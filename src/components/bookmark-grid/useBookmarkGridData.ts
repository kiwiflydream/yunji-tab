import type {
  Bookmark,
  BookmarkSortMode,
  BookmarkUsage,
  Category,
} from '~/lib/types'
import { useMemo } from 'react'
import {
  filterGridBookmarks,
  filterGridCategories,
  isSmartBookmarkView,
  selectBookmarksForView,
} from '~/lib/bookmark-grid-data'
import { getNavigationDerivedData } from '~/lib/navigation-derived'

interface BookmarkGridDataOptions {
  bookmarks: Bookmark[]
  categories: Category[]
  activeCategoryId: string
  searchQuery: string
  sortMode: BookmarkSortMode
  usage: Record<string, BookmarkUsage>
}

export function useBookmarkGridData({
  bookmarks,
  categories,
  activeCategoryId,
  searchQuery,
  sortMode,
  usage,
}: BookmarkGridDataOptions) {
  const derived = useMemo(
    () => getNavigationDerivedData(bookmarks, categories),
    [bookmarks, categories],
  )
  const categorizedBookmarks = useMemo(
    () =>
      selectBookmarksForView(
        bookmarks,
        activeCategoryId,
        sortMode,
        usage,
      ),
    [activeCategoryId, bookmarks, sortMode, usage],
  )
  const filteredBookmarks = useMemo(
    () =>
      searchQuery.trim()
        ? filterGridBookmarks(
            categorizedBookmarks,
            derived.searchEntries,
            searchQuery,
          )
        : categorizedBookmarks,
    [categorizedBookmarks, derived, searchQuery],
  )
  const filteredCategories = useMemo(
    () =>
      filterGridCategories(
        categories,
        activeCategoryId,
        derived.categoryPathMap,
        searchQuery,
      ),
    [activeCategoryId, categories, derived.categoryPathMap, searchQuery],
  )

  return {
    categoryPathMap: derived.categoryPathMap,
    filteredBookmarks,
    filteredCategories,
    isSmartView: isSmartBookmarkView(activeCategoryId),
    itemCounts: {
      bookmarkCountByCategory: derived.bookmarkCountByCategory,
      childCountByCategory: derived.childCategoryCountByCategory,
    },
    searching: Boolean(searchQuery.trim()),
  }
}
