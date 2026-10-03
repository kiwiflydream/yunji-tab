import type { BookmarkGroup, BookmarkGroupMember } from '~/lib/bookmark-groups'
import { ArrowDown, ArrowUp, Loader2, X } from 'lucide-react'
import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { BookmarkGroupCapacityError } from '~/lib/bookmark-groups'
import { useBookmarkGroupsStore } from '~/lib/bookmark-groups-store'
import { useBookmarks, useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

export function BookmarkGroupEditor({ group, onClose }: { group?: BookmarkGroup, onClose: () => void }) {
  const { t } = useI18n()
  const allBookmarks = useBookmarks()
  const sourceIds = useRef(new Map(allBookmarks.map(bookmark => [bookmark.url, bookmark.id])))
  const save = useBookmarkGroupsStore(state => state.save)
  const [id] = useState(() => group?.id ?? crypto.randomUUID())
  const [title, setTitle] = useState(group?.title ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const [members, setMembers] = useState<BookmarkGroupMember[]>(group?.bookmarks ?? [])
  const [search, setSearch] = useState('')
  const query = useDeferredValue(search.trim().toLocaleLowerCase())
  const [limit, setLimit] = useState(50)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<'groupRequired' | 'groupMemberTitleRequired' | 'groupSaveFailed' | 'groupCapacityExceeded' | null>(null)
  const visibleError = (error === 'groupRequired' && title.trim() && members.length)
    || (error === 'groupMemberTitleRequired' && members.every(member => member.title.trim()))
    ? null
    : error
  const choices = useMemo(() => {
    const unique = new Map(allBookmarks.map(bookmark => [bookmark.url, bookmark]))
    return [...unique.values()].filter(bookmark =>
      `${bookmark.name} ${bookmark.url}`.toLocaleLowerCase().includes(query))
  }, [allBookmarks, query])
  const selected = new Set(members.map(member => member.url))
  const move = (index: number, delta: number) => {
    setMembers((current) => {
      const next = [...current]
      ;[next[index], next[index + delta]] = [next[index + delta], next[index]]
      return next
    })
  }
  const submit = async () => {
    if (!title.trim() || !members.length) {
      setError('groupRequired')
      return
    }
    if (members.some(member => !member.title.trim())) {
      setError('groupMemberTitleRequired')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await save(id, {
        ...(!group || title !== group.title ? { title } : {}),
        ...(!group || description !== group.description ? { description } : {}),
        ...(!group || JSON.stringify(members) !== JSON.stringify(group.bookmarks)
          ? { bookmarks: members.map((member) => {
              const sourceId = sourceIds.current.get(member.url)
              const source = useNavStore.getState().bookmarks.find(bookmark => bookmark.id === sourceId)
              return source ? { ...member, url: source.url } : member
            }) }
          : {}),
      }, !group, group?.bookmarks)
      onClose()
    }
    catch (cause) {
      setError(cause instanceof BookmarkGroupCapacityError ? 'groupCapacityExceeded' : 'groupSaveFailed')
    }
    finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy)
          onClose()
      }}
    >
      <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col gap-4 overflow-hidden">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>{t(group ? 'editBookmarkGroup' : 'createBookmarkGroup')}</DialogTitle>
          <DialogDescription>{t('groupEditorHint')}</DialogDescription>
        </DialogHeader>
        <form
          className="min-h-0 overflow-y-auto pr-1"
          id="bookmark-group-form"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <fieldset disabled={busy} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="bookmark-group-title" className="text-sm font-medium">{t('groupTitle')}</label>
              <Input id="bookmark-group-title" value={title} onChange={event => setTitle(event.target.value)} aria-required="true" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="bookmark-group-description" className="text-sm font-medium">{t('groupDescription')}</label>
              <textarea id="bookmark-group-description" value={description} onChange={event => setDescription(event.target.value)} rows={2} className="flex w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25" />
            </div>
            <section className="space-y-2" aria-label={t('groupSelectedCount', { count: members.length })}>
              <h3 className="text-sm font-medium">{t('groupSelectedCount', { count: members.length })}</h3>
              <ol className="space-y-2">
                {members.map((member, index) => (
                  <li key={member.url} className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <label htmlFor={`group-member-${index}`} className="text-xs text-muted-foreground">{t('groupMemberTitle')}</label>
                        <Input id={`group-member-${index}`} value={member.title} aria-required="true" onChange={event => setMembers(current => current.map(item => item.url === member.url ? { ...item, title: event.target.value } : item))} />
                      </div>
                      <div className="flex shrink-0 items-center">
                        <Button type="button" variant="ghost" size="icon" disabled={index === 0} aria-label={t('moveGroupMemberUp', { name: member.title })} onClick={() => move(index, -1)}><ArrowUp /></Button>
                        <Button type="button" variant="ghost" size="icon" disabled={index === members.length - 1} aria-label={t('moveGroupMemberDown', { name: member.title })} onClick={() => move(index, 1)}><ArrowDown /></Button>
                        <Button type="button" variant="ghost" size="icon" aria-label={t('removeGroupMember', { name: member.title })} onClick={() => setMembers(current => current.filter(item => item.url !== member.url))}><X /></Button>
                      </div>
                    </div>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{member.url}</p>
                  </li>
                ))}
              </ol>
            </section>
            <section className="space-y-2">
              <Input
                aria-label={t('searchGroupBookmarks')}
                placeholder={t('searchGroupBookmarks')}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setLimit(50)
                }}
              />
              <div className="max-h-60 overflow-y-auto rounded-lg border border-border/70">
                {choices.slice(0, limit).map(bookmark => (
                  <label key={bookmark.url} className="flex cursor-pointer items-center gap-3 border-b border-border/40 p-3 last:border-b-0 hover:bg-accent/50">
                    <Checkbox
                      checked={selected.has(bookmark.url)}
                      onCheckedChange={(checked) => {
                        sourceIds.current.set(bookmark.url, bookmark.id)
                        setMembers(current => checked ? [...current, { id: crypto.randomUUID(), url: bookmark.url, title: bookmark.name }] : current.filter(member => member.url !== bookmark.url))
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block break-words text-sm">{bookmark.name}</span>
                      <span className="block break-all text-xs text-muted-foreground">{bookmark.url}</span>
                    </span>
                  </label>
                ))}
                {!choices.length ? <p className="p-4 text-sm text-muted-foreground">{t('groupNoMatches')}</p> : null}
              </div>
              {choices.length > limit ? <Button type="button" variant="ghost" size="sm" onClick={() => setLimit(current => current + 50)}>{t('more')}</Button> : null}
            </section>
          </fieldset>
        </form>
        {visibleError ? <p role="alert" className="text-sm text-red-700 dark:text-red-400">{t(visibleError)}</p> : null}
        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" form="bookmark-group-form" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
