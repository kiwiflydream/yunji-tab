import type {
  AppearanceSettings,
  AutoOrganizeRule,
  BookmarkSortMode,
  BookmarkViewMode,
  CardFieldSettings,
  Category,
  Language,
  MetadataSyncScope,
  NavItemSettings,
  SavedSearch,
  SearchEngine,
  Settings,
  ShortcutAction,
  ThemeMode,
} from './types'
import {
  DEFAULT_APPEARANCE_SETTINGS,
  normalizeAppearanceSettings,
} from './appearance'
import { normalizeAutoOrganizeRules } from './auto-organize'
import { isVirtualCategoryId } from './default-data'
import { normalizeIgnoredDomains } from './description-sync'
import { getBrowserLanguage, isLanguage } from './i18n'
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  normalizeKeyboardShortcuts,
} from './keyboard-shortcuts'
import { normalizeMetadataSyncScope } from './metadata-sync'
import { normalizeCustomSearchEngines } from './search-engines'

export type AppearanceSettingsPatch = Partial<
  Omit<AppearanceSettings, 'cardFields' | 'navItems'>
> & {
  cardFields?: Partial<CardFieldSettings>
  navItems?: Partial<NavItemSettings>
}

export interface SettingsSlice {
  setLanguage: (language: Language) => Promise<void>
  addCustomSearchEngine: (engine: Omit<SearchEngine, 'id'>) => Promise<void>
  updateCustomSearchEngine: (
    id: string,
    engine: Omit<SearchEngine, 'id'>,
  ) => Promise<void>
  removeCustomSearchEngine: (id: string) => Promise<void>
  setTheme: (theme: ThemeMode) => Promise<void>
  setDefaultCategory: (id: string) => Promise<void>
  setSingleHomeTab: (enabled: boolean) => Promise<void>
  setGlobalCommandPaletteEnabled: (enabled: boolean) => Promise<void>
  applyDefaultCategory: () => void
  setDescriptionIgnoredDomains: (domains: string[]) => Promise<void>
  setOnboardingDismissed: (dismissed: boolean) => Promise<void>
  setBookmarkSortMode: (mode: BookmarkSortMode) => Promise<void>
  setBookmarkViewMode: (mode: BookmarkViewMode) => Promise<void>
  setAppearance: (patch: AppearanceSettingsPatch) => Promise<void>
  setKeyboardShortcut: (
    action: ShortcutAction,
    shortcut: Settings['keyboardShortcuts'][ShortcutAction],
  ) => Promise<void>
  resetKeyboardShortcuts: () => Promise<void>
  addSavedSearch: (query: string) => Promise<void>
  removeSavedSearch: (id: string) => Promise<void>
  addAutoOrganizeRule: (rule: Omit<AutoOrganizeRule, 'id'>) => Promise<void>
  updateAutoOrganizeRule: (
    id: string,
    patch: Partial<Omit<AutoOrganizeRule, 'id'>>,
  ) => Promise<void>
  removeAutoOrganizeRule: (id: string) => Promise<void>
  runAutoOrganizeRules: () => Promise<number>
  setMetadataSyncScope: (scope: Partial<MetadataSyncScope>) => Promise<void>
  setMetadataSyncEncryption: (
    enabled: boolean,
    passphrase?: string,
  ) => Promise<void>
}

export const DEFAULT_SETTINGS: Settings = {
  language: getBrowserLanguage(),
  theme: 'system',
  defaultCategoryId: 'all',
  singleHomeTab: false,
  globalCommandPaletteEnabled: false,
  descriptionIgnoredDomains: [],
  customSearchEngines: [],
  onboardingDismissed: false,
  bookmarkSortMode: 'manual',
  bookmarkViewMode: 'grid',
  appearance: DEFAULT_APPEARANCE_SETTINGS,
  savedSearches: [],
  metadataSyncScope: normalizeMetadataSyncScope(),
  metadataSyncEncryptionEnabled: false,
  autoOrganizeRules: [],
  keyboardShortcuts: DEFAULT_KEYBOARD_SHORTCUTS,
}

export function resolveAvailableCategoryId(
  categoryId: string | undefined,
  categories: Category[],
): string {
  if (!categoryId)
    return 'all'
  if (isVirtualCategoryId(categoryId))
    return categoryId
  return categories.some(category => category.id === categoryId)
    ? categoryId
    : 'all'
}

export function normalizeSettings(settings?: Partial<Settings>): Settings {
  const customSearchEngines = normalizeCustomSearchEngines(
    settings?.customSearchEngines,
  )
  return {
    language: isLanguage(settings?.language)
      ? settings.language
      : DEFAULT_SETTINGS.language,
    theme:
      settings?.theme === 'light'
      || settings?.theme === 'dark'
      || settings?.theme === 'system'
        ? settings.theme
        : DEFAULT_SETTINGS.theme,
    defaultCategoryId:
      typeof settings?.defaultCategoryId === 'string'
      && settings.defaultCategoryId.trim()
        ? settings.defaultCategoryId
        : DEFAULT_SETTINGS.defaultCategoryId,
    singleHomeTab: settings?.singleHomeTab === true,
    globalCommandPaletteEnabled:
      settings?.globalCommandPaletteEnabled === true,
    descriptionIgnoredDomains: normalizeIgnoredDomains(
      settings?.descriptionIgnoredDomains ?? [],
    ),
    customSearchEngines,
    onboardingDismissed: settings?.onboardingDismissed === true,
    bookmarkSortMode:
      settings?.bookmarkSortMode === 'name'
      || settings?.bookmarkSortMode === 'recentlyAdded'
      || settings?.bookmarkSortMode === 'frequent'
        ? settings.bookmarkSortMode
        : 'manual',
    bookmarkViewMode:
      settings?.bookmarkViewMode === 'compact' ? 'compact' : 'grid',
    appearance: normalizeAppearanceSettings(settings?.appearance),
    savedSearches: Array.isArray(settings?.savedSearches)
      ? settings.savedSearches
          .filter(
            (item): item is SavedSearch =>
              typeof item?.id === 'string'
              && typeof item.name === 'string'
              && typeof item.query === 'string'
              && Boolean(item.query.trim()),
          )
          .slice(0, 20)
      : [],
    metadataSyncScope: normalizeMetadataSyncScope(settings?.metadataSyncScope),
    metadataSyncEncryptionEnabled:
      settings?.metadataSyncEncryptionEnabled === true,
    autoOrganizeRules: normalizeAutoOrganizeRules(settings?.autoOrganizeRules),
    keyboardShortcuts: normalizeKeyboardShortcuts(settings?.keyboardShortcuts),
  }
}
