import type { Page, Worker } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './extension.fixture'

const title = '研究工具'
const sourceName = '项目文档'
const sourceUrl = 'https://example.test/group-ui-source'
const menuNames = ['项目文档', '接口调试', '服务管理', '运行日志', '发布记录', '团队知识库', '版本对照', '非常长的组内名称用于测试两行换行 Documentation and reference guides for the development workspace']
const menuUrls = menuNames.map((_, index) => `${sourceUrl}/menu/${index}`)
let previousSync: Record<string, unknown> = {}

test.beforeEach(async ({ extensionWorker, newTabPage }) => {
  previousSync = await extensionWorker.evaluate(async () => Object.fromEntries(Object.entries(await chrome.storage.sync.get(null))
    .filter(([key]) => key.startsWith('yunji-tab:bookmark-group:') || key === 'yunji-tab:settings')))
  await extensionWorker.evaluate(async ({ title, sourceName, sourceUrl }) => {
    const values = await chrome.storage.sync.get(null)
    await chrome.storage.sync.remove(Object.keys(values).filter(key => key.startsWith('yunji-tab:bookmark-group:')))
    for (const bookmark of await chrome.bookmarks.search({ url: sourceUrl }))
      await chrome.bookmarks.remove(bookmark.id)
    await chrome.bookmarks.create({ parentId: '1', title: sourceName, url: sourceUrl })
    const key = 'yunji-tab:bookmark-group:ui-tools'
    await chrome.storage.sync.set({
      'yunji-tab:settings': JSON.stringify({ language: 'zh-CN', theme: 'light', appearance: { navLayout: 'sidebar' } }),
      [key]: { version: 1, generation: 'ui', partCount: 1 },
      [`${key}:ui:0`]: JSON.stringify({ id: 'ui-tools', title, description: '每天一起使用的研究与开发工具', pinnedAt: 123, bookmarks: [{ id: 'ui-member', url: sourceUrl, title: '项目文档' }] }),
    })
  }, { title, sourceName, sourceUrl })
  await newTabPage.reload()
  await newTabPage.setViewportSize({ width: 1280, height: 900 })
})

test.afterEach(async ({ extensionWorker }) => {
  await extensionWorker.evaluate(async ({ previousSync, sourceUrl, menuUrls }) => {
    for (const url of [sourceUrl, ...menuUrls]) {
      for (const bookmark of await chrome.bookmarks.search({ url }))
        await chrome.bookmarks.remove(bookmark.id)
    }
    const values = await chrome.storage.sync.get(null)
    await chrome.storage.sync.remove(Object.keys(values).filter(key => key.startsWith('yunji-tab:bookmark-group:') || key === 'yunji-tab:settings'))
    await chrome.storage.sync.set(previousSync)
  }, { previousSync, sourceUrl, menuUrls })
})

async function openSettings(page: Page) {
  await page.getByRole('button', { name: '更多操作', exact: true }).click()
  await page.getByRole('menuitem', { name: '打开设置', exact: true }).click()
  await page.getByRole('tab', { name: '常规', exact: true }).click()
}

