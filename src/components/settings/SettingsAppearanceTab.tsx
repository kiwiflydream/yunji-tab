import type { MessageKey, TranslationParams } from '~/lib/i18n'
import type { AppearanceSettings, ThemeMode } from '~/lib/types'
import { ChevronDown, ExternalLink, Monitor, Moon, RotateCcw, Sun } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import { Switch } from '~/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'
import { DEFAULT_APPEARANCE_SETTINGS } from '~/lib/appearance'
import { useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'
import { cn } from '~/lib/utils'

const APPEARANCE_OPTIONS = {
  contentWidth: [
    { value: 'standard', labelKey: 'appearanceWidthStandard' },
    { value: 'wide', labelKey: 'appearanceWidthWide' },
    { value: 'full', labelKey: 'appearanceWidthFull' },
  ],
  gridDensity: [
    { value: 'comfortable', labelKey: 'appearanceDensityComfortable' },
    { value: 'dense', labelKey: 'appearanceDensityDense' },
  ],
  cardStyle: [
    { value: 'soft', labelKey: 'appearanceCardSoft' },
    { value: 'outline', labelKey: 'appearanceCardOutline' },
    { value: 'plain', labelKey: 'appearanceCardPlain' },
  ],
  iconSize: [
    { value: 'sm', labelKey: 'appearanceSizeSmall' },
    { value: 'md', labelKey: 'appearanceSizeMedium' },
    { value: 'lg', labelKey: 'appearanceSizeLarge' },
  ],
  radius: [
    { value: 'sm', labelKey: 'appearanceRadiusSmall' },
    { value: 'md', labelKey: 'appearanceRadiusMedium' },
    { value: 'lg', labelKey: 'appearanceRadiusLarge' },
  ],
  accentColor: [
    { value: 'neutral', labelKey: 'appearanceAccentNeutral' },
    { value: 'blue', labelKey: 'appearanceAccentBlue' },
    { value: 'green', labelKey: 'appearanceAccentGreen' },
    { value: 'orange', labelKey: 'appearanceAccentOrange' },
    { value: 'rose', labelKey: 'appearanceAccentRose' },
  ],
  colorTheme: [
    { value: 'default', labelKey: 'appearanceColorDefault' },
    { value: 'graphite', labelKey: 'appearanceColorGraphite' },
    { value: 'meadow', labelKey: 'appearanceColorMeadow' },
    { value: 'dawn', labelKey: 'appearanceColorDawn' },
    { value: 'berry', labelKey: 'appearanceColorBerry' },
  ],
  backgroundStyle: [
    { value: 'flat', labelKey: 'appearanceBackgroundFlat' },
    { value: 'subtle', labelKey: 'appearanceBackgroundSubtle' },
    { value: 'panel', labelKey: 'appearanceBackgroundPanel' },
  ],
  titleLines: [
    { value: 1, labelKey: 'appearanceLineCount', params: { count: 1 } },
    { value: 2, labelKey: 'appearanceLineCount', params: { count: 2 } },
  ],
  descriptionLines: [
    { value: 1, labelKey: 'appearanceLineCount', params: { count: 1 } },
    { value: 2, labelKey: 'appearanceLineCount', params: { count: 2 } },
    { value: 3, labelKey: 'appearanceLineCount', params: { count: 3 } },
  ],
  maxVisibleTags: [
    { value: 0, labelKey: 'appearanceNotShown' },
    { value: 1, labelKey: 'appearanceTagCountValue', params: { count: 1 } },
    { value: 2, labelKey: 'appearanceTagCountValue', params: { count: 2 } },
    { value: 3, labelKey: 'appearanceTagCountValue', params: { count: 3 } },
    { value: 5, labelKey: 'appearanceTagCountValue', params: { count: 5 } },
  ],
} as const

const THEME_OPTIONS: Array<{
  value: ThemeMode
  labelKey: MessageKey
  shortLabelKey: MessageKey
  Icon: typeof Sun
}> = [
  { value: 'light', labelKey: 'themeLight', shortLabelKey: 'themeLight', Icon: Sun },
  { value: 'dark', labelKey: 'themeDark', shortLabelKey: 'themeDark', Icon: Moon },
  { value: 'system', labelKey: 'themeSystem', shortLabelKey: 'themeSystemShort', Icon: Monitor },
]

type StylePresetSettings = Omit<
  AppearanceSettings,
  'navLayout' | 'navItems' | 'catDecorations'
>
type StylePreset = 'minimal' | 'balanced' | 'compact' | 'soft' | 'kami'

interface StylePresetDefinition {
  labelKey: MessageKey
  descriptionKey: MessageKey
  badgeKey?: MessageKey
  settings: StylePresetSettings
}

function optionLabel(
  t: (key: MessageKey, params?: TranslationParams) => string,
  option: { labelKey: MessageKey, params?: TranslationParams },
) {
  return t(option.labelKey, option.params)
}

interface AppearanceSwitchProps {
  checked: boolean
  label: string
  onCheckedChange: (checked: boolean) => void
}

function AppearanceSwitch({
  checked,
  label,
  onCheckedChange,
}: AppearanceSwitchProps) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg bg-secondary/45 px-3 py-2.5 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  )
}

