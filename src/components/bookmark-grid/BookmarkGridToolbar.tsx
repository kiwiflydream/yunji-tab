import type { BookmarkSortMode, BookmarkViewMode } from '~/lib/types'
import { BookmarkPlus, LayoutGrid, List, ListChecks } from 'lucide-react'
import { InboxTriageDialog } from '~/components/InboxTriageDialog'
import { Button } from '~/components/ui/button'
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
  onStartSelection: () => void
}

export function BookmarkGridToolbar({
  activeCategoryId,
  searchQuery,
  searching,
  selectionMode,
  visibleBookmarkCount,
  visibleCategoryCount,
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
  const itemCount = visibleBookmarkCount + visibleCategoryCount

  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 border-l-2 border-primary/80 pl-3">
        <h2 className="truncate text-xl font-semibold tracking-[-0.015em] sm:text-2xl text-foreground">
          {title}
        </h2>
        <p className="mt-0.5 text-xs font-mono tabular-nums text-muted-foreground">
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
        <select
          value={sortMode}
          onChange={event =>
            void setSortMode(event.target.value as BookmarkSortMode)}
          aria-label={t('bookmarkSort')}
          className="h-8.5 rounded-lg border border-border/70 bg-card px-2.5 text-xs font-medium text-foreground shadow-xs outline-none transition-colors hover:border-border focus-visible:ring-2 focus-visible:ring-ring/25"
        >
          <option value="manual">{t('nativeOrder')}</option>
          <option value="name">{t('byName')}</option>
          <option value="recentlyAdded">{t('recentlyAdded')}</option>
          <option value="frequent">{t('byFrequency')}</option>
        </select>
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
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onStartSelection}
                disabled={visibleBookmarkCount === 0}
              >
                <ListChecks data-icon="inline-start" />
                {t('bulkManage')}
              </Button>
            )
          : null}
      </div>
    </div>
  )
}