test('shares compact card preferences and exposes hover actions through keyboard focus', async ({ extensionWorker, newTabPage }) => {
  await newTabPage.getByRole('navigation', { name: '书签分类' }).getByRole('button', { name: '书签组', exact: true }).click()
  const card = newTabPage.locator('article[data-bookmark-group-id="ui-tools"]')
  const actions = card.locator('div.absolute.right-2.top-2')
  await expect.poll(() => actions.evaluate(element => getComputedStyle(element).opacity)).toBe('0')
  await card.getByRole('button', { name: `查看书签组 ${title}`, exact: true }).focus()
  await newTabPage.keyboard.press('Tab')
  await expect(card.getByRole('button', { name: `取消置顶 ${title}`, exact: true })).toBeFocused()
  await expect.poll(() => actions.evaluate(element => getComputedStyle(element).opacity)).toBe('1')
  await newTabPage.keyboard.press('Tab')
  await expect(card.getByRole('button', { name: `更多操作 ${title}`, exact: true })).toBeFocused()
  await newTabPage.keyboard.press('Enter')
  await expect(newTabPage.getByRole('menuitem', { name: `编辑书签组 ${title}`, exact: true })).toBeVisible()
  await newTabPage.keyboard.press('Escape')
  await expect(newTabPage.getByRole('menuitem', { name: `编辑书签组 ${title}`, exact: true })).toHaveCount(0)
  await newTabPage.locator('header').click({ position: { x: 290, y: 10 } })
  await card.evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))))
  await newTabPage.screenshot({ path: '/tmp/yunji-group-default-icon-b.png' })
  await extensionWorker.evaluate(async () => {
    await chrome.storage.sync.set({ 'yunji-tab:settings': JSON.stringify({ language: 'zh-CN', theme: 'light', bookmarkViewMode: 'compact', appearance: { navLayout: 'sidebar', radius: 'sm', iconSize: 'lg', cardStyle: 'outline', cardFields: { actions: 'always' } } }) })
  })
  await newTabPage.reload()
  await newTabPage.getByRole('navigation', { name: '书签分类' }).getByRole('button', { name: '书签组', exact: true }).click()
  await expect.poll(() => card.evaluate(element => getComputedStyle(element).minHeight)).toBe('68px')
  await expect.poll(() => card.evaluate(element => getComputedStyle(element).borderRadius)).toBe('6px')
  await expect(card.getByText('每天一起使用的研究与开发工具', { exact: true })).toHaveCount(0)
  await expect.poll(() => card.locator('[aria-hidden="true"]').first().evaluate(element => element.getBoundingClientRect().width)).toBe(44)
  await expect.poll(() => actions.evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0)
})

test('places groups after smart categories and preserves data when toggled off across live pages', async ({ extensionContext, extensionWorker, newTabPage }) => {
  const nav = newTabPage.getByRole('navigation', { name: '书签分类' })
  const groupsEntry = nav.getByRole('button', { name: '书签组', exact: true })
  const smart = nav.getByRole('button', { name: /^智能分类/ })
  await expect(groupsEntry).toContainText('🗂️')
  expect((await groupsEntry.boundingBox())!.y).toBeGreaterThan((await smart.boundingBox())!.y)
  await groupsEntry.click()
  const viewGroup = newTabPage.getByRole('button', { name: `查看书签组 ${title}`, exact: true })
  await expect(viewGroup).toBeVisible()
  const other = await extensionContext.newPage()
  try {
    await other.goto(newTabPage.url())
    await other.getByRole('navigation', { name: '书签分类' }).getByRole('button', { name: '书签组', exact: true }).click()
    await expect(other.getByRole('button', { name: `查看书签组 ${title}`, exact: true })).toBeVisible()
    await openSettings(newTabPage)
    const enabled = newTabPage.getByRole('switch', { name: '书签组', exact: true })
    await expect(enabled).toBeChecked()
    await enabled.uncheck()
    await expect(groupsEntry).toHaveCount(0)
    await expect(other.getByRole('button', { name: '书签组', exact: true })).toHaveCount(0)
    await expect(other.getByRole('button', { name: `查看书签组 ${title}`, exact: true })).toHaveCount(0)
    await newTabPage.keyboard.press('Escape')
    await expect(newTabPage.getByRole('dialog')).toBeHidden()
    await newTabPage.reload()
    await expect(groupsEntry).toHaveCount(0)
    await smart.click()
    const pinned = nav.getByRole('button', { name: /置顶/ })
    const disabledCount = Number((await pinned.textContent())?.match(/\d+$/)?.[0])
    await pinned.click()
    await expect(viewGroup).toHaveCount(0)
    await openSettings(newTabPage)
    await newTabPage.getByRole('switch', { name: '书签组', exact: true }).check()
    await newTabPage.keyboard.press('Escape')
    await expect(newTabPage.getByRole('dialog')).toBeHidden()
    await expect(viewGroup).toBeVisible()
    await expect(pinned).toContainText(String(disabledCount + 1))
    await expect(other.getByRole('button', { name: `查看书签组 ${title}`, exact: true })).toBeVisible()
    const settings = await extensionWorker.evaluate(async () => JSON.parse(String((await chrome.storage.sync.get('yunji-tab:settings'))['yunji-tab:settings'])))
    expect(settings.bookmarkGroupsEnabled).toBe(true)
    await newTabPage.reload()
    await expect(groupsEntry).toBeVisible()
  }
  finally {
    await other.close()
  }
})

