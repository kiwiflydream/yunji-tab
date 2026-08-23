import type { LucideIcon } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import {
  Bot,
  Database,
  Info,
  Keyboard,
  Palette,
  Search,
  Settings2,
  WandSparkles,
} from 'lucide-react'
import { useRef } from 'react'
import { useI18n } from '~/lib/use-i18n'
import { cn } from '~/lib/utils'

export type SettingsTab
  = | 'general'
    | 'appearance'
    | 'shortcuts'
    | 'search'
    | 'sync'
    | 'ai'
    | 'data'
    | 'about'

const SETTINGS_TABS: Array<{
  id: SettingsTab
  labelKey:
    | 'appearance'
    | 'about'
    | 'aiSettings'
    | 'contentEnhancement'
    | 'dataAndPrivacy'
    | 'general'
    | 'keyboardShortcuts'
    | 'search'
  Icon: LucideIcon
}> = [
  { id: 'general', labelKey: 'general', Icon: Settings2 },
  { id: 'appearance', labelKey: 'appearance', Icon: Palette },
  { id: 'shortcuts', labelKey: 'keyboardShortcuts', Icon: Keyboard },
  { id: 'search', labelKey: 'search', Icon: Search },
  { id: 'sync', labelKey: 'contentEnhancement', Icon: WandSparkles },
  { id: 'ai', labelKey: 'aiSettings', Icon: Bot },
  { id: 'data', labelKey: 'dataAndPrivacy', Icon: Database },
  { id: 'about', labelKey: 'about', Icon: Info },
]

interface SettingsTabNavigationProps {
  value: SettingsTab
  onValueChange: (tab: SettingsTab) => void
}

export function SettingsTabNavigation({
  value,
  onValueChange,
}: SettingsTabNavigationProps) {
  const { t } = useI18n()
  const tabButtonsRef = useRef<Array<HTMLButtonElement | null>>([])

  const focusTab = (index: number) => {
    const tab = SETTINGS_TABS[index]
    if (!tab)
      return
    onValueChange(tab.id)
    window.requestAnimationFrame(() => tabButtonsRef.current[index]?.focus())
  }

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      focusTab((index + 1) % SETTINGS_TABS.length)
    }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      focusTab((index - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length)
    }
    else if (event.key === 'Home') {
      event.preventDefault()
      focusTab(0)
    }
    else if (event.key === 'End') {
      event.preventDefault()
      focusTab(SETTINGS_TABS.length - 1)
    }
  }

  return (
    <div
      role="tablist"
      aria-label={t('settingsCategories')}
      aria-orientation="vertical"
      className="flex gap-1 overflow-x-auto border-b border-border/70 bg-secondary/35 p-3 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:p-4"
    >
      {SETTINGS_TABS.map((tab, index) => (
        <button
          key={tab.id}
          ref={(element) => {
            tabButtonsRef.current[index] = element
          }}
          id={`settings-tab-${tab.id}`}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          aria-controls={`settings-panel-${tab.id}`}
          tabIndex={value === tab.id ? 0 : -1}
          onClick={() => onValueChange(tab.id)}
          onKeyDown={event => handleKeyDown(event, index)}
          className={cn(
            'flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors md:w-full',
            value === tab.id
              ? 'bg-card text-foreground shadow-sm ring-1 ring-border/60'
              : 'text-muted-foreground hover:bg-card/70 hover:text-foreground',
          )}
        >
          <tab.Icon className="size-4" aria-hidden="true" />
          {t(tab.labelKey)}
        </button>
      ))}
    </div>
  )
}
