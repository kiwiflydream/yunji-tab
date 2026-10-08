import type { MouseEvent, PointerEvent } from 'react'
import type { BookmarkDropData } from '~/lib/drag-drop'
import type { AppearanceSettings, Bookmark } from '~/lib/types'
import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core'

import {
  FolderTree,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useMovePending } from '~/components/BookmarkDragDropContext'
import { BookmarkIcon } from '~/components/BookmarkIcon'
import { Badge } from '~/components/ui/badge'
import { Checkbox } from '~/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  cardActionButtonClass,
  cardActionsClass,
  cardActionsHoverClass,
  cardContainerClass,
  cardContentClass,
  cardSizeClass,
  cardStyleClass,
  cardTitleClass,
  descriptionLineClass,
  radiusClass,
  titleLineClass,
} from '~/lib/appearance'
import { openBookmarkUrl } from '~/lib/bookmark-urls'
import {
  getBookmarkDropPlacement,
  readDragItemData,
  validateBookmarkDrop,
} from '~/lib/drag-drop'
import { useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'
import { cn } from '~/lib/utils'

interface BookmarkCardProps {
  bookmark: Bookmark
  onEdit?: (bookmark: Bookmark) => void
  categoryPath?: string
  onOpenCategory?: () => void
  selectionMode?: boolean
  selected?: boolean
  onToggleSelection?: () => void
  compact?: boolean
  appearance: AppearanceSettings
  reorderEnabled?: boolean
  reorderIndex?: number
  pinnedReorder?: boolean
}

function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  }
  catch {
    return url
  }
}

