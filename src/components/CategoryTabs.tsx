import type { ReactNode } from 'react'
import type { CategoryTreeNode } from '~/lib/category-tree'
import type { Category } from '~/lib/types'
import { useDraggable } from '@dnd-kit/core'

import { ChevronRight, GripVertical, Pencil } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useMovePending } from '~/components/BookmarkDragDropContext'
import { Button } from '~/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import { useCategoryDropTarget } from '~/components/useCategoryDropTarget'
import { bookmarkSearchEntryScore } from '~/lib/bookmark-search'
import { getCategoryAncestorIds } from '~/lib/category-tree'
import { VIRTUAL_CATEGORIES } from '~/lib/default-data'
import { getNavigationDerivedData } from '~/lib/navigation-derived'
import { useBookmarks, useCategories, useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'
import { cn } from '~/lib/utils'

const MAX_TREE_INDENT_DEPTH = 3

interface CategoryTabProps {
  category: Category
  active: boolean
  count: number
  onSelect: (id: string) => void
  onEdit: (category: Category) => void
  fullWidth: boolean
  showCount: boolean
  leadingControl?: ReactNode
}

function CategoryTab({
  category,
  active,
  count,
  onSelect,
  onEdit,
  fullWidth,
  showCount,
  leadingControl,
}: CategoryTabProps) {
  const { categoryName, t } = useI18n()
  const movePending = useMovePending()
  const {
    attributes,
    listeners,
    isDragging,
    setActivatorNodeRef,
    setNodeRef: setDragNodeRef,
  } = useDraggable({
    id: `category-sidebar:${category.id}`,
    disabled: !category.modifiable || movePending,
    data: {
      type: 'category',
      categoryId: category.id,
      parentId: category.parentId,
      label: category.name,
      emoji: category.emoji,
    },
  })
  const { isOver, setDropNodeRef, validation } = useCategoryDropTarget(
    category,
    'sidebar',
  )
  const setNodeRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDragNodeRef(node)
      setDropNodeRef(node)
    },
    [setDragNodeRef, setDropNodeRef],
  )

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group relative flex h-9 shrink-0 items-center gap-1 rounded-lg text-sm transition-all duration-150',
        fullWidth && 'lg:w-full',
        active
          ? 'bg-accent font-medium text-accent-foreground shadow-xs relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:bg-primary before:rounded-r-full'
          : 'text-foreground hover:bg-accent/65',
        isDragging && 'opacity-35',
        isOver
        && validation?.status === 'valid'
        && 'bg-accent text-foreground ring-2 ring-ring',
        isOver
        && validation?.status === 'invalid'
        && 'bg-destructive/10 text-destructive ring-2 ring-destructive/70',
        isOver && validation?.status === 'noop' && 'ring-2 ring-border',
      )}
    >
      {leadingControl}
      <button
        type="button"
        onClick={() => onSelect(category.id)}
        aria-pressed={active}
        className={cn(
          'flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          leadingControl ? 'pl-0' : 'pl-2.5',
        )}
      >
        <span className="w-5 shrink-0 truncate text-center text-base">
          {category.emoji}
        </span>
        <span
          title={categoryName(category)}
          className="min-w-0 flex-1 truncate text-[13px] font-medium"
        >
          {categoryName(category)}
        </span>
        {showCount
          ? (
              <span
                className={cn(
                  'ml-auto shrink-0 rounded-full bg-muted/60 px-1.5 py-0.5 text-[10.5px] font-mono tabular-nums text-muted-foreground transition-opacity',
                  category.modifiable
                  && 'group-hover:opacity-0 group-focus-within:opacity-0',
                  active && 'bg-background/60 text-foreground font-medium',
                )}
              >
                {count}
              </span>
            )
          : null}
      </button>

      {category.modifiable
        ? (
            <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center gap-0.5 rounded-md bg-accent/95 px-0.5 opacity-0 shadow-xs ring-1 ring-border/40 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
              <button
                ref={setActivatorNodeRef}
                type="button"
                disabled={movePending}
                {...attributes}
                {...listeners}
                title={t('dragFolder')}
                aria-label={t('dragNamedFolder', { name: category.name })}
                className={cn(
                  'flex size-6 touch-none items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 active:cursor-grabbing',
                  active
                    ? 'text-foreground/70 hover:bg-background/65 hover:text-foreground'
                    : 'text-muted-foreground hover:bg-background/65 hover:text-foreground',
                )}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onEdit(category)}
                title={t('editFolder')}
                aria-label={t('editNamedFolder', { name: category.name })}
                className={cn(
                  'flex size-6 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'text-foreground/70 hover:bg-background/65 hover:text-foreground'
                    : 'text-muted-foreground hover:bg-background/65 hover:text-foreground',
                )}
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )
        : null}
    </div>
  )
}

