import type { BookmarkTreeNode } from './bookmark-tree'
import type { LocalizedText } from './i18n'
import type { BookmarkMeta, CategoryMeta } from './types'
import { canonicalizeBookmarkUrl } from './bookmark-urls'

export const trashStorageKey = 'yunji-tab:trash'
export const historyStorageKey = 'yunji-tab:history'
export const metadataSyncRecoveryStorageKey = 'yunji-tab:metadata-sync-recovery'
export const trashRetentionMs = 30 * 24 * 60 * 60 * 1000
export const metadataSyncRecoveryRetentionMs = trashRetentionMs

export interface TrashEntry {
  id: string
  label: LocalizedText
  deletedAt: number
  expiresAt: number
  roots: BookmarkTreeNode[]
  categoryMeta: Record<string, CategoryMeta>
  defaultCategoryId?: string
  restoredRootIndexes?: number[]
  restoreError?: LocalizedText
}

export interface TrashRestorePreview {
  nodeCount: number
  bookmarkCount: number
  duplicateUrlCount: number
  fallbackParentCount: number
  remainingRootCount: number
}

function flattenTree(nodes: BookmarkTreeNode[]): BookmarkTreeNode[] {
  return nodes.flatMap(node => [node, ...flattenTree(node.children ?? [])])
}

export function createTrashRestorePreview(
  entry: TrashEntry,
  currentBookmarkUrls: string[],
  availableCategoryIds: string[],
): TrashRestorePreview {
  const completed = new Set(entry.restoredRootIndexes ?? [])
  const remainingRoots = entry.roots.filter((_, index) => !completed.has(index))
  const nodes = flattenTree(remainingRoots)
  const currentUrls = new Set(currentBookmarkUrls.map(canonicalizeBookmarkUrl))
  const availableCategories = new Set(availableCategoryIds)
  return {
    nodeCount: nodes.length,
    bookmarkCount: nodes.filter(node => node.url).length,
    duplicateUrlCount: nodes.filter(node =>
      node.url && currentUrls.has(canonicalizeBookmarkUrl(node.url))).length,
    fallbackParentCount: remainingRoots.filter(root =>
      root.parentId && root.parentId !== '1' && root.parentId !== '2'
      && !availableCategories.has(`cat-${root.parentId}`)).length,
    remainingRootCount: remainingRoots.length,
  }
}

export interface HistoryEntry {
  id: string
  action: 'add' | 'edit' | 'move' | 'delete' | 'restore' | 'sync'
  label: LocalizedText
  createdAt: number
}

export interface MetadataSyncRecoveryEntry {
  id: string
  label: LocalizedText
  createdAt: number
  expiresAt: number
  direction: 'downloaded' | 'merged'
  bookmarkMeta: Record<string, BookmarkMeta>
  categoryMeta: Record<string, CategoryMeta>
  changedBookmarkCount: number
  changedCategoryCount: number
  removedFieldCount: number
}

export interface MetadataChangeSummary {
  changedBookmarkCount: number
  changedCategoryCount: number
  removedFieldCount: number
}

function parseStorageValue(value: unknown): unknown {
  if (typeof value !== 'string')
    return value
  try {
    return JSON.parse(value)
  }
  catch {
    return value
  }
}

function isStoredText(value: unknown): value is LocalizedText {
  if (typeof value === 'string')
    return true
  if (typeof value !== 'object' || value === null)
    return false
  const candidate = value as { key?: unknown, params?: unknown }
  if (typeof candidate.key !== 'string')
    return false
  if (candidate.params === undefined)
    return true
  return typeof candidate.params === 'object'
    && candidate.params !== null
    && Object.values(candidate.params).every(param =>
      typeof param === 'string' || typeof param === 'number')
}

function recordsEqual(left: unknown, right: unknown): boolean {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value))
      return value.map(normalize)
    if (typeof value !== 'object' || value === null)
      return value
    const record = value as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(record).sort().map(key => [key, normalize(record[key])]),
    )
  }
  return JSON.stringify(normalize(left ?? {})) === JSON.stringify(normalize(right ?? {}))
}

export function summarizeMetadataChanges(
  beforeMeta: Record<string, BookmarkMeta>,
  afterMeta: Record<string, BookmarkMeta>,
  beforeCategoryMeta: Record<string, CategoryMeta>,
  afterCategoryMeta: Record<string, CategoryMeta>,
): MetadataChangeSummary {
  const bookmarkUrls = new Set([...Object.keys(beforeMeta), ...Object.keys(afterMeta)])
  const changedBookmarkCount = [...bookmarkUrls].filter(url =>
    !recordsEqual(beforeMeta[url], afterMeta[url])).length
  let removedFieldCount = 0
  for (const url of bookmarkUrls) {
    const before = beforeMeta[url] ?? {}
    const after = afterMeta[url] ?? {}
    removedFieldCount += Object.keys(before).filter(field =>
      before[field as keyof BookmarkMeta] !== undefined
      && after[field as keyof BookmarkMeta] === undefined).length
  }
  const categoryIds = new Set([
    ...Object.keys(beforeCategoryMeta),
    ...Object.keys(afterCategoryMeta),
  ])
  const changedCategoryCount = [...categoryIds].filter(id =>
    !recordsEqual(beforeCategoryMeta[id], afterCategoryMeta[id])).length
  return { changedBookmarkCount, changedCategoryCount, removedFieldCount }
}

export function pruneTrash(value: unknown, now = Date.now()): TrashEntry[] {
  value = parseStorageValue(value)
  if (!Array.isArray(value))
    return []
  return value.filter((item): item is TrashEntry => {
    if (typeof item !== 'object' || item === null)
      return false
    const entry = item as Partial<TrashEntry>
    return typeof entry.id === 'string' && isStoredText(entry.label)
      && typeof entry.deletedAt === 'number' && typeof entry.expiresAt === 'number'
      && entry.expiresAt > now && Array.isArray(entry.roots)
      && typeof entry.categoryMeta === 'object' && entry.categoryMeta !== null
  }).slice(0, 100)
}

export function pruneHistory(value: unknown): HistoryEntry[] {
  value = parseStorageValue(value)
  if (!Array.isArray(value))
    return []
  return value.filter((item): item is HistoryEntry => {
    if (typeof item !== 'object' || item === null)
      return false
    const entry = item as Partial<HistoryEntry>
    return typeof entry.id === 'string' && isStoredText(entry.label)
      && typeof entry.createdAt === 'number'
      && ['add', 'edit', 'move', 'delete', 'restore', 'sync'].includes(entry.action ?? '')
  }).slice(0, 200)
}

export function pruneMetadataSyncRecovery(
  value: unknown,
  now = Date.now(),
): MetadataSyncRecoveryEntry[] {
  value = parseStorageValue(value)
  if (!Array.isArray(value))
    return []
  return value.filter((item): item is MetadataSyncRecoveryEntry => {
    if (typeof item !== 'object' || item === null)
      return false
    const entry = item as Partial<MetadataSyncRecoveryEntry>
    return typeof entry.id === 'string' && isStoredText(entry.label)
      && typeof entry.createdAt === 'number' && typeof entry.expiresAt === 'number'
      && entry.expiresAt > now
      && (entry.direction === 'downloaded' || entry.direction === 'merged')
      && typeof entry.bookmarkMeta === 'object' && entry.bookmarkMeta !== null
      && typeof entry.categoryMeta === 'object' && entry.categoryMeta !== null
      && typeof entry.changedBookmarkCount === 'number'
      && typeof entry.changedCategoryCount === 'number'
      && typeof entry.removedFieldCount === 'number'
  }).slice(0, 20)
}