function toStylePresetSettings(
  appearance: AppearanceSettings,
): StylePresetSettings {
  return {
    contentWidth: appearance.contentWidth,
    gridDensity: appearance.gridDensity,
    cardStyle: appearance.cardStyle,
    iconSize: appearance.iconSize,
    radius: appearance.radius,
    accentColor: appearance.accentColor,
    colorTheme: appearance.colorTheme,
    backgroundStyle: appearance.backgroundStyle,
    cardFields: { ...appearance.cardFields },
  }
}

const STYLE_PRESETS: Record<StylePreset, StylePresetDefinition> = {
  minimal: {
    labelKey: 'appearanceStyleMinimal',
    descriptionKey: 'appearanceStyleMinimalDescription',
    settings: {
      contentWidth: 'standard',
      gridDensity: 'comfortable',
      cardStyle: 'plain',
      iconSize: 'sm',
      radius: 'md',
      accentColor: 'neutral',
      colorTheme: 'graphite',
      backgroundStyle: 'flat',
      cardFields: {
        description: false,
        tags: false,
        categoryPath: false,
        categoryCards: true,
        actions: 'hover',
        titleLines: 1,
        descriptionLines: 1,
        maxVisibleTags: 0,
      },
    },
  },
  balanced: {
    labelKey: 'appearanceStyleBalanced',
    descriptionKey: 'appearanceStyleBalancedDescription',
    settings: toStylePresetSettings(DEFAULT_APPEARANCE_SETTINGS),
  },
  compact: {
    labelKey: 'appearanceStyleCompact',
    descriptionKey: 'appearanceStyleCompactDescription',
    settings: {
      contentWidth: 'full',
      gridDensity: 'dense',
      cardStyle: 'outline',
      iconSize: 'sm',
      radius: 'md',
      accentColor: 'neutral',
      colorTheme: 'default',
      backgroundStyle: 'flat',
      cardFields: {
        description: false,
        tags: false,
        categoryPath: true,
        categoryCards: false,
        actions: 'hover',
        titleLines: 1,
        descriptionLines: 1,
        maxVisibleTags: 0,
      },
    },
  },
  soft: {
    labelKey: 'appearanceStyleSoft',
    descriptionKey: 'appearanceStyleSoftDescription',
    settings: {
      contentWidth: 'wide',
      gridDensity: 'comfortable',
      cardStyle: 'soft',
      iconSize: 'md',
      radius: 'lg',
      accentColor: 'orange',
      colorTheme: 'dawn',
      backgroundStyle: 'subtle',
      cardFields: {
        description: true,
        tags: true,
        categoryPath: true,
        categoryCards: true,
        actions: 'hover',
        titleLines: 2,
        descriptionLines: 2,
        maxVisibleTags: 3,
      },
    },
  },
  kami: {
    labelKey: 'appearanceStyleKami',
    descriptionKey: 'appearanceStyleKamiDescription',
    badgeKey: 'appearanceStyleKamiBadge',
    settings: {
      contentWidth: 'wide',
      gridDensity: 'comfortable',
      cardStyle: 'outline',
      iconSize: 'md',
      radius: 'sm',
      accentColor: 'neutral',
      colorTheme: 'kami',
      backgroundStyle: 'flat',
      cardFields: {
        description: true,
        tags: true,
        categoryPath: true,
        categoryCards: true,
        actions: 'hover',
        titleLines: 2,
        descriptionLines: 2,
        maxVisibleTags: 3,
      },
    },
  },
}

