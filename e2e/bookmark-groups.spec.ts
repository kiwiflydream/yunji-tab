import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { chromium } from '@playwright/test'
import { bookmarkGroupMessages } from '../src/lib/i18n-bookmark-groups'
import { expect, test } from './extension.fixture'

test('creates groups from saved bookmarks, keeps aliases, opens members, and syncs live pages', async ({ extensionContext, extensionWorker, newTabPage }) => {
  const url = 'https://example.com/group-source'
  const native = await extensionWorker.evaluate(async url => chrome.bookmarks.create({ parentId: '1', title: 'Group source original', url }), url)
  await newTabPage.reload()
  await newTabPage.getByRole('button', { name: /^书签组/ }).click()
  await newTabPage.getByRole('button', { name: '创建书签组', exact: true }).click()
  const dialog = newTabPage.getByRole('dialog')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('请填写组标题')
  await dialog.getByLabel('组标题', { exact: true }).fill('开发工具')
  await dialog.getByLabel('组描述（可选）', { exact: true }).fill('工作中经常一起使用的工具')
  await dialog.getByLabel('搜索已有书签', { exact: true }).fill('Group source original')
  await dialog.getByRole('checkbox', { name: /^Group source original / }).check()
  await dialog.getByLabel('组内标题', { exact: true }).fill('项目文档')
  await expect(dialog.getByText('已选择 1 个书签')).toBeVisible()
  await newTabPage.screenshot({ path: '/tmp/yunji-tab-bookmark-group-editor.png', fullPage: true })
  expect((await new AxeBuilder({ page: newTabPage }).analyze()).violations.filter(item => ['critical', 'serious'].includes(item.impact ?? ''))).toEqual([])
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toBeHidden()
  await newTabPage.getByRole('button', { name: '查看书签组 开发工具', exact: true }).click()
  await expect(newTabPage.getByRole('button', { name: '打开书签 项目文档', exact: true })).toBeVisible()
  const original = await extensionWorker.evaluate(async id => (await chrome.bookmarks.get(id))[0], native.id)
  expect(original.title).toBe('Group source original')
  const opened = extensionContext.waitForEvent('page')
  await newTabPage.getByRole('button', { name: '打开书签 项目文档', exact: true }).click()
  const target = await opened
  await expect.poll(() => target.url()).toBe(url)
  await target.close()

  const other = await extensionContext.newPage()
  try {
    await other.goto(newTabPage.url())
    await other.getByRole('button', { name: /^书签组/ }).click()
    await expect(other.getByRole('button', { name: '查看书签组 开发工具', exact: true })).toBeVisible()
    await newTabPage.getByRole('button', { name: '编辑书签组', exact: true }).click()
    await newTabPage.getByLabel('组标题', { exact: true }).fill('工作工具')
    await newTabPage.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click()
    await expect(other.getByRole('button', { name: '查看书签组 工作工具', exact: true })).toBeVisible()
    await newTabPage.reload()
    await newTabPage.getByRole('button', { name: /^书签组/ }).click()
    await newTabPage.getByRole('button', { name: '查看书签组 工作工具', exact: true }).click()
    // Close every home page, edit through the native API, and reopen the group.
    const homeUrl = newTabPage.url()
    await expect.poll(async () => extensionWorker.evaluate(async id => (await chrome.storage.local.get('yunji-tab:bookmark-group-sources'))['yunji-tab:bookmark-group-sources']?.[id], native.id)).toBe(url)
    await other.close()
    await newTabPage.goto('about:blank')
    await extensionWorker.evaluate(async id => chrome.bookmarks.update(id, { url: 'https://example.com/group-source-closed' }), native.id)
    await expect.poll(async () => extensionWorker.evaluate(async () => JSON.stringify(await chrome.storage.sync.get(null)))).toContain('https://example.com/group-source-closed')
    await newTabPage.goto(homeUrl)
    const liveOther = await extensionContext.newPage()
    await liveOther.goto(homeUrl)
    await liveOther.getByRole('button', { name: /^书签组/ }).click()
    await newTabPage.getByRole('button', { name: /^书签组/ }).click()
    await newTabPage.getByRole('button', { name: '查看书签组 工作工具', exact: true }).click()
    await expect(newTabPage.getByText('https://example.com/group-source-closed', { exact: true })).toBeVisible()
    await extensionWorker.evaluate(async id => chrome.bookmarks.update(id, { url: 'https://example.com/group-source-new' }), native.id)
    await expect(newTabPage.getByText('https://example.com/group-source-new', { exact: true })).toBeVisible()
    await extensionWorker.evaluate(async id => chrome.bookmarks.remove(id), native.id)
    await expect(newTabPage.getByText('原书签已移除', { exact: true })).toBeVisible()
    await expect(newTabPage.getByRole('button', { name: '打开书签 项目文档', exact: true })).toBeDisabled()
    await newTabPage.getByRole('button', { name: '返回书签组', exact: true }).click()
    await newTabPage.getByRole('button', { name: '删除书签组 工作工具', exact: true }).click()
    await newTabPage.getByRole('alertdialog').getByRole('button', { name: '删除', exact: true }).click()
    await expect(liveOther.getByRole('button', { name: '查看书签组 工作工具', exact: true })).toHaveCount(0)
    await liveOther.close()
  }
  finally {
    await other.close()
  }
})

