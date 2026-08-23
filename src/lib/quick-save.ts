import type { Bookmark, Category, CategoryMeta } from './types'
import { Storage } from '@plasmohq/storage'
import { loadBookmarkTreeData } from './bookmark-tree'
import { canonicalizeBookmarkUrl, normalizeBookmarkUrl } from './bookmark-urls'
import { LocalizedError } from './localized-error'

export const quickSaveCategoryKey = 'yunji-tab:quick-save-category'
export const quickSaveBookmarkMessage = 'yunji-tab:quick-save-bookmark'

const categoryMetaStorageKey = 'yunji-tab:category-meta'
const quickSaveStorage = new Storage({ area: 'local' })

export interface CurrentPage {
  title: string
  url: string
}

export interface QuickSaveBookmarkInput {
  name: string
  url: string
  categoryId: string
  tags: string[]
  inboxAt: number
}

export interface QuickSaveData {
  bookmarks: Bookmark[]
  categories: Category[]
}

export async function loadQuickSaveData(): Promise<QuickSaveData> {
  const [{ bookmarks, categories }, categoryMeta] = await Promise.all([
    loadBookmarkTreeData(),
    quickSaveStorage.get<Record<string, CategoryMeta>>(categoryMetaStorageKey),
  ])
  return {
    bookmarks,
    categories: categories.map(category => ({
      ...category,
      emoji: categoryMeta?.[category.id]?.emoji ?? category.emoji,
    })),
  }
}

export async function saveQuickBookmark(
  bookmark: QuickSaveBookmarkInput,
): Promise<void> {
  const response = await chrome.runtime.sendMessage({
    type: quickSaveBookmarkMessage,
    bookmark,
  })
  if (!response?.ok) {
    throw new LocalizedError(
      response?.errorKey ?? 'runtimeQuickSaveFailed',
      response?.params,
    )
  }
}

export function getDuplicateBookmark<T extends Pick<Bookmark, 'url'>>(
  bookmarks: T[],
  url: string,
): T | undefined {
  const candidate = canonicalizeBookmarkUrl(url)
  if (!candidate)
    return undefined
  return bookmarks.find(bookmark => canonicalizeBookmarkUrl(bookmark.url) === candidate)
}

export function currentPageFromTab(
  tab: Pick<chrome.tabs.Tab, 'title' | 'url'> | undefined,
): CurrentPage | null {
  const url = normalizeBookmarkUrl(tab?.url ?? '')
  if (!url)
    return null
  return {
    title: tab?.title?.trim() || new URL(url).hostname,
    url,
  }
}
