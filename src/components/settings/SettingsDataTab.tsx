import type { ImportPreview } from '~/lib/import-preview'
import type { BackupImportResult, FullBackupRestoreResult } from '~/lib/store'
import { Download, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '~/components/ui/button'
import { createImportPreview } from '~/lib/import-preview'
import { useBookmarks, useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

export function SettingsDataTab() {
  const { t } = useI18n()
  const bookmarks = useBookmarks()
  const exportBackup = useNavStore(state => state.exportBackup)
  const importBackup = useNavStore(state => state.importBackup)
  const exportFullBackup = useNavStore(state => state.exportFullBackup)
  const restoreFullBackup = useNavStore(state => state.restoreFullBackup)
  const importInputRef = useRef<HTMLInputElement>(null)
  const fullRestoreInputRef = useRef<HTMLInputElement>(null)
  const [backupResult, setBackupResult] = useState<BackupImportResult | null>(
    null,
  )
  const [fullRestoreResult, setFullRestoreResult]
    = useState<FullBackupRestoreResult | null>(null)
  const [backupError, setBackupError] = useState('')
  const [pendingImport, setPendingImport] = useState<{
    raw: string
    preview: ImportPreview
  } | null>(null)
  const [importStrategy, setImportStrategy] = useState<
    'merge' | 'replace' | 'skip'
  >('merge')

  const downloadBackup = () => {
    const blob = new Blob([exportBackup()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `yunji-tab-backup-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const prepareImport = async (
    file: File | undefined,
    kind: 'metadata' | 'full',
  ) => {
    if (!file)
      return
    setBackupResult(null)
    setBackupError('')
    try {
      const raw = await file.text()
      setPendingImport({
        raw,
        preview: createImportPreview(
          raw,
          bookmarks.map(bookmark => bookmark.url),
          kind,
        ),
      })
    }
    catch {
      setBackupError(t('backupPreviewFailed'))
    }
    finally {
      if (importInputRef.current)
        importInputRef.current.value = ''
      if (fullRestoreInputRef.current)
        fullRestoreInputRef.current.value = ''
    }
  }

  const confirmImport = async () => {
    if (!pendingImport)
      return
    setBackupError('')
    try {
      if (pendingImport.preview.kind === 'metadata')
        setBackupResult(await importBackup(pendingImport.raw, importStrategy))
      else setFullRestoreResult(await restoreFullBackup(pendingImport.raw))
      setPendingImport(null)
    }
    catch {
      setBackupError(t('backupImportFailed'))
    }
  }

  const downloadFullBackup = async () => {
    setBackupError('')
    try {
      const blob = new Blob([await exportFullBackup()], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `yunji-tab-full-snapshot-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(url)
    }
    catch {
      setBackupError(t('fullSnapshotExportFailed'))
    }
  }

  return (
    <section className="rounded-xl border border-border bg-muted/35 p-4">
      <h3 className="text-sm font-semibold">{t('dataBackup')}</h3>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">
        {t('dataBackupDescription')}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={downloadBackup}>
          <Download className="mr-2 h-4 w-4" />
          {t('exportJson')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => importInputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          {t('importJson')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void downloadFullBackup()}
        >
          <Download className="mr-2 h-4 w-4" />
          {t('fullSnapshot')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => fullRestoreInputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          {t('restoreSnapshot')}
        </Button>
        <input
          ref={importInputRef}
          type="file"
          aria-label={t('chooseMetadataJson')}
          accept="application/json,.json"
          className="sr-only"
          onChange={event =>
            void prepareImport(event.target.files?.[0], 'metadata')}
        />
        <input
          ref={fullRestoreInputRef}
          type="file"
          aria-label={t('chooseFullSnapshotJson')}
          accept="application/json,.json"
          className="sr-only"
          onChange={event =>
            void prepareImport(event.target.files?.[0], 'full')}
        />
      </div>
      {pendingImport
        ? (
            <div className="mt-3 rounded-md border border-border bg-background p-3">
              <p className="text-sm font-semibold">{t('importPreview')}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('importPreviewSummary', {
                  bookmarks: pendingImport.preview.bookmarkCount,
                  categories: pendingImport.preview.categoryCount,
                  conflicts: pendingImport.preview.conflictCount,
                })}
              </p>
              {pendingImport.preview.kind === 'metadata'
                ? (
                    <select
                      value={importStrategy}
                      onChange={event =>
                        setImportStrategy(event.target.value as typeof importStrategy)}
                      className="mt-3 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      aria-label={t('importConflictStrategy')}
                    >
                      <option value="merge">{t('mergeKeepLocalFields')}</option>
                      <option value="replace">{t('replaceWithBackup')}</option>
                      <option value="skip">{t('skipConflicts')}</option>
                    </select>
                  )
                : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('fullSnapshotRestoreDescription')}
                    </p>
                  )}
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setPendingImport(null)}
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void confirmImport()}
                >
                  {t('confirmImport')}
                </Button>
              </div>
            </div>
          )
        : null}
      {backupResult
        ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {t('metadataRestoreSummary', {
                bookmarks: backupResult.bookmarkMetaCount,
                categories: backupResult.categoryMetaCount,
                usage: backupResult.usageCount,
              })}
            </p>
          )
        : null}
      {fullRestoreResult
        ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {t('fullRestoreSummary', {
                count: fullRestoreResult.restoredNodeCount,
                folder: fullRestoreResult.restoredFolderName,
              })}
            </p>
          )
        : null}
      {backupError
        ? (
            <p className="mt-3 text-xs text-destructive">{backupError}</p>
          )
        : null}
    </section>
  )
}
