import type {
  HistoryEntry,
  MetadataSyncRecoveryEntry,
  TrashEntry,
} from './activity'
import type { NativeBookmarkSnapshotNode } from './backup'
import type { BookmarkTreeNode } from './bookmark-tree'
import type { LocalizedText } from './i18n'
import type { SettingsSlice } from './store-settings-state'
import type {
  Bookmark,
  BookmarkMeta,
  BookmarkUsage,
  Category,
  CategoryMeta,
  Settings,
} from './types'

import { create } from 'zustand'
import {
  historyStorageKey,
  metadataSyncRecoveryRetentionMs,
  metadataSyncRecoveryStorageKey,
  pruneHistory,
  pruneMetadataSyncRecovery,
  pruneTrash,
  summarizeMetadataChanges,
  trashRetentionMs,
  trashStorageKey,
} from './activity'
import {
  createFullBookmarkSnapshot,
  createYunjiTabBackup,
  parseFullBookmarkSnapshot,
  parseYunjiTabBackup,
} from './backup'
import {
  releaseBookmarkDeletionArchive,
  suppressBookmarkDeletionArchive,
} from './bookmark-deletion-safety'
import { assertBookmarksApi, bookmarkApi } from './bookmark-repository'
import {
  bookmarkTreeContainsNode,
  loadBookmarkTreeData,
  toNodeId,
} from './bookmark-tree'
import { normalizeAlternateBookmarkUrls } from './bookmark-urls'
import { mergeBookmarkUsageMaps } from './bookmark-usage'
import { findCategoryByPath } from './category-path'
import { createCoalescedAsyncRunner } from './coalesced-async'
import { DEFAULT_CATEGORY_EMOJI, isVirtualCategoryId } from './default-data'
import {
  getDescriptionSyncStatus,
} from './description-sync'
import { localizedMessage } from './i18n'
import { LocalizedError, localizedErrorMessage } from './localized-error'
import {
  applyMaterializedBookmarkMetadata,
  clearMetadataSyncStorage,
  isMetadataSyncWriteQuotaError,
  markLocalMetadataChanged,
  synchronizeMetadata,
} from './metadata-sync'
import { fetchSiteDescription } from './site-metadata'
import {
  metaStorage,
  persist,
  registerSupplementaryPersisted,
  settingsStorage,
  STORAGE_KEYS,
} from './store-persistence'
import { createSettingsSlice } from './store-settings-slice'
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  resolveAvailableCategoryId,
} from './store-settings-state'
import { isLegacyFaviconUrl } from './utils'

// 新建书签/文件夹的默认父级：书签栏
const DEFAULT_PARENT_ID = '1'
const DESCRIPTION_FETCH_CONCURRENCY = 3
const MAX_DESCRIPTION_LENGTH = 300
const UNDO_WINDOW_MS = 10_000
export const metadataAutoSyncDelayMs = 30_000
export const usagePersistDelayMs = 500
const METADATA_SYNC_QUOTA_BACKOFF_BASE_MS = 5 * 60_000
const METADATA_SYNC_QUOTA_BACKOFF_MAX_MS = 60 * 60_000

let descriptionSyncPromise: Promise<DescriptionSyncResult> | undefined
let deletionSnapshot: DeletionSnapshot | undefined
let deletionTimer: ReturnType<typeof setTimeout> | undefined
let metadataSyncTimer: ReturnType<typeof setTimeout> | undefined
let metadataSyncPromise: Promise<void> | undefined
let metadataSyncQuotaFailures = 0
let runScheduledMetadataSync: () => void = () => {}
let scheduleUsagePersist: () => void = () => {}
const runBookmarkLoad = createCoalescedAsyncRunner()

function scheduleMetadataSync(
  delayMs = metadataAutoSyncDelayMs,
  replaceExisting = false,
): void {
  if (metadataSyncTimer) {
    if (!replaceExisting)
      return
    clearTimeout(metadataSyncTimer)
  }
  metadataSyncTimer = setTimeout(() => {
    metadataSyncTimer = undefined
    runScheduledMetadataSync()
  }, delayMs)
}

interface DeletionSnapshot {
  label: LocalizedText
  roots: BookmarkTreeNode[]
  categoryMeta: Record<string, CategoryMeta>
  defaultCategoryId?: string
}

export interface PendingDeletion {
  label: LocalizedText
  expiresAt: number
  restoring: boolean
  restoreFailed?: boolean
}

export interface BackupImportResult {
  bookmarkMetaCount: number
  categoryMetaCount: number
  usageCount: number
}

export interface FullBackupRestoreResult extends BackupImportResult {
  restoredFolderName: string
  restoredNodeCount: number
}

export interface TrashRestoreResult {
  restoredRootCount: number
  remainingRootCount: number
  failedRootCount: number
}

async function restoreBookmarkTree(
  node: BookmarkTreeNode,
  parentId: string,
  categoryIdMap: Map<string, string>,
): Promise<string> {
  const restored = await bookmarkApi.create({
    parentId,
    index: node.index,
    title: node.title,
    url: node.url,
  })
  if (!node.url) {
    categoryIdMap.set(`cat-${node.id}`, `cat-${restored.id}`)
  }
  try {
    for (const child of node.children ?? []) {
      // Restore siblings in source order and stop before creating later nodes on failure.
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      await restoreBookmarkTree(child, restored.id, categoryIdMap)
    }
    return restored.id
  }
  catch (cause) {
    try {
      await suppressBookmarkDeletionArchive([restored.id])
      if (node.url)
        await bookmarkApi.remove(restored.id)
      else
        await bookmarkApi.removeTree(restored.id)
    }
    catch {
      // Preserve the original restore failure; the trash entry remains retryable.
    }
    throw cause
  }
}

async function removeNativeBookmark(id: string, tree = false): Promise<void> {
  await suppressBookmarkDeletionArchive([id])
  try {
    if (tree)
      await bookmarkApi.removeTree(id)
    else
      await bookmarkApi.remove(id)
  }
  catch (cause) {
    await releaseBookmarkDeletionArchive([id])
    throw cause
  }
}

async function restoreSnapshotNode(
  node: NativeBookmarkSnapshotNode,
  parentId: string,
  path: string[],
  categoryIdByPath: Map<string, string>,
): Promise<number> {
  // Creation is the required side effect for URL nodes even though their result ID is unused.
  // react-doctor-disable-next-line react-doctor/async-defer-await
  const restored = await chrome.bookmarks.create({
    parentId,
    title: node.title || node.url || '',
    url: node.url,
  })
  if (node.url)
    return 1

  const nextPath = [...path, node.title]
  categoryIdByPath.set(JSON.stringify(nextPath), `cat-${restored.id}`)
  let count = 1
  for (const child of node.children ?? []) {
    // Child creation is ordered so browser bookmark indices remain deterministic.
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    count += await restoreSnapshotNode(
      child,
      restored.id,
      nextPath,
      categoryIdByPath,
    )
  }
  return count
}

function beginUndoWindow(
  snapshot: DeletionSnapshot,
  update: (pending: PendingDeletion | null) => void,
): void {
  if (deletionTimer)
    clearTimeout(deletionTimer)
  deletionSnapshot = snapshot
  update({
    label: snapshot.label,
    expiresAt: Date.now() + UNDO_WINDOW_MS,
    restoring: false,
  })
  deletionTimer = setTimeout(() => {
    deletionSnapshot = undefined
    deletionTimer = undefined
    update(null)
  }, UNDO_WINDOW_MS)
}

async function forEachConcurrent<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0
  const worker = async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex]
      nextIndex += 1
      await task(item)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )
}

// 分类 id → 浏览器书签 parentId；"all" 回退到书签栏
function resolveParentId(categoryId: string): string {
  return categoryId && categoryId !== 'all'
    ? toNodeId(categoryId)
    : DEFAULT_PARENT_ID
}