interface CategoryTreeItemsProps {
  nodes: CategoryTreeNode[]
  depth: number
  activeId: string
  collapsedIds: Set<string>
  forcedExpandedIds: Set<string>
  showCount: boolean
  count: (id: string) => number
  onSelect: (id: string) => void
  onEdit: (category: Category) => void
  onToggle: (id: string) => void
}

function CategoryTreeItems({
  nodes,
  depth,
  activeId,
  collapsedIds,
  forcedExpandedIds,
  showCount,
  count,
  onSelect,
  onEdit,
  onToggle,
}: CategoryTreeItemsProps) {
  const { t } = useI18n()
  return nodes.map(({ category, children }) => {
    const hasChildren = children.length > 0
    const expanded
      = forcedExpandedIds.has(category.id) || !collapsedIds.has(category.id)
    const leadingControl = hasChildren
      ? (
          <button
            type="button"
            aria-label={t(expanded ? 'collapseFolder' : 'expandFolder', {
              name: category.name,
            })}
            aria-expanded={expanded}
            onClick={() => onToggle(category.id)}
            className="hidden size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:flex"
          >
            <ChevronRight className={cn('size-3.5 transition-transform duration-200 ease-out', expanded && 'rotate-90')} />
          </button>
        )
      : (
          <span aria-hidden="true" className="hidden size-7 shrink-0 lg:block" />
        )

    return (
      <li key={category.id} className="contents lg:block">
        <CategoryTab
          category={category}
          active={category.id === activeId}
          count={count(category.id)}
          fullWidth
          showCount={showCount}
          leadingControl={leadingControl}
          onSelect={onSelect}
          onEdit={onEdit}
        />
        {hasChildren && expanded
          ? (
              <ul
                className={cn(
                  'contents lg:flex lg:flex-col lg:gap-1',
                  depth < MAX_TREE_INDENT_DEPTH
                  && 'lg:ml-3.5 lg:border-l lg:border-border/50 lg:pl-1.5',
                )}
              >
                <CategoryTreeItems
                  nodes={children}
                  depth={depth + 1}
                  activeId={activeId}
                  collapsedIds={collapsedIds}
                  forcedExpandedIds={forcedExpandedIds}
                  showCount={showCount}
                  count={count}
                  onSelect={onSelect}
                  onEdit={onEdit}
                  onToggle={onToggle}
                />
              </ul>
            )
          : null}
      </li>
    )
  })
}

interface CategoryTabsProps {
  onEditCategory: (category: Category) => void
}

