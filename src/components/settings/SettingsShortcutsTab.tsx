import type { KeyboardEvent } from 'react'
import type { MessageKey } from '~/lib/i18n'
import type { ShortcutAction } from '~/lib/types'
import { ExternalLink, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Kbd, KbdGroup } from '~/components/ui/kbd'
import { Switch } from '~/components/ui/switch'
import {
  getBrowserShortcutSettingsTarget,
  openBrowserShortcutSettings,
} from '~/lib/browser-shortcuts'
import {
  formatChromeShortcutParts,
  formatShortcut,
  formatShortcutParts,
  SHORTCUT_ACTIONS,
  shortcutFromKeyboardEvent,
  shortcutsEqual,
  validateShortcut,
} from '~/lib/keyboard-shortcuts'
import { useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

const ACTIONS: Record<
  ShortcutAction,
  { descriptionKey: MessageKey, labelKey: MessageKey }
> = {
  focusSearch: {
    labelKey: 'focusSearchShortcut',
    descriptionKey: 'focusSearchShortcutDescription',
  },
  openCommandPalette: {
    labelKey: 'openCommandPaletteShortcut',
    descriptionKey: 'openCommandPaletteShortcutDescription',
  },
  addBookmark: {
    labelKey: 'addBookmarkShortcut',
    descriptionKey: 'addBookmarkShortcutDescription',
  },
}

type RecorderIssue
  = | { action: ShortcutAction, type: 'reserved' | 'unsupported' }
    | {
      action: ShortcutAction
      conflictAction: ShortcutAction
      type: 'conflict'
    }

type BrowserShortcutState
  = | { state: 'loading' }
    | {
      state: 'ready'
      shortcuts: Record<BrowserCommandName, string>
    }
    | { state: 'unavailable' }

type BrowserCommandName = 'open-global-command-palette' | 'quick-save-page'

const BROWSER_COMMANDS: Array<{
  labelKey: MessageKey
  name: BrowserCommandName
}> = [
  {
    name: 'open-global-command-palette',
    labelKey: 'globalCommandPaletteShortcut',
  },
  {
    name: 'quick-save-page',
    labelKey: 'quickSaveCurrentPageShortcut',
  },
]

function ShortcutKeys({ parts }: { parts: string[] }) {
  return (
    <KbdGroup>
      {parts.map(part => <Kbd key={part}>{part}</Kbd>)}
    </KbdGroup>
  )
}

export function SettingsShortcutsTab() {
  const { t } = useI18n()
  const shortcuts = useNavStore(state => state.settings.keyboardShortcuts)
  const globalCommandPaletteEnabled = useNavStore(
    state => state.settings.globalCommandPaletteEnabled,
  )
  const setKeyboardShortcut = useNavStore(state => state.setKeyboardShortcut)
  const setGlobalCommandPaletteEnabled = useNavStore(
    state => state.setGlobalCommandPaletteEnabled,
  )
  const resetKeyboardShortcuts = useNavStore(
    state => state.resetKeyboardShortcuts,
  )
  const [recording, setRecording] = useState<ShortcutAction | null>(null)
  const [issue, setIssue] = useState<RecorderIssue | null>(null)
  const [browserShortcutOpenFailed, setBrowserShortcutOpenFailed] = useState(
    false,
  )
  const [browserSettingsTarget] = useState(
    getBrowserShortcutSettingsTarget,
  )
  const [browserShortcut, setBrowserShortcut] = useState<BrowserShortcutState>(
    () =>
      typeof chrome === 'undefined' || !chrome.commands?.getAll
        ? { state: 'unavailable' }
        : { state: 'loading' },
  )

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.commands?.getAll)
      return
    let active = true
    void chrome.commands
      .getAll()
      .then((commands) => {
        if (!active)
          return
        setBrowserShortcut({
          state: 'ready',
          shortcuts: Object.fromEntries(
            BROWSER_COMMANDS.map(({ name }) => [
              name,
              commands.find(item => item.name === name)?.shortcut ?? '',
            ]),
          ) as Record<BrowserCommandName, string>,
        })
      })
      .catch(() => {
        if (active)
          setBrowserShortcut({ state: 'unavailable' })
      })
    return () => {
      active = false
    }
  }, [])

  const handleShortcutKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    action: ShortcutAction,
  ) => {
    if (recording !== action)
      return
    if (event.key === 'Tab') {
      setRecording(null)
      setIssue(null)
      return
    }
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Escape') {
      setRecording(null)
      setIssue(null)
      return
    }
    const shortcut = shortcutFromKeyboardEvent(event.nativeEvent)
    if (!shortcut)
      return
    const validationIssue = validateShortcut(shortcut)
    if (validationIssue) {
      setIssue({ action, type: validationIssue })
      return
    }
    const conflictAction = SHORTCUT_ACTIONS.find(
      candidate =>
        candidate !== action && shortcutsEqual(shortcuts[candidate], shortcut),
    )
    if (conflictAction) {
      setIssue({ action, conflictAction, type: 'conflict' })
      return
    }
    setIssue(null)
    setRecording(null)
    void setKeyboardShortcut(action, shortcut).catch(() => {
      setIssue({ action, type: 'unsupported' })
    })
  }

  const issueMessage
    = issue?.type === 'conflict'
      ? t('shortcutConflict', {
          action: t(ACTIONS[issue.conflictAction].labelKey),
        })
      : issue?.type === 'reserved'
        ? t('shortcutReserved')
        : issue?.type === 'unsupported'
          ? t('shortcutUnsupported')
          : null

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-border bg-muted/35 p-4">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{t('keyboardShortcuts')}</h3>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {t('keyboardShortcutsDescription')}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setRecording(null)
              setIssue(null)
              void resetKeyboardShortcuts()
            }}
          >
            <RotateCcw data-icon="inline-start" />
            {t('resetShortcuts')}
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {SHORTCUT_ACTIONS.map((action) => {
            const config = ACTIONS[action]
            const isRecording = recording === action
            return (
              <div
                key={action}
                className="rounded-lg border border-border/70 bg-card px-3 py-3"
              >
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t(config.labelKey)}</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                      {t(config.descriptionKey)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={isRecording ? 'secondary' : 'outline'}
                    className="w-full shrink-0 sm:w-auto sm:min-w-36"
                    aria-label={`${t('recordShortcut')}: ${t(config.labelKey)}, ${formatShortcut(shortcuts[action])}`}
                    aria-pressed={isRecording}
                    onClick={() => {
                      if (recording === action)
                        return
                      setRecording(action)
                      setIssue(null)
                    }}
                    onBlur={() => {
                      if (recording === action)
                        setRecording(null)
                    }}
                    onKeyDown={event => handleShortcutKeyDown(event, action)}
                  >
                    {isRecording
                      ? (
                          t('pressShortcut')
                        )
                      : (
                          <ShortcutKeys
                            parts={formatShortcutParts(shortcuts[action])}
                          />
                        )}
                  </Button>
                </div>
                {isRecording
                  ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t('recordingShortcutHint')}
                      </p>
                    )
                  : null}
                {issue?.action === action && issueMessage
                  ? (
                      <p className="mt-2 text-xs text-destructive" role="alert">
                        {issueMessage}
                      </p>
                    )
                  : null}
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-muted/35 p-4">
        <h3 className="text-sm font-semibold">
          {t('browserManagedShortcuts')}
        </h3>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          {t('browserManagedShortcutsDescription')}
        </p>
        <div className="mt-3 flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-card px-3 py-3">
          <label
            htmlFor="global-command-palette-enabled"
            className="min-w-0 cursor-pointer"
          >
            <span className="block text-sm font-medium">
              {t('globalCommandPaletteEnabled')}
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
              {t('globalCommandPaletteEnabledDescription')}
            </span>
          </label>
          <Switch
            id="global-command-palette-enabled"
            checked={globalCommandPaletteEnabled}
            onCheckedChange={value =>
              void setGlobalCommandPaletteEnabled(value)}
          />
        </div>
        <div className="mt-2 overflow-hidden rounded-lg border border-border/70 bg-card">
          {BROWSER_COMMANDS.map((command, index) => {
            const shortcut
              = browserShortcut.state === 'ready'
                ? browserShortcut.shortcuts[command.name]
                : ''
            return (
              <div
                key={command.name}
                className={`flex flex-col items-start gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${index > 0 ? 'border-t border-border/70' : ''}`}
              >
                <span className="text-sm font-medium">
                  {t(command.labelKey)}
                </span>
                {browserShortcut.state === 'loading'
                  ? (
                      <Badge variant="secondary">{t('shortcutLoading')}</Badge>
                    )
                  : browserShortcut.state === 'unavailable'
                    ? (
                        <Badge variant="outline">{t('shortcutUnavailable')}</Badge>
                      )
                    : shortcut
                      ? (
                          <ShortcutKeys
                            parts={formatChromeShortcutParts(shortcut)}
                          />
                        )
                      : (
                          <Badge variant="outline">{t('shortcutNotAssigned')}</Badge>
                        )}
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <code
            className="break-all text-xs leading-5 text-muted-foreground"
            aria-label={t('browserShortcutSettingsAddress')}
          >
            {browserSettingsTarget.primaryUrl}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setBrowserShortcutOpenFailed(false)
              void openBrowserShortcutSettings(browserSettingsTarget).catch(
                () => setBrowserShortcutOpenFailed(true),
              )
            }}
          >
            <ExternalLink data-icon="inline-start" />
            {t('openBrowserShortcutSettings')}
          </Button>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {t('browserShortcutFindExtensionHint', {
            name: t('brandName'),
          })}
        </p>
        {browserShortcutOpenFailed
          ? (
              <p className="mt-2 text-xs leading-5 text-destructive" role="alert">
                {t('openBrowserShortcutSettingsFailed', {
                  url: browserSettingsTarget.primaryUrl,
                })}
              </p>
            )
          : null}
      </section>
    </div>
  )
}
