import type { MessageKey } from '~/lib/i18n'
import type { WebdavBackupFile, WebdavConfig, WebdavErrorCode, WebdavStatus } from '~/lib/webdav-backup'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'
import { useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'
import {
  forgetWebdavConfig,
  listWebdavBackups,
  loadWebdavConfig,
  loadWebdavStatus,
  readWebdavBackup,
  requestWebdavPermission,
  runWebdavBackup,
  saveWebdavConfig,
  testWebdavConnection,
  WEBDAV_CONFIG_KEY,
  WEBDAV_DEFAULT_URL,
  WEBDAV_STATUS_KEY,
  webdavErrorCode,
} from '~/lib/webdav-backup'

const errorKeys: Record<WebdavErrorCode, MessageKey> = {
  address: 'webdavErrorAddress',
  insecure: 'webdavErrorInsecure',
  credentials: 'webdavErrorCredentials',
  permission: 'webdavErrorPermission',
  auth: 'webdavErrorAuth',
  missing: 'webdavErrorMissing',
  network: 'webdavErrorNetwork',
  server: 'webdavErrorServer',
  invalid: 'webdavErrorInvalid',
  changed: 'webdavErrorChanged',
}

export function WebdavBackupSettings({ onRestore }: { onRestore: (raw: string) => void }) {
  const { t, language } = useI18n()
  const [config, setConfig] = useState<WebdavConfig>({ enabled: false, url: WEBDAV_DEFAULT_URL, username: '', password: '', intervalHours: 24 })
  const [status, setStatus] = useState<WebdavStatus>({})
  const [history, setHistory] = useState<WebdavBackupFile[]>([])
  const [savedConfig, setSavedConfig] = useState<WebdavConfig | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [historyError, setHistoryError] = useState<MessageKey | null>(null)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [visibleCount, setVisibleCount] = useState(30)
  const [ready, setReady] = useState(false)
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<MessageKey | null>(null)
  const [error, setError] = useState<MessageKey | null>(null)

  useEffect(() => {
    let active = true
    const refresh = async (includeConfig: boolean) => {
      try {
        const [storedConfig, storedStatus] = await Promise.all([includeConfig ? loadWebdavConfig() : undefined, loadWebdavStatus()])
        if (!active)
          return
        if (storedConfig)
          setSavedConfig(storedConfig)
        if (storedConfig && !dirtyRef.current) {
          setConfig(storedConfig)
          setDirty(false)
        }
        setStatus(storedStatus)
        setReady(true)
      }
      catch {
        if (active)
          setError('webdavErrorStorage')
      }
    }
    void refresh(true)
    const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && (changes[WEBDAV_STATUS_KEY] || changes[WEBDAV_CONFIG_KEY]))
        void refresh(Boolean(changes[WEBDAV_CONFIG_KEY]))
    }
    chrome.storage.onChanged.addListener(changed)
    return () => {
      active = false
      chrome.storage.onChanged.removeListener(changed)
    }
  }, [])

  const savedUrl = savedConfig?.url
  const savedUsername = savedConfig?.username
  const savedPassword = savedConfig?.password
  const hasSavedConnection = Boolean(savedUsername && savedPassword)
  useEffect(() => {
    let active = true
    setHistory([])
    setHistoryError(null)
    setHistoryLoaded(false)
    setVisibleCount(30)
    if (!hasSavedConnection) {
      setHistoryLoading(false)
      return
    }
    setHistoryLoading(true)
    void listWebdavBackups().then((files) => {
      if (active) {
        setHistory(files)
        setHistoryLoaded(true)
      }
    }).catch((cause) => {
      if (active)
        setHistoryError(errorKeys[webdavErrorCode(cause)])
    }).finally(() => {
      if (active)
        setHistoryLoading(false)
    })
    return () => {
      active = false
    }
  }, [savedUrl, savedUsername, savedPassword, hasSavedConnection, status.lastSuccessAt, refreshVersion])

  const update = (patch: Partial<WebdavConfig>) => {
    setConfig(current => ({ ...current, ...patch }))
    dirtyRef.current = true
    setDirty(true)
    setMessage(null)
    setError(null)
  }

  const perform = async (action: 'save' | 'test' | 'upload' | 'restore' | 'forget' | 'refresh', file?: WebdavBackupFile) => {
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      if (action !== 'forget' && !await requestWebdavPermission(config)) {
        setError('webdavErrorPermission')
        return
      }
      if (action === 'save') {
        await saveWebdavConfig(config)
        const stored = await loadWebdavConfig()
        setConfig(stored)
        setSavedConfig(stored)
        dirtyRef.current = false
        setDirty(false)
        setMessage('webdavSaved')
      }
      else if (action === 'test') {
        await testWebdavConnection(config)
        setMessage('webdavConnected')
      }
      else if (action === 'upload') {
        await runWebdavBackup(() => useNavStore.getState().exportFullBackup(), true)
        setMessage('webdavUploaded')
      }
      else if (action === 'restore') {
        onRestore(await readWebdavBackup(file))
      }
      else if (action === 'refresh') {
        setRefreshVersion(value => value + 1)
      }
      else {
        await forgetWebdavConfig()
        const stored = await loadWebdavConfig()
        setConfig(stored)
        setSavedConfig(stored)
        dirtyRef.current = false
        setDirty(false)
      }
      setStatus(await loadWebdavStatus())
    }
    catch (cause) {
      setError(errorKeys[webdavErrorCode(cause)])
    }
    finally {
      setBusy(false)
    }
  }

  const formatDate = (timestamp: number) => new Date(timestamp).toLocaleString(language)
  const statusError = error ?? (status.error ? errorKeys[status.error] : null)
  return (
    <div className="mt-5 border-t border-border pt-5">
      <h4 className="text-sm font-semibold">{t('webdavTitle')}</h4>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('webdavDescription')}</p>
      <fieldset disabled={!ready || busy} className="mt-4 space-y-3">
        <label className="block space-y-1.5 text-sm">
          <span>{t('webdavDirectory')}</span>
          <Input type="url" value={config.url} placeholder={WEBDAV_DEFAULT_URL} onChange={event => update({ url: event.target.value })} autoComplete="off" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm">
            <span>{t('webdavUsername')}</span>
            <Input value={config.username} onChange={event => update({ username: event.target.value })} autoComplete="off" />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span>{t('webdavPassword')}</span>
            <Input type="password" value={config.password} onChange={event => update({ password: event.target.value })} autoComplete="new-password" />
          </label>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{t('webdavCredentialsHint')}</p>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={config.enabled} onCheckedChange={checked => update({ enabled: checked === true })} />
          <span>{t('webdavAuto')}</span>
        </label>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span>{t('webdavInterval')}</span>
          <select value={config.intervalHours} onChange={event => update({ intervalHours: Number(event.target.value) })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            {[1, 6, 24, 72].map(hours => <option key={hours} value={hours}>{t('webdavHours', { count: hours })}</option>)}
          </select>
        </label>
        {dirty ? <p className="text-xs text-muted-foreground">{t('webdavDirty')}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => void perform('save')}>{t('save')}</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void perform('test')}>{t('webdavTest')}</Button>
          <Button type="button" size="sm" variant="outline" disabled={dirty || !config.url || !config.username || !config.password} onClick={() => void perform('upload')}>{t('webdavUpload')}</Button>
          <Button type="button" size="sm" variant="outline" disabled={dirty || !config.url || !config.username || !config.password} onClick={() => void perform('restore')}>{t('webdavRestore')}</Button>
          <Button type="button" size="sm" variant="ghost" disabled={!config.username && !config.password && !history.length} onClick={() => void perform('forget')}>{t('webdavForget')}</Button>
        </div>
      </fieldset>
      {busy ? <Loader2 className="mt-3 h-4 w-4 animate-spin" aria-label={t('saving')} /> : null}
      {message ? <p role="status" className="mt-3 text-xs text-muted-foreground">{t(message)}</p> : null}
      <p className="mt-3 text-xs text-muted-foreground">{status.lastSuccessAt ? t('webdavLastSuccess', { time: formatDate(status.lastSuccessAt) }) : t('webdavNoBackup')}</p>
      {status.lastCheckedAt ? <p className="mt-1 text-xs text-muted-foreground">{t('webdavLastCheck', { time: formatDate(status.lastCheckedAt) })}</p> : null}
      {status.lastResult === 'unchanged' && !statusError ? <p className="mt-2 text-xs text-muted-foreground">{t('webdavHistoryUnchanged')}</p> : null}
      {statusError ? <p role="alert" className="mt-3 text-xs text-destructive">{t(statusError)}</p> : null}
      <section aria-label={t('webdavHistory')} className="mt-4 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <h5 className="text-sm font-semibold">{t('webdavHistory')}</h5>
          <Button type="button" size="sm" variant="outline" disabled={!ready || busy || dirty || historyLoading || !hasSavedConnection} onClick={() => void perform('refresh')}>
            {t('webdavHistoryRefresh')}
          </Button>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('webdavHistoryHint')}</p>
        {historyLoading ? <p role="status" className="mt-3 text-xs text-muted-foreground">{t('webdavHistoryLoading')}</p> : null}
        {historyError ? <p role="alert" className="mt-3 text-xs text-destructive">{t(historyError)}</p> : null}
        {history.length
          ? (
              <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                {history.slice(0, visibleCount).map(file => (
                  <li key={file.filename} className="flex items-start justify-between gap-3 rounded-md border border-border bg-background p-3">
                    <div className="min-w-0 space-y-1 text-xs">
                      {file.timestamp !== undefined
                        ? <time dateTime={new Date(file.timestamp).toISOString()} className="block font-medium">{formatDate(file.timestamp)}</time>
                        : <p className="font-medium">{t('webdavHistoryUnknownTime')}</p>}
                      <p className="break-all text-muted-foreground">{file.filename}</p>
                      {file.size !== undefined ? <p className="text-muted-foreground">{t('webdavHistorySize', { size: file.size.toLocaleString(language) })}</p> : null}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      aria-label={t('webdavRestoreAt', { filename: file.filename })}
                      disabled={!ready || busy || dirty || historyLoading}
                      onClick={() => void perform('restore', file)}
                    >
                      {t('webdavRestoreRecord')}
                    </Button>
                  </li>
                ))}
              </ul>
            )
          : !historyLoading && !historyError ? <p className="mt-3 text-xs text-muted-foreground">{t(historyLoaded ? 'webdavHistoryEmpty' : 'webdavHistoryConfigure')}</p> : null}
        {history.length > visibleCount
          ? <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => setVisibleCount(count => count + 30)}>{t('webdavHistoryMore')}</Button>
          : null}
      </section>
    </div>
  )
}