// 按元数据表（url 索引）为书签补充描述/图标
function applyMeta(
  bookmarks: Bookmark[],
  meta: Record<string, BookmarkMeta>,
): Bookmark[] {
  return bookmarks.map((b) => {
    const m = meta[b.url]
    if (!m)
      return b
    return {
      ...b,
      description: m.description ?? b.description,
      icon: m.icon ?? b.icon,
      alternateUrls: m.alternateUrls ?? b.alternateUrls,
      pinnedAt: m.pinnedAt ?? b.pinnedAt,
      tags: m.tags ?? b.tags,
      inboxAt: m.inboxAt ?? b.inboxAt,
    }
  })
}

export function mergeAlternateUrlsForDuplicate(
  existing: string[] | undefined,
  candidates: string[],
  primaryUrl: string,
): string[] {
  return normalizeAlternateBookmarkUrls(
    [...(existing ?? []), ...candidates],
    primaryUrl,
  )
}

function applyMetaForUrl(
  bookmarks: Bookmark[],
  url: string,
  meta: BookmarkMeta | undefined,
): Bookmark[] {
  return bookmarks.map(bookmark => bookmark.url === url
    ? {
        ...bookmark,
        description: meta?.description,
        icon: meta?.icon,
        alternateUrls: meta?.alternateUrls,
        pinnedAt: meta?.pinnedAt,
        tags: meta?.tags,
        inboxAt: meta?.inboxAt,
      }
    : bookmark)
}

function applyCategoryMeta(
  categories: Category[],
  categoryMeta: Record<string, CategoryMeta>,
): Category[] {
  return categories.map(category => ({
    ...category,
    emoji: categoryMeta[category.id]?.emoji ?? category.emoji,
  }))
}

function collectCategoryIds(
  rootId: string,
  categories: Category[],
): Set<string> {
  const ids = new Set([rootId])
  let previousSize = 0

  while (ids.size !== previousSize) {
    previousSize = ids.size
    for (const category of categories) {
      if (ids.has(category.parentId))
        ids.add(category.id)
    }
  }

  return ids
}

function getMutableCategory(id: string, categories: Category[]): Category {
  const category = categories.find(candidate => candidate.id === id)
  if (!category)
    throw new Error('category.not_found')
  if (!category.modifiable)
    throw new Error('category.browser_root_readonly')
  return category
}

async function assertNativeCategoryMoveAllowed(
  sourceId: string,
  destinationId: string,
): Promise<void> {
  const sourceNodeId = toNodeId(sourceId)
  const destinationNodeId = toNodeId(destinationId)
  const [sourceTree] = await bookmarkApi.getSubTree(sourceNodeId)
  if (!sourceTree)
    throw new Error('category.not_found')
  if (bookmarkTreeContainsNode(sourceTree, destinationNodeId)) {
    throw new Error('category.circular_move')
  }

  const [destination] = await bookmarkApi.get(destinationNodeId)
  if (!destination || destination.url) {
    throw new Error('category.target_not_found')
  }
}

function removeLegacyFaviconMeta(meta: Record<string, BookmarkMeta>): {
  meta: Record<string, BookmarkMeta>
  changed: boolean
} {
  const cleaned = { ...meta }
  let changed = false

  for (const [url, bookmarkMeta] of Object.entries(cleaned)) {
    if (!isLegacyFaviconUrl(bookmarkMeta.icon))
      continue
    changed = true
    const { icon: _icon, ...next } = bookmarkMeta
    if (next.description || next.alternateUrls?.length || next.pinnedAt
      || next.tags?.length || next.inboxAt) {
      cleaned[url] = next
    }
    else {
      delete cleaned[url]
    }
  }

  return { meta: cleaned, changed }
}

export interface DescriptionSyncResult {
  attempted: number
  updated: number
}

export interface MetadataSyncStatus {
  state: 'idle' | 'syncing' | 'success' | 'error'
  direction?: 'downloaded' | 'uploaded' | 'merged' | 'unchanged'
  syncedAt?: number
  byteCount?: number
  omittedBookmarkCount?: number
  retryCount?: number
  error?: LocalizedText
}

export interface MetadataSyncLogEntry {
  id: string
  createdAt: number
  state: 'success' | 'error'
  direction?: MetadataSyncStatus['direction']
  retryCount: number
  message: LocalizedText
}

export interface BackgroundTask {
  id: string
  type: 'metadata-sync' | 'description-sync' | 'health-check' | 'trash-restore' | 'backup'
  label: LocalizedText
  state: 'running' | 'success' | 'error'
  completed: number
  total?: number
  message?: LocalizedText
  startedAt: number
  finishedAt?: number
}

export interface NavState extends SettingsSlice {
  categories: Category[]
  bookmarks: Bookmark[]
  // 浏览器书签没有描述/图标字段，使用按 URL 索引的本地元数据补充
  meta: Record<string, BookmarkMeta>
  categoryMeta: Record<string, CategoryMeta>
  usage: Record<string, BookmarkUsage>

  activeCategoryId: string
  bookmarkSearchQuery: string
  settings: Settings
  pendingDeletion: PendingDeletion | null
  initialized: boolean
  metadataSyncStatus: MetadataSyncStatus
  metadataSyncLog: MetadataSyncLogEntry[]
  metadataSyncPassphraseSet: boolean
  metadataSyncRecovery: MetadataSyncRecoveryEntry[]
  tasks: BackgroundTask[]
  trash: TrashEntry[]
  history: HistoryEntry[]

  init: () => Promise<void>
  loadBookmarks: () => Promise<void>
  /** 手动同步当前缺失的书签描述，同一时间只运行一个任务 */
  syncMissingDescriptions: () => Promise<DescriptionSyncResult>
  syncBookmarkDescriptions: (ids: string[]) => Promise<DescriptionSyncResult>
  /** 新建浏览器书签文件夹，同名文件夹直接复用 */
  addCategory: (name: string, emoji?: string) => Promise<string>
  updateCategory: (
    id: string,
    patch: { name?: string, emoji?: string, parentId?: string },
  ) => Promise<void>
  removeCategory: (id: string) => Promise<void>
  undoLastDeletion: () => Promise<void>
  /** 更新某 URL 的描述/图标元数据 */
  setBookmarkMeta: (url: string, patch: Partial<BookmarkMeta>) => Promise<void>
  setBookmarkPinned: (url: string, pinned: boolean) => Promise<void>
  setBookmarkTags: (url: string, tags: string[]) => Promise<void>
  markBookmarksOrganized: (ids: string[]) => Promise<void>
  setActiveCategory: (id: string) => void
  setBookmarkSearchQuery: (query: string) => void
  addBookmark: (bookmark: Omit<Bookmark, 'id'>) => Promise<void>
  updateBookmark: (
    id: string,
    patch: Partial<Omit<Bookmark, 'id'>>,
  ) => Promise<void>
  reconcileBookmarkUrlChange: (nativeId: string, url: string) => Promise<void>
  removeBookmark: (id: string) => Promise<void>
  moveBookmarks: (ids: string[], categoryId: string) => Promise<void>
  reorderBookmark: (id: string, targetId: string) => Promise<void>
  reorderPinnedBookmark: (id: string, targetId: string) => Promise<void>
  removeBookmarks: (ids: string[]) => Promise<void>
  recordBookmarkOpen: (url: string) => Promise<void>
  exportBackup: () => string
  importBackup: (raw: string, strategy?: 'merge' | 'replace' | 'skip') => Promise<BackupImportResult>
  exportFullBackup: () => Promise<string>
  restoreFullBackup: (raw: string) => Promise<FullBackupRestoreResult>
  syncMetadataNow: () => Promise<void>
  restoreMetadataSyncRecovery: (id: string) => Promise<boolean>
  removeMetadataSyncRecovery: (id: string) => Promise<void>
  persistDeletion: (snapshot: DeletionSnapshot) => Promise<void>
  recordActivity: (action: HistoryEntry['action'], label: LocalizedText) => Promise<void>
  restoreTrashEntry: (id: string) => Promise<TrashRestoreResult>
  removeTrashEntry: (id: string) => Promise<void>
  clearHistory: () => Promise<void>
  clearUsage: () => Promise<void>
  clearTrash: () => Promise<void>
  clearMetadataSyncRecovery: () => Promise<void>
  clearSupplementaryMetadata: () => Promise<void>
  beginTask: (task: Pick<BackgroundTask, 'id' | 'type' | 'label' | 'total'>) => void
  updateTask: (id: string, patch: Partial<Pick<BackgroundTask, 'completed' | 'total' | 'message'>>) => void
  finishTask: (id: string, state: 'success' | 'error', message?: LocalizedText) => void
  clearFinishedTasks: () => void
}

