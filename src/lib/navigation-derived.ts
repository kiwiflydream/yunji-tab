import type { BookmarkSearchEntry } from './bookmark-search'
import type { CategoryTreeNode } from './category-tree'
import type { Bookmark, Category } from './types'
import { createBookmarkSearchEntry } from './bookmark-search'
import { buildCategoryPathMap } from './category-path'
import { buildCategoryTree } from './category-tree'

export interface NavigationDerivedData {
  bookmarkCountByCategory: Map<string, number>
  categoryPathMap: Map<string, string[]>
  categoryTree: CategoryTreeNode[]
  childCategoryCountByCategory: Map<string, number>
  searchEntries: BookmarkSearchEntry[]
  searchEntryByBookmarkId: Map<string, BookmarkSearchEntry>
  smartCounts: {
    inbox: number
    pinned: number
    untagged: number
    undescribed: number
  }
}

interface CategoryDerivedData {
  categoryPathMap: Map<string, string[]>
  categoryTree: CategoryTreeNode[]
  childCategoryCountByCategory: Map<string, number>
}

const categoryCache = new WeakMap<Category[], CategoryDerivedData>()
const navigationCache = new WeakMap<
  Bookmark[],
  WeakMap<Category[], NavigationDerivedData>
>()

function getCategoryDerivedData(categories: Category[]): CategoryDerivedData {
  const cached = categoryCache.get(categories)
  if (cached)
    return cached

  const childCategoryCountByCategory = new Map<string, number>()
  for (const category of categories) {
    childCategoryCountByCategory.set(
      category.parentId,
      (childCategoryCountByCategory.get(category.parentId) ?? 0) + 1,
    )
  }
  const derived = {
    categoryPathMap: buildCategoryPathMap(categories),
    categoryTree: buildCategoryTree(categories),
    childCategoryCountByCategory,
  }
  categoryCache.set(categories, derived)
  return derived
}

export function getNavigationDerivedData(
  bookmarks: Bookmark[],
  categories: Category[],
): NavigationDerivedData {
  let byCategories = navigationCache.get(bookmarks)
  if (!byCategories) {
    byCategories = new WeakMap()
    navigationCache.set(bookmarks, byCategories)
  }
  const cached = byCategories.get(categories)
  if (cached)
    return cached

  const categoryDerived = getCategoryDerivedData(categories)
  const bookmarkCountByCategory = new Map<string, number>()
  let inbox = 0
  let pinned = 0
  let untagged = 0
  let undescribed = 0
  for (const bookmark of bookmarks) {
    bookmarkCountByCategory.set(
      bookmark.categoryId,
      (bookmarkCountByCategory.get(bookmark.categoryId) ?? 0) + 1,
    )
    if (bookmark.inboxAt)
      inbox += 1
    if (bookmark.pinnedAt)
      pinned += 1
    if (!bookmark.tags?.length)
      untagged += 1
    if (!bookmark.description)
      undescribed += 1
  }

  let lazySearchEntries: BookmarkSearchEntry[] | undefined
  let lazySearchEntryByBookmarkId: Map<string, BookmarkSearchEntry> | undefined

  const getSearchEntries = (): BookmarkSearchEntry[] => {
    if (!lazySearchEntries) {
      lazySearchEntries = bookmarks.map(bookmark =>
        createBookmarkSearchEntry(
          bookmark,
          categoryDerived.categoryPathMap.get(bookmark.categoryId) ?? [],
        ),
      )
    }
    return lazySearchEntries
  }

  const derived: NavigationDerivedData = {
    ...categoryDerived,
    bookmarkCountByCategory,
    get searchEntries() {
      return getSearchEntries()
    },
    get searchEntryByBookmarkId() {
      if (!lazySearchEntryByBookmarkId) {
        lazySearchEntryByBookmarkId = new Map(
          getSearchEntries().map(entry => [entry.bookmark.id, entry]),
        )
      }
      return lazySearchEntryByBookmarkId
    },
    smartCounts: { inbox, pinned, untagged, undescribed },
  }
  byCategories.set(categories, derived)
  return derived
}
