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
import { useNavStore } from '~/lib/store'

interface BookmarkGridItemsProps {
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
      {bookmarks.map((bookmark, index) => (
        <BookmarkCard
          key={bookmark.id}
          bookmark={bookmark}
          onEdit={onEdit}
          categoryPath={
            searching
              ? categoryPathMap.get(bookmark.categoryId)?.join(' / ')
              : undefined
          }
          onOpenCategory={
            searching ? () => openCategory(bookmark.categoryId) : undefined
          }
          selectionMode={selectionMode}
          selected={selectedIds.has(bookmark.id)}
          onToggleSelection={() => onToggleSelection(bookmark.id)}
          compact={viewMode === 'compact'}
          appearance={appearance}
          reorderEnabled={reorderEnabled}
          reorderIndex={pinnedReorder ? index : undefined}
          pinnedReorder={pinnedReorder}
        />
      ))}
    </div>
  )
}
