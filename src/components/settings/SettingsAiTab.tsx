import type { AiClassificationSuggestion } from '~/lib/ai-bookmark-classification'
import type { AiClassificationRecovery } from '~/lib/ai-classification-apply'
import type { AiSettings } from '~/lib/ai-settings'
import type { MessageKey } from '~/lib/i18n'
import {
  Bot,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
} from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AiClassificationPreviewDialog } from '~/components/settings/AiClassificationPreviewDialog'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import { Input } from '~/components/ui/input'
import {
  ensureAiEndpointPermission,
  fetchCompatibleModels,
  validateAiEndpoint,
} from '~/lib/ai-bookmark-classification'
import {
  applyClassificationSuggestions,
  loadAiClassificationRecovery,
  undoAiClassification,
} from '~/lib/ai-classification-apply'
import {
  clearAiClassificationJob,
  getAiClassificationJobSnapshot,
  initializeAiClassificationJob,
  isCurrentAiClassificationJobOwner,
  pauseAiClassificationJob,
  resumeAiClassificationJob,
  startAiClassificationJob,
  subscribeAiClassificationJob,
  terminateAiClassificationJob,
} from '~/lib/ai-classification-job'
import {
  clearAiToken,
  getDefaultAiClassificationPrompt,
  getDefaultAiSettings,
  loadAiSettings,
  loadAiToken,
  saveAiSettings,
} from '~/lib/ai-settings'
import { toNodeId } from '~/lib/bookmark-tree'
import { useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'
import { cn } from '~/lib/utils'

function errorMessageKey(cause: unknown): MessageKey {
  const message = cause instanceof Error ? cause.message : ''
  if (message === 'ai.invalid_base_url')
    return 'aiInvalidBaseUrl'
  if (message === 'ai.insecure_token_endpoint')
    return 'aiInsecureEndpoint'
  if (message === 'ai.model_required')
    return 'aiModelRequired'
  if (message === 'ai.prompt_required')
    return 'aiPromptRequired'
  if (message === 'ai.invalid_response' || cause instanceof SyntaxError)
    return 'aiInvalidResponse'
  return 'aiRequestFailed'
}

export function SettingsAiTab() {
  const { language, t } = useI18n()
  const bookmarks = useNavStore(state => state.bookmarks)
  const categories = useNavStore(state => state.categories)
  const loadBookmarks = useNavStore(state => state.loadBookmarks)
  const markBookmarksOrganized = useNavStore(
    state => state.markBookmarksOrganized,
  )
  const [settings, setSettings] = useState<AiSettings>(() =>
    getDefaultAiSettings(language),
  )
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loadingModels, setLoadingModels] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<AiClassificationSuggestion[]>(
    [],
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [applying, setApplying] = useState(false)
  const [recovery, setRecovery] = useState<AiClassificationRecovery | null>(
    null,
  )
  const [configurationOpen, setConfigurationOpen] = useState(false)
  const initialLanguageRef = useRef(language)
  const job = useSyncExternalStore(
    subscribeAiClassificationJob,
    getAiClassificationJobSnapshot,
    getAiClassificationJobSnapshot,
  )
  const previousJobStatusRef = useRef(job.status)
  const jobActive = job.status === 'running' || job.status === 'pausing'
  const jobControllable = isCurrentAiClassificationJobOwner()

  useEffect(() => {
    void (async () => {
      await initializeAiClassificationJob()
      const storedSettings = await loadAiSettings(initialLanguageRef.current)
      setSettings(storedSettings)
      setToken(await loadAiToken(storedSettings.rememberToken))
      setRecovery(await loadAiClassificationRecovery())
    })()
  }, [])

  useEffect(() => {
    const wasActive
      = previousJobStatusRef.current === 'running'
        || previousJobStatusRef.current === 'pausing'
    if (wasActive && job.status === 'completed' && job.suggestions.length > 0) {
      setSuggestions(job.suggestions)
      setSelectedIds(new Set(job.suggestions.map(item => item.bookmarkId)))
      setPreviewOpen(true)
    }
    previousJobStatusRef.current = job.status
  }, [job])

  const clearMessages = () => {
    setStatus('')
    setError('')
  }

  const requestPermission = async () => {
    validateAiEndpoint(settings.baseUrl, Boolean(token.trim()))
    if (!(await ensureAiEndpointPermission(settings.baseUrl)))
      throw new Error('ai.permission_denied')
  }

  const saveConfiguration = async () => {
    clearMessages()
    try {
      validateAiEndpoint(settings.baseUrl, Boolean(token.trim()))
      await saveAiSettings(settings, token, language)
      setStatus(t('aiConfigurationSaved'))
    }
    catch (cause) {
      setError(t(errorMessageKey(cause)))
    }
  }

  const loadModels = async (verified = false) => {
    clearMessages()
    setLoadingModels(true)
    try {
      await requestPermission()
      const nextModels = await fetchCompatibleModels(settings.baseUrl, token)
      setModels(nextModels)
      setStatus(
        t(verified ? 'aiConnectionVerified' : 'aiModelsLoaded', {
          count: nextModels.length,
        }),
      )
    }
    catch (cause) {
      setError(
        cause instanceof Error && cause.message === 'ai.permission_denied'
          ? t('aiPermissionDenied')
          : t(errorMessageKey(cause)),
      )
    }
    finally {
      setLoadingModels(false)
    }
  }

  const generatePreview = async () => {
    clearMessages()
    try {
      await requestPermission()
      await saveAiSettings(settings, token, language)
      await startAiClassificationJob(
        { ...settings, token },
        bookmarks,
        categories,
      )
    }
    catch (cause) {
      setError(
        cause instanceof Error && cause.message === 'ai.permission_denied'
          ? t('aiPermissionDenied')
          : t(errorMessageKey(cause)),
      )
    }
  }

  const resumePreview = async () => {
    clearMessages()
    try {
      await requestPermission()
      await saveAiSettings(settings, token, language)
      await resumeAiClassificationJob(
        { ...settings, token },
        bookmarks,
        categories,
      )
    }
    catch (cause) {
      setError(
        cause instanceof Error && cause.message === 'ai.permission_denied'
          ? t('aiPermissionDenied')
          : t(errorMessageKey(cause)),
      )
    }
  }

  const showSavedPreview = () => {
    setSuggestions(job.suggestions)
    setSelectedIds(new Set(job.suggestions.map(item => item.bookmarkId)))
    setPreviewOpen(true)
  }

  const applyPreview = async () => {
    setApplying(true)
    clearMessages()
    const selectedSuggestions = suggestions.filter(item =>
      selectedIds.has(item.bookmarkId),
    )
    try {
      const currentState = useNavStore.getState()
      const result = await applyClassificationSuggestions(
        selectedSuggestions,
        currentState.bookmarks,
        currentState.categories,
        async (bookmarkId, targetCategoryId) => {
          await chrome.bookmarks.move(toNodeId(bookmarkId), {
            parentId: toNodeId(targetCategoryId),
          })
        },
      )
      const movedIds
        = result.recovery?.items.map(item => item.bookmarkId) ?? []
      if (movedIds.length > 0)
        await markBookmarksOrganized(movedIds)
      await loadBookmarks()
      setRecovery(result.recovery)
      await clearAiClassificationJob()
      setPreviewOpen(false)
      setStatus(
        t('aiMoveCompleted', { count: result.moved, skipped: result.skipped }),
      )
    }
    catch {
      const savedRecovery = await loadAiClassificationRecovery()
      if (savedRecovery?.items.length) {
        await markBookmarksOrganized(
          savedRecovery.items.map(item => item.bookmarkId),
        )
      }
      await loadBookmarks()
      setRecovery(savedRecovery)
      setPreviewOpen(false)
      setError(t('aiApplyFailed'))
    }
    finally {
      setApplying(false)
    }
  }

  const undoLastClassification = async () => {
    if (!recovery)
      return
    clearMessages()
    const currentState = useNavStore.getState()
    const result = await undoAiClassification(
      recovery,
      currentState.bookmarks,
      currentState.categories,
    )
    await loadBookmarks()
    setRecovery(null)
    setStatus(
      t('aiUndoCompleted', { count: result.restored, skipped: result.skipped }),
    )
  }

  const removeToken = async () => {
    await clearAiToken()
    setToken('')
    setStatus(t('aiTokenCleared'))
    setError('')
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="text-base font-semibold">{t('aiSettings')}</h2>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          {t('aiSettingsDescription')}
        </p>
      </header>

      <section className="rounded-xl border border-border bg-muted/35 p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">{t('aiClassification')}</h3>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {t('aiClassificationDescription')}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-background p-3 ring-1 ring-border/70">
          <div className="flex items-start gap-2">
            <ShieldCheck
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium">{t('aiPrivacyNotice')}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t('aiPrivacyDescription')}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {job.status === 'idle'
                ? t('aiPreviewOnly')
                : t('aiGeneratingPreview', {
                    completed: job.completed,
                    total: job.total,
                  })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('aiProgressPersists')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {jobActive && jobControllable
              ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={pauseAiClassificationJob}
                  >
                    {job.status === 'pausing' ? t('aiPausing') : t('aiPause')}
                  </Button>
                )
              : null}
            {(job.status === 'paused' || (job.status === 'error' && job.completed < job.total))
              ? (
                  <Button type="button" onClick={() => void resumePreview()}>
                    <Sparkles />
                    {t('aiResume')}
                  </Button>
                )
              : null}
            {jobControllable && ['running', 'pausing', 'paused'].includes(job.status)
              ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => terminateAiClassificationJob()}
                  >
                    <Square />
                    {t('aiTerminate')}
                  </Button>
                )
              : null}
            {job.suggestions.length > 0
              && ['completed', 'terminated', 'error'].includes(job.status)
              ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={showSavedPreview}
                  >
                    {t('aiViewPreview')}
                  </Button>
                )
              : null}
            {!jobActive && job.status !== 'paused'
              ? (
                  <Button
                    type="button"
                    disabled={bookmarks.length === 0}
                    onClick={() => void generatePreview()}
                  >
                    <Sparkles />
                    {t('aiGeneratePreview')}
                  </Button>
                )
              : null}
          </div>
        </div>

        {job.total > 0 && job.status !== 'idle'
          ? (
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={job.total}
                aria-valuenow={job.completed}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{
                    width: `${Math.min(100, (job.completed / job.total) * 100)}%`,
                  }}
                />
              </div>
            )
          : null}

        <p
          className={cn(
            'mt-2 min-h-5 text-sm',
            error ? 'text-destructive' : 'text-muted-foreground',
          )}
          role={error ? 'alert' : 'status'}
          aria-live="polite"
        >
          {error
            || (jobActive && job.retryAttempt > 0
              ? t('aiRetryingRequest', {
                  attempt: job.retryAttempt,
                  max: job.retryMax,
                })
              : '')
            || (job.status === 'error'
              ? t(errorMessageKey(new Error(job.error)))
              : '')
            || (job.status === 'paused' ? t('aiPaused') : '')
            || (job.status === 'terminated' ? t('aiTerminated') : '')
            || (job.status === 'completed' && job.suggestions.length === 0
              ? t('aiNoSuggestions')
              : '')
            || status}
        </p>

        {recovery
          ? (
              <div className="mt-4 flex flex-col items-start gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {t('aiUndoAvailable')}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void undoLastClassification()}
                >
                  <RotateCcw />
                  {t('aiUndo')}
                </Button>
              </div>
            )
          : null}
      </section>

      <section className="rounded-xl border border-border bg-muted/35">
        <Collapsible
          open={configurationOpen}
          onOpenChange={setConfigurationOpen}
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-start gap-3 rounded-xl p-4 text-left transition-colors hover:bg-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/25"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border">
                <Bot
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {t('aiProvider')}
                </span>
                <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                  {t('aiProviderDescription')}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'mt-1 size-4 shrink-0 text-muted-foreground transition-transform',
                  configurationOpen && 'rotate-180',
                )}
                aria-hidden="true"
              />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent className="px-4 pb-4">
            <div className="grid gap-4 border-t border-border pt-4">
              <label className="grid gap-1.5 text-sm font-medium">
                {t('aiBaseUrl')}
                <Input
                  type="url"
                  value={settings.baseUrl}
                  onChange={event =>
                    setSettings(current => ({
                      ...current,
                      baseUrl: event.target.value,
                    }))}
                  placeholder="https://api.openai.com/v1"
                  spellCheck={false}
                />
              </label>

              <div className="grid gap-1.5">
                <label htmlFor="ai-token" className="text-sm font-medium">
                  {t('aiToken')}
                </label>
                <span className="relative block">
                  <Input
                    id="ai-token"
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    onChange={event => setToken(event.target.value)}
                    placeholder="sk-..."
                    className="pr-11"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    aria-label={t(showToken ? 'aiHideToken' : 'aiShowToken')}
                    className="absolute right-1 top-1 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                    onClick={() => setShowToken(current => !current)}
                  >
                    {showToken
                      ? (
                          <EyeOff className="size-4" />
                        )
                      : (
                          <Eye className="size-4" />
                        )}
                  </button>
                </span>
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="ai-model" className="text-sm font-medium">
                  {t('aiModel')}
                </label>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Input
                    id="ai-model"
                    list="ai-model-options"
                    value={settings.model}
                    onChange={event =>
                      setSettings(current => ({
                        ...current,
                        model: event.target.value,
                      }))}
                    placeholder="gpt-4.1-mini"
                    spellCheck={false}
                  />
                  <datalist id="ai-model-options">
                    {models.map(model => (
                      <option key={model} value={model} />
                    ))}
                  </datalist>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loadingModels}
                    onClick={() => void loadModels()}
                  >
                    <RefreshCw
                      className={cn(loadingModels && 'animate-spin')}
                    />
                    {loadingModels ? t('aiFetchingModels') : t('aiFetchModels')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('aiManualModelHint')}
                </p>
              </div>

              <label className="grid gap-1.5 text-sm font-medium">
                {t('aiBatchSize')}
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={settings.batchSize}
                  onChange={event =>
                    setSettings(current => ({
                      ...current,
                      batchSize: Number(event.target.value),
                    }))}
                  className="max-w-40"
                />
                <span className="text-xs font-normal leading-5 text-muted-foreground">
                  {t('aiBatchSizeHint')}
                </span>
              </label>

              <div className="grid gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="ai-prompt" className="text-sm font-medium">
                    {t('aiPrompt')}
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setSettings(current => ({
                        ...current,
                        prompt: getDefaultAiClassificationPrompt(language),
                      }))}
                  >
                    {t('aiResetPrompt')}
                  </Button>
                </div>
                <textarea
                  id="ai-prompt"
                  value={settings.prompt}
                  onChange={event =>
                    setSettings(current => ({
                      ...current,
                      prompt: event.target.value,
                    }))}
                  rows={5}
                  className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm leading-6 shadow-sm ring-offset-background transition-colors placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/15"
                />
              </div>

              <label className="flex items-start gap-2.5 text-sm">
                <Checkbox
                  checked={settings.rememberToken}
                  onCheckedChange={value =>
                    setSettings(current => ({
                      ...current,
                      rememberToken: value === true,
                    }))}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium">
                    {t('aiRememberToken')}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    {t('aiRememberTokenHint')}
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
              <Button
                type="button"
                size="sm"
                onClick={() => void saveConfiguration()}
              >
                {t('aiSaveConfiguration')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loadingModels}
                onClick={() => void loadModels(true)}
              >
                {t('aiVerifyConfiguration')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void removeToken()}
              >
                <KeyRound />
                {t('aiClearToken')}
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </section>

      <AiClassificationPreviewDialog
        open={previewOpen}
        suggestions={suggestions}
        selectedIds={selectedIds}
        bookmarks={bookmarks}
        categories={categories}
        applying={applying}
        onOpenChange={setPreviewOpen}
        onSelectedIdsChange={setSelectedIds}
        onApply={() => void applyPreview()}
      />
    </div>
  )
}
