import type { MessageKey, TranslationParams } from '~/lib/i18n'
import type { TabSession } from '~/lib/tab-sessions'
import { Storage } from '@plasmohq/storage'
import {
  ChevronDown,
  FolderClock,
  Loader2,
  Play,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import {
  collectSessionTabs,
  maxTabSessions,
  parseTabSessions,
  tabSessionsStorageKey,
} from '~/lib/tab-sessions'
import { useI18n } from '~/lib/use-i18n'

const localStorage = new Storage({ area: 'local' })

interface TabSessionsDialogProps {
  triggerClassName?: string
  triggerLabel?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function TabSessionsDialog({
  triggerClassName,
  triggerLabel,
  open: controlledOpen,
  onOpenChange,
}: TabSessionsDialogProps) {
  const { languageTag, t } = useI18n()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const [sessions, setSessions] = useState<TabSession[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{
    key: MessageKey
    params?: TranslationParams
  } | null>(null)
  const [excludePinned, setExcludePinned] = useState(false)
  const [restoreInNewWindow, setRestoreInNewWindow] = useState(false)
  const [expandedId, setExpandedId] = useState('')
  const [selectedUrls, setSelectedUrls] = useState<Record<string, string[]>>({})
  const expandedSelectedUrls = useMemo(
    () => new Set(selectedUrls[expandedId] ?? []),
    [expandedId, selectedUrls],
  )

  const persist = async (next: TabSession[]) => {
    setSessions(next)
    await localStorage.set(tabSessionsStorageKey, next)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (onOpenChange)
      onOpenChange(nextOpen)
    else
      setInternalOpen(nextOpen)
    if (nextOpen) {
      setMessage(null)
      setExpandedId('')
      void localStorage.get<unknown>(tabSessionsStorageKey)
        .then(value => setSessions(parseTabSessions(
          value,
          t('runtimeUnnamedSession'),
        )))
    }
  }

  const captureCurrentTabs = async () => {
    const options = { excludePinned }
    const currentTabs = collectSessionTabs(
      await chrome.tabs.query({ currentWindow: true }),
      options,
    )
    if (currentTabs.length > 0)
      return currentTabs

    const windows = await chrome.windows.getAll({ populate: true })
    const normalWindows = windows.filter(window => window.type === 'normal')
    const candidates = [
      ...normalWindows.filter(window => window.focused),
      ...normalWindows.filter(window => !window.focused),
    ]
    for (const window of candidates) {
      const tabs = collectSessionTabs(window.tabs ?? [], options)
      if (tabs.length > 0)
        return tabs
    }
    return []
  }

  const saveCurrentWindow = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const tabs = await captureCurrentTabs()
      if (tabs.length === 0) {
        setMessage({ key: 'noSavableTabs' })
        return
      }
      const createdAt = Date.now()
      const session: TabSession = {
        id: crypto.randomUUID(),
        name: name.trim() || t('defaultSessionName', {
          date: new Date(createdAt).toLocaleString(languageTag),
        }),
        createdAt,
        tabs,
      }
      await persist([session, ...sessions].slice(0, maxTabSessions))
      setName('')
      setMessage({ key: 'savedTabCount', params: { count: tabs.length } })
    }
    catch {
      setMessage({ key: 'saveSessionFailed' })
    }
    finally {
      setBusy(false)
    }
  }

  const updateSession = async (session: TabSession) => {
    setBusy(true)
    setMessage(null)
    try {
      const tabs = await captureCurrentTabs()
      if (tabs.length === 0) {
        setMessage({ key: 'noTabsForUpdate' })
        return
      }
      await persist(sessions.map(item => item.id === session.id
        ? { ...item, tabs, updatedAt: Date.now() }
        : item))
      setSelectedUrls(current => ({ ...current, [session.id]: tabs.map(tab => tab.url) }))
      setMessage({ key: 'updatedNamedSession', params: { name: session.name } })
    }
    finally {
      setBusy(false)
    }
  }

  const restore = async (session: TabSession) => {
    const selected = new Set(selectedUrls[session.id] ?? session.tabs.map(tab => tab.url))
    const urls = session.tabs.flatMap(tab => selected.has(tab.url) ? [tab.url] : [])
    if (urls.length === 0) {
      setMessage({ key: 'selectAtLeastOneTab' })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      if (restoreInNewWindow) {
        await chrome.windows.create({ url: urls })
      }
      else {
        for (const url of urls) {
          // Creating tabs sequentially preserves the saved session's tab order.
          // react-doctor-disable-next-line react-doctor/async-await-in-loop
          await chrome.tabs.create({ url, active: false })
        }
      }
      setMessage({ key: 'restoredTabCount', params: { count: urls.length } })
    }
    catch {
      setMessage({ key: 'someTabsRestoreFailed' })
    }
    finally {
      setBusy(false)
    }
  }

  const toggleExpanded = (session: TabSession) => {
    const expanding = expandedId !== session.id
    setExpandedId(expanding ? session.id : '')
    if (expanding && !selectedUrls[session.id]) {
      setSelectedUrls(current => ({
        ...current,
        [session.id]: session.tabs.map(tab => tab.url),
      }))
    }
  }

  const toggleUrl = (sessionId: string, url: string) => {
    setSelectedUrls((current) => {
      const selected = new Set(current[sessionId] ?? [])
      if (selected.has(url))
        selected.delete(url)
      else
        selected.add(url)
      return { ...current, [sessionId]: [...selected] }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {triggerClassName
        ? (
            <DialogTrigger asChild>
              <button type="button" title={t('tabSessions')} aria-label={t('manageTabSessions')} className={triggerClassName}>
                <FolderClock className="h-4 w-4" />
                {triggerLabel ? <span>{triggerLabel}</span> : null}
              </button>
            </DialogTrigger>
          )
        : null}
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('tabSessions')}</DialogTitle>
          <DialogDescription>{t('tabSessionsDescription')}</DialogDescription>
        </DialogHeader>

        <section className="grid gap-3 border-b border-border pb-4">
          <div className="flex gap-2">
            <Input value={name} onChange={event => setName(event.target.value)} placeholder={t('optionalSessionName')} />
            <Button type="button" onClick={() => void saveCurrentWindow()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {t('saveWindow')}
            </Button>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox checked={excludePinned} onCheckedChange={value => setExcludePinned(value === true)} />
              {t('excludePinnedTabs')}
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={restoreInNewWindow} onCheckedChange={value => setRestoreInNewWindow(value === true)} />
              {t('restoreToNewWindow')}
            </label>
          </div>
        </section>

        {message ? <p className="text-sm text-muted-foreground">{t(message.key, message.params)}</p> : null}
        <div className="grid gap-2">
          {sessions.length === 0
            ? <p className="py-8 text-center text-sm text-muted-foreground">{t('noSavedSessions')}</p>
            : sessions.map(session => (
                <article key={session.id} className="rounded-md border border-border">
                  <div className="flex items-center gap-2 p-3">
                    <button type="button" aria-expanded={expandedId === session.id} aria-label={t(expandedId === session.id ? 'collapseNamedSession' : 'expandNamedSession', { name: session.name })} onClick={() => toggleExpanded(session)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expandedId === session.id ? 'rotate-180' : ''}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{session.name}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {t('sessionTabCountAndDate', {
                            count: session.tabs.length,
                            date: new Date(session.updatedAt ?? session.createdAt)
                              .toLocaleString(languageTag),
                          })}
                        </span>
                      </span>
                    </button>
                    <button type="button" title={t('updateFromCurrentWindow')} aria-label={t('updateNamedSession', { name: session.name })} disabled={busy} onClick={() => void updateSession(session)} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50">
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button type="button" title={t('restoreSession')} aria-label={t('restoreNamedSession', { name: session.name })} disabled={busy} onClick={() => void restore(session)} className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50">
                      <Play className="h-4 w-4" />
                    </button>
                    <button type="button" title={t('deleteSession')} aria-label={t('deleteNamedSession', { name: session.name })} disabled={busy} onClick={() => void persist(sessions.filter(item => item.id !== session.id))} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {expandedId === session.id
                    ? (
                        <div className="grid gap-1 border-t border-border px-3 py-2">
                          {session.tabs.map(tab => (
                            <label key={tab.url} className="flex min-w-0 items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-muted/50">
                              <Checkbox checked={expandedSelectedUrls.has(tab.url)} onCheckedChange={() => toggleUrl(session.id, tab.url)} />
                              <span className="min-w-0 flex-1 truncate" title={tab.url}>{tab.title}</span>
                            </label>
                          ))}
                        </div>
                      )
                    : null}
                </article>
              ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
