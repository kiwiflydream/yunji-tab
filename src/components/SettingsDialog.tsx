import type { SettingsTab } from '~/components/settings/SettingsTabNavigation'
import { Settings } from 'lucide-react'

import { useState } from 'react'
import { PrivacyDataSettings } from '~/components/PrivacyDataSettings'
import { CrossDeviceSyncSettings } from '~/components/settings/CrossDeviceSyncSettings'
import { SettingsAboutTab } from '~/components/settings/SettingsAboutTab'
import { SettingsAiTab } from '~/components/settings/SettingsAiTab'
import { SettingsAppearanceTab } from '~/components/settings/SettingsAppearanceTab'
import { SettingsDataTab } from '~/components/settings/SettingsDataTab'
import { SettingsGeneralTab } from '~/components/settings/SettingsGeneralTab'
import { SettingsSearchTab } from '~/components/settings/SettingsSearchTab'
import { SettingsShortcutsTab } from '~/components/settings/SettingsShortcutsTab'
import { SettingsSyncTab } from '~/components/settings/SettingsSyncTab'
import { SettingsTabNavigation } from '~/components/settings/SettingsTabNavigation'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'

import { useI18n } from '~/lib/use-i18n'

interface SettingsDialogProps {
  triggerClassName?: string
  triggerLabel?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SettingsDialog({
  triggerClassName,
  triggerLabel,
  open: controlledOpen,
  onOpenChange,
}: SettingsDialogProps) {
  const { t } = useI18n()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general')
  const handleOpenChange = (nextOpen: boolean) => {
    if (onOpenChange)
      onOpenChange(nextOpen)
    else setInternalOpen(nextOpen)
    if (nextOpen)
      setSettingsTab('general')
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {triggerClassName
        ? (
            <DialogTrigger asChild>
              <button
                type="button"
                title={t('settings')}
                aria-label={t('openSettings')}
                className={triggerClassName}
              >
                <Settings className="h-4 w-4" />
                {triggerLabel ? <span>{triggerLabel}</span> : null}
              </button>
            </DialogTrigger>
          )
        : null}

      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:p-0">
        <div className="border-b border-border/70 px-5 py-4 sm:px-6 sm:py-5">
          <DialogHeader>
            <DialogTitle>{t('settings')}</DialogTitle>
            <DialogDescription>{t('settingsDescription')}</DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid min-h-0 flex-1 md:grid-cols-[10.5rem_minmax(0,1fr)]">
          <SettingsTabNavigation
            value={settingsTab}
            onValueChange={setSettingsTab}
          />

          <div className="max-h-[calc(100dvh-13rem)] overflow-y-auto px-4 py-5 sm:px-6">
            <div
              id={`settings-panel-${settingsTab}`}
              role="tabpanel"
              aria-labelledby={`settings-tab-${settingsTab}`}
              tabIndex={0}
              className="flex flex-col outline-none"
            >
              {settingsTab === 'general' ? <SettingsGeneralTab /> : null}

              {settingsTab === 'appearance' ? <SettingsAppearanceTab /> : null}

              {settingsTab === 'shortcuts' ? <SettingsShortcutsTab /> : null}

              {settingsTab === 'search' ? <SettingsSearchTab /> : null}

              {settingsTab === 'sync' ? <SettingsSyncTab /> : null}

              {settingsTab === 'ai' ? <SettingsAiTab /> : null}

              {settingsTab === 'data'
                ? (
                    <>
                      <CrossDeviceSyncSettings />
                      <SettingsDataTab />
                      <PrivacyDataSettings />
                    </>
                  )
                : null}

              {settingsTab === 'about' ? <SettingsAboutTab /> : null}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border/70 bg-secondary/25 px-5 py-3 sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            {t('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
