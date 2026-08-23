import type { BookmarkHealthIssue, BookmarkHealthResult } from '~/lib/bookmark-health'
import type { BookmarkHealthMessageKey } from '~/lib/i18n-bookmark-health'
import {
  ArrowRight,
  CheckCircle2,
  GitMerge,
  HeartPulse,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react'

import { useMemo, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import {
  scanBookmarkHealth,
} from '~/lib/bookmark-health'
import { buildCategoryPathMap } from '~/lib/category-path'
import { localizedMessage } from '~/lib/i18n'
import { ensureSitePermissions } from '~/lib/site-permissions'
import { useBookmarks, useCategories, useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'
import { cn } from '~/lib/utils'

interface BookmarkHealthDialogProps {
  triggerClassName?: string
  triggerLabel?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const ISSUE_META: Record<
  BookmarkHealthIssue,
  { labelKey: BookmarkHealthMessageKey, className: string }
> = {
  'duplicate': {
    labelKey: 'healthIssueDuplicate',
    className: 'bg-secondary text-secondary-foreground',
  },
  'redirected': {
    labelKey: 'healthIssueRedirected',
    className: 'bg-accent text-accent-foreground',
  },
  'http-error': {
    labelKey: 'healthIssueHttpError',
    className: 'bg-destructive/10 text-destructive',
  },
  'unreachable': {
    labelKey: 'healthIssueUnreachable',
    className: 'bg-destructive/10 text-destructive',
  },
}

type HealthFilter = 'all' | BookmarkHealthIssue
interface ConfirmAction {
  type: 'merge' | 'delete'
  result: BookmarkHealthResult
}

export function BookmarkHealthDialog({
  triggerClassName,
  triggerLabel,
  open: controlledOpen,
  onOpenChange,
}: BookmarkHealthDialogProps) {
  const { categoryName, t } = useI18n()
  const bookmarks = useBookmarks()
  const categories = useCategories()
  const ignoredDomains = useNavStore(
    state => state.settings.descriptionIgnoredDomains,
  )
  const updateBookmark = useNavStore(state => state.updateBookmark)
  const removeBookmarks = useNavStore(state => state.removeBookmarks)
  const [internalOpen, setInternalOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [results, setResults] = useState<BookmarkHealthResult[] | null>(null)
  const [filter, setFilter] = useState<HealthFilter>('all')
  const [actionId, setActionId] = useState('')
  const [error, setError] = useState('')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  )
  const categoryPathMap = useMemo(
    () => buildCategoryPathMap(categories.map(category => ({
      ...category,
      name: categoryName(category),
    }))),
    [categories, categoryName],
  )
  const beginTask = useNavStore(state => state.beginTask)
  const updateTask = useNavStore(state => state.updateTask)
  const finishTask = useNavStore(state => state.finishTask)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const issueResults = (results ?? []).filter(
    result => result.issues.length > 0,
  )
  const visibleResults = issueResults.filter(
    result => filter === 'all' || result.issues.includes(filter),
  )
  const countIssue = (issue: BookmarkHealthIssue) =>
    issueResults.filter(result => result.issues.includes(issue)).length

  const scan = async () => {
    beginTask({
      id: 'health-check',
      type: 'health-check',
      label: localizedMessage('healthTaskLabel'),
      total: bookmarks.length,
    })
    setScanning(true)
    setError('')
    setFilter('all')
    try {
      if (!(await ensureSitePermissions())) {
        setError(t('healthSitePermissionRequired'))
        finishTask(
          'health-check',
          'error',
          localizedMessage('healthTaskPermissionDenied'),
        )
        return
      }
      const nextResults = await scanBookmarkHealth(bookmarks, {
        ignoredDomains,
        onProgress: (completed, total) => {
          setProgress({ completed, total })
          updateTask('health-check', { completed, total })
        },
      })
      setResults(nextResults)
      const issueCount = nextResults.filter(result => result.issues.length > 0).length
      finishTask(
        'health-check',
        'success',
        localizedMessage('healthTaskFoundIssues', { count: issueCount }),
      )
    }
    catch {
      setError(t('healthScanFailed'))
      finishTask('health-check', 'error', localizedMessage('healthTaskFailed'))
    }
    finally {
      setScanning(false)
    }
  }

  const updateRedirect = async (result: BookmarkHealthResult) => {
    if (!result.finalUrl)
      return
    setActionId(result.bookmarkId)
    setError('')
    try {
      await updateBookmark(result.bookmarkId, { url: result.finalUrl })
      setResults(
        current =>
          current?.map(candidate =>
            candidate.bookmarkId === result.bookmarkId
              ? {
                  ...candidate,
                  url: result.finalUrl ?? candidate.url,
                  issues: candidate.issues.filter(
                    issue => issue !== 'redirected',
                  ),
                }
              : candidate,
          ) ?? null,
      )
    }
    catch {
      setError(t('healthUpdateRedirectFailed'))
    }
    finally {
      setActionId('')
    }
  }

  const mergeDuplicates = async (result: BookmarkHealthResult) => {
    const duplicateIds = (result.duplicateIds ?? []).filter(
      id => id !== result.bookmarkId,
    )
    if (duplicateIds.length === 0)
      return
    setActionId(result.bookmarkId)
    setError('')
    try {
      await removeBookmarks(duplicateIds)
      const removedIds = new Set(duplicateIds)
      setResults(current =>
        current
          ? current.flatMap(candidate =>
              removedIds.has(candidate.bookmarkId)
                ? []
                : [candidate.bookmarkId === result.bookmarkId
                    ? {
                        ...candidate,
                        issues: candidate.issues.filter(
                          issue => issue !== 'duplicate',
                        ),
                        duplicateIds: undefined,
                      }
                    : candidate],
            )
          : null,
      )
    }
    catch {
      setError(t('healthMergeFailed'))
    }
    finally {
      setActionId('')
    }
  }

  const removeBroken = async (result: BookmarkHealthResult) => {
    setActionId(result.bookmarkId)
    setError('')
    try {
      await removeBookmarks([result.bookmarkId])
      setResults(
        current =>
          current?.filter(
            candidate => candidate.bookmarkId !== result.bookmarkId,
          ) ?? null,
      )
    }
    catch {
      setError(t('healthDeleteFailed'))
    }
    finally {
      setActionId('')
    }
  }

  const filters: Array<{ id: HealthFilter, label: string, count: number }> = [
    { id: 'all', label: t('healthAllIssues'), count: issueResults.length },
    { id: 'duplicate', label: t('healthIssueDuplicate'), count: countIssue('duplicate') },
    { id: 'redirected', label: t('healthRedirectedFilter'), count: countIssue('redirected') },
    {
      id: 'http-error',
      label: t('healthIssueHttpError'),
      count: countIssue('http-error'),
    },
    { id: 'unreachable', label: t('healthIssueUnreachable'), count: countIssue('unreachable') },
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {triggerClassName
        ? (
            <DialogTrigger asChild>
              <button
                type="button"
                title={t('bookmarkHealth')}
                aria-label={t('openBookmarkHealth')}
                className={triggerClassName}
              >
                <HeartPulse className="h-4 w-4" />
                {triggerLabel ? <span>{triggerLabel}</span> : null}
              </button>
            </DialogTrigger>
          )
        : null}
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-balance">{t('bookmarkHealth')}</DialogTitle>
          <DialogDescription className="text-pretty">
            {t('healthDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => void scan()} disabled={scanning}>
            {scanning
              ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )
              : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
            {scanning
              ? t('healthCheckingProgress', progress)
              : results
                ? t('healthCheckAgain')
                : t('healthCheckBookmarkCount', { count: bookmarks.length })}
          </Button>
          {results
            ? (
                <span className="text-sm text-muted-foreground">
                  {t('healthFoundBookmarkCount', { count: issueResults.length })}
                </span>
              )
            : null}
        </div>

        {results && issueResults.length > 0
          ? (
              <div className="flex gap-1 overflow-x-auto border-b border-border pb-2">
                {filters.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilter(item.id)}
                    className={cn(
                      'flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm',
                      filter === item.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {item.label}
                    <span className="text-xs opacity-70">{item.count}</span>
                  </button>
                ))}
              </div>
            )
          : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {results && issueResults.length === 0
          ? (
              <div className="flex flex-col items-center py-12 text-center">
                <CheckCircle2 className="h-9 w-9 text-foreground" />
                <p className="mt-3 text-sm font-medium">{t('healthNoIssues')}</p>
              </div>
            )
          : null}

        {visibleResults.length > 0
          ? (
              <div className="divide-y divide-border border-y border-border">
                {visibleResults.map((result) => {
                  const busy = actionId === result.bookmarkId
                  return (
                    <div
                      key={result.bookmarkId}
                      className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold">
                            {result.name}
                          </span>
                          {result.issues.map(issue => (
                            <span
                              key={issue}
                              className={cn(
                                'rounded px-1.5 py-0.5 text-xs font-medium',
                                ISSUE_META[issue].className,
                              )}
                            >
                              {t(ISSUE_META[issue].labelKey)}
                              {issue === 'http-error' && result.statusCode
                                ? ` ${result.statusCode}`
                                : ''}
                            </span>
                          ))}
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {categoryPathMap.get(result.categoryId)?.join(' / ')}
                        </p>
                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                          {result.url}
                        </p>
                        {result.issues.includes('redirected') && result.finalUrl
                          ? (
                              <p className="mt-1 flex min-w-0 items-center gap-1 font-mono text-xs text-foreground">
                                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{result.finalUrl}</span>
                              </p>
                            )
                          : null}
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        {result.issues.includes('duplicate')
                          ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                  setConfirmAction({ type: 'merge', result })}
                              >
                                <GitMerge className="mr-1.5 h-4 w-4" />
                                {t('healthKeepThis')}
                              </Button>
                            )
                          : null}
                        {result.issues.includes('redirected') && result.finalUrl
                          ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void updateRedirect(result)}
                              >
                                <ArrowRight className="mr-1.5 h-4 w-4" />
                                {t('healthUpdateAddress')}
                              </Button>
                            )
                          : null}
                        {result.issues.some(
                          issue =>
                            issue === 'http-error' || issue === 'unreachable',
                        )
                          ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() =>
                                  setConfirmAction({ type: 'delete', result })}
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="mr-1.5 h-4 w-4" />
                                {t('delete')}
                              </Button>
                            )
                          : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          : null}

        <AlertDialog
          open={confirmAction !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen)
              setConfirmAction(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-balance">
                {confirmAction?.type === 'merge'
                  ? t('healthMergeTitle')
                  : t('healthDeleteTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-pretty">
                {confirmAction?.type === 'merge'
                  ? t('healthMergeDescription')
                  : t('healthDeleteDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const action = confirmAction
                  setConfirmAction(null)
                  if (!action)
                    return
                  if (action.type === 'merge') {
                    void mergeDuplicates(action.result)
                  }
                  else {
                    void removeBroken(action.result)
                  }
                }}
              >
                {confirmAction?.type === 'merge' ? t('healthConfirmMerge') : t('confirmDelete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}