export const useNavStore = create<NavState>()((set, get, store) => ({
  categories: [],
  bookmarks: [],
  meta: {},
  categoryMeta: {},
  usage: {},

  activeCategoryId: 'all',
  bookmarkSearchQuery: '',
  settings: DEFAULT_SETTINGS,
  pendingDeletion: null,
  initialized: false,
  metadataSyncStatus: { state: 'idle' },
  metadataSyncLog: [],
  metadataSyncPassphraseSet: false,
  metadataSyncRecovery: [],
  tasks: [],
  trash: [],
  history: [],

  init: async () => {
    if (get().initialized)
      return
    try {
      const [
        meta,
        categoryMeta,
        settings,
        usage,
        trash,
        history,
        metadataSyncLog,
        metadataSyncPassphrase,
        metadataSyncRecovery,
        tasks,
      ] = await Promise.all([
        metaStorage.get<Record<string, BookmarkMeta>>(STORAGE_KEYS.meta),
        metaStorage.get<Record<string, CategoryMeta>>(
          STORAGE_KEYS.categoryMeta,
        ),
        settingsStorage.get<Settings>(STORAGE_KEYS.settings),
        metaStorage.get<Record<string, BookmarkUsage>>(STORAGE_KEYS.usage),
        metaStorage.get<unknown>(trashStorageKey),
        metaStorage.get<unknown>(historyStorageKey),
        metaStorage.get<MetadataSyncLogEntry[]>(STORAGE_KEYS.metadataSyncLog),
        metaStorage.get<string>(STORAGE_KEYS.metadataSyncPassphrase),
        metaStorage.get<unknown>(metadataSyncRecoveryStorageKey),
        metaStorage.get<BackgroundTask[]>(STORAGE_KEYS.tasks),
      ])
      const normalizedMeta = removeLegacyFaviconMeta(meta ?? {})
      set({
        meta: normalizedMeta.meta,
        categoryMeta: categoryMeta ?? {},
        usage: usage ?? {},
        settings: normalizeSettings(settings),
        trash: pruneTrash(trash),
        history: pruneHistory(history),
        metadataSyncLog: Array.isArray(metadataSyncLog)
          ? metadataSyncLog.slice(0, 20)
          : [],
        metadataSyncPassphraseSet: typeof metadataSyncPassphrase === 'string'
          && metadataSyncPassphrase.length > 0,
        metadataSyncRecovery: pruneMetadataSyncRecovery(metadataSyncRecovery),
        tasks: Array.isArray(tasks)
          ? tasks.filter(task => task?.state !== 'running').slice(0, 50)
          : [],
        initialized: true,
      })
      if (normalizedMeta.changed) {
        void persist(metaStorage, STORAGE_KEYS.meta, normalizedMeta.meta)
      }
    }
    catch {
      // storage 不可用时仍可读取浏览器书签，保证页面始终可用。
      set({ settings: DEFAULT_SETTINGS, initialized: true })
    }
  },

  loadBookmarks: () => runBookmarkLoad(async () => {
    const { categories, bookmarks } = await loadBookmarkTreeData()
    const activeCategoryId = resolveAvailableCategoryId(
      get().activeCategoryId,
      categories,
    )
    set({
      categories: applyCategoryMeta(categories, get().categoryMeta),
      bookmarks: applyMeta(bookmarks, get().meta),
      activeCategoryId,
    })
  }),

  syncMetadataNow: () => {
    if (typeof chrome === 'undefined' || !chrome.storage?.sync)
      return Promise.resolve()
    if (metadataSyncPromise)
      return metadataSyncPromise
    if (metadataSyncTimer) {
      clearTimeout(metadataSyncTimer)
      metadataSyncTimer = undefined
    }

    metadataSyncPromise = (async () => {
      get().beginTask({
        id: 'metadata-sync',
        type: 'metadata-sync',
        label: localizedMessage('runtimeMetadataSyncTask'),
      })
      set({ metadataSyncStatus: { state: 'syncing' } })
      try {
        const encryptionPassphrase = get().settings.metadataSyncEncryptionEnabled
          ? (await metaStorage.get<string>(STORAGE_KEYS.metadataSyncPassphrase))?.trim()
          : undefined
        if (get().settings.metadataSyncEncryptionEnabled && !encryptionPassphrase) {
          throw new LocalizedError('runtimeMetadataPassphraseRequired')
        }
        const metadataAtSyncStart = get().meta
        const result = await synchronizeMetadata({
          meta: metadataAtSyncStart,
          categoryMeta: get().categoryMeta,
          categories: get().categories,
          scope: get().settings.metadataSyncScope,
          encryptionPassphrase,
        })
        if (result.direction === 'downloaded' || result.direction === 'merged') {
          const previousMeta = get().meta
          const previousCategoryMeta = get().categoryMeta
          const categoryMeta: Record<string, CategoryMeta> = {}
          if (get().settings.metadataSyncScope.categoryIcons) {
            for (const item of result.document.categoryMeta) {
              const category = findCategoryByPath(item.path, get().categories)
              if (category)
                categoryMeta[category.id] = { emoji: item.emoji }
            }
          }
          else {
            Object.assign(categoryMeta, previousCategoryMeta)
          }
          const meta = applyMaterializedBookmarkMetadata(
            previousMeta,
            result.document.bookmarkMeta,
            get().settings.metadataSyncScope,
            {
              baseline: metadataAtSyncStart,
              omittedUrls: result.omittedBookmarkUrls,
            },
          )
          const summary = summarizeMetadataChanges(
            previousMeta,
            meta,
            previousCategoryMeta,
            categoryMeta,
          )
          const totalChanges = summary.changedBookmarkCount + summary.changedCategoryCount
          let metadataSyncRecovery = get().metadataSyncRecovery
          if (totalChanges > 0) {
            const createdAt = Date.now()
            const recovery: MetadataSyncRecoveryEntry = {
              id: crypto.randomUUID(),
              label: localizedMessage(
                'runtimeMetadataRecoveryLabel',
                {
                  bookmarks: summary.changedBookmarkCount,
                  categories: summary.changedCategoryCount,
                  removed: summary.removedFieldCount,
                },
              ),
              createdAt,
              expiresAt: createdAt + metadataSyncRecoveryRetentionMs,
              direction: result.direction,
              bookmarkMeta: structuredClone(previousMeta),
              categoryMeta: structuredClone(previousCategoryMeta),
              ...summary,
            }
            metadataSyncRecovery = [
              recovery,
              ...pruneMetadataSyncRecovery(metadataSyncRecovery),
            ].slice(0, 20)
            // The recovery point must be durable before remote values replace local data.
            await metaStorage.set(metadataSyncRecoveryStorageKey, metadataSyncRecovery)
          }
          await Promise.all([
            metaStorage.set(STORAGE_KEYS.meta, meta),
            metaStorage.set(STORAGE_KEYS.categoryMeta, categoryMeta),
          ])
          set({
            meta,
            categoryMeta,
            metadataSyncRecovery,
            bookmarks: applyMeta(get().bookmarks, meta),
            categories: applyCategoryMeta(get().categories, categoryMeta),
          })
          if (totalChanges > 0) {
            await get().recordActivity(
              'sync',
              localizedMessage('runtimeMetadataSyncUpdated', {
                count: totalChanges,
              }),
            )
          }
        }
        metadataSyncQuotaFailures = 0
        set({
          metadataSyncStatus: {
            state: 'success',
            direction: result.direction,
            syncedAt: result.syncedAt,
            byteCount: result.byteCount,
            omittedBookmarkCount: result.omittedBookmarkCount,
            retryCount: result.retryCount,
          },
        })
        const log: MetadataSyncLogEntry = {
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          state: 'success',
          direction: result.direction,
          retryCount: result.retryCount,
          message: result.direction === 'merged'
            ? localizedMessage('runtimeMetadataSyncMerged')
            : localizedMessage('runtimeMetadataSyncComplete'),
        }
        const metadataSyncLog = [log, ...get().metadataSyncLog].slice(0, 20)
        set({ metadataSyncLog })
        await metaStorage.set(STORAGE_KEYS.metadataSyncLog, metadataSyncLog)
        get().finishTask('metadata-sync', 'success', log.message)
      }
      catch (cause) {
        const quotaLimited = isMetadataSyncWriteQuotaError(cause)
        let message: LocalizedText = localizedErrorMessage(
          cause,
          'runtimeMetadataSyncFailed',
        )
        if (quotaLimited) {
          metadataSyncQuotaFailures += 1
          const backoffMs = Math.min(
            METADATA_SYNC_QUOTA_BACKOFF_BASE_MS * 2 ** (metadataSyncQuotaFailures - 1),
            METADATA_SYNC_QUOTA_BACKOFF_MAX_MS,
          )
          scheduleMetadataSync(backoffMs, true)
          message = localizedMessage(
            'runtimeMetadataSyncPaused',
            {
              minutes: Math.ceil(backoffMs / 60_000),
            },
          )
        }
        const retryCount = quotaLimited ? 0 : 2
        set({
          metadataSyncStatus: {
            state: 'error',
            retryCount,
            error: message,
          },
        })
        const failureLog: MetadataSyncLogEntry = {
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          state: 'error',
          retryCount,
          message,
        }
        const metadataSyncLog = [failureLog, ...get().metadataSyncLog].slice(0, 20)
        set({ metadataSyncLog })
        await metaStorage.set(STORAGE_KEYS.metadataSyncLog, metadataSyncLog)
        get().finishTask('metadata-sync', 'error', message)
      }
    })().finally(() => {
      metadataSyncPromise = undefined
    })

    return metadataSyncPromise
  },

  restoreMetadataSyncRecovery: async (id) => {
    const recovery = get().metadataSyncRecovery.find(item => item.id === id)
    if (!recovery)
      return false
    const meta = structuredClone(recovery.bookmarkMeta)
    const categoryMeta = structuredClone(recovery.categoryMeta)
    await Promise.all([
      persist(metaStorage, STORAGE_KEYS.meta, meta),
      persist(metaStorage, STORAGE_KEYS.categoryMeta, categoryMeta),
    ])
    const metadataSyncRecovery = get().metadataSyncRecovery.filter(item => item.id !== id)
    await metaStorage.set(metadataSyncRecoveryStorageKey, metadataSyncRecovery)
    set({
      meta,
      categoryMeta,
      metadataSyncRecovery,
      bookmarks: applyMeta(get().bookmarks, meta),
      categories: applyCategoryMeta(get().categories, categoryMeta),
    })
    await get().recordActivity(
      'restore',
      localizedMessage('runtimeMetadataRestoreActivity'),
    )
    return true
  },

  removeMetadataSyncRecovery: async (id) => {
    const metadataSyncRecovery = get().metadataSyncRecovery.filter(item => item.id !== id)
    set({ metadataSyncRecovery })
    await metaStorage.set(metadataSyncRecoveryStorageKey, metadataSyncRecovery)
  },

  beginTask: (task) => {
    const next: BackgroundTask = {
      ...task,
      state: 'running',
      completed: 0,
      startedAt: Date.now(),
    }
    const tasks = [next, ...get().tasks.filter(item => item.id !== task.id)].slice(0, 50)
    set({ tasks })
    void metaStorage.set(STORAGE_KEYS.tasks, tasks)
  },

  updateTask: (id, patch) => {
    const tasks = get().tasks.map(task => task.id === id ? { ...task, ...patch } : task)
    set({ tasks })
    void metaStorage.set(STORAGE_KEYS.tasks, tasks)
  },

  finishTask: (id, state, message) => {
    const tasks = get().tasks.map(task => task.id === id
      ? {
          ...task,
          state,
          completed: state === 'success' ? (task.total ?? task.completed) : task.completed,
          message,
          finishedAt: Date.now(),
        }
      : task)
    set({ tasks })
    void metaStorage.set(STORAGE_KEYS.tasks, tasks)
  },

  clearFinishedTasks: () => {
    const tasks = get().tasks.filter(task => task.state === 'running')
    set({ tasks })
    void metaStorage.set(STORAGE_KEYS.tasks, tasks)
  },

  recordActivity: async (action, label) => {
    const history = [{
      id: crypto.randomUUID(),
      action,
      label,
      createdAt: Date.now(),
    }, ...get().history].slice(0, 200)
    set({ history })
    await metaStorage.set(historyStorageKey, history)
  },

  persistDeletion: async (snapshot) => {
    const deletedAt = Date.now()
    const trash = [{
      id: crypto.randomUUID(),
      ...snapshot,
      deletedAt,
      expiresAt: deletedAt + trashRetentionMs,
    }, ...pruneTrash(get().trash)].slice(0, 100)
    set({ trash })
    await Promise.all([
      metaStorage.set(trashStorageKey, trash),
      get().recordActivity('delete', snapshot.label),
    ])
  },

  restoreTrashEntry: async (id) => {
    assertBookmarksApi()
    const entry = get().trash.find(item => item.id === id)
    if (!entry)
      return { restoredRootCount: 0, remainingRootCount: 0, failedRootCount: 0 }
    get().beginTask({
      id: `trash-restore:${id}`,
      type: 'trash-restore',
      label: localizedMessage('runtimeRestoreTask'),
      total: entry.roots.length - (entry.restoredRootIndexes?.length ?? 0),
    })
    const categoryIdMap = new Map<string, string>()
    const completed = new Set(entry.restoredRootIndexes ?? [])
    let restoredRootCount = 0
    let failedRootCount = 0
    let restoreError: LocalizedText = ''
    for (const [index, root] of entry.roots.entries()) {
      if (completed.has(index))
        continue
      let parentId = root.parentId ?? DEFAULT_PARENT_ID
      try {
        const [parent] = await bookmarkApi.get(parentId)
        if (!parent || parent.url)
          parentId = DEFAULT_PARENT_ID
      }
      catch {
        parentId = DEFAULT_PARENT_ID
      }
      try {
        await restoreBookmarkTree(root, parentId, categoryIdMap)
        completed.add(index)
        restoredRootCount += 1
        get().updateTask(`trash-restore:${id}`, { completed: restoredRootCount })
        const trash = get().trash.map(item => item.id === id
          ? { ...item, restoredRootIndexes: [...completed], restoreError: undefined }
          : item)
        set({ trash })
        await metaStorage.set(trashStorageKey, trash)
      }
      catch (cause) {
        failedRootCount += 1
        restoreError = localizedErrorMessage(cause, 'runtimeRestoreFailed')
      }
    }
    const categoryMeta = { ...get().categoryMeta }
    for (const [oldId, meta] of Object.entries(entry.categoryMeta)) {
      const newId = categoryIdMap.get(oldId)
      if (newId)
        categoryMeta[newId] = meta
    }
    const remainingRootCount = entry.roots.length - completed.size
    const trash = remainingRootCount === 0
      ? get().trash.filter(item => item.id !== id)
      : get().trash.map(item => item.id === id
          ? { ...item, restoredRootIndexes: [...completed], restoreError }
          : item)
    set({ trash, categoryMeta })
    const operations: Array<Promise<unknown>> = [
      metaStorage.set(trashStorageKey, trash),
      persist(metaStorage, STORAGE_KEYS.categoryMeta, categoryMeta),
    ]
    if (restoredRootCount > 0)
      operations.push(get().recordActivity('restore', entry.label))
    await Promise.all(operations)
    await get().loadBookmarks()
    get().finishTask(
      `trash-restore:${id}`,
      remainingRootCount === 0 ? 'success' : 'error',
      remainingRootCount === 0
        ? localizedMessage('runtimeRestoreComplete')
        : localizedMessage('runtimeRestorePartial', {
            count: failedRootCount,
          }),
    )
    return { restoredRootCount, remainingRootCount, failedRootCount }
  },

  removeTrashEntry: async (id) => {
    const trash = get().trash.filter(item => item.id !== id)
    set({ trash })
    await metaStorage.set(trashStorageKey, trash)
  },

  clearHistory: async () => {
    set({ history: [] })
    await metaStorage.set(historyStorageKey, [])
  },

  clearUsage: async () => {
    set({ usage: {} })
    await metaStorage.set(STORAGE_KEYS.usage, {})
  },

  clearTrash: async () => {
    set({ trash: [] })
    await metaStorage.set(trashStorageKey, [])
  },

  clearMetadataSyncRecovery: async () => {
    set({ metadataSyncRecovery: [] })
    await metaStorage.set(metadataSyncRecoveryStorageKey, [])
  },

  clearSupplementaryMetadata: async () => {
    set({ meta: {}, categoryMeta: {}, metadataSyncRecovery: [] })
    await Promise.all([
      metaStorage.set(STORAGE_KEYS.meta, {}),
      metaStorage.set(STORAGE_KEYS.categoryMeta, {}),
      metaStorage.set(metadataSyncRecoveryStorageKey, []),
      clearMetadataSyncStorage(),
    ])
    await get().loadBookmarks()
  },

  syncMissingDescriptions: async () =>
    get().syncBookmarkDescriptions(
      get().bookmarks.map(bookmark => bookmark.id),
    ),

  syncBookmarkDescriptions: async (ids) => {
    if (descriptionSyncPromise)
      return descriptionSyncPromise

    descriptionSyncPromise = (async () => {
      const selectedIds = new Set(ids)
      const seen = new Set<string>()
      const targets = get().bookmarks.filter((bookmark) => {
        if (!selectedIds.has(bookmark.id))
          return false
        if (seen.has(bookmark.url)) {
          return false
        }
        seen.add(bookmark.url)
        return (
          getDescriptionSyncStatus(
            bookmark,
            get().settings.descriptionIgnoredDomains,
          ) === 'eligible'
        )
      })
      get().beginTask({
        id: 'description-sync',
        type: 'description-sync',
        label: localizedMessage('runtimeDescriptionTask'),
        total: targets.length,
      })

      let updated = 0
      let completed = 0
      await forEachConcurrent(
        targets,
        DESCRIPTION_FETCH_CONCURRENCY,
        async (bookmark) => {
          if (
            getDescriptionSyncStatus(
              bookmark,
              get().settings.descriptionIgnoredDomains,
            ) !== 'eligible'
          ) {
            return
          }

          try {
            const description = (await fetchSiteDescription(bookmark.url))
              ?.replace(/\s+/g, ' ')
              .trim()
              .slice(0, MAX_DESCRIPTION_LENGTH)
            if (!description)
              return

            const state = get()
            if (state.meta[bookmark.url]?.description)
              return
            const meta = {
              ...state.meta,
              [bookmark.url]: {
                ...state.meta[bookmark.url],
                description,
              },
            }
            updated += 1
            set({
              meta,
              bookmarks: applyMetaForUrl(
                state.bookmarks,
                bookmark.url,
                meta[bookmark.url],
              ),
            })
          }
          catch {
            // 单个站点失败不影响本次手动同步的其他书签。
          }
          finally {
            completed += 1
            get().updateTask('description-sync', {
              completed,
              message: localizedMessage(
                'runtimeDescriptionProgress',
                { count: updated },
              ),
            })
          }
        },
      )

      if (updated > 0)
        await persist(metaStorage, STORAGE_KEYS.meta, get().meta)
      return { attempted: targets.length, updated }
    })()

    try {
      const result = await descriptionSyncPromise
      get().finishTask(
        'description-sync',
        'success',
        localizedMessage('runtimeDescriptionComplete', {
          attempted: result.attempted,
          updated: result.updated,
        }),
      )
      return result
    }
    catch (cause) {
      get().finishTask(
        'description-sync',
        'error',
        localizedErrorMessage(cause, 'runtimeDescriptionFailed'),
      )
      throw cause
    }
    finally {
      descriptionSyncPromise = undefined
    }
  },

  addCategory: async (name, emoji) => {
    assertBookmarksApi()

    const trimmed = name.trim()
    const existing = get().categories.find(c => c.name === trimmed)
    if (existing)
      return existing.id
    if (!trimmed)
      throw new Error('category.name_required')

    const node = await bookmarkApi.create({
      parentId: DEFAULT_PARENT_ID,
      title: trimmed,
    })
    const categoryId = `cat-${node.id}`
    const normalizedEmoji = emoji?.trim()
    if (normalizedEmoji && normalizedEmoji !== DEFAULT_CATEGORY_EMOJI) {
      const categoryMeta = {
        ...get().categoryMeta,
        [categoryId]: { emoji: normalizedEmoji },
      }
      set({ categoryMeta })
      await persist(metaStorage, STORAGE_KEYS.categoryMeta, categoryMeta)
    }
    await get().loadBookmarks()
    return categoryId
  },

  updateCategory: async (id, patch) => {
    assertBookmarksApi()

    const categories = get().categories
    const category = getMutableCategory(id, categories)
    const nodeId = toNodeId(id)
    let destination: Category | undefined

    if (patch.parentId && patch.parentId !== category.parentId) {
      destination = categories.find(
        candidate => candidate.id === patch.parentId,
      )
      if (!destination)
        throw new Error('category.target_not_found')
      const unavailableIds = collectCategoryIds(id, categories)
      if (unavailableIds.has(destination.id)) {
        throw new Error('category.circular_move')
      }
      await assertNativeCategoryMoveAllowed(id, destination.id)
    }

    if (patch.name !== undefined) {
      const title = patch.name.trim()
      if (!title)
        throw new Error('category.name_required')
      if (title !== category.name) {
        await bookmarkApi.update(nodeId, { title })
      }
    }

    if (destination) {
      await bookmarkApi.move(nodeId, {
        parentId: toNodeId(destination.id),
      })
    }

    if (patch.emoji !== undefined) {
      const emoji = patch.emoji.trim() || DEFAULT_CATEGORY_EMOJI
      const categoryMeta = { ...get().categoryMeta }
      if (emoji === DEFAULT_CATEGORY_EMOJI) {
        delete categoryMeta[id]
      }
      else {
        categoryMeta[id] = { emoji }
      }
      set({ categoryMeta })
      await persist(metaStorage, STORAGE_KEYS.categoryMeta, categoryMeta)
    }

    await get().loadBookmarks()
  },

  removeCategory: async (id) => {
    assertBookmarksApi()

    const categories = get().categories
    const category = getMutableCategory(id, categories)
    const removedIds = collectCategoryIds(id, categories)
    const [root] = await bookmarkApi.getSubTree(toNodeId(id))
    if (!root?.parentId)
      throw new Error('category.not_found')
    const removedCategoryMeta = Object.fromEntries(
      [...removedIds].flatMap((removedId) => {
        const metadata = get().categoryMeta[removedId]
        return metadata ? [[removedId, metadata]] : []
      }),
    )
    const removedDefaultCategoryId = removedIds.has(
      get().settings.defaultCategoryId,
    )
      ? get().settings.defaultCategoryId
      : undefined
    await removeNativeBookmark(toNodeId(id), true)

    const categoryMeta = { ...get().categoryMeta }
    let categoryMetaChanged = false
    for (const removedId of removedIds) {
      if (!categoryMeta[removedId])
        continue
      delete categoryMeta[removedId]
      categoryMetaChanged = true
    }

    let settings = get().settings
    const settingsChanged = removedIds.has(settings.defaultCategoryId)
    if (settingsChanged) {
      settings = { ...settings, defaultCategoryId: 'all' }
    }

    set({ categoryMeta, settings })
    await Promise.allSettled([
      categoryMetaChanged
        ? persist(metaStorage, STORAGE_KEYS.categoryMeta, categoryMeta)
        : Promise.resolve(),
      settingsChanged
        ? persist(settingsStorage, STORAGE_KEYS.settings, settings)
        : Promise.resolve(),
    ])
    const snapshot = {
      label: localizedMessage('runtimeFolderLabel', {
        name: category.name,
      }),
      roots: [root],
      categoryMeta: removedCategoryMeta,
      defaultCategoryId: removedDefaultCategoryId,
    }
    await get().persistDeletion(snapshot)
    beginUndoWindow(
      snapshot,
      pendingDeletion => set({ pendingDeletion }),
    )
    await get().loadBookmarks()
  },

  undoLastDeletion: async () => {
    assertBookmarksApi()
    const snapshot = deletionSnapshot
    if (!snapshot)
      return
    if (deletionTimer)
      clearTimeout(deletionTimer)
    deletionTimer = undefined
    set(state => ({
      pendingDeletion: state.pendingDeletion
        ? { ...state.pendingDeletion, restoring: true }
        : null,
    }))

    const categoryIdMap = new Map<string, string>()
    try {
      for (const root of snapshot.roots) {
        // Sequential restoration keeps retry accounting aligned with completed roots.
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        await restoreBookmarkTree(
          root,
          root.parentId ?? DEFAULT_PARENT_ID,
          categoryIdMap,
        )
      }
    }
    catch (cause) {
      deletionSnapshot = undefined
      set(state => ({
        pendingDeletion: state.pendingDeletion
          ? { ...state.pendingDeletion, restoring: false, restoreFailed: true }
          : null,
      }))
      deletionTimer = setTimeout(() => {
        deletionTimer = undefined
        set({ pendingDeletion: null })
      }, 5_000)
      throw cause
    }

    const categoryMeta = { ...get().categoryMeta }
    for (const [oldId, meta] of Object.entries(snapshot.categoryMeta)) {
      const newId = categoryIdMap.get(oldId)
      if (newId)
        categoryMeta[newId] = meta
    }

    let settings = get().settings
    if (snapshot.defaultCategoryId) {
      const restoredDefaultId = categoryIdMap.get(snapshot.defaultCategoryId)
      if (restoredDefaultId) {
        settings = { ...settings, defaultCategoryId: restoredDefaultId }
      }
    }

    deletionSnapshot = undefined
    const trashEntry = get().trash.find(item => item.label === snapshot.label)
    if (trashEntry)
      await get().removeTrashEntry(trashEntry.id)
    await get().recordActivity('restore', snapshot.label)
    set({ categoryMeta, settings, pendingDeletion: null })
    await Promise.allSettled([
      persist(metaStorage, STORAGE_KEYS.categoryMeta, categoryMeta),
      persist(settingsStorage, STORAGE_KEYS.settings, settings),
    ])
    await get().loadBookmarks()
  },

  setBookmarkMeta: async (url, patch) => {
    if (!url)
      return
    const meta = { ...get().meta }
    const next = { ...(meta[url] ?? {}) }
    if (patch.description !== undefined) {
      next.description = patch.description || undefined
    }
    if (patch.icon !== undefined) {
      next.icon = patch.icon || undefined
    }
    if (patch.alternateUrls !== undefined) {
      next.alternateUrls = normalizeAlternateBookmarkUrls(
        patch.alternateUrls,
        url,
      )
      if (next.alternateUrls.length === 0) {
        next.alternateUrls = undefined
      }
    }
    if (patch.pinnedAt !== undefined) {
      next.pinnedAt = patch.pinnedAt > 0 ? patch.pinnedAt : undefined
    }
    if (patch.tags !== undefined) {
      next.tags = [...new Set(patch.tags.flatMap((tag) => {
        const normalized = tag.trim()
        return normalized ? [normalized] : []
      }))]
      if (next.tags.length === 0) {
        next.tags = undefined
      }
    }
    if (patch.inboxAt !== undefined) {
      next.inboxAt = patch.inboxAt > 0 ? patch.inboxAt : undefined
    }
    if (
      !next.description
      && !next.icon
      && !next.alternateUrls?.length
      && !next.pinnedAt
      && !next.tags?.length
      && !next.inboxAt
    ) {
      delete meta[url]
    }
    else {
      meta[url] = next
    }
    set({
      meta,
      bookmarks: applyMetaForUrl(get().bookmarks, url, meta[url]),
    })
    await persist(metaStorage, STORAGE_KEYS.meta, meta)
  },

  setBookmarkPinned: async (url, pinned) => {
    await get().setBookmarkMeta(url, { pinnedAt: pinned ? Date.now() : 0 })
  },

  setBookmarkTags: async (url, tags) => {
    await get().setBookmarkMeta(url, { tags })
  },

  markBookmarksOrganized: async (ids) => {
    const selectedIds = new Set(ids)
    const targets = get().bookmarks.filter(bookmark => selectedIds.has(bookmark.id))
    const meta = { ...get().meta }
    for (const bookmark of targets) {
      const next = { ...(meta[bookmark.url] ?? {}) }
      delete next.inboxAt
      if (!next.description && !next.icon && !next.alternateUrls?.length
        && !next.pinnedAt && !next.tags?.length) {
        delete meta[bookmark.url]
      }
      else {
        meta[bookmark.url] = next
      }
    }
    set({ meta, bookmarks: applyMeta(get().bookmarks, meta) })
    await persist(metaStorage, STORAGE_KEYS.meta, meta)
  },

  setActiveCategory: id => set({ activeCategoryId: id }),
  setBookmarkSearchQuery: query => set({ bookmarkSearchQuery: query }),

  addBookmark: async (bookmark) => {
    assertBookmarksApi()

    await bookmarkApi.create({
      parentId: resolveParentId(bookmark.categoryId),
      title: bookmark.name,
      url: bookmark.url,
    })
    const icon = bookmark.icon
    if (
      bookmark.description
      || icon
      || bookmark.alternateUrls?.length
      || bookmark.tags?.length
      || bookmark.inboxAt
    ) {
      await get().setBookmarkMeta(bookmark.url, {
        description: bookmark.description,
        icon,
        alternateUrls: bookmark.alternateUrls,
        tags: bookmark.tags,
        inboxAt: bookmark.inboxAt,
      })
    }
    await get().loadBookmarks()
    await get().recordActivity('add', bookmark.name)
  },

  updateBookmark: async (id, patch) => {
    assertBookmarksApi()

    const nodeId = toNodeId(id)
    const current = get().bookmarks.find(b => b.id === id)
    const changes: { title?: string, url?: string } = {}
    if (patch.name !== undefined)
      changes.title = patch.name
    if (patch.url !== undefined)
      changes.url = patch.url
    if (changes.title !== undefined || changes.url !== undefined) {
      await bookmarkApi.update(nodeId, changes)
    }
    if (patch.url && current && patch.url !== current.url) {
      await get().reconcileBookmarkUrlChange(nodeId, patch.url)
    }
    if (patch.categoryId && patch.categoryId !== 'all') {
      if (
        !get().categories.some(category => category.id === patch.categoryId)
      ) {
        throw new Error('category.target_not_found')
      }
      await chrome.bookmarks.move(nodeId, {
        parentId: resolveParentId(patch.categoryId),
      })
    }
    if (
      patch.description !== undefined
      || patch.icon !== undefined
      || patch.alternateUrls !== undefined
      || patch.tags !== undefined
      || patch.inboxAt !== undefined
    ) {
      const url = patch.url ?? current?.url ?? ''
      await get().setBookmarkMeta(url, {
        description: patch.description,
        icon: patch.icon,
        alternateUrls: patch.alternateUrls,
        tags: patch.tags,
        inboxAt: patch.inboxAt,
      })
    }
    await get().loadBookmarks()
    await get().recordActivity(
      'edit',
      current?.name
      ?? patch.name
      ?? localizedMessage('runtimeBookmarkFallback'),
    )
  },

  reconcileBookmarkUrlChange: async (nativeId, url) => {
    const id = `bm-${nativeId}`
    const current = get().bookmarks.find(bookmark => bookmark.id === id)
    if (!current || !url || current.url === url)
      return

    const meta = { ...get().meta }
    const previousMeta = meta[current.url]
    const oldUrlStillInUse = get().bookmarks.some(bookmark =>
      bookmark.id !== id && bookmark.url === current.url,
    )
    if (previousMeta) {
      meta[url] = { ...previousMeta, ...meta[url] }
      if (!oldUrlStillInUse)
        delete meta[current.url]
    }

    const usage = { ...get().usage }
    const previousUsage = usage[current.url]
    if (previousUsage && !oldUrlStillInUse) {
      const existingUsage = usage[url]
      usage[url] = existingUsage
        ? {
            openCount: existingUsage.openCount + previousUsage.openCount,
            lastOpenedAt: Math.max(
              existingUsage.lastOpenedAt,
              previousUsage.lastOpenedAt,
            ),
          }
        : previousUsage
      delete usage[current.url]
    }

    if (!previousMeta && !previousUsage)
      return
    set({ meta, usage })
    await Promise.all([
      previousMeta
        ? persist(metaStorage, STORAGE_KEYS.meta, meta)
        : Promise.resolve(),
      previousUsage && !oldUrlStillInUse
        ? persist(metaStorage, STORAGE_KEYS.usage, usage)
        : Promise.resolve(),
    ])
  },

  removeBookmark: async (id) => {
    assertBookmarksApi()

    const [node] = await bookmarkApi.get(toNodeId(id))
    if (!node?.parentId)
      throw new Error('bookmark.not_found')
    await removeNativeBookmark(node.id)
    const snapshot = {
      label: localizedMessage('runtimeBookmarkLabel', {
        name: node.title || node.url || '',
      }),
      roots: [node],
      categoryMeta: {},
    }
    await get().persistDeletion(snapshot)
    beginUndoWindow(
      snapshot,
      pendingDeletion => set({ pendingDeletion }),
    )
    await get().loadBookmarks()
  },

  moveBookmarks: async (ids, categoryId) => {
    assertBookmarksApi()
    if (!get().categories.some(category => category.id === categoryId)) {
      throw new Error('category.target_not_found')
    }
    const selectedIds = new Set(ids)
    const targets = get().bookmarks.filter(bookmark =>
      selectedIds.has(bookmark.id),
    )
    await Promise.all(
      targets.map(bookmark =>
        bookmarkApi.move(toNodeId(bookmark.id), {
          parentId: resolveParentId(categoryId),
        }),
      ),
    )
    await get().markBookmarksOrganized(ids)
    await get().loadBookmarks()
    await get().recordActivity(
      'move',
      localizedMessage('runtimeBookmarkCountLabel', {
        count: targets.length,
      }),
    )
  },

  reorderBookmark: async (id, targetId) => {
    assertBookmarksApi()
    const bookmark = get().bookmarks.find(item => item.id === id)
    const target = get().bookmarks.find(item => item.id === targetId)
    if (!bookmark || !target || bookmark.id === target.id)
      return
    if (bookmark.categoryId !== target.categoryId)
      throw new Error('bookmark.reorder_cross_category')
    if (Boolean(bookmark.pinnedAt) !== Boolean(target.pinnedAt))
      throw new Error('bookmark.reorder_pin_boundary')
    const sourceIndex = bookmark.index ?? 0
    const targetIndex = target.index ?? 0
    await bookmarkApi.move(toNodeId(id), {
      parentId: resolveParentId(bookmark.categoryId),
      index: targetIndex + (sourceIndex < targetIndex ? 1 : 0),
    })
    await get().loadBookmarks()
    await get().recordActivity('move', bookmark.name)
  },

  reorderPinnedBookmark: async (id, targetId) => {
    const bookmarks = get().bookmarks
    const bookmark = bookmarks.find(item => item.id === id)
    const target = bookmarks.find(item => item.id === targetId)
    if (!bookmark?.pinnedAt || !target?.pinnedAt || bookmark.url === target.url)
      return
    const pinnedByUrl = new Map<string, Bookmark>()
    for (const item of bookmarks) {
      if (item.pinnedAt && !pinnedByUrl.has(item.url))
        pinnedByUrl.set(item.url, item)
    }
    const pinned = [...pinnedByUrl.values()]
      .toSorted((left, right) => (right.pinnedAt ?? 0) - (left.pinnedAt ?? 0))
    const sourceIndex = pinned.findIndex(item => item.url === bookmark.url)
    const targetIndex = pinned.findIndex(item => item.url === target.url)
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex)
      return
    const [moved] = pinned.splice(sourceIndex, 1)
    if (!moved)
      return
    pinned.splice(targetIndex, 0, moved)

    const previousMeta = get().meta
    const meta = { ...previousMeta }
    const ranks = new Map<string, number>()
    const topRank = Date.now() + pinned.length
    pinned.forEach((item, index) => {
      const pinnedAt = topRank - index
      ranks.set(item.url, pinnedAt)
      meta[item.url] = { ...(meta[item.url] ?? {}), pinnedAt }
    })
    const reorderedBookmarks = get().bookmarks.map((item) => {
      const pinnedAt = ranks.get(item.url)
      return pinnedAt === undefined || pinnedAt === item.pinnedAt
        ? item
        : { ...item, pinnedAt }
    })
    set({
      meta,
      bookmarks: reorderedBookmarks,
    })
    try {
      await persist(metaStorage, STORAGE_KEYS.meta, meta)
    }
    catch (cause) {
      set(state => state.meta === meta
        ? {
            meta: previousMeta,
            bookmarks: state.bookmarks === reorderedBookmarks
              ? bookmarks
              : state.bookmarks.map((item) => {
                  const pinnedAt = ranks.has(item.url)
                    ? previousMeta[item.url]?.pinnedAt
                    : item.pinnedAt
                  return pinnedAt === item.pinnedAt
                    ? item
                    : { ...item, pinnedAt }
                }),
          }
        : state)
      throw cause
    }
    await get().recordActivity('move', bookmark.name)
  },

  removeBookmarks: async (ids) => {
    assertBookmarksApi()
    const nodeIds = [...new Set(ids.map(toNodeId))]
    if (nodeIds.length === 0)
      return
    const nodes = (await bookmarkApi.get(nodeIds as [string, ...string[]]))
      .filter(node => node.url && node.parentId)
      .sort(
        (left, right) =>
          (left.parentId ?? '').localeCompare(right.parentId ?? '')
          || (left.index ?? 0) - (right.index ?? 0),
      )
    if (nodes.length === 0)
      return
    await suppressBookmarkDeletionArchive(nodes.map(node => node.id))
    try {
      await Promise.all(nodes.map(node => bookmarkApi.remove(node.id)))
    }
    catch (cause) {
      await releaseBookmarkDeletionArchive(nodes.map(node => node.id))
      throw cause
    }
    const snapshot = {
      label: nodes.length === 1
        ? localizedMessage('runtimeBookmarkLabel', {
            name: nodes[0].title || nodes[0].url || '',
          })
        : localizedMessage('runtimeBookmarkCountLabel', {
            count: nodes.length,
          }),
      roots: nodes,
      categoryMeta: {},
    }
    await get().persistDeletion(snapshot)
    beginUndoWindow(
      snapshot,
      pendingDeletion => set({ pendingDeletion }),
    )
    await get().loadBookmarks()
  },

  recordBookmarkOpen: async (url) => {
    const persistedUsage = await metaStorage.get<Record<string, BookmarkUsage>>(
      STORAGE_KEYS.usage,
    )
    const mergedUsage = mergeBookmarkUsageMaps(persistedUsage, get().usage)
    const current = mergedUsage[url]
    const usage = {
      ...mergedUsage,
      [url]: {
        openCount: (current?.openCount ?? 0) + 1,
        lastOpenedAt: Date.now(),
      },
    }
    set({ usage })
    scheduleUsagePersist()
  },

  exportBackup: () =>
    JSON.stringify(
      createYunjiTabBackup({
        settings: get().settings,
        meta: get().meta,
        categoryMeta: get().categoryMeta,
        usage: get().usage,
        categories: get().categories,
      }),
      null,
      2,
    ),

  importBackup: async (raw, strategy = 'merge') => {
    const backup = parseYunjiTabBackup(raw)
    const meta = { ...get().meta }
    for (const [url, importedMeta] of Object.entries(backup.bookmarkMeta)) {
      const existing = meta[url]
      if (existing && strategy === 'skip')
        continue
      const normalizedImported = {
        ...importedMeta,
        alternateUrls: normalizeAlternateBookmarkUrls(
          importedMeta.alternateUrls ?? [],
          url,
        ),
        tags: importedMeta.tags?.flatMap((tag) => {
          const normalized = tag.trim()
          return normalized ? [normalized] : []
        }),
      }
      meta[url] = existing && strategy === 'merge'
        ? {
            ...normalizedImported,
            ...existing,
            tags: [...new Set([...(existing.tags ?? []), ...(normalizedImported.tags ?? [])])],
          }
        : normalizedImported
      if (!meta[url].alternateUrls?.length) {
        meta[url].alternateUrls = undefined
      }
      if (!meta[url].tags?.length) {
        meta[url].tags = undefined
      }
    }
    const usage = { ...get().usage, ...backup.usage }
    const categoryMeta = { ...get().categoryMeta }
    let restoredCategoryMetaCount = 0
    for (const item of backup.categoryMeta) {
      const category = findCategoryByPath(item.path, get().categories)
      if (!category)
        continue
      categoryMeta[category.id] = { emoji: item.emoji }
      restoredCategoryMetaCount += 1
    }
    const defaultCategory = findCategoryByPath(
      backup.defaultCategoryPath,
      get().categories,
    )
    const settings = normalizeSettings({
      ...backup.settings,
      defaultCategoryId:
        defaultCategory?.id
        ?? (isVirtualCategoryId(backup.settings.defaultCategoryId)
          ? backup.settings.defaultCategoryId
          : 'all'),
    })

    set({ meta, categoryMeta, usage, settings })
    await Promise.all([
      persist(metaStorage, STORAGE_KEYS.meta, meta),
      persist(metaStorage, STORAGE_KEYS.categoryMeta, categoryMeta),
      persist(metaStorage, STORAGE_KEYS.usage, usage),
      persist(settingsStorage, STORAGE_KEYS.settings, settings),
    ])
    await get().loadBookmarks()
    return {
      bookmarkMetaCount: Object.keys(backup.bookmarkMeta).length,
      categoryMetaCount: restoredCategoryMetaCount,
      usageCount: Object.keys(backup.usage).length,
    }
  },

  exportFullBackup: async () => {
    assertBookmarksApi()
    const [tree] = await bookmarkApi.getTree()
    return JSON.stringify(
      createFullBookmarkSnapshot({
        yunjiTab: createYunjiTabBackup({
          settings: get().settings,
          meta: get().meta,
          categoryMeta: get().categoryMeta,
          usage: get().usage,
          categories: get().categories,
        }),
        nativeRoots: tree.children ?? [],
      }),
      null,
      2,
    )
  },

  restoreFullBackup: async (raw) => {
    assertBookmarksApi()
    const snapshot = parseFullBookmarkSnapshot(raw)
    const restoredFolderName = `Yunji Tab Restore ${new Date()
      .toISOString()
      .slice(0, 16)
      .replace('T', ' ')}`
    const root = await bookmarkApi.create({
      parentId: DEFAULT_PARENT_ID,
      title: restoredFolderName,
    })
    const categoryIdByPath = new Map<string, string>()
    let restoredNodeCount = 1
    for (const node of snapshot.roots) {
      // Root creation order must match the exported bookmark snapshot.
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      restoredNodeCount += await restoreSnapshotNode(
        node,
        root.id,
        [],
        categoryIdByPath,
      )
    }

    const meta = { ...get().meta }
    for (const [url, importedMeta] of Object.entries(
      snapshot.yunjiTab.bookmarkMeta,
    )) {
      meta[url] = {
        ...importedMeta,
        alternateUrls: normalizeAlternateBookmarkUrls(
          importedMeta.alternateUrls ?? [],
          url,
        ),
        tags: importedMeta.tags?.flatMap((tag) => {
          const normalized = tag.trim()
          return normalized ? [normalized] : []
        }),
      }
      if (!meta[url].alternateUrls?.length) {
        meta[url].alternateUrls = undefined
      }
      if (!meta[url].tags?.length) {
        meta[url].tags = undefined
      }
    }

    const categoryMeta = { ...get().categoryMeta }
    let restoredCategoryMetaCount = 0
    for (const item of snapshot.yunjiTab.categoryMeta) {
      const restoredId = categoryIdByPath.get(JSON.stringify(item.path))
      if (!restoredId)
        continue
      categoryMeta[restoredId] = { emoji: item.emoji }
      restoredCategoryMetaCount += 1
    }

    const restoredDefaultCategoryId = categoryIdByPath.get(
      JSON.stringify(snapshot.yunjiTab.defaultCategoryPath ?? []),
    )
    const settings = normalizeSettings({
      ...snapshot.yunjiTab.settings,
      defaultCategoryId:
        restoredDefaultCategoryId
        ?? (isVirtualCategoryId(snapshot.yunjiTab.settings.defaultCategoryId)
          ? snapshot.yunjiTab.settings.defaultCategoryId
          : 'all'),
    })
    const usage = { ...get().usage, ...snapshot.yunjiTab.usage }

    set({ meta, categoryMeta, settings, usage })
    await Promise.all([
      persist(metaStorage, STORAGE_KEYS.meta, meta),
      persist(metaStorage, STORAGE_KEYS.categoryMeta, categoryMeta),
      persist(metaStorage, STORAGE_KEYS.usage, usage),
      persist(settingsStorage, STORAGE_KEYS.settings, settings),
    ])
    await get().loadBookmarks()
    return {
      restoredFolderName,
      restoredNodeCount,
      bookmarkMetaCount: Object.keys(snapshot.yunjiTab.bookmarkMeta).length,
      categoryMetaCount: restoredCategoryMetaCount,
      usageCount: Object.keys(snapshot.yunjiTab.usage).length,
    }
  },

  ...createSettingsSlice(set, get, store),
}))

runScheduledMetadataSync = () => {
  void useNavStore.getState().syncMetadataNow()
}

let usagePersistTimer: ReturnType<typeof setTimeout> | undefined
let usagePersistPending = false

export async function flushUsagePersistence(): Promise<void> {
  if (!usagePersistPending)
    return
  if (usagePersistTimer) {
    clearTimeout(usagePersistTimer)
    usagePersistTimer = undefined
  }
  usagePersistPending = false
  await persist(
    metaStorage,
    STORAGE_KEYS.usage,
    useNavStore.getState().usage,
  )
}

scheduleUsagePersist = () => {
  usagePersistPending = true
  if (usagePersistTimer)
    clearTimeout(usagePersistTimer)
  usagePersistTimer = setTimeout(() => {
    usagePersistTimer = undefined
    void flushUsagePersistence()
  }, usagePersistDelayMs)
}

registerSupplementaryPersisted(async () => {
  await markLocalMetadataChanged()
  scheduleMetadataSync()
})

// === 派生 selector hooks ===

export const useCategories = (): Category[] => useNavStore(s => s.categories)

export const useBookmarks = (): Bookmark[] => useNavStore(s => s.bookmarks)
