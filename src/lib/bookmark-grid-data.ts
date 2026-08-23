import type { BookmarkSearchEntry } from './bookmark-search'
import type {
  Bookmark,
  BookmarkSortMode,
  BookmarkUsage,
  Category,
} from './types'
import {
  bookmarkSearchEntryScore,
  categorySearchScore,
} from './bookmark-search'

export type BookmarkUsageMap = Record<string, BookmarkUsage>

export interface GridItemCounts {
  bookmarkCountByCategory: Map<string, number>
  childCountByCategory: Map<string, number>
}

export function isUsageBookmarkView(activeCategoryId: string): boolean {
  return activeCategoryId === 'frequent' || activeCategoryId === 'recent'
}

export function isSmartBookmarkView(activeCategoryId: string): boolean {
  return isUsageBookmarkView(activeCategoryId)
    || activeCategoryId === 'inbox'
    || activeCategoryId === 'pinned'
    || activeCategoryId === 'untagged'
    || activeCategoryId === 'undescribed'
}

export function sortBookmarks(
  bookmarks: Bookmark[],
  mode: BookmarkSortMode,
  usage: BookmarkUsageMap,
): Bookmark[] {
  return bookmarks.toSorted((left, right) => {
    const pinned = (right.pinnedAt ?? 0) - (left.pinnedAt ?? 0)
    if (pinned)
      return pinned
    if (mode === 'name')
      return left.name.localeCompare(right.name)
    if (mode === 'recentlyAdded')
      return (right.dateAdded ?? 0) - (left.dateAdded ?? 0)
    if (mode === 'frequent') {
      return (
        (usage[right.url]?.openCount ?? 0)
        - (usage[left.url]?.openCount ?? 0)
      )
    }
    return (left.index ?? 0) - (right.index ?? 0)
  })
}

export function selectBookmarksForView(
  bookmarks: Bookmark[],
  activeCategoryId: string,
  sortMode: BookmarkSortMode,
  usage: BookmarkUsageMap,
): Bookmark[] {
  if (activeCategoryId === 'all')
    return sortBookmarks(bookmarks, sortMode, usage)

  if (isUsageBookmarkView(activeCategoryId)) {
    return bookmarks
      .filter(bookmark => (usage[bookmark.url]?.openCount ?? 0) > 0)
      .sort((left, right) => {
        const pinned = (right.pinnedAt ?? 0) - (left.pinnedAt ?? 0)
        if (pinned)
          return pinned
        const leftUsage = usage[left.url] ?? { openCount: 0, lastOpenedAt: 0 }
        const rightUsage = usage[right.url] ?? { openCount: 0, lastOpenedAt: 0 }
        return activeCategoryId === 'frequent'
          ? rightUsage.openCount - leftUsage.openCount
          || rightUsage.lastOpenedAt - leftUsage.lastOpenedAt
          : rightUsage.lastOpenedAt - leftUsage.lastOpenedAt
      })
  }

  const matchingBookmarks = bookmarks.filter((bookmark) => {
    if (activeCategoryId === 'inbox')
      return Boolean(bookmark.inboxAt)
    if (activeCategoryId === 'pinned')
      return Boolean(bookmark.pinnedAt)
    if (activeCategoryId === 'untagged')
      return !bookmark.tags?.length
    if (activeCategoryId === 'undescribed')
      return !bookmark.description
    return bookmark.categoryId === activeCategoryId
  })
  return sortBookmarks(matchingBookmarks, sortMode, usage)
}

export function filterGridBookmarks(
  categorized: Bookmark[],
  searchEntries: BookmarkSearchEntry[],
  searchQuery: string,
): Bookmark[] {
  if (!searchQuery.trim())
    return categorized

  const matches = searchEntries.reduce<Array<{ bookmark: Bookmark, score: number }>>((results, entry) => {
    const score = bookmarkSearchEntryScore(entry, searchQuery)
    if (score >= 0)
      results.push({ bookmark: entry.bookmark, score })
    return results
  }, [])
  return matches
    .sort(
      (left, right) =>
        right.score - left.score
        || (right.bookmark.pinnedAt ?? 0) - (left.bookmark.pinnedAt ?? 0),
    )
    .map(result => result.bookmark)
}

export function filterGridCategories(
  categories: Category[],
  activeCategoryId: string,
  categoryPathMap: Map<string, string[]>,
  searchQuery: string,
): Category[] {
  if (!searchQuery.trim()) {
    return isSmartBookmarkView(activeCategoryId)
      ? []
      : categories.filter(category => category.parentId === activeCategoryId)
  }

  const matches = categories.reduce<Array<{ category: Category, score: number }>>((results, category) => {
    const score = categorySearchScore(
      category,
      searchQuery,
      categoryPathMap.get(category.id) ?? [],
    )
    if (score >= 0)
      results.push({ category, score })
    return results
  }, [])
  return matches
    .sort((left, right) => right.score - left.score)
    .map(result => result.category)
}

export function countGridItems(
  bookmarks: Bookmark[],
  categories: Category[],
): GridItemCounts {
  const bookmarkCountByCategory = new Map<string, number>()
  const childCountByCategory = new Map<string, number>()
  for (const bookmark of bookmarks) {
    bookmarkCountByCategory.set(
      bookmark.categoryId,
      (bookmarkCountByCategory.get(bookmark.categoryId) ?? 0) + 1,
    )
  }
  for (const category of categories) {
    childCountByCategory.set(
      category.parentId,
      (childCountByCategory.get(category.parentId) ?? 0) + 1,
    )
  }
  return { bookmarkCountByCategory, childCountByCategory }
}