export function SettingsAppearanceTab() {
  const { t } = useI18n()
  const theme = useNavStore(state => state.settings.theme)
  const appearance = useNavStore(state => state.settings.appearance)
  const setTheme = useNavStore(state => state.setTheme)
  const setAppearance = useNavStore(state => state.setAppearance)
  const [appearanceAdvancedOpen, setAppearanceAdvancedOpen] = useState(false)
  const currentStyleSettings = toStylePresetSettings(appearance)
  const appearancePreset
    = (
      Object.entries(STYLE_PRESETS) as Array<
        [StylePreset, StylePresetDefinition]
      >
    ).find(
      ([, preset]) =>
        JSON.stringify(preset.settings) === JSON.stringify(currentStyleSettings),
    )?.[0] ?? ''

  const applyPreset = (preset: StylePreset) => {
    void setAppearance(STYLE_PRESETS[preset].settings)
  }

  return (
    <>
      <section className="rounded-xl border border-border bg-muted/35 p-4">
        <h3 className="text-sm font-semibold">{t('appearanceLightDarkMode')}</h3>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          {t('appearanceLightDarkModeDescription')}
        </p>
        <ToggleGroup
          type="single"
          value={theme}
          onValueChange={(value) => {
            if (value)
              void setTheme(value as ThemeMode)
          }}
          variant="outline"
          className="mt-3 grid grid-cols-3"
          aria-label={t('appearanceThemeMode')}
        >
          {THEME_OPTIONS.map(({ value, labelKey, shortLabelKey, Icon }) => (
            <ToggleGroupItem key={value} value={value} aria-label={t(labelKey)}>
              <Icon />
              <span className="hidden sm:inline">{t(labelKey)}</span>
              <span className="sm:hidden">{t(shortLabelKey)}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </section>

      <section className="rounded-xl border border-border bg-muted/35 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">{t('appearanceOverallStyle')}</h3>
              {!appearancePreset ? <Badge variant="outline">{t('appearanceCustomized')}</Badge> : null}
            </div>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {t('appearanceOverallStyleDescription')}
            </p>
          </div>
          {appearancePreset !== 'balanced'
            ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => applyPreset('balanced')}
                >
                  <RotateCcw data-icon="inline-start" />
                  {t('appearanceResetDefault')}
                </Button>
              )
            : null}
        </div>
        <ToggleGroup
          type="single"
          value={appearancePreset}
          onValueChange={(value) => {
            if (value)
              applyPreset(value as StylePreset)
          }}
          variant="outline"
          className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
          aria-label={t('appearanceOverallStyle')}
        >
          {(
            Object.entries(STYLE_PRESETS) as Array<
              [StylePreset, StylePresetDefinition]
            >
          ).map(([value, preset]) => (
            <div key={value} className="relative">
              <ToggleGroupItem
                value={value}
                aria-label={t(preset.labelKey)}
                className={cn(
                  'h-full min-h-20 w-full flex-col items-start justify-start gap-1 px-3 py-3 text-left',
                  value === 'kami' && 'pr-11',
                )}
              >
                <span className="flex items-center gap-2 font-medium">
                  {t(preset.labelKey)}
                  {preset.badgeKey
                    ? <Badge variant="secondary">{t(preset.badgeKey)}</Badge>
                    : null}
                </span>
                <span className="text-xs font-normal leading-5 text-muted-foreground">
                  {t(preset.descriptionKey)}
                </span>
              </ToggleGroupItem>
              {value === 'kami'
                ? (
                    <a
                      href="https://github.com/tw93/Kami"
                      target="_blank"
                      rel="noreferrer"
                      aria-label={t('appearanceViewKamiSource')}
                      title={t('appearanceViewKamiSource')}
                      className="absolute right-2.5 top-2.5 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                    >
                      <ExternalLink className="size-4" aria-hidden="true" />
                    </a>
                  )
                : null}
            </div>
          ))}
        </ToggleGroup>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          {t('appearancePresetScopeDescription')}
        </p>
      </section>

      <section className="rounded-xl border border-border bg-muted/35 p-4">
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-semibold">{t('appearanceCatDecorations')}</span>
            <span className="mt-1 block text-sm leading-5 text-muted-foreground">
              {t('appearanceCatDecorationsDescription')}
            </span>
          </span>
          <Switch
            checked={appearance.catDecorations}
            onCheckedChange={value =>
              void setAppearance({ catDecorations: value })}
            aria-label={t('appearanceShowCatDecorations')}
          />
        </label>
      </section>

      <Collapsible
        open={appearanceAdvancedOpen}
        onOpenChange={setAppearanceAdvancedOpen}
      >
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="group w-full justify-between"
          >
            {t('appearanceAdvancedCustomization')}
            <ChevronDown
              data-icon="inline-end"
              className="transition-transform group-data-[state=open]:rotate-180"
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 grid gap-4">
          <section className="rounded-xl border border-border bg-muted/35 p-4">
            <h3 className="text-sm font-semibold">{t('appearanceLayoutAndSurface')}</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">{t('appearanceContentWidth')}</span>
                <select
                  value={appearance.contentWidth}
                  onChange={event =>
                    void setAppearance({
                      contentWidth: event.target
                        .value as typeof appearance.contentWidth,
                    })}
                  className="h-10 rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
                >
                  {APPEARANCE_OPTIONS.contentWidth.map(option => (
                    <option key={option.value} value={option.value}>
                      {optionLabel(t, option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">{t('appearanceGridDensity')}</span>
                <select
                  value={appearance.gridDensity}
                  onChange={event =>
                    void setAppearance({
                      gridDensity: event.target
                        .value as typeof appearance.gridDensity,
                    })}
                  className="h-10 rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
                >
                  {APPEARANCE_OPTIONS.gridDensity.map(option => (
                    <option key={option.value} value={option.value}>
                      {optionLabel(t, option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">{t('appearanceColorTheme')}</span>
                <select
                  value={appearance.colorTheme}
                  onChange={event =>
                    void setAppearance({
                      colorTheme: event.target
                        .value as typeof appearance.colorTheme,
                    })}
                  className="h-10 rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
                >
                  {appearance.colorTheme === 'kami'
                    ? (
                        <option value="kami" disabled>
                          {t('appearanceKamiColorOption')}
                        </option>
                      )
                    : null}
                  {APPEARANCE_OPTIONS.colorTheme.map(option => (
                    <option key={option.value} value={option.value}>
                      {optionLabel(t, option)}
                    </option>
                  ))}
                </select>
                {appearance.colorTheme === 'kami'
                  ? (
                      <span className="text-xs text-muted-foreground">
                        {t('appearanceKamiColorHint')}
                      </span>
                    )
                  : null}
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">{t('appearanceAccentColor')}</span>
                <select
                  value={appearance.accentColor}
                  onChange={event =>
                    void setAppearance({
                      accentColor: event.target
                        .value as typeof appearance.accentColor,
                    })}
                  className="h-10 rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
                >
                  {APPEARANCE_OPTIONS.accentColor.map(option => (
                    <option key={option.value} value={option.value}>
                      {optionLabel(t, option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">{t('appearanceBackground')}</span>
                <select
                  value={appearance.backgroundStyle}
                  onChange={event =>
                    void setAppearance({
                      backgroundStyle: event.target
                        .value as typeof appearance.backgroundStyle,
                    })}
                  className="h-10 rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
                >
                  {APPEARANCE_OPTIONS.backgroundStyle.map(option => (
                    <option key={option.value} value={option.value}>
                      {optionLabel(t, option)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-muted/35 p-4">
            <h3 className="text-sm font-semibold">{t('appearanceCardDetails')}</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">{t('appearanceCardStyle')}</span>
                <select
                  value={appearance.cardStyle}
                  onChange={event =>
                    void setAppearance({
                      cardStyle: event.target.value as typeof appearance.cardStyle,
                    })}
                  className="h-10 rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
                >
                  {APPEARANCE_OPTIONS.cardStyle.map(option => (
                    <option key={option.value} value={option.value}>
                      {optionLabel(t, option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">{t('appearanceIconSize')}</span>
                <select
                  value={appearance.iconSize}
                  onChange={event =>
                    void setAppearance({
                      iconSize: event.target.value as typeof appearance.iconSize,
                    })}
                  className="h-10 rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
                >
                  {APPEARANCE_OPTIONS.iconSize.map(option => (
                    <option key={option.value} value={option.value}>
                      {optionLabel(t, option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">{t('appearanceRadius')}</span>
                <select
                  value={appearance.radius}
                  onChange={event =>
                    void setAppearance({
                      radius: event.target.value as typeof appearance.radius,
                    })}
                  className="h-10 rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
                >
                  {APPEARANCE_OPTIONS.radius.map(option => (
                    <option key={option.value} value={option.value}>
                      {optionLabel(t, option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">{t('appearanceActionButtons')}</span>
                <select
                  value={appearance.cardFields.actions}
                  onChange={event =>
                    void setAppearance({
                      cardFields: {
                        actions: event.target
                          .value as typeof appearance.cardFields.actions,
                      },
                    })}
                  className="h-10 rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
                >
                  <option value="hover">{t('appearanceActionsHover')}</option>
                  <option value="always">{t('appearanceActionsAlways')}</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">{t('appearanceTitleLines')}</span>
                <select
                  value={appearance.cardFields.titleLines}
                  onChange={event =>
                    void setAppearance({
                      cardFields: {
                        titleLines: Number(
                          event.target.value,
                        ) as typeof appearance.cardFields.titleLines,
                      },
                    })}
                  className="h-10 rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
                >
                  {APPEARANCE_OPTIONS.titleLines.map(option => (
                    <option key={option.value} value={option.value}>
                      {optionLabel(t, option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">{t('appearanceDescriptionLines')}</span>
                <select
                  value={appearance.cardFields.descriptionLines}
                  onChange={event =>
                    void setAppearance({
                      cardFields: {
                        descriptionLines: Number(
                          event.target.value,
                        ) as typeof appearance.cardFields.descriptionLines,
                      },
                    })}
                  className="h-10 rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
                >
                  {APPEARANCE_OPTIONS.descriptionLines.map(option => (
                    <option key={option.value} value={option.value}>
                      {optionLabel(t, option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">{t('appearanceTagCount')}</span>
                <select
                  value={appearance.cardFields.maxVisibleTags}
                  onChange={event =>
                    void setAppearance({
                      cardFields: {
                        maxVisibleTags: Number(event.target.value),
                      },
                    })}
                  className="h-10 rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
                >
                  {APPEARANCE_OPTIONS.maxVisibleTags.map(option => (
                    <option key={option.value} value={option.value}>
                      {optionLabel(t, option)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-muted/35 p-4">
            <h3 className="text-sm font-semibold">{t('appearanceVisibleFields')}</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <AppearanceSwitch
                label={t('appearanceFieldDescription')}
                checked={appearance.cardFields.description}
                onCheckedChange={value =>
                  void setAppearance({
                    cardFields: { description: value },
                  })}
              />
              <AppearanceSwitch
                label={t('appearanceFieldTags')}
                checked={appearance.cardFields.tags}
                onCheckedChange={value =>
                  void setAppearance({
                    cardFields: { tags: value },
                  })}
              />
              <AppearanceSwitch
                label={t('appearanceFieldSearchPath')}
                checked={appearance.cardFields.categoryPath}
                onCheckedChange={value =>
                  void setAppearance({
                    cardFields: { categoryPath: value },
                  })}
              />
              <AppearanceSwitch
                label={t('appearanceFieldCategoryCards')}
                checked={appearance.cardFields.categoryCards}
                onCheckedChange={value =>
                  void setAppearance({
                    cardFields: { categoryCards: value },
                  })}
              />
            </div>
          </section>
        </CollapsibleContent>
      </Collapsible>
    </>
  )
}
