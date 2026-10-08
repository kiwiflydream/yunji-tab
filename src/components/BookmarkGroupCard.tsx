import type { MouseEvent, PointerEvent } from 'react'
import type { BookmarkGroup } from '~/lib/bookmark-groups'
import type { AppearanceSettings } from '~/lib/types'
import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core'
import { GripVertical, Loader2, MoreHorizontal, Pencil, Star, Trash2 } from 'lucide-react'
import { useCallback } from 'react'
import { useMovePending } from '~/components/BookmarkDragDropContext'
import { BookmarkIcon } from '~/components/BookmarkIcon'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu'
import { cardActionButtonClass, cardActionsClass, cardActionsHoverClass, cardContainerClass, cardContentClass, cardSizeClass, cardStyleClass, cardTitleClass, descriptionLineClass, radiusClass, titleLineClass } from '~/lib/appearance'
import { getBookmarkDropPlacement, readDragItemData, validateBookmarkDrop } from '~/lib/drag-drop'
import { useI18n } from '~/lib/use-i18n'
import { cn } from '~/lib/utils'

interface BookmarkGroupCardProps {
  group: BookmarkGroup
  appearance: AppearanceSettings
  compact: boolean
  pinning: string | null
  expanded: boolean
  reorderIndex: number
  reorderEnabled: boolean
  pinnedReorder: boolean
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void
  onHover: (event: PointerEvent<HTMLButtonElement>) => void
  onLeave: () => void
  onActionsEnter: () => void
  onPin: () => void
  onEdit: () => void
  onDelete: () => void
}

export function BookmarkGroupCard({ group, appearance, compact, pinning, expanded, reorderIndex, reorderEnabled, pinnedReorder, onOpen, onHover, onLeave, onActionsEnter, onPin, onEdit, onDelete }: BookmarkGroupCardProps) {
  const { t } = useI18n()
  const fields = appearance.cardFields
  const moving = useMovePending()
  const { active } = useDndContext()
  const item = readDragItemData(active?.data.current)
  const target = { type: 'group-drop' as const, groupId: group.id, label: group.title, index: reorderIndex, pinned: Boolean(group.pinnedAt), pinnedReorder }
  const { attributes, listeners, isDragging, setActivatorNodeRef, setNodeRef: setDragRef } = useDraggable({
    id: `group:${group.id}`,
    disabled: moving || !reorderEnabled,
    data: { ...target, type: 'group', reorderEnabled },
  })
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `group-drop:${group.id}`,
    disabled: moving || !reorderEnabled || item?.type === 'category',
    data: target,
  })
  const setNodeRef = useCallback((node: HTMLElement | null) => {
    setDragRef(node)
    setDropRef(node)
  }, [setDragRef, setDropRef])
  const validation = isOver && item ? validateBookmarkDrop(item, target) : null
  const placement = item && item.type !== 'category' ? getBookmarkDropPlacement(item, target) : null
  return (
    <article ref={setNodeRef} data-bookmark-group-id={group.id} className={cn(cardContainerClass, cardStyleClass[appearance.cardStyle], radiusClass[appearance.radius], compact ? cardSizeClass.compact : cardSizeClass.grid, isDragging && 'opacity-35', validation?.status === 'valid' && 'ring-2 ring-ring', validation?.status === 'invalid' && 'ring-2 ring-destructive/70')}>
      <button
        type="button"
        data-nav-item
        aria-label={t('viewNamedGroup', { name: group.title })}
        aria-haspopup="menu"
        aria-expanded={expanded}
        aria-controls={expanded ? `bookmark-group-menu-${group.id}` : undefined}
        onClick={(event) => {
          if (!active && !moving)
            onOpen(event)
        }}
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse')
            listeners?.onPointerDown?.(event)
        }}
        onPointerEnter={onHover}
        onPointerMove={onHover}
        onPointerLeave={onLeave}
        className={cn('flex w-full items-center text-left focus-visible:outline-none active:scale-[0.99]', compact ? cardContentClass.compact : cardContentClass.grid, reorderEnabled && 'cursor-grab active:cursor-grabbing', moving && 'cursor-wait')}
      >
        <BookmarkIcon icon={group.icon} name={group.title} appearance={appearance} compact={compact} fallbackIcon="🗂️" />
        <div className="min-w-0 flex-1 pr-9">
          <div className={cn(cardTitleClass, titleLineClass[fields.titleLines])}>{group.title}</div>
          {fields.description && group.description && !compact
            ? <p className={cn('mt-1 text-xs leading-relaxed text-muted-foreground', descriptionLineClass[fields.descriptionLines])}>{group.description}</p>
            : null}
          <p className="mt-0.5 text-xs text-muted-foreground">{t('bookmarkCount', { count: group.bookmarks.length })}</p>
        </div>
      </button>
      <div onPointerEnter={onActionsEnter} className={cn(cardActionsClass, fields.actions === 'hover' && cardActionsHoverClass)}>
        <button
          type="button"
          disabled={pinning !== null}
          aria-pressed={Boolean(group.pinnedAt)}
          aria-label={t(group.pinnedAt ? 'unpinNamed' : 'pinNamed', { name: group.title })}
          title={group.pinnedAt ? t('unpin') : t('pinBookmark')}
          onClick={onPin}
          className={cn(cardActionButtonClass, group.pinnedAt && 'text-foreground font-semibold')}
        >
          {pinning === group.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" fill={group.pinnedAt ? 'currentColor' : 'none'} />}
        </button>
        <button ref={setActivatorNodeRef} type="button" disabled={moving || !reorderEnabled} {...attributes} {...listeners} title={t('dragToReorder')} aria-label={t('dragGroup', { name: group.title })} className={cn(cardActionButtonClass, 'touch-none cursor-grab active:cursor-grabbing disabled:opacity-50')}>
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={t('moreActionsFor', { name: group.title })} title={t('moreActions')} className={cardActionButtonClass}>
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuGroup>
              <DropdownMenuItem aria-label={t('editNamedGroup', { name: group.title })} onSelect={onEdit}>
                <Pencil />
                {t('editBookmarkGroup')}
              </DropdownMenuItem>
              <DropdownMenuItem aria-label={t('deleteNamedGroup', { name: group.title })} onSelect={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 />
                {t('deleteBookmarkGroup')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {validation?.status === 'valid' && placement
        ? <div aria-hidden className={cn('pointer-events-none absolute inset-x-2 z-20 h-1 rounded-full bg-foreground', placement === 'before' ? 'top-0' : 'bottom-0')} />
        : null}
    </article>
  )
}