export function BookmarkCard({
  bookmark,
  onEdit,
  categoryPath,
  onOpenCategory,
  selectionMode = false,
  selected = false,
  onToggleSelection,
  compact = false,
  appearance,
  reorderEnabled = false,
  reorderIndex,
  pinnedReorder = false,
}: BookmarkCardProps) {
  const { t } = useI18n()
  const removeBookmark = useNavStore(s => s.removeBookmark)
  const recordBookmarkOpen = useNavStore(s => s.recordBookmarkOpen)
  const setBookmarkPinned = useNavStore(s => s.setBookmarkPinned)
  const movePending = useMovePending()
  const {
    attributes,
    listeners,
    isDragging,
    setActivatorNodeRef,
    setNodeRef: setDragNodeRef,
  }
    = useDraggable({
      id: `bookmark:${bookmark.id}`,
      disabled: movePending || selectionMode,
      data: {
        type: 'bookmark',
        bookmarkId: bookmark.id,
        url: bookmark.url,
        categoryId: bookmark.categoryId,
        label: bookmark.name,
        index: reorderIndex ?? bookmark.index ?? 0,
        pinned: Boolean(bookmark.pinnedAt),
        reorderEnabled,
        pinnedReorder,
      },
    })
  const reorderTarget: BookmarkDropData = {
    type: 'bookmark-drop',
    bookmarkId: bookmark.id,
    url: bookmark.url,
    categoryId: bookmark.categoryId,
    label: bookmark.name,
    index: reorderIndex ?? bookmark.index ?? 0,
    pinned: Boolean(bookmark.pinnedAt),
    pinnedReorder,
  }
  const { active } = useDndContext()
  const activeDragItem = readDragItemData(active?.data.current)
  const { isOver: isReorderTarget, setNodeRef: setDropNodeRef }
    = useDroppable({
      id: `bookmark-drop:${bookmark.id}`,
      disabled:
        !reorderEnabled
        || selectionMode
        || activeDragItem?.type === 'category',
      data: reorderTarget,
    })
  const cardRef = useRef<HTMLElement | null>(null)
  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      cardRef.current = node
      setDragNodeRef(node)
      setDropNodeRef(node)
    },
    [setDragNodeRef, setDropNodeRef],
  )
  const reorderValidation
    = isReorderTarget && activeDragItem
      ? validateBookmarkDrop(activeDragItem, reorderTarget)
      : null
  const reorderPlacement
    = activeDragItem && activeDragItem.type !== 'category'
      ? getBookmarkDropPlacement(activeDragItem, reorderTarget)
      : null
  const [opening, setOpening] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const fields = appearance.cardFields
  const showDescription = fields.description && Boolean(bookmark.description)
  const showTags
    = fields.tags && fields.maxVisibleTags > 0 && Boolean(bookmark.tags?.length)
  const showCategoryPath
    = fields.categoryPath
      && Boolean(categoryPath)
      && Boolean(onOpenCategory)
      && !selectionMode
  const visibleTags = bookmark.tags?.slice(0, fields.maxVisibleTags) ?? []
  const host = displayHost(bookmark.url)

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError('')
    try {
      await removeBookmark(bookmark.id)
    }
    catch {
      setDeleteError(t('deleteFailed'))
      setDeleting(false)
    }
  }
  const handleEdit = () => {
    onEdit?.(bookmark)
  }
  const handleTogglePinned = () => {
    void setBookmarkPinned(bookmark.url, !bookmark.pinnedAt).catch(
      () => undefined,
    )
  }
  const handleOpen = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (selectionMode) {
      event.preventDefault()
      onToggleSelection?.()
      return
    }
    void recordBookmarkOpen(bookmark.url).catch(() => undefined)
    if (
      event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) {
      return
    }

    event.preventDefault()
    if (opening)
      return

    setOpening(true)
    try {
      await openBookmarkUrl(bookmark)
    }
    finally {
      setOpening(false)
    }
  }
  const handleDirectDragPointerDown = (
    event: PointerEvent<HTMLAnchorElement>,
  ) => {
    if (event.pointerType === 'mouse')
      listeners?.onPointerDown?.(event)
  }

  return (
    <article
      ref={setNodeRef}
      className={cn(
        cardContainerClass,
        cardStyleClass[appearance.cardStyle],
        radiusClass[appearance.radius],
        compact ? cardSizeClass.compact : cardSizeClass.grid,
        isDragging && 'opacity-35',
        selected && 'ring-2 ring-ring',
        isReorderTarget
        && reorderValidation?.status === 'valid'
        && 'ring-2 ring-ring',
        isReorderTarget
        && reorderValidation?.status === 'invalid'
        && 'ring-2 ring-destructive/70',
      )}
    >
      {selectionMode
        ? (
            <div className="absolute left-3 top-3 z-20 flex size-8 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border/60">
              <Checkbox
                checked={selected}
                onCheckedChange={onToggleSelection}
                aria-label={t(selected ? 'deselectNamed' : 'selectNamed', {
                  name: bookmark.name,
                })}
              />
            </div>
          )
        : null}
      <a
        data-nav-item
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        draggable={false}
        onPointerDown={handleDirectDragPointerDown}
        onDragStart={event => event.preventDefault()}
        onClick={event => void handleOpen(event)}
        aria-busy={opening}
        className={cn(
          'flex items-center focus-visible:outline-none',
          compact ? cardContentClass.compact : cardContentClass.grid,
          !selectionMode
          && !movePending
          && 'cursor-grab active:cursor-grabbing',
          movePending && 'cursor-wait',
          showCategoryPath && 'pb-9',
        )}
      >
        <BookmarkIcon icon={bookmark.icon} url={bookmark.url} name={bookmark.name} appearance={appearance} compact={compact} />

        <div className="min-w-0 flex-1 pr-9">
          <div
            className={cn(
              cardTitleClass,
              titleLineClass[fields.titleLines],
            )}
          >
            {bookmark.name}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {host}
          </p>
          {showDescription && !compact && (
            <p
              className={cn(
                'mt-1 text-xs leading-relaxed text-muted-foreground',
                descriptionLineClass[fields.descriptionLines],
              )}
            >
              {bookmark.description}
            </p>
          )}
          {showTags && !compact
            ? (
                <div className="mt-1.5 flex max-w-full flex-wrap gap-1">
                  {visibleTags.map(tag => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="max-w-24 truncate border border-border/30 bg-secondary/50 px-1.5 py-0 text-[10px] font-medium text-muted-foreground hover:bg-secondary/80"
                      title={tag}
                    >
                      #
                      {tag}
                    </Badge>
                  ))}
                </div>
              )
            : null}
        </div>
      </a>

      {showCategoryPath
        ? (
            <button
              type="button"
              onClick={onOpenCategory}
              title={t('locateIn', { path: categoryPath })}
              className="absolute bottom-2.5 left-4 z-10 flex max-w-[calc(100%-2rem)] items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
            >
              <FolderTree className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{categoryPath}</span>
            </button>
          )
        : null}

      {/* 链接与操作按钮保持同级，避免嵌套交互元素 */}
      {!selectionMode
        ? (
            <div
              className={cn(
                cardActionsClass,
                fields.actions === 'hover'
                && cardActionsHoverClass,
              )}
            >
              <button
                type="button"
                onClick={handleTogglePinned}
                aria-label={t(bookmark.pinnedAt ? 'unpinNamed' : 'pinNamed', {
                  name: bookmark.name,
                })}
                title={bookmark.pinnedAt ? t('unpin') : t('pinBookmark')}
                className={cn(
                  cardActionButtonClass,
                  bookmark.pinnedAt && 'text-foreground font-semibold',
                )}
              >
                <Star
                  className="h-3.5 w-3.5"
                  fill={bookmark.pinnedAt ? 'currentColor' : 'none'}
                />
              </button>
              <button
                ref={setActivatorNodeRef}
                type="button"
                disabled={movePending}
                {...attributes}
                {...listeners}
                title={reorderEnabled ? t('dragToReorderOrMove') : t('dragToFolder')}
                aria-label={t('dragBookmark', { name: bookmark.name })}
                className="flex size-6 touch-none items-center justify-center rounded-md text-muted-foreground/80 transition-colors hover:bg-accent hover:text-foreground active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 active:cursor-grabbing"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={t('moreActionsFor', { name: bookmark.name })}
                    title={deleteError || t('moreActions')}
                    className={cardActionButtonClass}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuGroup>
                    {onEdit
                      ? (
                          <DropdownMenuItem onSelect={handleEdit}>
                            <Pencil />
                            {t('editBookmarkAction')}
                          </DropdownMenuItem>
                        )
                      : null}
                    <DropdownMenuItem
                      disabled={deleting}
                      onSelect={() => void handleDelete()}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 />
                      {t('deleteBookmark')}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        : null}

      {isReorderTarget
        && reorderValidation?.status === 'valid'
        && reorderPlacement
        ? (
            <div
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute left-2 right-2 z-30 h-1 rounded-full bg-ring shadow-sm',
                reorderPlacement === 'before' ? 'top-0' : 'bottom-0',
              )}
            />
          )
        : null}
    </article>
  )
}
