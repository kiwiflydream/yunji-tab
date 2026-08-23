import type { Bookmark, Category } from '~/lib/types'
import { useDeferredValue, useMemo, useState } from 'react'
import { BookmarkGridEmptyState } from '~/components/bookmark-grid/BookmarkGridEmptyState'
import { BookmarkGridItems } from '~/components/bookmark-grid/BookmarkGridItems'
import { BookmarkGridLoadingState } from '~/components/bookmark-grid/BookmarkGridLoadingState'
import { BookmarkGridToolbar } from '~/components/bookmark-grid/BookmarkGridToolbar'
import { useBookmarkBulkActions } from '~/components/bookmark-grid/useBookmarkBulkActions'
import { useBookmarkGridData } from '~/components/bookmark-grid/useBookmarkGridData'
import { BulkActionBar } from '~/components/BulkActionBar'
import { Button } from '~/components/ui/button'
import { useBookmarks, useCategories, useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

interface BookmarkGridProps {
  loading: boolean
  onEdit: (bookmark: Bookmark) => void
  onEditCategory: (category: Category) => void
  onAdd: () => void
}

const RENDER_BATCH_SIZE = 50

export function BookmarkGrid({
  loading,
  onEdit,
  onEditCategory,
  onAdd,
}: BookmarkGridProps) {
  const { t } = useI18n()
  const bookmarks = useBookmarks()
  const categories = useCategories()
  const activeCategoryId = useNavStore(state => state.activeCategoryId)
  const rawSearchQuery = useNavStore(state => state.bookmarkSearchQuery)
  const searchQuery = useDeferredValue(rawSearchQuery)
  const usage = useNavStore(state => state.usage)
  const sortMode = useNavStore(state => state.settings.bookmarkSortMode)
  const viewMode = useNavStore(state => state.settings.bookmarkViewMode)
  const appearance = useNavStore(state => state.settings.appearance)
  const paginationKey = `${activeCategoryId}\u0000${searchQuery}\u0000${viewMode}`
  const [pagination, setPagination] = useState({
    key: paginationKey,
    limit: RENDER_BATCH_SIZE,
  })
  const data = useBookmarkGridData({
    activeCategoryId,
    bookmarks,
    categories,
    searchQuery,
    sortMode,
    usage,
  })
  const visibleBookmarkIds = useMemo(
    () => data.filteredBookmarks.map(bookmark => bookmark.id),
    [data.filteredBookmarks],
  )
  const bulk = useBookmarkBulkActions({
    activeCategoryId,
    bookmarks,
    categories,
    visibleBookmarkIds,
  })
  const visibleLimit
    = pagination.key === paginationKey ? pagination.limit : RENDER_BATCH_SIZE
  const renderedBookmarks = data.filteredBookmarks.slice(0, visibleLimit)
  const visibleCategories
    = !bulk.selectionMode && appearance.cardFields.categoryCards
      ? data.filteredCategories
      : []
  const pinnedReorder = activeCategoryId === 'pinned'
  const reorderEnabled
    = !data.searching
      && !bulk.selectionMode
      && (pinnedReorder
        || (sortMode === 'manual'
          && categories.some(category => category.id === activeCategoryId)))

  if (loading)
    return <BookmarkGridLoadingState label={`${t('bookmarks')}…`} />

  if (bookmarks.length === 0 && categories.length === 0) {
    return <BookmarkGridEmptyState emptyLibrary onAdd={onAdd} />
  }

  if (
    visibleCategories.length === 0
    && data.filteredBookmarks.length === 0
    && !bulk.selectionMode
    && activeCategoryId !== 'inbox'
  ) {
    return (
      <BookmarkGridEmptyState
        searching={Boolean(rawSearchQuery.trim())}
        isSmartView={data.isSmartView}
      />
    )
  }

  return (
    <>
      <BookmarkGridToolbar
        activeCategoryId={activeCategoryId}
        searchQuery={searchQuery}
        searching={data.searching}
        selectionMode={bulk.selectionMode}
        visibleBookmarkCount={visibleBookmarkIds.length}
        visibleCategoryCount={visibleCategories.length}
        onStartSelection={bulk.startSelection}
      />
      {bulk.selectionMode
        ? (
            <BulkActionBar
              selectedCount={bulk.selectedCount}
              visibleCount={visibleBookmarkIds.length}
              allVisibleSelected={bulk.allVisibleSelected}
              categories={categories}
              destinationId={bulk.destinationId}
              busy={bulk.busy}
              message={bulk.message}
              onCancel={bulk.cancelSelection}
              onToggleAll={bulk.toggleAll}
              onDestinationChange={bulk.setDestinationId}
              onMove={() => void bulk.move()}
              onOpen={() => void bulk.open()}
              onSync={() => void bulk.sync()}
              onDelete={() => void bulk.remove()}
              onOrganize={bulk.organize ? () => void bulk.organize?.() : undefined}
            />
          )
        : null}
      <BookmarkGridItems
        appearance={appearance}
        bookmarks={renderedBookmarks}
        categories={visibleCategories}
        categoryPathMap={data.categoryPathMap}
        itemCounts={data.itemCounts}
        onEdit={onEdit}
        onEditCategory={onEditCategory}
        onToggleSelection={bulk.toggleBookmark}
        reorderEnabled={reorderEnabled}
        pinnedReorder={pinnedReorder}
        searching={data.searching}
        selectedIds={bulk.selectedIds}
        selectionMode={bulk.selectionMode}
        viewMode={viewMode}
      />
      {renderedBookmarks.length < data.filteredBookmarks.length
        ? (
            <div className="mt-5 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setPagination({
                    key: paginationKey,
                    limit: visibleLimit + RENDER_BATCH_SIZE,
                  })}
              >
                {t('loadMoreRemaining', {
                  count: data.filteredBookmarks.length - renderedBookmarks.length,
                })}
              </Button>
            </div>
          )
        : null}
    </>
  )
}