test('receives sync parts in a separate Chrome profile with different native bookmark IDs', async ({ extensionWorker, newTabPage }) => {
  // Transfer sync records between isolated profiles; no real Chrome account is signed in.
  const group = { id: 'remote-group-test', title: '跨设备组', description: '另一设备创建', pinnedAt: 123, bookmarks: [{ id: 'remote-member', url: 'https://example.com/remote-group', title: '组内别名' }] }
  const sourceId = await extensionWorker.evaluate(async (group) => {
    const native = await chrome.bookmarks.create({ parentId: '1', title: 'Source bookmark', url: group.bookmarks[0].url })
    const key = `yunji-tab:bookmark-group:${group.id}`
    await chrome.storage.sync.set({ [key]: { version: 1, generation: 'remote', partCount: 1 }, [`${key}:remote:0`]: JSON.stringify(group) })
    return native.id
  }, group)
  const values = await extensionWorker.evaluate(async () => chrome.storage.sync.get(null))
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'yunji-tab-groups-receiver-'))
  const extensionPath = path.resolve('build/chrome-mv3-prod')
  const receiver = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    locale: 'zh-CN',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-first-run', '--no-default-browser-check'],
  })
  try {
    let [worker] = receiver.serviceWorkers()
    worker ??= await receiver.waitForEvent('serviceworker')
    const receiverId = await worker.evaluate(async (group) => {
      // Ensure the receiver's native ID is different from the source's.
      for (let index = 0; index < 20; index++)
        await chrome.bookmarks.create({ parentId: '1', title: 'Receiver extra bookmark', url: `https://example.com/receiver-extra/${index}` })
      return (await chrome.bookmarks.create({ parentId: '1', title: 'Receiver original title', url: group.bookmarks[0].url })).id
    }, group)
    expect(receiverId).not.toBe(sourceId)
    const key = `yunji-tab:bookmark-group:${group.id}`
    await worker.evaluate(async ({ key, manifest }) => chrome.storage.sync.set({ [key]: manifest }), { key, manifest: values[key] })
    const page = await receiver.newPage()
    await page.goto(newTabPage.url())
    await page.getByRole('button', { name: /^书签组/ }).click()
    await expect(page.getByRole('button', { name: '查看书签组 跨设备组', exact: true })).toHaveCount(0)
    const parts = Object.fromEntries(Object.entries(values).filter(([item]) => item.startsWith(`${key}:`)))
    await worker.evaluate(async parts => chrome.storage.sync.set(parts), parts)
    await page.getByRole('button', { name: '查看书签组 跨设备组', exact: true }).click()
    await expect(page.getByRole('button', { name: '打开书签 组内别名', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: '取消置顶 跨设备组', exact: true })).toHaveAttribute('aria-pressed', 'true')
    expect(await worker.evaluate(async id => (await chrome.bookmarks.get(id))[0].title, receiverId)).toBe('Receiver original title')
    await page.setViewportSize({ width: 375, height: 812 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect((await new AxeBuilder({ page }).analyze()).violations.filter(item => ['critical', 'serious'].includes(item.impact ?? ''))).toEqual([])
    await page.screenshot({ path: '/tmp/yunji-tab-bookmark-group-mobile.png', fullPage: true })
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.screenshot({ path: '/tmp/yunji-tab-bookmark-group-desktop.png', fullPage: true })
    await page.reload()
    await page.getByRole('button', { name: /^书签组/ }).click()
    await expect(page.getByRole('button', { name: '查看书签组 跨设备组', exact: true })).toBeVisible()
  }
  finally {
    await receiver.close()
  }
})

