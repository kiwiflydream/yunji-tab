import type { KeyboardEvent } from 'react'
import { Storage } from '@plasmohq/storage'
import { ArrowRight, CheckCircle2, Inbox } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { useBookmarks, useCategories, useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

const recentCategoriesKey = 'yunji-tab:recent-triage-categories'
const localStorage = new Storage({ area: 'local' })

function parseTags(value: string): string[] {
  return [...new Set(value.split(/[\s,，#]+/).map(tag => tag.trim()).filter(Boolean))].slice(0, 12)
}

export function InboxTriageDialog() {
  const { categoryName, t } = useI18n()
  const bookmarks = useBookmarks()
  const categories = useCategories()
  const updateBookmark = useNavStore(state => state.updateBookmark)
  const inbox = useMemo(
    () => bookmarks.filter(bookmark => bookmark.inboxAt)
      .sort((left, right) => (left.inboxAt ?? 0) - (right.inboxAt ?? 0)),
    [bookmarks],
  )
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const current = inbox[index % Math.max(1, inbox.length)]
  const [destinationId, setDestinationId] = useState('')
  const [tags, setTags] = useState('')
  const [recentCategoryIds, setRecentCategoryIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const popularTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const bookmark of bookmarks) {
      for (const tag of bookmark.tags ?? [])
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([tag]) => tag)
  }, [bookmarks])
  const selectedTags = useMemo(() => new Set(parseTags(tags)), [tags])
  const orderedCategories = useMemo(() => {
    const recent = recentCategoryIds.flatMap((id) => {
      const category = categories.find(item => item.id === id)
      return category ? [category] : []
    })
    const recentSet = new Set(recent.map(category => category.id))
    return [...recent, ...categories.filter(category => !recentSet.has(category.id))]
  }, [categories, recentCategoryIds])

  useEffect(() => {
    if (!current)
      return
    setDestinationId(current.categoryId)
    setTags(current.tags?.join(', ') ?? '')
  }, [current])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      setIndex(0)
      void localStorage.get<string[]>(recentCategoriesKey)
        .then(value => setRecentCategoryIds(Array.isArray(value) ? value : []))
    }
  }

  const completeCurrent = async () => {
    if (!current || !destinationId)
      return
    setSaving(true)
    try {
      await updateBookmark(current.id, {
        categoryId: destinationId,
        tags: parseTags(tags),
        inboxAt: 0,
      })
      const nextRecent = [destinationId, ...recentCategoryIds.filter(id => id !== destinationId)].slice(0, 5)
      setRecentCategoryIds(nextRecent)
      await localStorage.set(recentCategoriesKey, nextRecent)
    }
    finally {
      setSaving(false)
    }
  }

  const toggleTag = (tag: string) => {
    const currentTags = new Set(selectedTags)
    if (currentTags.has(tag))
      currentTags.delete(tag)
    else
      currentTags.add(tag)
    setTags([...currentTags].join(', '))
  }

  const skipCurrent = () => {
    if (inbox.length > 0)
      setIndex(value => (value + 1) % inbox.length)
  }

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!current || saving)
      return
    const target = event.target as HTMLElement
    const tagName = target.tagName
    const isTextControl = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT'
    if (event.key === 'Enter' && tagName !== 'BUTTON') {
      event.preventDefault()
      void completeCurrent()
    }
    else if (event.key === 'ArrowRight' && !isTextControl) {
      event.preventDefault()
      skipCurrent()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={inbox.length === 0}>
          <Inbox className="mr-1.5 h-4 w-4" />
          {t('triageOneByOne')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg" onKeyDown={handleDialogKeyDown}>
        <DialogHeader>
          <DialogTitle>{t('triageInbox')}</DialogTitle>
          <DialogDescription aria-live="polite">
            {inbox.length > 0
              ? t('inboxRemainingCount', { count: inbox.length })
              : t('inboxTriageComplete')}
          </DialogDescription>
        </DialogHeader>

        {current
          ? (
              <div className="grid gap-4">
                <div className="min-w-0 border-b border-border pb-3">
                  <h3 className="truncate text-base font-semibold">{current.name}</h3>
                  <p className="mt-1 truncate text-xs text-muted-foreground" title={current.url}>{current.url}</p>
                  {current.description ? <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{current.description}</p> : null}
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="triage-category" className="text-sm font-medium">{t('folder')}</label>
                  <select id="triage-category" value={destinationId} onChange={event => setDestinationId(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                    {orderedCategories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.emoji}
                        {' '}
                        {categoryName(category)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="triage-tags" className="text-sm font-medium">{t('syncFieldTags')}</label>
                  <Input id="triage-tags" value={tags} onChange={event => setTags(event.target.value)} placeholder={t('tagsPlaceholder')} />
                  {popularTags.length > 0
                    ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {popularTags.map(tag => (
                            <button key={tag} type="button" aria-pressed={selectedTags.has(tag)} onClick={() => toggleTag(tag)} className={`rounded px-2 py-1 text-xs ring-1 ring-border ${selectedTags.has(tag) ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent'}`}>
                              #
                              {tag}
                            </button>
                          ))}
                        </div>
                      )
                    : null}
                </div>
                <div className="flex justify-between gap-2">
                  <Button type="button" variant="ghost" onClick={skipCurrent} disabled={saving}>
                    {t('skip')}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                  <Button type="button" onClick={() => void completeCurrent()} disabled={saving || !destinationId}>
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    {t('completeAndContinue')}
                  </Button>
                </div>
              </div>
            )
          : (
              <div className="py-10 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">{t('inboxTriageComplete')}</p>
              </div>
            )}
      </DialogContent>
    </Dialog>
  )
}
