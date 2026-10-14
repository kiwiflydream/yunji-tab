import type { AdditionalGridItem } from '~/components/bookmark-grid/BookmarkGridItems'
import type { BookmarkGroup } from '~/lib/bookmark-groups'
import { useDndContext } from '@dnd-kit/core'
import { Layers, Loader2, Plus } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { BookmarkGroupCard } from '~/components/BookmarkGroupCard'
import { BookmarkGroupEditor } from '~/components/BookmarkGroupEditor'
import { BookmarkGroupMenu } from '~/components/BookmarkGroupMenu'
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '~/components/ui/alert-dialog'
import { Button } from '~/components/ui/button'
import { useBookmarkGroupMenu } from '~/components/useBookmarkGroupMenu'
import { gridClassByMode } from '~/lib/appearance'
import { sortBookmarkGroups } from '~/lib/bookmark-groups'
import { useBookmarkGroupsStore } from '~/lib/bookmark-groups-store'
import { comparePinnedCards, getPinnedCards, groupCardKey } from '~/lib/card-order'
import { useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

interface BookmarkGroupsViewProps {
  pinnedOnly?: boolean
  renderCards?: (cards: AdditionalGridItem[], count: number) => import('react').ReactNode
}

const RENDER_BATCH_SIZE = 50

export function BookmarkGroupsView({ pinnedOnly = false, renderCards }: BookmarkGroupsViewProps) {
  const { t } = useI18n()
  const enabled = useNavStore(state => state.settings.bookmarkGroupsEnabled)
  const appearance = useNavStore(state => state.settings.appearance)
  const compact = useNavStore(state => state.settings.bookmarkViewMode === 'compact')
  const searchQuery = useDeferredValue(useNavStore(state => state.bookmarkSearchQuery))
  const allGroups = useBookmarkGroupsStore(state => state.groups)
  const bookmarks = useNavStore(state => state.bookmarks)
  const dragging = Boolean(useDndContext().active)
  const pinnedIndices = useMemo(() => new Map(getPinnedCards(bookmarks, allGroups).map((card, index) => [card.key, index])), [bookmarks, allGroups])
  const groups = useMemo(() => {
    const filtered = allGroups.filter(group => enabled && (!pinnedOnly || group.pinnedAt))
    return pinnedOnly
      ? filtered.toSorted((left, right) => comparePinnedCards({ ...left, key: groupCardKey(left.id), pinnedAt: left.pinnedAt! }, { ...right, key: groupCardKey(right.id), pinnedAt: right.pinnedAt! }))
      : sortBookmarkGroups(filtered)
  }, [allGroups, enabled, pinnedOnly])
  const cardGroups = useMemo(() => {
    const query = renderCards ? searchQuery.trim().toLocaleLowerCase() : ''
    return query
      ? groups.filter(group => [group.title, group.description, ...group.bookmarks.map(member => member.title)].some(value => value?.toLocaleLowerCase().includes(query)))
      : groups
  }, [groups, renderCards, searchQuery])
  // Standalone and pinned instances mount under different React keys, but the
  // variant and query still join the key so a future shared mount cannot leak a
  // previous batch window into a different list.
  const paginationKey = `${pinnedOnly ? 'pinned' : 'all'}\u0000${renderCards ? 'inline' : 'standalone'}\u0000${searchQuery}`
  const [pagination, setPagination] = useState({ key: paginationKey, limit: RENDER_BATCH_SIZE })
  if (pagination.key !== paginationKey)
    setPagination({ key: paginationKey, limit: RENDER_BATCH_SIZE })
  const visibleLimit = pagination.key === paginationKey ? pagination.limit : RENDER_BATCH_SIZE
  const visibleGroups = useMemo(
    // Index is the position in the full filtered list, so drag reorder and drop
    // placement keep pointing at the same neighbours as before pagination.
    () => cardGroups.slice(0, visibleLimit).map((group, index) => ({ group, index })),
    [cardGroups, visibleLimit],
  )
  const remainingGroups = Math.max(cardGroups.length - visibleGroups.length, 0)
  const save = useBookmarkGroupsStore(state => state.save)
  const loadError = useBookmarkGroupsStore(state => state.error)
  const remove = useBookmarkGroupsStore(state => state.remove)
  const [editor, setEditor] = useState<{ group?: BookmarkGroup } | null>(null)
  const [deleting, setDeleting] = useState<BookmarkGroup | null>(null)
  const [pinning, setPinning] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<'groupSaveFailed' | 'groupOpenFailed' | null>(null)
  const { menu, setMenu, clearTimers, closeMenu, keepMenuOpen, leaveGroup, openGroup, hoverGroup } = useBookmarkGroupMenu(dragging || Boolean(editor || deleting))
  const menuGroup = cardGroups.find(group => group.id === menu?.id)
  // Drop an anchor whose group was removed, unpinned or filtered out by a live update.
  if (menu && (!menuGroup || dragging))
    setMenu(null)

  const togglePinned = async (group: BookmarkGroup) => {
    setPinning(group.id)
    setError(null)
    try {
      await save(group.id, { pinnedAt: group.pinnedAt ? 0 : Date.now() })
    }
    catch {
      setError('groupSaveFailed')
    }
    finally {
      setPinning(null)
    }
  }
  const deleteGroup = async () => {
    if (!deleting)
      return
    setBusy(true)
    setError(null)
    try {
      await remove(deleting.id)
      setDeleting(null)
      setMenu(null)
    }
    catch {
      setError('groupSaveFailed')
    }
    finally {
      setBusy(false)
    }
  }
  const cards: AdditionalGridItem[] = visibleGroups.map(({ group, index }) => ({
    key: groupCardKey(group.id),
    pinnedAt: group.pinnedAt ?? 0,
    pinnedOrder: group.pinnedOrder,
    node: (
      <BookmarkGroupCard
        key={group.id}
        group={group}
        appearance={appearance}
        compact={compact}
        pinning={pinning}
        expanded={menuGroup?.id === group.id}
        reorderIndex={pinnedOnly ? pinnedIndices.get(groupCardKey(group.id)) ?? index : index}
        reorderEnabled={!editor && !deleting && (!renderCards || !searchQuery.trim())}
        pinnedReorder={pinnedOnly}
        onOpen={(event) => {
          openGroup(group, event)
          setError(null)
        }}
        onHover={event => hoverGroup(group, event)}
        onLeave={() => leaveGroup(group.id)}
        onActionsEnter={() => {
          clearTimers()
          setMenu(current => current?.hover ? null : current)
        }}
        onPin={() => {
          closeMenu()
          void togglePinned(group)
        }}
        onEdit={() => {
          closeMenu()
          setEditor({ group })
        }}
        onDelete={() => {
          closeMenu()
          setDeleting(group)
          setError(null)
        }}
      />
    ),
  }))
  // The button lives here (not in BookmarkGrid) so pagination outside the grid
  // can reuse it without the grid needing to know about group batches.
  const loadMoreButton = remainingGroups > 0
    ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t('loadMoreGroups', { count: remainingGroups })}
          onClick={() =>
            setPagination({
              key: paginationKey,
              limit: visibleLimit + RENDER_BATCH_SIZE,
            })}
        >
          {t('loadMoreRemaining', { count: remainingGroups })}
        </Button>
      )
    : null
  if (pinnedOnly && !renderCards && !groups.length && !error && !editor && !deleting)
    return null

  return (
    <section className="space-y-5" aria-label={renderCards ? undefined : t('bookmarkGroups')}>
      {enabled && !renderCards
        ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="break-words text-xl font-semibold">{t('bookmarkGroups')}</h1>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{t('bookmarkGroupsHint')}</p>
              </div>
              {!pinnedOnly
                ? (
                    <Button onClick={() => {
                      closeMenu()
                      setEditor({})
                    }}
                    >
                      <Plus />
                      {t('createBookmarkGroup')}
                    </Button>
                  )
                : null}
            </div>
          )
        : null}
      {enabled && loadError
        ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-red-700 dark:text-red-400">
              {t('groupLoadFailed')}
              <Button variant="outline" size="sm" onClick={() => void useBookmarkGroupsStore.getState().load()}>{t('groupRetry')}</Button>
            </div>
          )
        : null}
      {enabled && error && !deleting ? <p role="alert" className="text-sm text-red-700 dark:text-red-400">{t(error)}</p> : null}
      {renderCards
        ? (
            <>
              {renderCards(cards, cardGroups.length)}
              {loadMoreButton ? <div className="mt-5 flex justify-center">{loadMoreButton}</div> : null}
            </>
          )
        : (
            <div className={gridClassByMode[appearance.gridDensity][compact ? 'compact' : 'grid']}>
              {cards.map(card => card.node)}
              {loadMoreButton ? <div className="col-span-full mt-1 flex justify-center">{loadMoreButton}</div> : null}
              {!groups.length && !loadError
                ? (
                    <div className="col-span-full py-14 text-center">
                      <span aria-hidden="true" className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-secondary text-muted-foreground"><Layers className="size-5" strokeWidth={1.75} /></span>
                      <h2 className="text-sm font-medium">{t('noBookmarkGroups')}</h2>
                      <p className="mt-2 text-sm text-muted-foreground">{t('bookmarkGroupsHint')}</p>
                    </div>
                  )
                : null}
            </div>
          )}
      {menu && menuGroup
        ? (
            <BookmarkGroupMenu
              key={menu.id}
              group={menuGroup}
              anchor={menu}
              appearance={appearance}
              onPointerEnter={keepMenuOpen}
              onPointerLeave={() => leaveGroup()}
              onClose={closeMenu}
            />
          )
        : null}
      {editor ? <BookmarkGroupEditor key={editor.group?.id ?? 'new'} group={editor.group} onClose={() => setEditor(null)} /> : null}
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open && !busy)
            setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteBookmarkGroup')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteGroupHint')}</AlertDialogDescription>
          </AlertDialogHeader>
          {error ? <p role="alert" className="text-sm text-red-700 dark:text-red-400">{t(error)}</p> : null}
          <AlertDialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>{t('cancel')}</Button>
            <Button variant="destructive" disabled={busy} onClick={() => void deleteGroup()}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {t('delete')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
