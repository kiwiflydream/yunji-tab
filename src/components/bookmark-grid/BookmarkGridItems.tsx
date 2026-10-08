import type { ReactNode } from 'react'
import type { GridItemCounts } from '~/lib/bookmark-grid-data'
import type {
  AppearanceSettings,
  Bookmark,
  BookmarkViewMode,
  Category,
} from '~/lib/types'
import { BookmarkCard } from '~/components/BookmarkCard'
import { CategoryCard } from '~/components/CategoryCard'
import { gridClassByMode } from '~/lib/appearance'
import { useBookmarkGroupsStore } from '~/lib/bookmark-groups-store'
import { bookmarkCardKey, comparePinnedCards, getPinnedCards } from '~/lib/card-order'
import { useNavStore } from '~/lib/store'

export interface AdditionalGridItem {
  key: string
  pinnedAt: number
  pinnedOrder?: number
  node: ReactNode
}

interface BookmarkGridItemsProps {
  additionalItems?: AdditionalGridItem[]
  appearance: AppearanceSettings
  bookmarks: Bookmark[]
  categories: Category[]
  categoryPathMap: Map<string, string[]>
  itemCounts: GridItemCounts
  onEdit: (bookmark: Bookmark) => void
  onEditCategory: (category: Category) => void
  onToggleSelection: (bookmarkId: string) => void
  reorderEnabled: boolean
  pinnedReorder: boolean
  searching: boolean
  selectedIds: Set<string>
  selectionMode: boolean
  viewMode: BookmarkViewMode
}

export function BookmarkGridItems({
  additionalItems,
  appearance,
  bookmarks,
  categories,
  categoryPathMap,
  itemCounts,
  onEdit,
  onEditCategory,
  onToggleSelection,
  reorderEnabled,
  pinnedReorder,
  searching,
  selectedIds,
  selectionMode,
  viewMode,
}: BookmarkGridItemsProps) {
  const setActiveCategory = useNavStore(state => state.setActiveCategory)
  const setSearchQuery = useNavStore(state => state.setBookmarkSearchQuery)
  const openCategory = (categoryId: string) => {
    setActiveCategory(categoryId)
    setSearchQuery('')
  }
  const allBookmarks = useNavStore(state => state.bookmarks)
  const groups = useBookmarkGroupsStore(state => state.groups)
  const pinnedIndices = new Map(getPinnedCards(allBookmarks, groups).map((card, index) => [card.key, index]))
  const items: Array<AdditionalGridItem & { bookmark?: Bookmark, renderKey: string }> = [
    ...bookmarks.map(bookmark => ({
      key: bookmarkCardKey(bookmark.url),
      renderKey: bookmark.id,
      pinnedAt: bookmark.pinnedAt ?? 0,
      pinnedOrder: bookmark.pinnedOrder,
      bookmark,
      node: null,
    })),
    ...(additionalItems ?? []).map(item => ({ ...item, renderKey: item.key })),
  ]
  if (pinnedReorder && !searching)
    items.sort(comparePinnedCards)

  return (
    <div className={gridClassByMode[appearance.gridDensity][viewMode]}>
      {categories.map(category => (
        <CategoryCard
          key={category.id}
          category={category}
          bookmarkCount={
            itemCounts.bookmarkCountByCategory.get(category.id) ?? 0
          }
          childCategoryCount={
            itemCounts.childCountByCategory.get(category.id) ?? 0
          }
          onEdit={onEditCategory}
          locationLabel={
            searching
              ? categoryPathMap.get(category.id)?.slice(0, -1).join(' / ')
              : undefined
          }
          onOpen={searching ? selected => openCategory(selected.id) : undefined}
          appearance={appearance}
        />
      ))}
      {items.map(item => item.bookmark
        ? (
            <BookmarkCard
              key={item.renderKey}
              bookmark={item.bookmark}
              onEdit={onEdit}
              categoryPath={searching ? categoryPathMap.get(item.bookmark.categoryId)?.join(' / ') : undefined}
              onOpenCategory={searching ? () => openCategory(item.bookmark!.categoryId) : undefined}
              selectionMode={selectionMode}
              selected={selectedIds.has(item.bookmark.id)}
              onToggleSelection={() => onToggleSelection(item.bookmark!.id)}
              compact={viewMode === 'compact'}
              appearance={appearance}
              reorderEnabled={reorderEnabled}
              reorderIndex={pinnedReorder ? pinnedIndices.get(item.key) : undefined}
              pinnedReorder={pinnedReorder}
            />
          )
        : item.node)}
    </div>
  )
}
