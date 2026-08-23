import type { MessageKey } from '~/lib/i18n'
import { ChevronDown, CircleHelp, Cloud, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'
import { cn } from '~/lib/utils'

const SYNC_SCOPE_OPTIONS = [
  { key: 'description', labelKey: 'syncFieldDescription' },
  { key: 'icon', labelKey: 'syncFieldIcon' },
  { key: 'alternateUrls', labelKey: 'syncFieldAlternateUrl' },
  { key: 'pinnedAt', labelKey: 'syncFieldPinned' },
  { key: 'tags', labelKey: 'syncFieldTags' },
  { key: 'inboxAt', labelKey: 'syncFieldInbox' },
  { key: 'categoryIcons', labelKey: 'syncFieldCategoryIcons' },
] as const

export function CrossDeviceSyncSettings() {
  const { languageTag, t, text } = useI18n()
  const metadataSyncStatus = useNavStore(state => state.metadataSyncStatus)
  const syncMetadataNow = useNavStore(state => state.syncMetadataNow)
  const metadataSyncScope = useNavStore(
    state => state.settings.metadataSyncScope,
  )
  const metadataSyncEncryptionEnabled = useNavStore(
    state => state.settings.metadataSyncEncryptionEnabled,
  )
  const metadataSyncPassphraseSet = useNavStore(
    state => state.metadataSyncPassphraseSet,
  )
  const setMetadataSyncScope = useNavStore(
    state => state.setMetadataSyncScope,
  )
  const setMetadataSyncEncryption = useNavStore(
    state => state.setMetadataSyncEncryption,
  )
  const [syncPassphraseInput, setSyncPassphraseInput] = useState('')
  const [syncSecurityMessage, setSyncSecurityMessage]
    = useState<MessageKey | null>(null)
  const [syncAdvancedOpen, setSyncAdvancedOpen] = useState(false)

  const saveMetadataEncryption = async () => {
    setSyncSecurityMessage(null)
    try {
      await setMetadataSyncEncryption(true, syncPassphraseInput)
      setSyncPassphraseInput('')
      setSyncSecurityMessage('encryptionPassphraseSaved')
    }
    catch {
      setSyncSecurityMessage('saveEncryptionSettingsFailed')
    }
  }

  const disableMetadataEncryption = async () => {
    setSyncSecurityMessage(null)
    await setMetadataSyncEncryption(false)
    setSyncPassphraseInput('')
    setSyncSecurityMessage('encryptionDisabledAndRemoved')
  }

  return (
    <section className="rounded-xl border border-border bg-muted/35 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border">
          <Cloud className="size-4 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{t('crossDeviceSync')}</h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {t('crossDeviceSyncDescription')}
          </p>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="mt-2"
              >
                <CircleHelp data-icon="inline-start" />
                {t('learnAboutSync')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('howCrossDeviceSyncWorks')}</DialogTitle>
                <DialogDescription>
                  {t('syncStorageDescription')}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-4 text-sm">
                <section className="flex flex-col gap-2">
                  <h4 className="font-semibold">{t('syncRequirements')}</h4>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    <li>{t('syncRequirementAccount')}</li>
                    <li>{t('syncRequirementEnabled')}</li>
                    <li>{t('syncRequirementBookmarks')}</li>
                  </ul>
                </section>

                <section className="flex flex-col gap-2">
                  <h4 className="font-semibold">{t('syncScope')}</h4>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    <li>{t('syncScopeMetadata')}</li>
                    <li>{t('syncScopeNativeBookmarks')}</li>
                    <li>{t('syncScopeLocalUsage')}</li>
                  </ul>
                </section>

                <section className="flex flex-col gap-2">
                  <h4 className="font-semibold">{t('syncPrivacyAndEncryption')}</h4>
                  <p className="text-muted-foreground">
                    {t('syncPrivacyAndEncryptionDescription')}
                  </p>
                </section>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {metadataSyncStatus.state === 'syncing'
            ? t('syncInProgress')
            : metadataSyncStatus.state === 'error'
              ? t('syncFailedWithReason', {
                  error: text(metadataSyncStatus.error),
                })
              : metadataSyncStatus.syncedAt
                ? [
                    t('syncStatusSummary', {
                      date: new Date(metadataSyncStatus.syncedAt).toLocaleString(languageTag),
                      direction: t(
                        metadataSyncStatus.direction === 'downloaded'
                          ? 'syncDirectionReceived'
                          : metadataSyncStatus.direction === 'uploaded'
                            ? 'syncDirectionUploaded'
                            : metadataSyncStatus.direction === 'merged'
                              ? 'syncDirectionMerged'
                              : 'syncDirectionSynced',
                      ),
                      size: Math.ceil((metadataSyncStatus.byteCount ?? 0) / 1024),
                    }),
                    metadataSyncStatus.retryCount
                      ? t('syncRetryCount', { count: metadataSyncStatus.retryCount })
                      : null,
                  ].filter(Boolean).join(' · ')
                : t('syncWaiting')}
          {(metadataSyncStatus.omittedBookmarkCount ?? 0) > 0
            ? ` · ${t('syncOmittedCount', { count: metadataSyncStatus.omittedBookmarkCount ?? 0 })}`
            : ''}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={metadataSyncStatus.state === 'syncing'}
          onClick={() => void syncMetadataNow()}
        >
          <RefreshCw
            data-icon="inline-start"
            className={cn(
              metadataSyncStatus.state === 'syncing' && 'animate-spin',
            )}
          />
          {t('syncNow')}
        </Button>
      </div>
      <Collapsible
        open={syncAdvancedOpen}
        onOpenChange={setSyncAdvancedOpen}
        className="mt-4 border-t border-border pt-4"
      >
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="group w-full justify-between"
          >
            {t('advancedSyncSettings')}
            <ChevronDown
              data-icon="inline-end"
              className="transition-transform group-data-[state=open]:rotate-180"
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-4">
            <p className="text-sm font-semibold">{t('syncScope')}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {SYNC_SCOPE_OPTIONS.map(option => (
                <label
                  key={option.key}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={metadataSyncScope[option.key]}
                    onCheckedChange={value =>
                      void setMetadataSyncScope({
                        [option.key]: value === true,
                      })}
                  />
                  {t(option.labelKey)}
                </label>
              ))}
            </div>
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{t('optionalEncryption')}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('optionalEncryptionDescription')}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground ring-1 ring-border">
                {metadataSyncEncryptionEnabled
                  ? metadataSyncPassphraseSet
                    ? t('encryptionEnabled')
                    : t('encryptionPassphrasePending')
                  : t('encryptionDisabled')}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Input
                type="password"
                value={syncPassphraseInput}
                onChange={event => setSyncPassphraseInput(event.target.value)}
                placeholder={
                  metadataSyncPassphraseSet
                    ? t('updateEncryptionPassphrasePlaceholder')
                    : t('encryptionPassphrasePlaceholder')
                }
                aria-label={t('encryptionPassphrase')}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => void saveMetadataEncryption()}
              >
                {metadataSyncEncryptionEnabled
                  ? t('updatePassphrase')
                  : t('enableEncryption')}
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {syncSecurityMessage
                  ? t(syncSecurityMessage)
                  : metadataSyncEncryptionEnabled
                    ? t('encryptedOnNextSync')
                    : t('plaintextMetadataSync')}
              </p>
              {metadataSyncEncryptionEnabled
                ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void disableMetadataEncryption()}
                    >
                      {t('disableEncryption')}
                    </Button>
                  )
                : null}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  )
}