test('uses bookmark card styling, hover menus and custom emoji or image icons', async ({ extensionContext, extensionWorker, newTabPage }) => {
  const nav = newTabPage.getByRole('navigation', { name: '书签分类' })
  await nav.getByRole('button', { name: '书签组', exact: true }).click()
  const card = newTabPage.locator('article[data-bookmark-group-id="ui-tools"]')
  const actions = card.locator('div.absolute.right-2.top-2')
  await expect(card.getByText('🗂️', { exact: true })).toBeVisible()
  await expect.poll(() => actions.evaluate(element => getComputedStyle(element).opacity)).toBe('0')
  await card.hover()
  await expect.poll(() => actions.evaluate(element => getComputedStyle(element).opacity)).toBe('1')
  await card.getByRole('button', { name: `更多操作 ${title}`, exact: true }).click()
  await newTabPage.getByRole('menuitem', { name: `编辑书签组 ${title}`, exact: true }).click()
  await newTabPage.getByRole('dialog').getByLabel('图标（可选）', { exact: true }).fill('🐱')
  await newTabPage.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click()
  await expect(card.getByText('🐱', { exact: true })).toBeVisible()
  await expect(card.getByText('🗂️', { exact: true })).toHaveCount(0)

  // A stale editor changes only its description, retaining another page's new icon.
  await card.hover()
  await card.getByRole('button', { name: `更多操作 ${title}`, exact: true }).click()
  await newTabPage.getByRole('menuitem', { name: `编辑书签组 ${title}`, exact: true }).click()
  await newTabPage.getByLabel('组描述（可选）', { exact: true }).fill('常用文档与开发工具')
  await extensionWorker.evaluate(async () => {
    const key = 'yunji-tab:bookmark-group:ui-tools'
    const values = await chrome.storage.sync.get(null)
    const manifest = values[key] as { generation: string, partCount: number }
    const group = JSON.parse(Array.from({ length: manifest.partCount }, (_, index) => values[`${key}:${manifest.generation}:${index}`]).join(''))
    group.icon = '🚀'
    await chrome.storage.sync.set({ [key]: { version: 1, generation: 'remote-icon', partCount: 1 }, [`${key}:remote-icon:0`]: JSON.stringify(group) })
  })
  await expect(card.getByText('🚀', { exact: true })).toBeAttached()
  await newTabPage.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click()
  await expect(card.getByText('🚀', { exact: true })).toBeVisible()
  await expect(card.getByText('常用文档与开发工具', { exact: true })).toBeVisible()

  const logoUrl = 'https://example.test/group-logo.png'
  await extensionContext.route(logoUrl, route => route.fulfill({ contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#267447"/></svg>' }))
  await card.hover()
  await card.getByRole('button', { name: `更多操作 ${title}`, exact: true }).click()
  await newTabPage.getByRole('menuitem', { name: `编辑书签组 ${title}`, exact: true }).click()
  await newTabPage.getByLabel('图标（可选）', { exact: true }).fill(logoUrl)
  await newTabPage.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click()
  await expect.poll(() => card.locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(32)
  await newTabPage.reload()
  await nav.getByRole('button', { name: '书签组', exact: true }).click()
  await expect(card.locator('img')).toBeVisible()
  await card.hover()
  await card.getByRole('button', { name: `更多操作 ${title}`, exact: true }).click()
  await newTabPage.getByRole('menuitem', { name: `编辑书签组 ${title}`, exact: true }).click()
  await newTabPage.getByLabel('图标（可选）', { exact: true }).fill('🐱')
  await newTabPage.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click()
  await expect(card.getByText('🐱', { exact: true })).toBeVisible()

  await nav.getByRole('button', { name: /全部/ }).click()
  const bookmarkCard = newTabPage.locator(`article:has(a[href="${sourceUrl}"])`).first()
  await bookmarkCard.hover()
  await bookmarkCard.getByRole('button', { name: `置顶 ${sourceName}`, exact: true }).click()
  await nav.getByRole('button', { name: /^智能分类/ }).click()
  await nav.getByRole('button', { name: /置顶/ }).click()
  await expect(card).toBeVisible()
  await expect(newTabPage.getByRole('heading', { name: '书签组', exact: true })).toHaveCount(0)
  expect(await card.evaluate(element => element.parentElement === document.querySelector('article:has(a[href="https://example.test/group-ui-source"])')?.parentElement)).toBe(true)
  expect(Math.round((await card.boundingBox())!.y)).toBe(Math.round((await bookmarkCard.boundingBox())!.y))
  const search = newTabPage.getByRole('textbox', { name: /^搜索书签/ })
  await search.fill(title)
  await expect(card).toBeVisible()
  await expect(bookmarkCard).toHaveCount(0)
  await search.fill('没有匹配的书签组')
  await expect(card).toHaveCount(0)
  await search.fill('')
  await expect(card).toBeVisible()
  await expect(bookmarkCard).toBeVisible()
  const styles = (element: Element) => {
    const style = getComputedStyle(element)
    return { radius: style.borderRadius, minHeight: style.minHeight, background: style.backgroundColor, border: style.border }
  }
  await newTabPage.locator('header').hover()
  await expect.poll(async () => JSON.stringify(await card.evaluate(styles)) === JSON.stringify(await bookmarkCard.evaluate(styles))).toBe(true)
  await newTabPage.screenshot({ path: '/tmp/yunji-groups-unified-desktop.png', fullPage: true })
  await newTabPage.setViewportSize({ width: 375, height: 900 })
  await expect.poll(() => newTabPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect.poll(() => actions.evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0)
  expect((await new AxeBuilder({ page: newTabPage }).analyze()).violations.filter(item => ['critical', 'serious'].includes(item.impact ?? ''))).toEqual([])
  await newTabPage.screenshot({ path: '/tmp/yunji-groups-unified-mobile.png', fullPage: true })
  await extensionWorker.evaluate(async () => {
    const settings = JSON.parse(String((await chrome.storage.sync.get('yunji-tab:settings'))['yunji-tab:settings']))
    settings.appearance = { ...settings.appearance, colorTheme: 'engraving', cardStyle: 'outline', radius: 'sm' }
    await chrome.storage.sync.set({ 'yunji-tab:settings': JSON.stringify(settings) })
  })
  await newTabPage.reload()
  await newTabPage.setViewportSize({ width: 1280, height: 900 })
  await nav.getByRole('button', { name: /^智能分类/ }).click()
  await nav.getByRole('button', { name: /置顶/ }).click()
  await expect(newTabPage.locator('html')).toHaveClass(/theme-engraving/)
  await newTabPage.locator('header').hover()
  await newTabPage.locator('header').evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))))
  await newTabPage.screenshot({ path: '/tmp/yunji-groups-unified-engraving.png', fullPage: true })
})

async function seedMenuMembers(worker: Worker) {
  await worker.evaluate(async ({ title, menuNames, menuUrls }) => {
    for (const [index, url] of menuUrls.entries())
      await chrome.bookmarks.create({ parentId: '1', title: `Menu source ${index}`, url })
    const members = menuNames.map((name, index) => ({ id: `menu-${index}`, title: name, url: menuUrls[index] }))
    const mainKey = 'yunji-tab:bookmark-group:ui-tools'
    const otherKey = 'yunji-tab:bookmark-group:ui-other'
    await chrome.storage.sync.set({
      [mainKey]: { version: 1, generation: 'menu', partCount: 1 },
      [`${mainKey}:menu:0`]: JSON.stringify({ id: 'ui-tools', title, icon: '🐱', description: '常用文档与开发工具', pinnedAt: 123, bookmarks: members }),
      [otherKey]: { version: 1, generation: 'menu', partCount: 1 },
      [`${otherKey}:menu:0`]: JSON.stringify({ id: 'ui-other', title: '运维服务', description: '查看系统状态', bookmarks: [{ ...members[0], title: '运行面板' }] }),
    })
  }, { title, menuNames, menuUrls })
}

for (const pinned of [false, true]) {
  test(`preserves an open ${pinned ? 'pinned' : 'group'} editor when another page disables groups`, async ({ extensionContext, newTabPage }) => {
    const nav = newTabPage.getByRole('navigation', { name: '书签分类' })
    if (pinned) {
      await nav.getByRole('button', { name: /^智能分类/ }).click()
      await nav.getByRole('button', { name: /置顶/ }).click()
    }
    else {
      await nav.getByRole('button', { name: '书签组', exact: true }).click()
    }
    const card = newTabPage.locator('article[data-bookmark-group-id="ui-tools"]')
    await card.getByRole('button', { name: `更多操作 ${title}`, exact: true }).click()
    await newTabPage.getByRole('menuitem', { name: `编辑书签组 ${title}`, exact: true }).click()
    const dialog = newTabPage.getByRole('dialog')
    await dialog.getByLabel('组标题', { exact: true }).fill('未保存的研究工具')
    await dialog.getByLabel('组描述（可选）', { exact: true }).fill('仍在编辑的描述')
    await dialog.getByLabel('图标（可选）', { exact: true }).fill('🐱')
    const other = await extensionContext.newPage()
    try {
      await other.goto(newTabPage.url())
      await openSettings(other)
      const enabled = other.getByRole('switch', { name: '书签组', exact: true })
      await enabled.uncheck()
      await expect(nav.getByRole('button', { name: '书签组', exact: true })).toHaveCount(0)
      await expect(card).toHaveCount(0)
      await expect(dialog).toBeVisible()
      await expect(dialog.getByLabel('组标题', { exact: true })).toHaveValue('未保存的研究工具')
      await enabled.check()
      await expect(card).toBeAttached()
      await expect(dialog.getByLabel('组描述（可选）', { exact: true })).toHaveValue('仍在编辑的描述')
      await expect(dialog.getByLabel('图标（可选）', { exact: true })).toHaveValue('🐱')
      await dialog.getByRole('button', { name: '保存', exact: true }).click()
      await expect(card.getByText('未保存的研究工具', { exact: true })).toBeVisible()
    }
    finally {
      await other.close()
    }
  })
}

test('keeps a reopened menu when the old member open finishes', async ({ extensionWorker, newTabPage }) => {
  await seedMenuMembers(extensionWorker)
  await newTabPage.getByRole('navigation', { name: '书签分类' }).getByRole('button', { name: '书签组', exact: true }).click()
  // Delay the real browser API boundary while leaving the menu and usage flow intact.
  await newTabPage.evaluate(() => {
    const state = window as unknown as { releaseGroupOpen: () => void, groupOpenStarted: boolean }
    const pending = new Promise<void>((resolve) => {
      state.releaseGroupOpen = resolve
    })
    chrome.tabs.create = (async () => {
      state.groupOpenStarted = true
      await pending
      return {} as chrome.tabs.Tab
    }) as typeof chrome.tabs.create
  })
  const trigger = newTabPage.getByRole('button', { name: `查看书签组 ${title}`, exact: true })
  const menu = newTabPage.getByRole('menu', { name: `查看书签组 ${title}`, exact: true })
  await trigger.click({ position: { x: 85, y: 34 } })
  await menu.getByRole('menuitem').first().click()
  await expect.poll(() => newTabPage.evaluate(() => (window as unknown as { groupOpenStarted: boolean }).groupOpenStarted)).toBe(true)
  await newTabPage.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await trigger.click({ position: { x: 85, y: 34 } })
  await expect(menu).toBeVisible()
  await newTabPage.evaluate(() => (window as unknown as { releaseGroupOpen: () => void }).releaseGroupOpen())
  await expect.poll(() => extensionWorker.evaluate(async (url) => {
    const raw = (await chrome.storage.local.get('yunji-tab:usage'))['yunji-tab:usage']
    const usage = typeof raw === 'string' ? JSON.parse(raw) : raw
    return usage?.[url]?.openCount ?? 0
  }, menuUrls[0])).toBeGreaterThan(0)
  await expect(menu).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
})

test('opens names beside the click, toggles and switches menus without leaving the grid', async ({ extensionContext, extensionWorker, newTabPage }) => {
  await extensionContext.route(`${sourceUrl}/menu/*`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Opened group bookmark</title>' }))
  await seedMenuMembers(extensionWorker)
  await newTabPage.getByRole('navigation', { name: '书签分类' }).getByRole('button', { name: '书签组', exact: true }).click()
  const trigger = newTabPage.getByRole('button', { name: `查看书签组 ${title}`, exact: true })
  const bounds = (await trigger.boundingBox())!
  const point = { x: bounds.x + 85, y: bounds.y + 34 }
  await newTabPage.mouse.click(point.x, point.y)
  const menu = newTabPage.getByRole('menu', { name: `查看书签组 ${title}`, exact: true })
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem')).toHaveText(menuNames)
  expect(await menu.locator('img, svg').count()).toBe(0)
  expect(await menu.textContent()).not.toContain('https://')
  await expect(trigger).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(newTabPage.getByRole('button', { name: '创建书签组', exact: true })).toBeVisible()
  await expect.poll(async () => Math.abs((await menu.boundingBox())!.x - point.x - 8)).toBeLessThan(2)
  await expect.poll(async () => Math.abs((await menu.boundingBox())!.y - point.y - 9)).toBeLessThan(2)
  const menuBounds = (await menu.boundingBox())!
  await newTabPage.mouse.move(menuBounds.x + 30, menuBounds.y + 24)
  await expect(menu.getByRole('menuitem').first()).toHaveAttribute('data-highlighted', '')
  await expect.poll(() => menu.getByRole('menuitem').first().evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
  await newTabPage.screenshot({ path: '/tmp/yunji-group-menu-light.png' })
  await newTabPage.mouse.click(point.x, point.y)
  await expect(menu).toHaveCount(0)
  await trigger.click({ position: { x: 85, y: 34 } })
  await newTabPage.getByRole('button', { name: '查看书签组 运维服务', exact: true }).click({ position: { x: 85, y: 34 } })
  await expect(newTabPage.getByRole('menu')).toHaveCount(1)
  await expect(newTabPage.getByRole('menuitem', { name: '打开书签 运行面板', exact: true })).toBeVisible()
  await newTabPage.locator('header').click()
  await expect(newTabPage.getByRole('menu')).toHaveCount(0)
  await trigger.focus()
  await newTabPage.keyboard.press('Enter')
  await expect(menu.getByRole('menuitem').first()).toBeFocused()
  await expect(menu).toHaveAttribute('data-keyboard', 'true')
  await expect.poll(() => menu.evaluate(element => getComputedStyle(element).animationName)).toBe('none')
  await newTabPage.keyboard.press('ArrowDown')
  await expect(menu.getByRole('menuitem').nth(1)).toBeFocused()
  await newTabPage.keyboard.press('End')
  await expect(menu.getByRole('menuitem').last()).toBeFocused()
  await newTabPage.keyboard.press('Home')
  await expect(menu.getByRole('menuitem').first()).toBeFocused()
  await newTabPage.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await newTabPage.keyboard.press('Space')
  await expect(menu).toBeVisible()
  await newTabPage.keyboard.press('Tab')
  await expect(menu).toHaveCount(0)
  await trigger.click({ position: { x: 85, y: 34 } })
  const opened = extensionContext.waitForEvent('page')
  await menu.getByRole('menuitem', { name: '打开书签 项目文档', exact: true }).click()
  const target = await opened
  await expect.poll(() => target.url()).toBe(menuUrls[0])
  await expect(menu).toHaveCount(0)
  await target.close()
  await expect(trigger).toBeVisible()
})

test('keeps long menus inside narrow screens, scrolls internally and follows engraving and reduced motion', async ({ extensionContext, extensionWorker, newTabPage }) => {
  await seedMenuMembers(extensionWorker)
  await extensionWorker.evaluate(async (missingUrl) => {
    for (const bookmark of await chrome.bookmarks.search({ url: missingUrl }))
      await chrome.bookmarks.remove(bookmark.id)
    const settings = JSON.parse(String((await chrome.storage.sync.get('yunji-tab:settings'))['yunji-tab:settings']))
    settings.appearance = { ...settings.appearance, colorTheme: 'engraving', radius: 'sm' }
    await chrome.storage.sync.set({ 'yunji-tab:settings': JSON.stringify(settings) })
  }, menuUrls[1])
  await newTabPage.reload()
  const nav = newTabPage.getByRole('navigation', { name: '书签分类' })
  const sourceCard = newTabPage.locator(`article:has(a[href="${sourceUrl}"])`)
  await sourceCard.hover()
  const pinSource = sourceCard.getByRole('button', { name: `置顶 ${sourceName}`, exact: true })
  if (await pinSource.count())
    await pinSource.click()
  await nav.getByRole('button', { name: /^智能分类/ }).click()
  await nav.getByRole('button', { name: /置顶/ }).click()
  const trigger = newTabPage.getByRole('button', { name: `查看书签组 ${title}`, exact: true })
  await trigger.click({ position: { x: 85, y: 34 } })
  const menu = newTabPage.getByRole('menu', { name: `查看书签组 ${title}`, exact: true })
  await expect(menu).toBeVisible()
  await expect.poll(() => menu.evaluate(element => getComputedStyle(element).borderRadius)).toBe('6px')
  await menu.evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))))
  await newTabPage.screenshot({ path: '/tmp/yunji-group-menu-engraving.png' })
  await newTabPage.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await newTabPage.emulateMedia({ reducedMotion: 'reduce' })
  await trigger.click({ position: { x: 85, y: 34 } })
  await expect.poll(() => menu.evaluate(element => getComputedStyle(element).animationName)).toBe('none')
  await newTabPage.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await newTabPage.emulateMedia({ reducedMotion: 'no-preference' })
  await trigger.focus()
  await newTabPage.keyboard.press('Enter')
  await expect(menu.getByRole('menuitem').first()).toBeFocused()
  await newTabPage.keyboard.press('ArrowDown')
  await expect(menu.getByRole('menuitem', { name: '打开书签 服务管理', exact: true })).toBeFocused()
  await newTabPage.keyboard.press('Escape')
  for (const width of [375, 320]) {
    await newTabPage.setViewportSize({ width, height: 450 })
    await trigger.scrollIntoViewIfNeeded()
    await newTabPage.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    const bounds = (await trigger.boundingBox())!
    await newTabPage.mouse.click(bounds.x + bounds.width - 14, bounds.y + bounds.height - 14)
    await expect(menu).toBeVisible()
    const box = (await menu.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(7)
    expect(box.x + box.width).toBeLessThanOrEqual(width - 7)
    expect(box.y).toBeGreaterThanOrEqual(7)
    expect(box.y + box.height).toBeLessThanOrEqual(443)
    await expect(menu).toHaveAttribute('data-side', 'top')
    await expect.poll(() => menu.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
    await expect(menu.getByRole('menuitem', { name: '打开书签 接口调试', exact: true })).toBeDisabled()
    await menu.evaluate(element => element.scrollTo({ top: element.scrollHeight }))
    await expect(menu.getByRole('menuitem').last()).toBeVisible()
    await menu.evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))))
    await newTabPage.screenshot({ path: `/tmp/yunji-group-menu-mobile-${width}.png` })
    expect((await new AxeBuilder({ page: newTabPage }).analyze()).violations.filter(item => ['critical', 'serious'].includes(item.impact ?? ''))).toEqual([])
    await newTabPage.keyboard.press('Escape')
  }
  // A genuine touch tap shares the pointer anchor and can select a link.
  const touchPage = await extensionContext.newPage()
  await touchPage.setViewportSize({ width: 375, height: 650 })
  const touchSession = await extensionContext.newCDPSession(touchPage)
  await touchSession.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
  const tap = async (x: number, y: number) => {
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  try {
    await touchPage.goto(newTabPage.url())
    await touchPage.getByRole('navigation', { name: '书签分类' }).getByRole('button', { name: '书签组', exact: true }).click()
    const touchBounds = (await touchPage.getByRole('button', { name: `查看书签组 ${title}`, exact: true }).boundingBox())!
    await tap(touchBounds.x + 85, touchBounds.y + 34)
    await expect(touchPage.getByRole('menuitem', { name: '打开书签 项目文档', exact: true })).toBeVisible()
    await tap(180, 24)
    await expect(touchPage.getByRole('menu')).toHaveCount(0)
  }
  finally {
    await touchSession.detach()
    await touchPage.close()
  }
})

