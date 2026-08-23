import type { AppearanceSettings, Category } from '~/lib/types'
import { useDraggable } from '@dnd-kit/core'
import { ChevronRight, Folder, GripVertical, Pencil } from 'lucide-react'

import { useCallback } from 'react'
import { useMovePending } from '~/components/BookmarkDragDropContext'
import { useCategoryDropTarget } from '~/components/useCategoryDropTarget'
import {
  cardStyleClass,
  iconSizeClass,
  radiusClass,
} from '~/lib/appearance'
import { DEFAULT_CATEGORY_EMOJI } from '~/lib/default-data'
import { useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'
import { cn } from '~/lib/utils'

interface CategoryCardProps {
  category: Category
  bookmarkCount: number
  childCategoryCount: number
  onEdit: (category: Category) => void
  locationLabel?: string
  onOpen?: (category: Category) => void
  appearance: AppearanceSettings
}

export function CategoryCard({
  category,
  bookmarkCount,
  childCategoryCount,
  onEdit,
  locationLabel,
  onOpen,
  appearance,
}: CategoryCardProps) {
  const { t } = useI18n()
  const setActiveCategory = useNavStore(s => s.setActiveCategory)
  const movePending = useMovePending()
  const {
    attributes,
    listeners,
    isDragging,
    setActivatorNodeRef,
    setNodeRef: setDragNodeRef,
  } = useDraggable({
    id: `category:${category.id}`,
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
    'card',
  )
  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      setDragNodeRef(node)
      setDropNodeRef(node)
    },
    [setDragNodeRef, setDropNodeRef],
  )
  const parts = [
    t('folderBookmarkCount', { count: bookmarkCount }),
    childCategoryCount > 0 ? t('subfolderCount', { count: childCategoryCount }) : '',
  ].filter(Boolean)
  const iconClasses = iconSizeClass[appearance.iconSize]

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group relative flex min-h-[108px] border-dashed [contain-intrinsic-size:108px] [content-visibility:auto] transition-[background-color,border-color,box-shadow,transform] duration-200',
        cardStyleClass[appearance.cardStyle],
        radiusClass[appearance.radius],
        isDragging && 'opacity-35',
        isOver
        && validation?.status === 'valid'
        && 'bg-accent ring-2 ring-ring',
        isOver
        && validation?.status === 'invalid'
        && 'bg-destructive/10 ring-2 ring-destructive/70',
        isOver && validation?.status === 'noop' && 'ring-2 ring-border',
      )}
    >
      <button
        data-nav-item
        type="button"
        onClick={() =>
          onOpen ? onOpen(category) : setActiveCategory(category.id)}
        aria-label={t('openFolder', { name: category.name })}
        className="flex min-w-0 flex-1 items-center gap-4 px-4 py-4 pr-16 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/25"
      >
        <div
          className={cn(
            'flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-secondary/85 to-secondary/40 text-foreground ring-1 ring-border/45 shadow-xs group-hover:ring-border/65 transition-all',
            iconClasses.grid,
          )}
        >
          {category.emoji === DEFAULT_CATEGORY_EMOJI
            ? (
                <Folder className="size-6 text-muted-foreground/80" />
              )
            : (
                <span
                  className="max-w-full truncate px-2 text-3xl"
                  aria-hidden="true"
                >
                  {category.emoji}
                </span>
              )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14.5px] font-medium leading-snug tracking-[-0.01em] group-hover:text-primary transition-colors">
              {category.name}
            </span>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
          {locationLabel
            ? (
                <p
                  className="mt-0.5 truncate text-xs text-muted-foreground"
                  title={locationLabel}
                >
                  {locationLabel}
                </p>
              )
            : null}
          <p className="mt-1 text-xs leading-4 text-muted-foreground">
            {parts.join(' · ')}
          </p>
        </div>
      </button>

      {category.modifiable
        ? (
            <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-lg border border-border/50 bg-card/90 p-0.5 shadow-xs backdrop-blur-xs opacity-70 transition-all duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
              <button
                ref={setActivatorNodeRef}
                type="button"
                disabled={movePending}
                {...attributes}
                {...listeners}
                title={t('dragFolder')}
                aria-label={t('dragNamedFolder', { name: category.name })}
                className="flex size-6 touch-none items-center justify-center rounded-md text-muted-foreground/80 transition-colors hover:bg-accent hover:text-foreground active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 active:cursor-grabbing"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onEdit(category)}
                title={t('editFolder')}
                aria-label={t('editNamedFolder', { name: category.name })}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground/80 transition-colors hover:bg-accent hover:text-foreground active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )
        : null}
    </div>
  )
}
