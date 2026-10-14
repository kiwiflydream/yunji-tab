import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { CategoryTreeNode } from '~/lib/category-tree'
import type { Category } from '~/lib/types'

import { useDraggable } from '@dnd-kit/core'
import { ChevronRight, Clock3, FileText, Folder, GripVertical, Inbox, Layers, LayoutGrid, ListFilter, Pencil, Pin, Star, Tag } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useMovePending } from '~/components/BookmarkDragDropContext'
import { Button } from '~/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import { useCategoryDropTarget } from '~/components/useCategoryDropTarget'
import { useBookmarkGroupsStore } from '~/lib/bookmark-groups-store'
import { countMatchingSearchEntries } from '~/lib/bookmark-search'
import { getCategoryAncestorIds } from '~/lib/category-tree'
import { DEFAULT_CATEGORY_EMOJI, VIRTUAL_CATEGORIES } from '~/lib/default-data'
import { useSlidingIndicator } from '~/lib/motion'
import { getNavigationDerivedData } from '~/lib/navigation-derived'
import { useBookmarks, useCategories, useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'
import { cn } from '~/lib/utils'

const MAX_TREE_INDENT_DEPTH = 3

// Built-in entries and untouched folders share one line-icon set; user-picked emoji still win.
const builtInCategoryIcons: Record<string, LucideIcon> = {
  'all': LayoutGrid,
  'inbox': Inbox,
  'pinned': Pin,
  'frequent': Star,
  'recent': Clock3,
  'untagged': Tag,
  'undescribed': FileText,
  'bookmark-groups': Layers,
}

function CategoryIcon({ category, active }: { category: Category, active: boolean }) {
  const Icon = category.id.startsWith('saved-search:')
    ? ListFilter
    : builtInCategoryIcons[category.id] ?? (category.emoji === DEFAULT_CATEGORY_EMOJI ? Folder : undefined)
  return (
    <span data-slot="category-icon" className="flex w-5 shrink-0 items-center justify-center truncate text-base">
      {Icon
        ? <Icon aria-hidden="true" strokeWidth={1.75} className={cn('size-4', active ? 'text-primary' : 'text-muted-foreground')} />
        : category.emoji}
    </span>
  )
}

interface CategoryTabProps {
  accessibleName?: string
  category: Category
  active: boolean
  count: number
  onSelect: (id: string) => void
  onEdit: (category: Category) => void
  fullWidth: boolean
  showCount: boolean
  showIcon: boolean
  leadingControl?: ReactNode
  reserveLeadingSpace?: boolean
}

function CategoryTab({
  accessibleName,
  category,
  active,
  count,
  onSelect,
  onEdit,
  fullWidth,
  showCount,
  showIcon,
  leadingControl,
  reserveLeadingSpace = false,
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
      data-category-tab
      data-active={active || undefined}
      className={cn(
        'group relative flex h-9 shrink-0 items-center gap-1 rounded-lg text-sm transition-all duration-150',
        fullWidth && 'lg:w-full',
        active
          ? 'bg-accent font-medium text-accent-foreground'
          : 'text-foreground/75 hover:bg-accent/65 hover:text-foreground',
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
      {leadingControl ?? (reserveLeadingSpace
        ? <span aria-hidden="true" className="hidden size-7 shrink-0 lg:block" />
        : null)}
      <button
        type="button"
        aria-label={accessibleName}
        onClick={() => onSelect(category.id)}
        aria-pressed={active}
        className={cn(
          'flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg pl-2.5 pr-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          (leadingControl || reserveLeadingSpace) && 'lg:pl-0',
        )}
      >
        {showIcon ? <CategoryIcon category={category} active={active} /> : null}
        <span
          title={categoryName(category)}
          className="min-w-0 flex-1 truncate text-[13px]"
        >
          {categoryName(category)}
        </span>
        {showCount && count > 0
          ? (
              <span
                className={cn(
                  'ml-auto shrink-0 px-1 text-xs tabular-nums text-muted-foreground transition-opacity',
                  category.modifiable
                  && 'group-hover:opacity-0 group-focus-within:opacity-0',
                  active && 'text-accent-foreground',
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
  showIcon: boolean
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
  showIcon,
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
      : null

    return (
      <li key={category.id} className="contents lg:block">
        <CategoryTab
          category={category}
          active={category.id === activeId}
          count={count(category.id)}
          fullWidth
          showCount={showCount}
          showIcon={showIcon}
          leadingControl={leadingControl}
          reserveLeadingSpace
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
                  showIcon={showIcon}
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
  groupsActive?: boolean
  onSelectGroups?: () => void
  onSelectCategory?: () => void
}

export function CategoryTabs({ onEditCategory, groupsActive, onSelectGroups, onSelectCategory }: CategoryTabsProps) {
  const { t } = useI18n()
  const categories = useCategories()
  const bookmarks = useBookmarks()
  const activeId = useNavStore(s => s.activeCategoryId)
  const setActiveCategory = useNavStore(s => s.setActiveCategory)
  const groupCount = useBookmarkGroupsStore(state => state.groups.length)
  const groupsEnabled = useNavStore(state => state.settings.bookmarkGroupsEnabled)
  const pinnedGroupCount = useBookmarkGroupsStore(state => state.groups.filter(group => group.pinnedAt).length)
  const setActive = (id: string) => {
    onSelectCategory?.()
    setActiveCategory(id)
  }
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
  const navRef = useRef<HTMLElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  useSlidingIndicator(navRef, indicatorRef, '[data-category-tab][data-active]', groupsActive ? 'groups' : `${activeId}\u0000${searchQuery}`)

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
  const showCounts = appearance.navItems.counts
  // savedSearch 计数依赖 derived 的 searchEntries 索引；按稳定的 derived 与
  // savedSearches 缓存，输入 / 布局变化时不重扫整组书签。counts 隐藏时完全不计算。
  const savedSearchCounts = useMemo(() => {
    const counts = new Map<string, number>()
    if (!showCounts || !appearance.navItems.savedSearches)
      return counts
    const entries = derived.searchEntries
    for (const item of savedSearches) {
      counts.set(
        `saved-search:${item.id}`,
        countMatchingSearchEntries(entries, item.query),
      )
    }
    return counts
  }, [
    derived,
    savedSearches,
    showCounts,
    appearance.navItems.savedSearches,
  ])
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
      return smartCounts.pinned + (groupsEnabled ? pinnedGroupCount : 0)
    if (id === 'untagged')
      return smartCounts.untagged
    if (id === 'undescribed')
      return smartCounts.undescribed
    if (id.startsWith('saved-search:')) {
      return savedSearchCounts.get(id) ?? 0
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

  const treeEnabled
    = navLayout === 'sidebar' && appearance.navItems.categoryTree
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
        active={!groupsActive && active}
        count={count(category.id)}
        fullWidth={navLayout === 'sidebar'}
        showCount={showCounts}
        showIcon={appearance.navItems.icons}
        reserveLeadingSpace={treeEnabled}
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

  const smartCategoriesCollapsible
    = navLayout === 'sidebar' && smartCategoryItems.length > 1

  const groupEntry = groupsEnabled && onSelectGroups
    ? (
        <CategoryTab
          category={{ id: 'bookmark-groups', name: t('bookmarkGroups'), emoji: '🗂️', parentId: 'all', modifiable: false }}
          accessibleName={t('bookmarkGroups')}
          active={Boolean(groupsActive)}
          count={groupCount}
          fullWidth={navLayout === 'sidebar'}
          showCount={showCounts}
          showIcon={appearance.navItems.icons}
          reserveLeadingSpace={treeEnabled}
          onSelect={onSelectGroups}
          onEdit={onEditCategory}
        />
      )
    : null

  return (
    <nav
      ref={navRef}
      aria-label={t('bookmarkCategories')}
      className={cn(
        'relative flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        navLayout === 'sidebar'
          ? 'lg:h-full lg:flex-col lg:gap-1 lg:overflow-x-hidden lg:overflow-y-auto'
          : 'lg:overflow-x-auto',
      )}
    >
      <span ref={indicatorRef} aria-hidden="true" hidden className="pointer-events-none absolute left-0 top-0 rounded-lg bg-accent" />
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
                    className={cn(
                      'shrink-0 justify-start gap-2 pl-2.5 pr-2 lg:w-full',
                      treeEnabled && 'lg:pl-8',
                    )}
                  >
                    <span aria-hidden="true" className="flex w-5 shrink-0 items-center justify-center">
                      <ChevronRight
                        data-icon="inline-start"
                        className={cn(
                          'transition-transform',
                          smartCategoriesOpen && 'rotate-90',
                        )}
                      />
                    </span>
                    <span className="min-w-0 truncate">{t('smartCategories')}</span>
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
              {groupEntry}
              {visibleSavedCategories.map(renderCategory)}
            </>
          )
        : (
            <>
              {utilityCategories.map(renderCategory)}
              {groupEntry}
            </>
          )}
      {treeEnabled
        ? (
            <ul className="contents lg:flex lg:w-full lg:flex-col lg:gap-1">
              <CategoryTreeItems
                nodes={categoryTree}
                depth={0}
                activeId={groupsActive ? '' : activeId}
                collapsedIds={collapsedCategoryIds}
                forcedExpandedIds={forcedExpandedIds}
                showCount={showCounts}
                showIcon={appearance.navItems.icons}
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
