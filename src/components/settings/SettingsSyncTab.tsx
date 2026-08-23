import type { DescriptionSyncResult } from '~/lib/store'
import {
  CheckCircle2,
  ChevronDown,
  RefreshCw,
  Save,
  Shield,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import {
  getDescriptionSyncStatus,
  normalizeIgnoredDomains,
} from '~/lib/description-sync'
import { ensureSitePermissions } from '~/lib/site-permissions'
import { useBookmarks, useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

export function SettingsSyncTab() {
  const { t } = useI18n()
  const bookmarks = useBookmarks()
  const syncMissingDescriptions = useNavStore(
    state => state.syncMissingDescriptions,
  )
  const ignoredDomains = useNavStore(
    state => state.settings.descriptionIgnoredDomains,
  )
  const setDescriptionIgnoredDomains = useNavStore(
    state => state.setDescriptionIgnoredDomains,
  )
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<DescriptionSyncResult | null>(null)
  const [error, setError] = useState('')
  const [ignoredDomainsInput, setIgnoredDomainsInput] = useState(() =>
    ignoredDomains.join('\n'),
  )
  const [domainsSaved, setDomainsSaved] = useState(false)
  const [ignoredDomainsExpanded, setIgnoredDomainsExpanded] = useState(false)

  const normalizedInputDomains = normalizeIgnoredDomains(
    ignoredDomainsInput.split(/[\s,]+/),
  )
  const domainsDirty
    = normalizedInputDomains.join('\n') !== ignoredDomains.join('\n')
  const eligibleUrls = new Set<string>()
  const ignoredUrls = new Set<string>()
  for (const bookmark of bookmarks) {
    const status = getDescriptionSyncStatus(bookmark, ignoredDomains)
    if (status === 'eligible')
      eligibleUrls.add(bookmark.url)
    if (status === 'ignored')
      ignoredUrls.add(bookmark.url)
  }
  const missingDescriptionCount = eligibleUrls.size
  const ignoredDescriptionCount = ignoredUrls.size
  let syncButtonLabel = t('completeWebsiteDescriptions')
  if (syncing)
    syncButtonLabel = t('completingWebsiteDescriptions', { count: missingDescriptionCount })
  else if (domainsDirty)
    syncButtonLabel = t('saveIgnoredListFirst')
  else if (missingDescriptionCount === 0)
    syncButtonLabel = t('allDescriptionsPresent')

  const saveIgnoredDomains = async () => {
    await setDescriptionIgnoredDomains(normalizedInputDomains)
    setIgnoredDomainsInput(normalizedInputDomains.join('\n'))
    setDomainsSaved(true)
  }

  const syncDescriptions = async () => {
    setSyncing(true)
    setResult(null)
    setError('')
    try {
      if (!(await ensureSitePermissions())) {
        setError(t('descriptionSitePermissionRequired'))
        return
      }
      setResult(await syncMissingDescriptions())
    }
    catch {
      setError(t('descriptionSyncFailed'))
    }
    finally {
      setSyncing(false)
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-border bg-muted/35">
        <button
          type="button"
          aria-expanded={ignoredDomainsExpanded}
          aria-controls="description-ignored-domains-panel"
          onClick={() => setIgnoredDomainsExpanded(expanded => !expanded)}
          className="flex w-full items-start gap-3 p-4 text-left outline-none transition-colors hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border">
            <Shield className="h-4 w-4 text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">{t('descriptionIgnoredDomains')}</h3>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {t('descriptionIgnoredDomainsDescription')}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {domainsDirty
              ? t('unsavedChanges')
              : t('domainCount', { count: ignoredDomains.length })}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${ignoredDomainsExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        {ignoredDomainsExpanded
          ? (
              <div id="description-ignored-domains-panel" className="px-4 pb-4">
                <textarea
                  id="description-ignored-domains"
                  aria-label={t('ignoredDomainList')}
                  value={ignoredDomainsInput}
                  onChange={(event) => {
                    setIgnoredDomainsInput(event.target.value)
                    setDomainsSaved(false)
                  }}
                  disabled={syncing}
                  rows={7}
                  spellCheck={false}
                  placeholder={t('ignoredDomainsPlaceholder')}
                  className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-sm leading-5 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    {domainsSaved
                      ? t('ignoredListSaved')
                      : t('savedDomainCount', { count: ignoredDomains.length })}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void saveIgnoredDomains()}
                    disabled={syncing || !domainsDirty}
                  >
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    {t('saveIgnoredList')}
                  </Button>
                </div>
              </div>
            )
          : null}
      </section>
      <section className="rounded-xl border border-border bg-muted/35 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold">{t('completeWebsiteDescriptions')}</h3>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {t('completeWebsiteDescriptionsDescription')}
            </p>
            {ignoredDescriptionCount > 0
              ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('ignoredUrlCount', { count: ignoredDescriptionCount })}
                  </p>
                )
              : null}
          </div>
          <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground ring-1 ring-border">
            {t('pendingWebsiteCount', { count: missingDescriptionCount })}
          </span>
        </div>

        <Button
          type="button"
          className="mt-4 w-full"
          onClick={() => void syncDescriptions()}
          disabled={syncing || domainsDirty || missingDescriptionCount === 0}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`}
          />
          {syncButtonLabel}
        </Button>

        {result
          ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-foreground" />
                {result.attempted > result.updated
                  ? t('descriptionSyncPartial', {
                      attempted: result.attempted,
                      missing: result.attempted - result.updated,
                      updated: result.updated,
                    })
                  : t('descriptionSyncComplete', {
                      attempted: result.attempted,
                      updated: result.updated,
                    })}
              </p>
            )
          : null}
        {error
          ? (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            )
          : null}
      </section>
    </>
  )
}
