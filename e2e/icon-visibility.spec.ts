import type { BookmarkGroup } from '../src/lib/bookmark-groups'
import { expect, test } from './extension.fixture'

test('toggles bookmark, folder, group and navigation icons, preserves choices across presets and reloads', async ({ extensionWorker, newTabPage }) => {
  const folderId = await extensionWorker.evaluate(async () => {
    const folder = await chrome.bookmarks.create({ parentId: '1', title: 'Icon Settings Folder' })
    const child = await chrome.bookmarks.create({ parentId: folder.id, title: 'Icon Settings Child' })
    await chrome.bookmarks.create({ parentId: child.id, title: 'Icon Settings Website', url: 'https://example.com/icon-settings' })
    await chrome.storage.sync.set({
      'yunji-tab:settings': JSON.stringify({ language: 'zh-CN', onboardingDismissed: true, appearance: { navLayout: 'sidebar' } }),
      'yunji-tab:bookmark-group:icon-settings': { version: 1, generation: 'icons', partCount: 1 },
      'yunji-tab:bookmark-group:icon-settings:icons:0': JSON.stringify({ id: 'icon-settings', title: 'Icon Settings Group', description: 'Card icon visibility fixture', bookmarks: [{ id: 'icon-settings-member', title: 'Icon Settings Website', url: 'https://example.com/icon-settings' }] } satisfies BookmarkGroup),
    })
    return folder.id
  })
  const errors: string[] = []
  newTabPage.on('pageerror', error => errors.push(error.message))
  try {
    await newTabPage.setViewportSize({ width: 1280, height: 900 })
    await newTabPage.reload()
    const card = newTabPage.locator('article').filter({ has: newTabPage.getByText('Icon Settings Website', { exact: true }) })
    const nav = newTabPage.getByRole('navigation', { name: '书签分类' })
    const folderIcons = newTabPage.locator('[data-slot="folder-card-icon"]')
    const groupCard = newTabPage.locator('article[data-bookmark-group-id="icon-settings"]')
    await expect(card.locator('[data-slot="bookmark-icon"]')).toBeVisible()
    await expect(folderIcons.first()).toBeVisible()
    await expect(nav.locator('[data-slot="category-icon"]').first()).toBeVisible()
    await nav.getByRole('button', { name: '书签组', exact: true }).click()
    await expect(groupCard.locator('[data-slot="bookmark-icon"]')).toBeVisible()
    await nav.getByRole('button', { name: /全部/ }).click()

    await newTabPage.getByRole('button', { name: '更多操作', exact: true }).click()
    await newTabPage.getByRole('menuitem', { name: '打开设置', exact: true }).click()
    await expect(newTabPage.getByRole('switch', { name: '菜单图标', exact: true })).toHaveCount(0)
    await newTabPage.getByRole('tab', { name: '外观', exact: true }).click()
    await newTabPage.getByRole('button', { name: '高级自定义', exact: true }).click()
    const fields = newTabPage.locator('section').filter({ has: newTabPage.getByRole('heading', { name: '显示字段', exact: true }) })
    const menuIcons = fields.getByRole('switch', { name: '菜单图标', exact: true })
    await expect(menuIcons).toBeChecked()
    await menuIcons.click()
    await expect(menuIcons).not.toBeChecked()
    const cardIcons = fields.getByRole('switch', { name: '卡片图标', exact: true })
    await expect(cardIcons).toBeChecked()
    await cardIcons.click()
    await expect(cardIcons).not.toBeChecked()
    await newTabPage.getByRole('radio', { name: '电光蓝', exact: true }).click()
    await expect(cardIcons).not.toBeChecked()
    await newTabPage.keyboard.press('Escape')
    await expect(card.locator('[data-slot="bookmark-icon"]')).toHaveCount(0)
    await expect(folderIcons).toHaveCount(0)
    await expect(nav.locator('[data-slot="category-icon"]')).toHaveCount(0)
    await expect(nav.getByRole('button', { name: '折叠目录 Icon Settings Folder', exact: true })).toBeVisible()
    await newTabPage.getByRole('button', { name: '打开目录 Bookmarks Bar', exact: true }).click()
    await expect(newTabPage.getByRole('button', { name: '打开目录 Icon Settings Folder', exact: true })).toBeVisible()
    await expect(folderIcons).toHaveCount(0)
    await newTabPage.getByRole('button', { name: '打开目录 Icon Settings Folder', exact: true }).click()
    await newTabPage.getByRole('button', { name: '打开目录 Icon Settings Child', exact: true }).click()
    await expect(card).toBeVisible()
    await expect(card.locator('[data-slot="bookmark-icon"]')).toHaveCount(0)
    await nav.getByRole('button', { name: '书签组', exact: true }).click()
    await expect(groupCard).toBeVisible()
    await expect(groupCard.locator('[data-slot="bookmark-icon"]')).toHaveCount(0)
    await groupCard.getByRole('button', { name: '查看书签组 Icon Settings Group', exact: true }).click()
    await expect(newTabPage.getByRole('menuitem', { name: '打开书签 Icon Settings Website', exact: true })).toBeVisible()
    await newTabPage.keyboard.press('Escape')
    await nav.getByRole('button', { name: /全部/ }).click()
    await newTabPage.reload()
    await expect(card).toBeVisible()
    await expect(card.locator('[data-slot="bookmark-icon"]')).toHaveCount(0)
    await expect(folderIcons).toHaveCount(0)
    await expect(nav.locator('[data-slot="category-icon"]')).toHaveCount(0)
    await newTabPage.screenshot({ path: '/tmp/yunji-icons-desktop.png', fullPage: true })

    await newTabPage.getByRole('radio', { name: '紧凑视图', exact: true }).click()
    await expect(card.locator('[data-slot="bookmark-icon"]')).toHaveCount(0)
    await newTabPage.getByRole('button', { name: '批量管理', exact: true }).click()
    const checkbox = card.getByRole('checkbox', { name: '选择 Icon Settings Website', exact: true })
    await expect(checkbox).toBeVisible()
    const checkboxBox = await checkbox.boundingBox()
    const titleBox = await card.getByText('Icon Settings Website', { exact: true }).boundingBox()
    expect(checkboxBox!.x + checkboxBox!.width).toBeLessThan(titleBox!.x)
    await checkbox.click()
    await expect(card.getByRole('checkbox')).toBeChecked()

    // Switch layout while keeping both icon choices hidden.
    await extensionWorker.evaluate(async () => {
      const key = 'yunji-tab:settings'
      const settings = JSON.parse(String((await chrome.storage.sync.get(key))[key]))
      settings.appearance.navLayout = 'top'
      await chrome.storage.sync.set({ [key]: JSON.stringify(settings) })
    })
    await newTabPage.reload()
    await expect(nav.locator('[data-slot="category-icon"]')).toHaveCount(0)
    await newTabPage.setViewportSize({ width: 375, height: 812 })
    await expect(card).toBeVisible()
    expect(await newTabPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await newTabPage.screenshot({ path: '/tmp/yunji-icons-mobile.png', fullPage: true })

    await newTabPage.getByRole('button', { name: '更多操作', exact: true }).click()
    await newTabPage.getByRole('menuitem', { name: '打开设置', exact: true }).click()
    await newTabPage.getByRole('tab', { name: '外观', exact: true }).click()
    await newTabPage.getByRole('button', { name: '高级自定义', exact: true }).click()
    await newTabPage.getByRole('switch', { name: '菜单图标', exact: true }).click()
    await newTabPage.getByRole('switch', { name: '卡片图标', exact: true }).click()
    await newTabPage.keyboard.press('Escape')
    await expect(card.locator('[data-slot="bookmark-icon"]')).toBeVisible()
    await expect(folderIcons.first()).toBeVisible()
    await expect(nav.locator('[data-slot="category-icon"]').first()).toBeVisible()
    await nav.getByRole('button', { name: '书签组', exact: true }).click()
    await expect(groupCard.locator('[data-slot="bookmark-icon"]')).toBeVisible()
    expect(errors).toEqual([])
  }
  finally {
    await extensionWorker.evaluate(async (id) => {
      await chrome.bookmarks.removeTree(id)
      await chrome.storage.sync.remove(['yunji-tab:bookmark-group:icon-settings', 'yunji-tab:bookmark-group:icon-settings:icons:0'])
      await chrome.storage.sync.set({ 'yunji-tab:settings': JSON.stringify({ language: 'zh-CN', onboardingDismissed: true }) })
    }, folderId)
  }
})
