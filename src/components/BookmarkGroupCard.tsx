import type { MouseEvent, PointerEvent } from 'react'
import type { BookmarkGroup } from '~/lib/bookmark-groups'
import type { AppearanceSettings } from '~/lib/types'
import { Loader2, MoreHorizontal, Pencil, Star, Trash2 } from 'lucide-react'
import { BookmarkIcon } from '~/components/BookmarkIcon'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu'
import { cardActionButtonClass, cardActionsClass, cardActionsHoverClass, cardContainerClass, cardContentClass, cardSizeClass, cardStyleClass, cardTitleClass, descriptionLineClass, radiusClass, titleLineClass } from '~/lib/appearance'
import { useI18n } from '~/lib/use-i18n'
import { cn } from '~/lib/utils'

interface BookmarkGroupCardProps {
  group: BookmarkGroup
  appearance: AppearanceSettings
  compact: boolean
  pinning: string | null
  expanded: boolean
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void
  onHover: (event: PointerEvent<HTMLButtonElement>) => void
  onLeave: () => void
  onActionsEnter: () => void
  onPin: () => void
  onEdit: () => void
  onDelete: () => void
}

export function BookmarkGroupCard({ group, appearance, compact, pinning, expanded, onOpen, onHover, onLeave, onActionsEnter, onPin, onEdit, onDelete }: BookmarkGroupCardProps) {
  const { t } = useI18n()
  const fields = appearance.cardFields
  return (
    <article data-bookmark-group-id={group.id} className={cn(cardContainerClass, cardStyleClass[appearance.cardStyle], radiusClass[appearance.radius], compact ? cardSizeClass.compact : cardSizeClass.grid)}>
      <button
        type="button"
        data-nav-item
        aria-label={t('viewNamedGroup', { name: group.title })}
        aria-haspopup="menu"
        aria-expanded={expanded}
        aria-controls={expanded ? `bookmark-group-menu-${group.id}` : undefined}
        onClick={onOpen}
        onPointerEnter={onHover}
        onPointerMove={onHover}
        onPointerLeave={onLeave}
        className={cn('flex w-full items-center text-left focus-visible:outline-none active:scale-[0.99]', compact ? cardContentClass.compact : cardContentClass.grid)}
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
    </article>
  )
}