export function CategoryTabs({ onEditCategory }: CategoryTabsProps) {
  const { t } = useI18n()
  const categories = useCategories()
  const bookmarks = useBookmarks()
  const activeId = useNavStore(s => s.activeCategoryId)
  const setActive = useNavStore(s => s.setActiveCategory)
  const usage = useNavStore(s => s.usage)
  const searchQuery = useNavStore(s => s.bookmarkSearchQuery)
  const setSearchQuery = useNavStore(s => s.setBookmarkSearchQuery)
  const savedSearches = useNavStore(s => s.settings.savedSearches)
  const appearance = useNavStore(s => s.settings.appearance)
  const navLayout = appearance.navLayout
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [smartCategoriesOpen, setSmartCategoriesOpen] = useState(false)

  const savedCategories: Category[] = useMemo(
    () =>
      savedSearches.map(item => ({
        id: `saved-search:${item.id}`,
        name: item.name,
        emoji: '🔖',
        parentId: 'all',
        modifiable: false,
      })),
    [savedSearches],
  )
  const virtualCategories = appearance.navItems.smartCategories
    ? [...VIRTUAL_CATEGORIES]
    : VIRTUAL_CATEGORIES.filter(
        category => category.id === 'all' || category.id === 'inbox',
      )
  const visibleSavedCategories = appearance.navItems.savedSearches
    ? savedCategories
    : []
  const utilityCategories = [
    ...virtualCategories,
    ...visibleSavedCategories,
  ]
  const allCategory = utilityCategories.find(category => category.id === 'all')
  const smartCategoryItems = virtualCategories.filter(
    category => category.id !== 'all',
  )
  const activeSmartCategory = smartCategoryItems.find(
    category => category.id === activeId,
  )
  const derived = useMemo(
    () => getNavigationDerivedData(bookmarks, categories),
    [bookmarks, categories],
  )
  const categoryTree = derived.categoryTree
  const forcedExpandedIds = useMemo(
    () => getCategoryAncestorIds(activeId, categories),
    [activeId, categories],
  )
  const { bookmarkCountByCategory, childCategoryCountByCategory }
    = derived
  const smartCounts = useMemo(() => {
    let used = 0
    for (const bookmark of bookmarks) {
      if (usage[bookmark.url]?.openCount > 0)
        used += 1
    }
    return { used, ...derived.smartCounts }
  }, [bookmarks, derived.smartCounts, usage])

  // 数字与主区当前展示的内容保持一致：直属书签 + 直属子目录。
  const count = (id: string) => {
    if (id === 'all')
      return bookmarks.length
    if (id === 'frequent' || id === 'recent')
      return smartCounts.used
    if (id === 'inbox')
      return smartCounts.inbox
    if (id === 'pinned')
      return smartCounts.pinned
    if (id === 'untagged')
      return smartCounts.untagged
    if (id === 'undescribed')
      return smartCounts.undescribed
    if (id.startsWith('saved-search:')) {
      const saved = savedSearches.find(
        item => `saved-search:${item.id}` === id,
      )
      return saved
        ? derived.searchEntries.filter(
          entry => bookmarkSearchEntryScore(entry, saved.query) >= 0,
        ).length
        : 0
    }
    return (
      (bookmarkCountByCategory.get(id) ?? 0)
      + (childCategoryCountByCategory.get(id) ?? 0)
    )
  }

  const toggleCategory = (id: string) => {
    const isForcedExpanded = forcedExpandedIds.has(id)
    if (isForcedExpanded)
      setActive(id)
    setCollapsedCategoryIds((current) => {
      const next = new Set(current)
      if (isForcedExpanded)
        next.add(id)
      else if (next.has(id))
        next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderCategory = (category: Category) => {
    const saved = savedSearches.find(
      item => `saved-search:${item.id}` === category.id,
    )
    const active = saved
      ? searchQuery === saved.query
      : category.id === activeId
    return (
      <CategoryTab
        key={category.id}
        category={category}
        active={active}
        count={count(category.id)}
        fullWidth={navLayout === 'sidebar'}
        showCount={appearance.navItems.counts}
        onSelect={(id) => {
          if (saved) {
            setActive('all')
            setSearchQuery(saved.query)
          }
          else {
            setActive(id)
          }
        }}
        onEdit={onEditCategory}
      />
    )
  }

  const treeEnabled
    = navLayout === 'sidebar' && appearance.navItems.categoryTree
  const smartCategoriesCollapsible
    = navLayout === 'sidebar' && smartCategoryItems.length > 1

  return (
    <nav
      aria-label={t('bookmarkCategories')}
      className={cn(
        'flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        navLayout === 'sidebar'
          ? 'lg:h-full lg:flex-col lg:gap-1 lg:overflow-x-hidden lg:overflow-y-auto'
          : 'lg:overflow-x-auto',
      )}
    >
      {smartCategoriesCollapsible
        ? (
            <>
              {allCategory ? renderCategory(allCategory) : null}
              <Collapsible
                open={smartCategoriesOpen}
                onOpenChange={setSmartCategoriesOpen}
                className="flex shrink-0 gap-1 lg:w-full lg:flex-col"
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 justify-start gap-2 lg:w-full"
                  >
                    <ChevronRight
                      data-icon="inline-start"
                      className={cn(
                        'transition-transform',
                        smartCategoriesOpen && 'rotate-90',
                      )}
                    />
                    {t('smartCategories')}
                    <span className="ml-auto text-xs tabular-nums opacity-60">
                      {smartCategoryItems.length}
                    </span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="flex gap-1 lg:flex-col">
                  {smartCategoriesOpen
                    ? smartCategoryItems.map(renderCategory)
                    : null}
                </CollapsibleContent>
              </Collapsible>
              {!smartCategoriesOpen && activeSmartCategory
                ? renderCategory(activeSmartCategory)
                : null}
              {visibleSavedCategories.map(renderCategory)}
            </>
          )
        : utilityCategories.map(renderCategory)}
      {treeEnabled
        ? (
            <ul className="contents lg:flex lg:w-full lg:flex-col lg:gap-1">
              <CategoryTreeItems
                nodes={categoryTree}
                depth={0}
                activeId={activeId}
                collapsedIds={collapsedCategoryIds}
                forcedExpandedIds={forcedExpandedIds}
                showCount={appearance.navItems.counts}
                count={count}
                onSelect={setActive}
                onEdit={onEditCategory}
                onToggle={toggleCategory}
              />
            </ul>
          )
        : (
            categories.map(renderCategory)
          )}
    </nav>
  )
}