test('opens on mouse dwell without taking focus and bridges the card/menu gap', async ({ extensionWorker, newTabPage }) => {
  await seedMenuMembers(extensionWorker)
  await newTabPage.getByRole('navigation', { name: '书签分类' }).getByRole('button', { name: '书签组', exact: true }).click()
  const trigger = newTabPage.getByRole('button', { name: `查看书签组 ${title}`, exact: true })
  const menu = newTabPage.getByRole('menu', { name: `查看书签组 ${title}`, exact: true })
  const header = newTabPage.locator('header')
  const card = newTabPage.locator('article[data-bookmark-group-id="ui-tools"]')
  const more = card.getByRole('button', { name: `更多操作 ${title}`, exact: true })
  const search = newTabPage.getByRole('textbox', { name: /^搜索书签/ })
  await search.focus()
  await newTabPage.clock.install()
  await newTabPage.clock.pauseAt(new Date())
  const bounds = (await trigger.boundingBox())!
  const point = { x: bounds.x + 85, y: bounds.y + 34 }

  // Briefly passing through a card must not open anything.
  await newTabPage.mouse.move(point.x, point.y)
  await newTabPage.clock.runFor(100)
  await header.hover()
  await newTabPage.clock.runFor(300)
  await expect(menu).toHaveCount(0)

  await newTabPage.mouse.move(point.x, point.y)
  await newTabPage.clock.runFor(199)
  await expect(menu).toHaveCount(0)
  await newTabPage.clock.runFor(150)
  await expect(menu).toBeVisible()
  await expect(search).toBeFocused()
  const position = (await menu.boundingBox())!
  await newTabPage.mouse.move(point.x - 12, point.y)
  await newTabPage.clock.runFor(300)
  expect((await menu.boundingBox())!.x).toBeCloseTo(position.x, 0)
  expect((await menu.boundingBox())!.y).toBeCloseTo(position.y, 0)

  // Cross the gap during the grace period and continue selecting inside the list.
  await newTabPage.mouse.move(bounds.x - 2, point.y)
  await newTabPage.clock.runFor(100)
  await newTabPage.mouse.move(position.x + 30, position.y + 24)
  await newTabPage.clock.runFor(400)
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem').first()).toHaveAttribute('data-highlighted', '')
  await expect(search).toBeFocused()
  await header.hover()
  await newTabPage.clock.runFor(199)
  await expect(menu).toBeVisible()
  await newTabPage.clock.runFor(150)
  await expect(menu).toHaveCount(0)
  await expect(search).toBeFocused()

  // Actions cancel a pending hover and never open the member list.
  await newTabPage.mouse.move(point.x, point.y)
  await newTabPage.clock.runFor(100)
  await more.hover()
  await newTabPage.clock.runFor(400)
  await expect(menu).toHaveCount(0)
  await more.click()
  await expect(newTabPage.getByRole('menuitem', { name: `编辑书签组 ${title}`, exact: true })).toBeVisible()
  await newTabPage.keyboard.press('Escape')

  // Clicking an already hovered group keeps it open for explicit interaction.
  await newTabPage.mouse.move(point.x, point.y)
  await newTabPage.clock.runFor(350)
  await expect(menu).toBeVisible()
  await newTabPage.mouse.click(point.x, point.y)
  await header.hover()
  await newTabPage.clock.runFor(400)
  await expect(menu).toBeVisible()
  await newTabPage.keyboard.press('Escape')
  await newTabPage.clock.runFor(32)
  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()

  // Switching from an explicitly opened menu to a hovered group must not restore old focus.
  await newTabPage.mouse.click(point.x, point.y)
  await newTabPage.clock.runFor(350)
  const other = newTabPage.getByRole('button', { name: '查看书签组 运维服务', exact: true })
  await other.hover()
  await newTabPage.clock.runFor(350)
  await expect(menu).toHaveCount(0)
  await expect(newTabPage.getByRole('menu', { name: '查看书签组 运维服务', exact: true })).toBeVisible()
  await newTabPage.getByRole('navigation', { name: '书签分类' }).getByRole('button', { name: /全部/ }).click()
  await newTabPage.clock.runFor(400)
  await expect(newTabPage.getByRole('menu')).toHaveCount(0)
  await newTabPage.clock.resume()
  await newTabPage.getByRole('navigation', { name: '书签分类' }).getByRole('button', { name: '书签组', exact: true }).click()
  await trigger.hover({ position: { x: 85, y: 34 } })
  await expect(menu).toBeVisible()
  await menu.evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))))
  await menu.getByRole('menuitem').first().hover()
  await expect.poll(() => menu.getByRole('menuitem').first().evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
  await newTabPage.screenshot({ path: '/tmp/yunji-group-menu-hover.png' })
  await header.hover()
  await expect(menu).toHaveCount(0)
})
