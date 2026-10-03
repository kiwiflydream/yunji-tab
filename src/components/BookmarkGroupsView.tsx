import type { BookmarkGroup, BookmarkGroupMember } from '~/lib/bookmark-groups'
import { ArrowLeft, ArrowUpRight, Layers, Loader2, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { BookmarkGroupEditor } from '~/components/BookmarkGroupEditor'
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '~/components/ui/alert-dialog'
import { Button } from '~/components/ui/button'
import { resolveGroupBookmark } from '~/lib/bookmark-groups'
import { useBookmarkGroupsStore } from '~/lib/bookmark-groups-store'
import { openBookmarkUrl } from '~/lib/bookmark-urls'
import { useBookmarks, useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

export function BookmarkGroupsView({ pinnedOnly = false }: { pinnedOnly?: boolean }) {
  const { t } = useI18n()
  const allGroups = useBookmarkGroupsStore(state => state.groups)
  const groups = useMemo(() => allGroups
    .filter(group => !pinnedOnly || group.pinnedAt)
    .toSorted((left, right) => (right.pinnedAt ?? 0) - (left.pinnedAt ?? 0) || left.title.localeCompare(right.title)), [allGroups, pinnedOnly])
  const save = useBookmarkGroupsStore(state => state.save)
  const loadError = useBookmarkGroupsStore(state => state.error)
  const remove = useBookmarkGroupsStore(state => state.remove)
  const bookmarks = useBookmarks()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ group?: BookmarkGroup } | null>(null)
  const [deleting, setDeleting] = useState<BookmarkGroup | null>(null)
  const [pinning, setPinning] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [opening, setOpening] = useState<string | null>(null)
  const [error, setError] = useState<'groupSaveFailed' | 'groupOpenFailed' | null>(null)
  const selected = groups.find(group => group.id === selectedId)
  const Heading = pinnedOnly ? 'h2' : 'h1'
  const bookmarkMap = useMemo(() => new Map(bookmarks.map(bookmark => [bookmark.url, bookmark])), [bookmarks])
  const openMember = async (member: BookmarkGroupMember) => {
    const bookmark = resolveGroupBookmark(member, useNavStore.getState().bookmarks)
    if (!bookmark)
      return
    setOpening(member.url)
    setError(null)
    try {
      await openBookmarkUrl(bookmark)
      await useNavStore.getState().recordBookmarkOpen(bookmark.url)
    }
    catch {
      setError('groupOpenFailed')
    }
    finally {
      setOpening(null)
    }
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
  const pinButton = (group: BookmarkGroup) => (
    <Button
      variant="ghost"
      size="icon"
      disabled={pinning !== null}
      aria-pressed={Boolean(group.pinnedAt)}
      aria-label={t(group.pinnedAt ? 'unpinNamed' : 'pinNamed', { name: group.title })}
      title={t(group.pinnedAt ? 'unpinNamed' : 'pinNamed', { name: group.title })}
      onClick={() => void togglePinned(group)}
    >
      {pinning === group.id ? <Loader2 className="animate-spin" /> : <Star fill={group.pinnedAt ? 'currentColor' : 'none'} />}
    </Button>
  )
  const deleteGroup = async () => {
    if (!deleting)
      return
    setBusy(true)
    setError(null)
    try {
      await remove(deleting.id)
      setDeleting(null)
      setSelectedId(null)
    }
    catch {
      setError('groupSaveFailed')
    }
    finally {
      setBusy(false)
    }
  }
  if (pinnedOnly && !groups.length && !error && !editor && !deleting)
    return null

  return (
    <section className={pinnedOnly ? 'mb-6 space-y-5' : 'space-y-5'} aria-label={t('bookmarkGroups')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {selected
            ? (
                <Button variant="ghost" size="sm" className="mb-3 -ml-3" onClick={() => setSelectedId(null)}>
                  <ArrowLeft />
                  {t('backToGroups')}
                </Button>
              )
            : null}
          <Heading className="break-words text-xl font-semibold">{selected?.title ?? t('bookmarkGroups')}</Heading>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{selected?.description || t('bookmarkGroupsHint')}</p>
        </div>
        <div className="flex items-center gap-2">
          {selected ? pinButton(selected) : null}
          {selected || !pinnedOnly
            ? (
                <Button onClick={() => setEditor(selected ? { group: selected } : {})}>
                  {selected ? <Pencil /> : <Plus />}
                  {t(selected ? 'editBookmarkGroup' : 'createBookmarkGroup')}
                </Button>
              )
            : null}
        </div>
      </div>
      {loadError
        ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-red-700 dark:text-red-400">
              {t('groupLoadFailed')}
              <Button variant="outline" size="sm" onClick={() => void useBookmarkGroupsStore.getState().load()}>{t('groupRetry')}</Button>
            </div>
          )
        : null}
      {error && !deleting ? <p role="alert" className="text-sm text-red-700 dark:text-red-400">{t(error)}</p> : null}
      {selected
        ? (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card">
              {selected.bookmarks.map((member) => {
                const available = bookmarkMap.has(member.url)
                return (
                  <li key={member.url}>
                    <button type="button" data-nav-item aria-label={t('openGroupBookmark', { name: member.title })} disabled={!available || opening !== null} onClick={() => void openMember(member)} className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-accent/50 active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-50">
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-medium">{member.title}</span>
                        <span className="mt-1 block break-all text-xs text-muted-foreground">{member.url}</span>
                        {!available ? <span className="mt-1 block text-xs text-red-700 dark:text-red-400">{t('groupBookmarkMissing')}</span> : null}
                      </span>
                      {opening === member.url ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )
        : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {groups.map(group => (
                <article key={group.id} className="group flex flex-col rounded-xl border border-border/70 bg-card">
                  <button
                    type="button"
                    data-nav-item
                    aria-label={t('viewNamedGroup', { name: group.title })}
                    onClick={() => {
                      setSelectedId(group.id)
                      setError(null)
                    }}
                    className="flex flex-1 flex-col gap-3 rounded-xl p-4 text-left transition-colors hover:bg-accent/40 active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Layers className="size-5 text-muted-foreground" />
                    <span className="break-words text-sm font-semibold">{group.title}</span>
                    {group.description ? <span className="line-clamp-2 break-words text-sm leading-relaxed text-muted-foreground">{group.description}</span> : null}
                    <span className="mt-auto text-xs text-muted-foreground">{t('bookmarkCount', { count: group.bookmarks.length })}</span>
                  </button>
                  <div className="flex justify-end gap-1 border-t border-border/40 px-2 py-1">
                    {pinButton(group)}
                    <Button variant="ghost" size="icon" aria-label={t('editNamedGroup', { name: group.title })} onClick={() => setEditor({ group })}><Pencil /></Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('deleteNamedGroup', { name: group.title })}
                      onClick={() => {
                        setDeleting(group)
                        setError(null)
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </article>
              ))}
              {!groups.length && !loadError
                ? (
                    <div className="col-span-full py-14 text-center">
                      <Layers className="mx-auto mb-3 size-8 text-muted-foreground/60" />
                      <h2 className="text-sm font-medium">{t('noBookmarkGroups')}</h2>
                      <p className="mt-2 text-sm text-muted-foreground">{t('bookmarkGroupsHint')}</p>
                    </div>
                  )
                : null}
            </div>
          )}
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
