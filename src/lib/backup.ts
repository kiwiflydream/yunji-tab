import type {
  BookmarkMeta,
  BookmarkUsage,
  Category,
  CategoryMeta,
  Settings,
} from './types'
import { normalizeAppearanceSettings } from './appearance'
import { normalizeAutoOrganizeRules } from './auto-organize'
import { getCategoryPath } from './category-path'
import { getBrowserLanguage, isLanguage } from './i18n'
import { normalizeKeyboardShortcuts } from './keyboard-shortcuts'
import { normalizeMetadataSyncScope } from './metadata-sync'
import { normalizeCustomSearchEngines } from './search-engines'

const BACKUP_SCHEMA_VERSION = 1
const FULL_SNAPSHOT_KIND = 'yunji-tab-full-bookmark-snapshot'

interface CategoryMetaBackup {
  path: string[]
  emoji: string
}

export interface YunjiTabBackup {
  schemaVersion: 1
  exportedAt: string
  settings: Settings
  defaultCategoryPath?: string[]
  bookmarkMeta: Record<string, BookmarkMeta>
  categoryMeta: CategoryMetaBackup[]
  usage: Record<string, BookmarkUsage>
}

export interface NativeBookmarkSnapshotNode {
  title: string
  url?: string
  children?: NativeBookmarkSnapshotNode[]
}

