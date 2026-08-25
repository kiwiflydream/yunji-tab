import type { StateCreator } from 'zustand'
import type { NavState } from './store'
import type { SettingsSlice } from './store-settings-state'
import { normalizeAppearanceSettings } from './appearance'
import {
  normalizeAutoOrganizeRules,
  previewAutoOrganizeRules,
} from './auto-organize'
import { normalizeIgnoredDomains } from './description-sync'
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  SHORTCUT_ACTIONS,
  shortcutsEqual,
  validateShortcut,
} from './keyboard-shortcuts'
import {
  markLocalMetadataChanged,
  normalizeMetadataSyncScope,
} from './metadata-sync'
import { validateCustomSearchEngine } from './search-engines'
import {
  metaStorage,
  persist,
  settingsStorage,
  STORAGE_KEYS,
} from './store-persistence'
import { resolveAvailableCategoryId } from './store-settings-state'

export const createSettingsSlice: StateCreator<
  NavState,
  [],
  [],
  SettingsSlice
> = (set, get) => ({
  setLanguage: async (language) => {
    const settings = { ...get().settings, language }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
  },

  addCustomSearchEngine: async (engine) => {
    if (get().settings.customSearchEngines.length >= 20)
      throw new Error('search_engine.limit_reached')
    const normalized = validateCustomSearchEngine(
      engine,
      get().settings.customSearchEngines,
    )
    const customSearchEngines = [
      ...get().settings.customSearchEngines,
      { id: `custom-${crypto.randomUUID()}`, ...normalized },
    ]
    const settings = { ...get().settings, customSearchEngines }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
  },

  updateCustomSearchEngine: async (id, engine) => {
    if (!get().settings.customSearchEngines.some(item => item.id === id))
      throw new Error('search_engine.not_found')
    const normalized = validateCustomSearchEngine(
      engine,
      get().settings.customSearchEngines,
      id,
    )
    const customSearchEngines = get().settings.customSearchEngines.map(
      item => (item.id === id ? { id, ...normalized } : item),
    )
    const settings = { ...get().settings, customSearchEngines }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
  },

  removeCustomSearchEngine: async (id) => {
    const customSearchEngines = get().settings.customSearchEngines.filter(
      engine => engine.id !== id,
    )
    const settings = { ...get().settings, customSearchEngines }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
  },

  setTheme: async (theme) => {
    const settings = { ...get().settings, theme }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
  },

  setDefaultCategory: async (id) => {
    const settings = {
      ...get().settings,
      defaultCategoryId: resolveAvailableCategoryId(id, get().categories),
    }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
  },

  setSingleHomeTab: async (singleHomeTab) => {
    const settings = { ...get().settings, singleHomeTab }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
  },

  setGlobalCommandPaletteEnabled: async (globalCommandPaletteEnabled) => {
    const settings = { ...get().settings, globalCommandPaletteEnabled }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
  },

  applyDefaultCategory: () => {
    set({
      activeCategoryId: resolveAvailableCategoryId(
        get().settings.defaultCategoryId,
        get().categories,
      ),
    })
  },

  setDescriptionIgnoredDomains: async (domains) => {
    const settings = {
      ...get().settings,
      descriptionIgnoredDomains: normalizeIgnoredDomains(domains),
    }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
  },

  setOnboardingDismissed: async (dismissed) => {
    const settings = { ...get().settings, onboardingDismissed: dismissed }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
  },

  setBookmarkSortMode: async (bookmarkSortMode) => {
    const settings = { ...get().settings, bookmarkSortMode }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
  },

  setBookmarkViewMode: async (bookmarkViewMode) => {
    const settings = { ...get().settings, bookmarkViewMode }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
  },

  setAppearance: async (patch) => {
    const settings = {
      ...get().settings,
      appearance: normalizeAppearanceSettings({
        ...get().settings.appearance,
        ...patch,
        cardFields: patch.cardFields
          ? { ...get().settings.appearance.cardFields, ...patch.cardFields }
          : get().settings.appearance.cardFields,
        navItems: patch.navItems
          ? { ...get().settings.appearance.navItems, ...patch.navItems }
          : get().settings.appearance.navItems,
      }),
    }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
  },

  setKeyboardShortcut: async (action, shortcut) => {
    if (validateShortcut(shortcut))
      throw new Error('shortcut.invalid')
    if (
      SHORTCUT_ACTIONS.some(
        candidate =>
          candidate !== action
          && shortcutsEqual(get().settings.keyboardShortcuts[candidate], shortcut),
      )
    ) {
      throw new Error('shortcut.conflict')
    }
    const settings = {
      ...get().settings,
      keyboardShortcuts: {
        ...get().settings.keyboardShortcuts,
        [action]: shortcut,
      },
    }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
  },

  resetKeyboardShortcuts: async () => {
    const settings = {
      ...get().settings,
      keyboardShortcuts: structuredClone(DEFAULT_KEYBOARD_SHORTCUTS),
    }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
  },

  addSavedSearch: async (query) => {
    const normalized = query.trim()
    if (
      !normalized
      || get().settings.savedSearches.some(item => item.query === normalized)
    ) {
      return
    }
    const savedSearches = [
      ...get().settings.savedSearches,
      {
        id: crypto.randomUUID(),
        name: normalized.slice(0, 40),
        query: normalized,
      },
    ].slice(-20)
    const settings = { ...get().settings, savedSearches }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
  },

  removeSavedSearch: async (id) => {
    const settings = {
      ...get().settings,
      savedSearches: get().settings.savedSearches.filter(
        item => item.id !== id,
      ),
    }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
  },

  addAutoOrganizeRule: async (rule) => {
    const settings = {
      ...get().settings,
      autoOrganizeRules: normalizeAutoOrganizeRules([
        ...get().settings.autoOrganizeRules,
        { id: crypto.randomUUID(), ...rule },
      ]),
    }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
  },

  updateAutoOrganizeRule: async (id, patch) => {
    const settings = {
      ...get().settings,
      autoOrganizeRules: normalizeAutoOrganizeRules(
        get().settings.autoOrganizeRules.map(rule =>
          rule.id === id ? { ...rule, ...patch } : rule,
        ),
      ),
    }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
  },

  removeAutoOrganizeRule: async (id) => {
    const settings = {
      ...get().settings,
      autoOrganizeRules: get().settings.autoOrganizeRules.filter(
        rule => rule.id !== id,
      ),
    }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
  },

  runAutoOrganizeRules: async () => {
    const preview = previewAutoOrganizeRules(
      get().bookmarks,
      get().settings.autoOrganizeRules,
      get().categories,
    )
    for (const item of preview) {
      // Each update reloads store state; preserve rule order and avoid lost updates.
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      await get().updateBookmark(item.bookmark.id, item.patch)
    }
    return preview.length
  },

  setMetadataSyncScope: async (scope) => {
    const settings = {
      ...get().settings,
      metadataSyncScope: normalizeMetadataSyncScope({
        ...get().settings.metadataSyncScope,
        ...scope,
      }),
    }
    set({ settings })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
    await markLocalMetadataChanged()
  },

  setMetadataSyncEncryption: async (enabled, passphrase) => {
    const normalizedPassphrase = passphrase?.trim()
    if (enabled && !normalizedPassphrase && !get().metadataSyncPassphraseSet)
      throw new Error('metadata_sync.passphrase_required')
    const settings = {
      ...get().settings,
      metadataSyncEncryptionEnabled: enabled,
    }
    if (normalizedPassphrase) {
      await metaStorage.set(
        STORAGE_KEYS.metadataSyncPassphrase,
        normalizedPassphrase,
      )
    }
    if (!enabled)
      await metaStorage.remove(STORAGE_KEYS.metadataSyncPassphrase)
    set({
      settings,
      metadataSyncPassphraseSet:
        enabled
        && (Boolean(normalizedPassphrase) || get().metadataSyncPassphraseSet),
    })
    await persist(settingsStorage, STORAGE_KEYS.settings, settings)
    await markLocalMetadataChanged()
  },
})
