import { DEFAULT_APPEARANCE_SETTINGS } from '../src/lib/appearance'
import { resolveBrowserLanguage, translate } from '../src/lib/i18n'
import { normalizeSettings } from '../src/lib/store-settings-state'
import { expect, test } from './extension.fixture'

for (const scope of ['general', 'appearance'] as const) {
  test(`restores ${scope} defaults, preserves other settings and data across reloads`, async ({ extensionContext, extensionWorker, extensionId, newTabPage }) => {
    const settingsKey = 'yunji-tab:settings'
    const groupKey = 'yunji-tab:bookmark-group:reset-fixture'
    const partKey = `${groupKey}:reset:0`
    const settings = normalizeSettings({
      language: 'en',
      theme: 'dark',
      onboardingDismissed: true,
      defaultCategoryId: 'pinned',
      singleHomeTab: false,
      bookmarkGroupsEnabled: false,
      bookmarkViewMode: 'compact',
      globalCommandPaletteEnabled: true,
      savedSearches: [{ id: 'reset-filter', name: 'Keep filter', query: 'tag:work' }],
      autoOrganizeRules: [{ id: 'reset-rule', name: 'Keep rule', enabled: true, field: 'domain', operator: 'contains', value: 'example.test', addTags: ['work'], clearInbox: false }],
      appearance: { ...DEFAULT_APPEARANCE_SETTINGS, colorTheme: 'electric', catDecorations: true, navLayout: 'top', contentWidth: 'full', navItems: { icons: false, counts: false, smartCategories: false, savedSearches: true, categoryTree: false }, cardFields: { ...DEFAULT_APPEARANCE_SETTINGS.cardFields, websiteIcon: false, description: false, tags: false, actions: 'always' } },
    })
    const original = await extensionWorker.evaluate(async ({ settingsKey, groupKey, partKey }) => chrome.storage.sync.get([settingsKey, groupKey, partKey]), { settingsKey, groupKey, partKey })
    const bookmarkId = await extensionWorker.evaluate(async () => (await chrome.bookmarks.create({ parentId: '1', title: 'Keep bookmark', url: 'https://example.test/reset-fixture' })).id)
    const group = JSON.stringify({ id: 'reset-fixture', title: 'Keep group', description: '', bookmarks: [{ id: 'reset-member', title: 'Keep bookmark', url: 'https://example.test/reset-fixture' }] })
    await extensionWorker.evaluate(async ({ settingsKey, groupKey, partKey, settings, group }) => {
      await chrome.storage.sync.set({
        [settingsKey]: JSON.stringify(settings),
        [groupKey]: { version: 1, generation: 'reset', partCount: 1 },
        [partKey]: group,
      })
    }, { settingsKey, groupKey, partKey, settings, group })
    let other: Awaited<ReturnType<typeof extensionContext.newPage>> | undefined
    try {
      const nativeTree = await extensionWorker.evaluate(() => chrome.bookmarks.getTree())
      await newTabPage.reload()
      await newTabPage.setViewportSize({ width: scope === 'general' ? 1280 : 375, height: 900 })
      other = await extensionContext.newPage()
      await other.goto(`chrome-extension://${extensionId}/newtab.html`)
      await expect(other.locator('html')).toHaveClass(/theme-electric/)
      await newTabPage.getByRole('button', { name: 'More actions', exact: true }).click()
      await newTabPage.getByRole('menuitem', { name: 'Open settings', exact: true }).click()
      await newTabPage.getByRole('tab', { name: scope === 'general' ? 'General' : 'Appearance', exact: true }).click()
      const browserLanguage = resolveBrowserLanguage(await newTabPage.evaluate(() => navigator.language))
      const language = scope === 'general' ? browserLanguage : 'en'
      const expected = scope === 'general'
        ? { ...settings, language, defaultCategoryId: 'all', bookmarkGroupsEnabled: true, appearance: { ...settings.appearance, navLayout: 'sidebar', navItems: { icons: false, counts: true, smartCategories: true, savedSearches: false, categoryTree: true } } }
        : { ...settings, theme: 'system', appearance: { ...DEFAULT_APPEARANCE_SETTINGS, navLayout: 'top', navItems: { ...settings.appearance.navItems, icons: true } } }
      await newTabPage.getByRole('button', { name: 'Restore defaults', exact: true }).click()
      await expect(newTabPage.getByRole('dialog').getByRole('status')).toHaveText(translate(language, 'settingsResetDone'))
      await expect.poll(() => extensionWorker.evaluate(async key => JSON.parse(String((await chrome.storage.sync.get(key))[key])), settingsKey)).toEqual(expected)
      // Other open pages pick up general and appearance preferences on reload.
      await other.reload()
      if (scope === 'general') {
        await expect(other.locator('.workspace-layout')).toHaveAttribute('data-nav-layout', 'sidebar')
      }
      else {
        await expect(other.locator('html')).toHaveClass(/theme-electric/)
      }
      await newTabPage.screenshot({ path: `/tmp/yunji-settings-reset-${scope}.png`, fullPage: true })
      await newTabPage.reload()
      await newTabPage.getByRole('button', { name: translate(language, 'moreActions'), exact: true }).click()
      await newTabPage.getByRole('menuitem', { name: translate(language, 'openSettings'), exact: true }).click()
      await newTabPage.getByRole('tab', { name: translate(language, scope), exact: true }).click()
      await expect(newTabPage.getByRole('button', { name: translate(language, 'settingsResetDefault'), exact: true })).toBeVisible()
      await expect.poll(() => newTabPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      expect(await extensionWorker.evaluate(() => chrome.bookmarks.getTree())).toEqual(nativeTree)
      expect(await extensionWorker.evaluate(async key => (await chrome.storage.sync.get(key))[key], partKey)).toBe(group)
    }
    finally {
      await other?.close()
      await extensionWorker.evaluate(async ({ settingsKey, groupKey, partKey, original, bookmarkId }) => {
        await chrome.bookmarks.remove(bookmarkId)
        await chrome.storage.sync.remove([settingsKey, groupKey, partKey])
        await chrome.storage.sync.set(original)
      }, { settingsKey, groupKey, partKey, original, bookmarkId })
    }
  })
}
