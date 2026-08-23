import type { MetadataSyncRecoveryEntry, TrashEntry } from '~/lib/activity'
import type { MessageKey, TranslationParams } from '~/lib/i18n'
import { History, Loader2, RotateCcw, Trash2, X } from 'lucide-react'
import { useState } from 'react'
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
import { createTrashRestorePreview } from '~/lib/activity'
import { useBookmarks, useCategories, useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

interface ActivityDialogProps {
  triggerClassName?: string
  triggerLabel?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ActivityDialog({
  triggerClassName,
  triggerLabel,
  open,
  onOpenChange,
}: ActivityDialogProps) {
  const { languageTag, t, text } = useI18n()
  const trash = useNavStore(state => state.trash)
  const history = useNavStore(state => state.history)
  const metadataSyncRecovery = useNavStore(state => state.metadataSyncRecovery)
  const bookmarks = useBookmarks()
  const categories = useCategories()
  const restoreTrashEntry = useNavStore(state => state.restoreTrashEntry)
  const removeTrashEntry = useNavStore(state => state.removeTrashEntry)
  const restoreMetadataSyncRecovery = useNavStore(
    state => state.restoreMetadataSyncRecovery,
  )
  const removeMetadataSyncRecovery = useNavStore(
    state => state.removeMetadataSyncRecovery,
  )
  const clearHistory = useNavStore(state => state.clearHistory)
  const [pendingRestore, setPendingRestore] = useState<TrashEntry | null>(null)
  const [pendingMetadataRecovery, setPendingMetadataRecovery]
    = useState<MetadataSyncRecoveryEntry | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [message, setMessage] = useState<{
    key: MessageKey
    params?: TranslationParams
  } | null>(null)
  const preview = pendingRestore
    ? createTrashRestorePreview(
        pendingRestore,
        bookmarks.map(bookmark => bookmark.url),
        categories.map(category => category.id),
      )
    : null

  const confirmRestore = async () => {
    if (!pendingRestore)
      return
    setRestoring(true)
    try {
      const result = await restoreTrashEntry(pendingRestore.id)
      setMessage(result.remainingRootCount > 0
        ? {
            key: 'restorePartialCount',
            params: {
              failed: result.failedRootCount,
              restored: result.restoredRootCount,
            },
          }
        : {
            key: 'restoreCompleteCount',
            params: { count: result.restoredRootCount },
          })
      setPendingRestore(null)
    }
    finally {
      setRestoring(false)
    }
  }

  const confirmMetadataRecovery = async () => {
    if (!pendingMetadataRecovery)
      return
    setRestoring(true)
    try {
      const restored = await restoreMetadataSyncRecovery(pendingMetadataRecovery.id)
      setMessage({
        key: restored ? 'metadataRecoveryComplete' : 'recoveryPointMissing',
      })
      setPendingMetadataRecovery(null)
    }
    finally {
      setRestoring(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {triggerClassName
        ? (
            <DialogTrigger asChild>
              <button type="button" title={t('trashAndHistory')} aria-label={t('openTrashAndHistory')} className={triggerClassName}>
                <History className="h-4 w-4" />
                {triggerLabel ? <span>{triggerLabel}</span> : null}
              </button>
            </DialogTrigger>
          )
        : null}
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('trashAndHistory')}</DialogTitle>
          <DialogDescription>{t('activityDescription')}</DialogDescription>
        </DialogHeader>

        <section>
          <h3 className="text-sm font-semibold">{t('trash')}</h3>
          <div className="mt-2 grid gap-2">
            {trash.length === 0
              ? <p className="py-5 text-center text-sm text-muted-foreground">{t('trashEmpty')}</p>
              : trash.map(entry => (
                  <div key={entry.id} className="flex items-center gap-2 rounded-md border border-border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{text(entry.label)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(entry.deletedAt).toLocaleString(languageTag)}
                        {entry.restoreError ? ` · ${t('lastRestoreIncomplete')}` : ''}
                      </p>
                    </div>
                    <button type="button" title={t('restore')} aria-label={t('restoreNamed', { name: text(entry.label) })} onClick={() => setPendingRestore(entry)} className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground">
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button type="button" title={t('removeFromTrash')} aria-label={t('removeNamedFromTrash', { name: text(entry.label) })} onClick={() => void removeTrashEntry(entry.id)} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
          </div>
        </section>

        <section className="border-t border-border pt-4">
          <h3 className="text-sm font-semibold">{t('syncRecoveryPoints')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('syncRecoveryPointsDescription')}
          </p>
          <div className="mt-2 grid gap-2">
            {metadataSyncRecovery.length === 0
              ? <p className="py-5 text-center text-sm text-muted-foreground">{t('noSyncRecoveryPoints')}</p>
              : metadataSyncRecovery.map(entry => (
                  <div key={entry.id} className="flex items-center gap-2 rounded-md border border-border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{text(entry.label)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString(languageTag)}
                        {' · '}
                        {t(entry.direction === 'merged'
                          ? 'syncDirectionMergedShort'
                          : 'syncDirectionReceivedShort')}
                      </p>
                    </div>
                    <button type="button" title={t('restorePreSyncData')} aria-label={t('restoreNamed', { name: text(entry.label) })} onClick={() => setPendingMetadataRecovery(entry)} className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground">
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button type="button" title={t('deleteRecoveryPoint')} aria-label={t('deleteNamed', { name: text(entry.label) })} onClick={() => void removeMetadataSyncRecovery(entry.id)} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
          </div>
        </section>

        <section className="border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t('recentActivity')}</h3>
            <Button type="button" size="sm" variant="ghost" disabled={history.length === 0} onClick={() => void clearHistory()}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t('clearAll')}
            </Button>
          </div>
          <div className="mt-2 grid gap-1">
            {history.length === 0
              ? <p className="py-5 text-center text-sm text-muted-foreground">{t('noActivity')}</p>
              : history.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                    <span className="truncate">{text(entry.label)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString(languageTag)}</span>
                  </div>
                ))}
          </div>
        </section>
        {message ? <p className="text-sm text-muted-foreground">{t(message.key, message.params)}</p> : null}

        <AlertDialog open={pendingRestore !== null} onOpenChange={open => !open && !restoring && setPendingRestore(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('restorePreview')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('restorePreviewSummary', {
                  bookmarks: preview?.bookmarkCount ?? 0,
                  nodes: preview?.nodeCount ?? 0,
                })}
                {(preview?.duplicateUrlCount ?? 0) > 0
                  ? ` ${t('restoreDuplicateWarning', { count: preview?.duplicateUrlCount ?? 0 })}`
                  : ''}
                {(preview?.fallbackParentCount ?? 0) > 0
                  ? ` ${t('restoreFallbackWarning', { count: preview?.fallbackParentCount ?? 0 })}`
                  : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={restoring}>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                disabled={restoring}
                onClick={(event) => {
                  event.preventDefault()
                  void confirmRestore()
                }}
              >
                {restoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('confirmRestore')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={pendingMetadataRecovery !== null}
          onOpenChange={open => !open && !restoring && setPendingMetadataRecovery(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('restorePreSyncTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('restorePreSyncDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={restoring}>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                disabled={restoring}
                onClick={(event) => {
                  event.preventDefault()
                  void confirmMetadataRecovery()
                }}
              >
                {restoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('confirmRestore')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}