test('renders group cards, details, and editors in every supported language on narrow and wide screens', async ({ extensionWorker, newTabPage }) => {
  const group = { id: 'layout-group', title: '工具收藏 / Bookmarks for research, development and documentation', description: '把工作中一起使用的书签放在一组。Saved links for daily research and development, with a description that wraps across multiple lines.', bookmarks: [{ id: 'layout-member', url: 'https://example.com/group-layout?reference=long-bookmark-link-for-documentation', title: '项目文档 / Documentation and reference guides for the development workspace' }] }
  await extensionWorker.evaluate(async (group) => {
    await chrome.bookmarks.create({ parentId: '1', title: 'Layout source bookmark', url: group.bookmarks[0].url })
    const key = `yunji-tab:bookmark-group:${group.id}`
    await chrome.storage.sync.set({ [key]: { version: 1, generation: 'layout', partCount: 1 }, [`${key}:layout:0`]: JSON.stringify(group) })
  }, group)
  const savedSettings = await extensionWorker.evaluate(async () => (await chrome.storage.sync.get('yunji-tab:settings'))['yunji-tab:settings'])
  try {
    for (const [language, messages] of Object.entries(bookmarkGroupMessages)) {
      await extensionWorker.evaluate(async language => chrome.storage.sync.set({ 'yunji-tab:settings': JSON.stringify({ language, theme: language === 'fr' ? 'dark' : 'light', appearance: { navLayout: language === 'en' ? 'top' : 'sidebar' } }) }), language)
      await newTabPage.reload()
      await newTabPage.getByRole('button', { name: new RegExp(`^${messages.bookmarkGroups}`) }).click()
      for (const width of [375, 1280]) {
        await newTabPage.setViewportSize({ width, height: 900 })
        if (language === 'en' && width === 1280) {
          const nav = newTabPage.getByRole('navigation', { name: 'Bookmark categories' })
          const groupBounds = await nav.getByRole('button', { name: /^Bookmark groups/ }).boundingBox()
          const allBounds = await nav.getByRole('button', { name: /All/ }).first().boundingBox()
          expect(groupBounds!.width).toBeLessThan(300)
          expect(Math.abs(groupBounds!.y - allBounds!.y)).toBeLessThan(2)
        }
        const viewName = messages.viewNamedGroup.replace('{name}', group.title)
        await expect(newTabPage.getByRole('button', { name: viewName, exact: true })).toBeVisible()
        await expect.poll(() => newTabPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        await newTabPage.screenshot({ path: `/tmp/yunji-tab-groups-${language}-${width}-cards.png`, fullPage: true })
        await newTabPage.getByRole('button', { name: viewName, exact: true }).click()
        await expect(newTabPage.getByRole('button', { name: messages.openGroupBookmark.replace('{name}', group.bookmarks[0].title), exact: true })).toBeEnabled()
        await newTabPage.getByRole('button', { name: messages.editBookmarkGroup, exact: true }).click()
        const dialog = newTabPage.getByRole('dialog')
        await expect(dialog.getByLabel(messages.groupTitle, { exact: true })).toHaveValue(group.title)
        await dialog.evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))))
        await expect.poll(() => dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
        if (language === 'zh-CN' || language === 'fr')
          expect((await new AxeBuilder({ page: newTabPage }).analyze()).violations.filter(item => ['critical', 'serious'].includes(item.impact ?? ''))).toEqual([])
        await newTabPage.screenshot({ path: `/tmp/yunji-tab-groups-${language}-${width}-editor.png`, fullPage: true })
        await newTabPage.keyboard.press('Escape')
        await expect(dialog).toBeHidden()
        await newTabPage.getByRole('button', { name: messages.backToGroups, exact: true }).click()
      }
    }
  }
  finally {
    await extensionWorker.evaluate(async ({ savedSettings }) => {
      if (savedSettings === undefined)
        await chrome.storage.sync.remove('yunji-tab:settings')
      else
        await chrome.storage.sync.set({ 'yunji-tab:settings': savedSettings })
    }, { savedSettings })
  }
})