export interface FullBookmarkSnapshot {
  kind: typeof FULL_SNAPSHOT_KIND
  schemaVersion: 1
  exportedAt: string
  yunjiTab: YunjiTabBackup
  roots: NativeBookmarkSnapshotNode[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function createYunjiTabBackup(input: {
  settings: Settings
  meta: Record<string, BookmarkMeta>
  categoryMeta: Record<string, CategoryMeta>
  usage: Record<string, BookmarkUsage>
  categories: Category[]
}): YunjiTabBackup {
  const categoryMeta = Object.entries(input.categoryMeta).flatMap(
    ([categoryId, meta]) => {
      const path = getCategoryPath(categoryId, input.categories)
      return path && meta.emoji ? [{ path, emoji: meta.emoji }] : []
    },
  )

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings: input.settings,
    defaultCategoryPath: getCategoryPath(
      input.settings.defaultCategoryId,
      input.categories,
    ),
    bookmarkMeta: input.meta,
    categoryMeta,
    usage: input.usage,
  }
}

function toNativeSnapshotNode(
  node: chrome.bookmarks.BookmarkTreeNode,
): NativeBookmarkSnapshotNode {
  return {
    title: node.title,
    url: node.url,
    children: node.children?.map(toNativeSnapshotNode),
  }
}

function parseNativeSnapshotNode(
  value: unknown,
): NativeBookmarkSnapshotNode | undefined {
  if (!isRecord(value) || typeof value.title !== 'string') {
    return undefined
  }

  const children = Array.isArray(value.children)
    ? value.children.flatMap((child) => {
        const parsed = parseNativeSnapshotNode(child)
        return parsed ? [parsed] : []
      })
    : undefined

  return {
    title: value.title,
    url: typeof value.url === 'string' ? value.url : undefined,
    children,
  }
}

export function createFullBookmarkSnapshot(input: {
  yunjiTab: YunjiTabBackup
  nativeRoots: chrome.bookmarks.BookmarkTreeNode[]
}): FullBookmarkSnapshot {
  return {
    kind: FULL_SNAPSHOT_KIND,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    yunjiTab: input.yunjiTab,
    roots: input.nativeRoots.map(toNativeSnapshotNode),
  }
}

export function parseYunjiTabBackup(raw: string): YunjiTabBackup {
  let value: unknown
  try {
    value = JSON.parse(raw)
  }
  catch {
    throw new Error('backup.invalid_json')
  }
  if (!isRecord(value) || value.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error('backup.unsupported_version')
  }
  if (
    !isRecord(value.settings)
    || !isRecord(value.bookmarkMeta)
    || !Array.isArray(value.categoryMeta)
    || !isRecord(value.usage)
  ) {
    throw new Error('backup.missing_data')
  }

  const bookmarkMeta: Record<string, BookmarkMeta> = {}
  for (const [url, candidate] of Object.entries(value.bookmarkMeta)) {
    if (!isRecord(candidate) || url === '__proto__')
      continue
    bookmarkMeta[url] = {
      description:
        typeof candidate.description === 'string'
          ? candidate.description
          : undefined,
      icon: typeof candidate.icon === 'string' ? candidate.icon : undefined,
      alternateUrls: Array.isArray(candidate.alternateUrls)
        ? candidate.alternateUrls.filter(
            (url): url is string => typeof url === 'string',
          )
        : undefined,
      pinnedAt:
        typeof candidate.pinnedAt === 'number' && candidate.pinnedAt > 0
          ? candidate.pinnedAt
          : undefined,
      tags: Array.isArray(candidate.tags)
        ? candidate.tags.filter((tag): tag is string => typeof tag === 'string')
        : undefined,
      inboxAt:
        typeof candidate.inboxAt === 'number' && candidate.inboxAt > 0
          ? candidate.inboxAt
          : undefined,
    }
  }

  const usage: Record<string, BookmarkUsage> = {}
  for (const [url, candidate] of Object.entries(value.usage)) {
    if (
      !isRecord(candidate)
      || typeof candidate.openCount !== 'number'
      || typeof candidate.lastOpenedAt !== 'number'
      || url === '__proto__'
    ) {
      continue
    }
    usage[url] = {
      openCount: Math.max(0, Math.floor(candidate.openCount)),
      lastOpenedAt: Math.max(0, candidate.lastOpenedAt),
    }
  }

  const categoryMeta = value.categoryMeta.flatMap((candidate) => {
    if (
      !isRecord(candidate)
      || !Array.isArray(candidate.path)
      || !candidate.path.every(part => typeof part === 'string')
      || typeof candidate.emoji !== 'string'
    ) {
      return []
    }
    return [{ path: candidate.path as string[], emoji: candidate.emoji }]
  })

  const settings = value.settings
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : '',
    settings: {
      language: isLanguage(settings.language)
        ? settings.language
        : getBrowserLanguage(),
      theme:
        settings.theme === 'light'
        || settings.theme === 'dark'
        || settings.theme === 'system'
          ? settings.theme
          : 'system',
      defaultCategoryId:
        typeof settings.defaultCategoryId === 'string'
          ? settings.defaultCategoryId
          : 'all',
      singleHomeTab: settings.singleHomeTab === true,
      globalCommandPaletteEnabled:
        settings.globalCommandPaletteEnabled === true,
      descriptionIgnoredDomains: Array.isArray(
        settings.descriptionIgnoredDomains,
      )
        ? settings.descriptionIgnoredDomains.filter(
            (domain): domain is string => typeof domain === 'string',
          )
        : [],
      customSearchEngines: normalizeCustomSearchEngines(
        settings.customSearchEngines,
      ),
      onboardingDismissed:
        typeof settings.onboardingDismissed === 'boolean'
          ? settings.onboardingDismissed
          : undefined,
      bookmarkSortMode:
        settings.bookmarkSortMode === 'name'
        || settings.bookmarkSortMode === 'recentlyAdded'
        || settings.bookmarkSortMode === 'frequent'
          ? settings.bookmarkSortMode
          : 'manual',
      bookmarkViewMode:
        settings.bookmarkViewMode === 'compact' ? 'compact' : 'grid',
      appearance: normalizeAppearanceSettings(
        isRecord(settings.appearance) ? settings.appearance : undefined,
      ),
      savedSearches: Array.isArray(settings.savedSearches)
        ? settings.savedSearches.flatMap((item) => {
            if (!isRecord(item) || typeof item.id !== 'string'
              || typeof item.name !== 'string' || typeof item.query !== 'string') {
              return []
            }
            return [{ id: item.id, name: item.name, query: item.query }]
          }).slice(0, 20)
        : [],
      metadataSyncScope: normalizeMetadataSyncScope(
        isRecord(settings.metadataSyncScope)
          ? settings.metadataSyncScope
          : undefined,
      ),
      metadataSyncEncryptionEnabled: settings.metadataSyncEncryptionEnabled === true,
      autoOrganizeRules: normalizeAutoOrganizeRules(settings.autoOrganizeRules),
      keyboardShortcuts: normalizeKeyboardShortcuts(settings.keyboardShortcuts),
    },
    defaultCategoryPath: Array.isArray(value.defaultCategoryPath)
      ? value.defaultCategoryPath.filter(
          (part): part is string => typeof part === 'string',
        )
      : undefined,
    bookmarkMeta,
    categoryMeta,
    usage,
  }
}

export function parseFullBookmarkSnapshot(raw: string): FullBookmarkSnapshot {
  let value: unknown
  try {
    value = JSON.parse(raw)
  }
  catch {
    throw new Error('snapshot.invalid_json')
  }

  if (
    !isRecord(value)
    || value.kind !== FULL_SNAPSHOT_KIND
    || value.schemaVersion !== BACKUP_SCHEMA_VERSION
    || !isRecord(value.yunjiTab)
    || !Array.isArray(value.roots)
  ) {
    throw new Error('snapshot.unsupported_version')
  }

  const roots = value.roots.flatMap((root) => {
    const parsed = parseNativeSnapshotNode(root)
    return parsed ? [parsed] : []
  })

  return {
    kind: FULL_SNAPSHOT_KIND,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : '',
    yunjiTab: parseYunjiTabBackup(JSON.stringify(value.yunjiTab)),
    roots,
  }
}
