import { ChevronDown, PanelLeft, PanelTop } from 'lucide-react'
import { useState } from 'react'
import { AutoOrganizeSettings } from '~/components/AutoOrganizeSettings'
import { Button } from '~/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import { Switch } from '~/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'
import { ALL_CATEGORY, VIRTUAL_CATEGORIES } from '~/lib/default-data'
import { homeTabReadyMessage } from '~/lib/home-tabs'
import { languageOptions } from '~/lib/i18n'
import { useCategories, useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

const NAV_LAYOUT_OPTIONS = [
  { value: 'sidebar', labelKey: 'sidebar', Icon: PanelLeft },
  { value: 'top', labelKey: 'topbar', Icon: PanelTop },
] as const

interface NavigationSwitchProps {
  checked: boolean
  label: string
  onCheckedChange: (checked: boolean) => void
}

function NavigationSwitch({
  checked,
  label,
  onCheckedChange,
}: NavigationSwitchProps) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg bg-secondary/45 px-3 py-2.5 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  )
}

export function SettingsGeneralTab() {
  const { categoryName, language, t } = useI18n()
  const categories = useCategories()
  const defaultCategoryId = useNavStore(
    state => state.settings.defaultCategoryId,
  )
  const singleHomeTab = useNavStore(state => state.settings.singleHomeTab)
  const appearance = useNavStore(state => state.settings.appearance)
  const setDefaultCategory = useNavStore(state => state.setDefaultCategory)
  const setSingleHomeTab = useNavStore(state => state.setSingleHomeTab)
  const setAppearance = useNavStore(state => state.setAppearance)
  const setLanguage = useNavStore(state => state.setLanguage)
  const [autoRulesOpen, setAutoRulesOpen] = useState(false)

  const defaultCategoryValue
    = VIRTUAL_CATEGORIES.some(category => category.id === defaultCategoryId)
      || categories.some(category => category.id === defaultCategoryId)
      ? defaultCategoryId
      : ALL_CATEGORY.id

  const updateSingleHomeTab = async (enabled: boolean) => {
    await setSingleHomeTab(enabled)
    if (enabled) {
      await chrome.runtime
        .sendMessage({ type: homeTabReadyMessage })
        .catch(() => undefined)
    }
  }

  return (
    <>
      <section className="rounded-xl border border-border bg-muted/35 p-4">
        <label htmlFor="default-category" className="text-sm font-semibold">
          {t('defaultFolder')}
        </label>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          {t('defaultFolderDescription')}
        </p>
        <select
          id="default-category"
          value={defaultCategoryValue}
          onChange={event => void setDefaultCategory(event.target.value)}
          className="mt-3 h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
        >
          {VIRTUAL_CATEGORIES.map(category => (
            <option key={category.id} value={category.id}>
              {category.emoji}
              {' '}
              {categoryName(category)}
            </option>
          ))}
          {categories.map(category => (
            <option key={category.id} value={category.id}>
              {category.emoji}
              {' '}
              {category.name}
            </option>
          ))}
        </select>
      </section>

      <section className="rounded-xl border border-border bg-muted/35 p-4">
        <label htmlFor="interface-language" className="text-sm font-semibold">
          {t('language')}
        </label>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          {t('languageDescription')}
        </p>
        <select
          id="interface-language"
          value={language}
          onChange={event =>
            void setLanguage(event.target.value as typeof language)}
          className="mt-3 h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
        >
          {languageOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </section>

      <section className="rounded-xl border border-border bg-muted/35 p-4">
        <h3 className="text-sm font-semibold">
          {t('navigationAndCategories')}
        </h3>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          {t('navigationAndCategoriesDescription')}
        </p>
        <ToggleGroup
          type="single"
          value={appearance.navLayout}
          onValueChange={(value) => {
            if (value) {
              void setAppearance({
                navLayout: value as typeof appearance.navLayout,
              })
            }
          }}
          variant="outline"
          className="mt-3 grid grid-cols-2"
          aria-label={t('categoryBarPosition')}
        >
          {NAV_LAYOUT_OPTIONS.map(({ value, labelKey, Icon }) => (
            <ToggleGroupItem key={value} value={value} aria-label={t(labelKey)}>
              <Icon />
              <span>{t(labelKey)}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <NavigationSwitch
            label={t('showCounts')}
            checked={appearance.navItems.counts}
            onCheckedChange={value =>
              void setAppearance({ navItems: { counts: value } })}
          />
          <NavigationSwitch
            label={t('smartCategories')}
            checked={appearance.navItems.smartCategories}
            onCheckedChange={value =>
              void setAppearance({ navItems: { smartCategories: value } })}
          />
          <NavigationSwitch
            label={t('savedFilters')}
            checked={appearance.navItems.savedSearches}
            onCheckedChange={value =>
              void setAppearance({ navItems: { savedSearches: value } })}
          />
          <NavigationSwitch
            label={t('categoryTree')}
            checked={appearance.navItems.categoryTree}
            onCheckedChange={value =>
              void setAppearance({ navItems: { categoryTree: value } })}
          />
        </div>
        <p className="mt-2 text-pretty text-xs leading-5 text-muted-foreground">
          {t('categoryTreeHint')}
        </p>
      </section>

      <section className="rounded-xl border border-border bg-muted/35 p-4">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="single-home-tab" className="min-w-0 cursor-pointer">
            <span className="block text-sm font-semibold">
              {t('singleHomeTab')}
            </span>
            <span className="mt-1 block text-sm leading-5 text-muted-foreground">
              {t('singleHomeTabDescription')}
            </span>
          </label>
          <Switch
            id="single-home-tab"
            checked={singleHomeTab}
            onCheckedChange={value => void updateSingleHomeTab(value)}
          />
        </div>
      </section>

      <Collapsible open={autoRulesOpen} onOpenChange={setAutoRulesOpen}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="group w-full justify-between"
          >
            {t('autoOrganizeRules')}
            <ChevronDown
              data-icon="inline-end"
              className="transition-transform group-data-[state=open]:rotate-180"
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <AutoOrganizeSettings />
        </CollapsibleContent>
      </Collapsible>
    </>
  )
}
