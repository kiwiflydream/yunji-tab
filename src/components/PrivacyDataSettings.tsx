import type { MessageKey } from '~/lib/i18n'
import { Storage } from '@plasmohq/storage'
import { Database, Eraser, GlobeLock, History, Image, Tags, Trash2 } from 'lucide-react'
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
import { clearFaviconCache } from '~/lib/favicon-cache'
import { useNavStore } from '~/lib/store'
import { tabSessionsStorageKey } from '~/lib/tab-sessions'
import { useI18n } from '~/lib/use-i18n'

const localStorage = new Storage({ area: 'local' })

interface DataAction {
  id: string
  label: string
  description: string
  Icon: typeof Database
  run: () => Promise<void>
}

export function PrivacyDataSettings() {
  const { t } = useI18n()
  const usageCount = useNavStore(state => Object.keys(state.usage).length)
  const metaCount = useNavStore(state => Object.keys(state.meta).length)
  const trashCount = useNavStore(state => state.trash.length)
  const historyCount = useNavStore(state => state.history.length)
  const recoveryCount = useNavStore(state => state.metadataSyncRecovery.length)
  const clearUsage = useNavStore(state => state.clearUsage)
  const clearTrash = useNavStore(state => state.clearTrash)
  const clearHistory = useNavStore(state => state.clearHistory)
  const clearMetadataSyncRecovery = useNavStore(
    state => state.clearMetadataSyncRecovery,
  )
  const clearSupplementaryMetadata = useNavStore(state => state.clearSupplementaryMetadata)
  const [pending, setPending] = useState<DataAction | null>(null)
  const [message, setMessage] = useState<{
    key: MessageKey
    label: string
  } | null>(null)

  const actions: DataAction[] = [
    {
      id: 'usage',
      label: t('usageHistoryWithCount', { count: usageCount }),
      description: t('clearUsageHistoryDescription'),
      Icon: History,
      run: clearUsage,
    },
    {
      id: 'favicons',
      label: t('faviconCache'),
      description: t('clearFaviconCacheDescription'),
      Icon: Image,
      run: clearFaviconCache,
    },
    {
      id: 'sessions',
      label: t('tabSessions'),
      description: t('clearTabSessionsDescription'),
      Icon: Database,
      run: () => localStorage.remove(tabSessionsStorageKey),
    },
    {
      id: 'activity',
      label: t('trashAndHistoryWithCount', {
        count: trashCount + historyCount + recoveryCount,
      }),
      description: t('clearActivityDescription'),
      Icon: Trash2,
      run: async () => {
        await Promise.all([
          clearTrash(),
          clearHistory(),
          clearMetadataSyncRecovery(),
        ])
      },
    },
    {
      id: 'metadata',
      label: t('supplementaryMetadataWithCount', { count: metaCount }),
      description: t('clearSupplementaryMetadataDescription'),
      Icon: Tags,
      run: clearSupplementaryMetadata,
    },
    {
      id: 'permissions',
      label: t('siteAccessPermission'),
      description: t('clearSiteAccessPermissionDescription'),
      Icon: GlobeLock,
      run: async () => {
        await chrome.permissions.remove({ origins: ['http://*/*', 'https://*/*'] })
      },
    },
  ]

  const confirm = async () => {
    if (!pending)
      return
    const label = pending.label
    try {
      await pending.run()
      setMessage({ key: 'dataActionCleared', label })
    }
    catch {
      setMessage({ key: 'dataActionClearFailed', label })
    }
    finally {
      setPending(null)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-muted/35 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border">
          <Eraser className="h-4 w-4 text-muted-foreground" />
        </span>
        <div>
          <h3 className="text-sm font-semibold">{t('privacyAndLocalData')}</h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{t('privacyAndLocalDataDescription')}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-1">
        {actions.map(action => (
          <button key={action.id} type="button" onClick={() => setPending(action)} className="flex items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-background">
            <action.Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{action.label}</span>
              <span className="block text-xs text-muted-foreground">{action.description}</span>
            </span>
          </button>
        ))}
      </div>
      {message
        ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t(message.key, { label: message.label })}
            </p>
          )
        : null}

      <AlertDialog open={pending !== null} onOpenChange={open => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmClear')}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.description}
              {' '}
              {t('clearCannotBeUndone')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirm()}>{t('confirmClear')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
