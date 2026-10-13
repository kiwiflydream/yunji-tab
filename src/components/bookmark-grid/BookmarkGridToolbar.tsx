import type { BookmarkSortMode, BookmarkViewMode } from '~/lib/types'
import { BookmarkPlus, LayoutGrid, List, ListChecks, SlidersHorizontal } from 'lucide-react'
import { InboxTriageDialog } from '~/components/InboxTriageDialog'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'
import { VIRTUAL_CATEGORIES } from '~/lib/default-data'
import { useCategories, useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

interface BookmarkGridToolbarProps {
  activeCategoryId: string
  searchQuery: string
  searching: boolean
  selectionMode: boolean
  visibleBookmarkCount: number
  visibleCategoryCount: number
  additionalItemCount?: number
  onStartSelection: () => void
}

export function BookmarkGridToolbar({
  activeCategoryId,
  searchQuery,
  searching,
  selectionMode,
  visibleBookmarkCount,
  visibleCategoryCount,
  additionalItemCount = 0,
  onStartSelection,
}: BookmarkGridToolbarProps) {
  const { categoryName, t } = useI18n()
  const categories = useCategories()
  const sortMode = useNavStore(state => state.settings.bookmarkSortMode)
  const viewMode = useNavStore(state => state.settings.bookmarkViewMode)
  const showSavedSearches = useNavStore(
    state => state.settings.appearance.navItems.savedSearches,
  )
  const savedSearches = useNavStore(state => state.settings.savedSearches)
  const setSortMode = useNavStore(state => state.setBookmarkSortMode)
  const setViewMode = useNavStore(state => state.setBookmarkViewMode)
  const addSavedSearch = useNavStore(state => state.addSavedSearch)
  const normalizedQuery = searchQuery.trim()
  const activeCategory = [...VIRTUAL_CATEGORIES, ...categories].find(
    category => category.id === activeCategoryId,
  )
  const title = searching
    ? t('searchResults', { query: normalizedQuery })
    : activeCategory
      ? categoryName(activeCategory)
      : t('allBookmarks')
  const itemCount = visibleBookmarkCount + visibleCategoryCount + (selectionMode ? 0 : additionalItemCount)

  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h2 className="truncate text-xl font-semibold tracking-[-0.015em] text-foreground">
          {title}
        </h2>
        <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {t('itemCount', { count: itemCount })}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {activeCategoryId === 'inbox' ? <InboxTriageDialog /> : null}
        {searching && showSavedSearches
          ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={savedSearches.some(
                  item => item.query === normalizedQuery,
                )}
                onClick={() => void addSavedSearch(normalizedQuery)}
                className="h-8.5 text-xs shadow-xs"
              >
                <BookmarkPlus data-icon="inline-start" className="size-3.5" />
                {t('savedFilters')}
              </Button>
            )
          : null}
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(mode) => {
            if (mode)
              void setViewMode(mode as BookmarkViewMode)
          }}
          variant="outline"
          size="sm"
          aria-label={t('bookmarkView')}
          className="rounded-lg border border-border/60 bg-muted/40 p-0.5 shadow-2xs"
        >
          <ToggleGroupItem
            value="grid"
            title={t('cardView')}
            aria-label={t('cardView')}
          >
            <LayoutGrid />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="compact"
            title={t('compactView')}
            aria-label={t('compactView')}
          >
            <List />
          </ToggleGroupItem>
        </ToggleGroup>
        {!selectionMode
          ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="outline">
                    <SlidersHorizontal data-icon="inline-start" />
                    {t('organizeBookmarks')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={6} className="w-48">
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    {t('bookmarkSort')}
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={sortMode}
                    onValueChange={mode => void setSortMode(mode as BookmarkSortMode)}
                  >
                    <DropdownMenuRadioItem value="manual">{t('nativeOrder')}</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="name">{t('byName')}</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="recentlyAdded">{t('recentlyAdded')}</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="frequent">{t('byFrequency')}</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={onStartSelection}
                    disabled={visibleBookmarkCount === 0}
                  >
                    <ListChecks />
                    {t('bulkManage')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          : null}
      </div>
    </div>
  )
}
