import type { MouseEvent, PointerEvent, ReactNode } from 'react'
import type { BookmarkGroupMenuAnchor } from '~/components/BookmarkGroupMenu'
import type { BookmarkGroup } from '~/lib/bookmark-groups'
import { Loader2, Plus } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { BookmarkGroupCard } from '~/components/BookmarkGroupCard'
import { BookmarkGroupEditor } from '~/components/BookmarkGroupEditor'
import { BookmarkGroupMenu } from '~/components/BookmarkGroupMenu'
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '~/components/ui/alert-dialog'
import { Button } from '~/components/ui/button'
import { gridClassByMode } from '~/lib/appearance'
import { useBookmarkGroupsStore } from '~/lib/bookmark-groups-store'
import { useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

interface BookmarkGroupsViewProps {
  pinnedOnly?: boolean
  renderCards?: (cards: ReactNode, count: number) => ReactNode
}

export function BookmarkGroupsView({ pinnedOnly = false, renderCards }: BookmarkGroupsViewProps) {
  const { t } = useI18n()
  const enabled = useNavStore(state => state.settings.bookmarkGroupsEnabled)
  const appearance = useNavStore(state => state.settings.appearance)
  const compact = useNavStore(state => state.settings.bookmarkViewMode === 'compact')
  const searchQuery = useDeferredValue(useNavStore(state => state.bookmarkSearchQuery))
  const allGroups = useBookmarkGroupsStore(state => state.groups)
  const groups = useMemo(() => allGroups
    .filter(group => enabled && (!pinnedOnly || group.pinnedAt))
    .toSorted((left, right) => (right.pinnedAt ?? 0) - (left.pinnedAt ?? 0) || left.title.localeCompare(right.title)), [allGroups, enabled, pinnedOnly])
  const cardGroups = useMemo(() => {
    const query = renderCards ? searchQuery.trim().toLocaleLowerCase() : ''
    return query
      ? groups.filter(group => [group.title, group.description, ...group.bookmarks.map(member => member.title)].some(value => value?.toLocaleLowerCase().includes(query)))
      : groups
  }, [groups, renderCards, searchQuery])
  const save = useBookmarkGroupsStore(state => state.save)
  const loadError = useBookmarkGroupsStore(state => state.error)
  const remove = useBookmarkGroupsStore(state => state.remove)
  const [menu, setMenu] = useState<BookmarkGroupMenuAnchor | null>(null)
  const menuRef = useRef(menu)
  menuRef.current = menu
  const dismissedTriggerRef = useRef<HTMLButtonElement | null>(null)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimers = () => {
    if (openTimerRef.current !== null)
      clearTimeout(openTimerRef.current)
    if (closeTimerRef.current !== null)
      clearTimeout(closeTimerRef.current)
    openTimerRef.current = null
    closeTimerRef.current = null
  }
  useEffect(() => clearTimers, [])
  const closeMenu = () => {
    dismissedTriggerRef.current = menu?.trigger ?? null
    clearTimers()
    setMenu(null)
  }
  const keepMenuOpen = () => {
    clearTimers()
  }
  const leaveGroup = (groupId?: string) => {
    if (groupId && dismissedTriggerRef.current?.closest('[data-bookmark-group-id]')?.getAttribute('data-bookmark-group-id') === groupId)
      dismissedTriggerRef.current = null
    clearTimers()
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null
      setMenu(current => current?.hover && !document.getElementById(`bookmark-group-menu-${current.id}`)?.contains(document.activeElement) ? null : current)
    }, 200)
  }
  const [editor, setEditor] = useState<{ group?: BookmarkGroup } | null>(null)
  const [deleting, setDeleting] = useState<BookmarkGroup | null>(null)
  const [pinning, setPinning] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<'groupSaveFailed' | 'groupOpenFailed' | null>(null)
  const menuGroup = cardGroups.find(group => group.id === menu?.id)
  // Drop an anchor whose group was removed, unpinned or filtered out by a live update.
  if (menu && !menuGroup)
    setMenu(null)

  const openGroup = (group: BookmarkGroup, event: MouseEvent<HTMLButtonElement>) => {
    clearTimers()
    const trigger = event.currentTarget
    if (menu?.id === group.id && !menu.hover)
      dismissedTriggerRef.current = trigger
    const keyboard = event.detail === 0
    const bounds = trigger.getBoundingClientRect()
    setMenu(current => current?.id === group.id && !current.hover
      ? null
      : {
          id: group.id,
          x: keyboard ? bounds.left : event.clientX,
          y: keyboard ? bounds.bottom : event.clientY,
          trigger,
          keyboard,
          hover: false,
        })
    setError(null)
  }
  const hoverGroup = (group: BookmarkGroup, event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'mouse' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches || editor || deleting)
      return
    if (dismissedTriggerRef.current === event.currentTarget) {
      if (event.type === 'pointerenter' && event.relatedTarget instanceof Element && !event.relatedTarget.closest('.bookmark-group-menu'))
        dismissedTriggerRef.current = null
      else
        return
    }
    clearTimers()
    if (menu?.id === group.id)
      return
    const trigger = event.currentTarget
    const { clientX: x, clientY: y } = event
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null
      if (trigger.isConnected && trigger.matches(':hover'))
        setMenu({ id: group.id, x, y, trigger, keyboard: false, hover: true })
    }, 200)
  }
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
  const cards = (
    <>
      {cardGroups.map(group => (
        <BookmarkGroupCard
          key={group.id}
          group={group}
          appearance={appearance}
          compact={compact}
          pinning={pinning}
          expanded={menuGroup?.id === group.id}
          onOpen={event => openGroup(group, event)}
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
      ))}
    </>
  )
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
        ? renderCards(cards, cardGroups.length)
        : (
            <div className={gridClassByMode[appearance.gridDensity][compact ? 'compact' : 'grid']}>
              {cards}
              {!groups.length && !loadError
                ? (
                    <div className="col-span-full py-14 text-center">
                      <span aria-hidden="true" className="mb-3 block text-3xl">🗂️</span>
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
              key={`${menu.id}-${menu.hover ? 'hover' : 'explicit'}`}
              group={menuGroup}
              anchor={menu}
              appearance={appearance}
              onPointerEnter={keepMenuOpen}
              onPointerLeave={() => leaveGroup()}
              onClose={() => {
                if (menuRef.current !== menu)
                  return
                dismissedTriggerRef.current = menu.trigger
                clearTimers()
                setMenu(current => current === menu ? null : current)
              }}
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