test('pins groups alongside ordinary bookmarks and syncs unpinning to another home page', async ({ extensionContext, extensionWorker, newTabPage }) => {
  await extensionWorker.evaluate(async () => chrome.bookmarks.create({ parentId: '1', title: 'Group favorite source', url: 'https://example.com/group-favorite' }))
  await newTabPage.reload()
  const nav = newTabPage.getByRole('navigation', { name: '书签分类' })
  await nav.getByRole('button', { name: /^书签组/ }).click()
  // Wait for the lazy group view before clearing pins left by earlier tests.
  await expect(newTabPage.getByRole('button', { name: '创建书签组', exact: true })).toBeVisible()
  const existingPins = newTabPage.getByRole('button', { name: /^取消置顶 / })
  while (await existingPins.count()) {
    const count = await existingPins.count()
    await existingPins.first().click()
    await expect(existingPins).toHaveCount(count - 1)
  }
  await newTabPage.getByRole('button', { name: '创建书签组', exact: true }).click()
  const dialog = newTabPage.getByRole('dialog')
  await dialog.getByLabel('组标题', { exact: true }).fill('星标测试组')
  await dialog.getByLabel('搜索已有书签', { exact: true }).fill('Group favorite source')
  await dialog.getByRole('checkbox', { name: /^Group favorite source / }).check()
  await dialog.getByLabel('组内标题', { exact: true }).fill('常用文档')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toBeHidden()
  await newTabPage.getByRole('button', { name: '置顶 星标测试组', exact: true }).click()
  await expect(newTabPage.getByRole('button', { name: '取消置顶 星标测试组', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const pinnedCategory = nav.getByRole('button', { name: /置顶/ })
  if (!await pinnedCategory.isVisible())
    await nav.getByRole('button', { name: /^智能分类/ }).click()
  await pinnedCategory.click()
  await expect(pinnedCategory).toContainText('1')
  await expect(newTabPage.getByRole('button', { name: '查看书签组 星标测试组', exact: true })).toBeVisible()
  await expect(newTabPage.getByText('打开书签后，猫咪会帮你记在这里', { exact: true })).toHaveCount(0)
  await expect(newTabPage.getByText('打开书签后会在这里留下记录', { exact: true })).toHaveCount(0)
  await nav.getByRole('button', { name: /全部/ }).click()
  await newTabPage.getByRole('button', { name: '置顶 Group favorite source', exact: true }).click()
  await pinnedCategory.click()
  await expect(pinnedCategory).toContainText('2')
  await expect(newTabPage.getByRole('button', { name: '查看书签组 星标测试组', exact: true })).toBeVisible()
  await expect(newTabPage.getByText('Group favorite source', { exact: true })).toBeVisible()
  await newTabPage.screenshot({ path: '/tmp/yunji-tab-pinned-groups.png', fullPage: true })
  const other = await extensionContext.newPage()
  try {
    await other.goto(newTabPage.url())
    await other.getByRole('navigation', { name: '书签分类' }).getByRole('button', { name: /^书签组/ }).click()
    await expect(other.getByRole('button', { name: '取消置顶 星标测试组', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await newTabPage.getByRole('button', { name: '查看书签组 星标测试组', exact: true }).click()
    await expect(newTabPage.getByRole('button', { name: '打开书签 常用文档', exact: true })).toBeEnabled()
    await newTabPage.getByRole('button', { name: '编辑书签组', exact: true }).click()
    const oldEditor = newTabPage.getByRole('dialog')
    await oldEditor.getByLabel('组描述（可选）', { exact: true }).fill('保留这段未保存内容')
    await other.getByRole('button', { name: '取消置顶 星标测试组', exact: true }).click()
    await expect(newTabPage.locator('nav[aria-label="书签分类"]').getByRole('button', { name: /置顶/, includeHidden: true })).toContainText('1')
    await expect(oldEditor).toBeVisible()
    await expect(oldEditor.getByLabel('组描述（可选）', { exact: true })).toHaveValue('保留这段未保存内容')
    await oldEditor.getByRole('button', { name: '保存', exact: true }).click()
    await expect(oldEditor).toBeHidden()
    await expect(newTabPage.getByRole('button', { name: '打开书签 常用文档', exact: true })).toHaveCount(0)
    await expect(newTabPage.getByText('Group favorite source', { exact: true })).toBeVisible()
    await other.reload()
    await other.getByRole('navigation', { name: '书签分类' }).getByRole('button', { name: /^书签组/ }).click()
    await expect(other.getByRole('button', { name: '置顶 星标测试组', exact: true })).toHaveAttribute('aria-pressed', 'false')
    await expect(other.getByText('保留这段未保存内容', { exact: true })).toBeVisible()
  }
  finally {
    await other.close()
  }
})
