import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './extension.fixture'

async function expectNoAccessibilityViolations(page: Page) {
  await page.waitForTimeout(250)
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
}

async function openHeaderAction(page: Page, name: string) {
  const action = page.getByRole('menuitem', { name, exact: true })
  await page.getByRole('button', { name: '更多操作', exact: true }).click()
  await action.click()
}

test('allows multiple home tabs by default and reuses them when enabled', async ({
  extensionWorker,
  newTabPage,
}) => {
  await extensionWorker.evaluate(async () => {
    const key = 'yunji-tab:settings'
    const stored = await chrome.storage.sync.get(key)
    const settings = typeof stored[key] === 'string'
      ? JSON.parse(stored[key]) as Record<string, unknown>
      : {}
    await chrome.storage.sync.set({
      [key]: JSON.stringify({ ...settings, singleHomeTab: false }),
    })
  })
  const existingTabId = await newTabPage.evaluate(async () =>
    (await chrome.tabs.getCurrent()).id)

  await openHeaderAction(newTabPage, '打开设置')
  await expect(newTabPage.getByText('只保留一个云吉 Tab 主页')).toBeVisible()
  const singleHomeTabCheckbox = newTabPage.locator('#single-home-tab')
  await expect(singleHomeTabCheckbox).not.toBeChecked()
  await newTabPage.keyboard.press('Escape')

  const createdTabId = await extensionWorker.evaluate(async () =>
    (await chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html') })).id)

  await expect.poll(async () => extensionWorker.evaluate(async createdTabId =>
    chrome.tabs.get(createdTabId!).then(() => true).catch(() => false), createdTabId)).toBe(true)

  await newTabPage.bringToFront()
  await openHeaderAction(newTabPage, '打开设置')
  await singleHomeTabCheckbox.click()
  await expect(singleHomeTabCheckbox).toBeChecked()

  await expect.poll(async () => extensionWorker.evaluate(async ({ createdTabId }) => {
    const homeUrl = chrome.runtime.getURL('newtab.html')
    const homeTabs = (await chrome.tabs.query({}))
      .filter(tab => tab.url?.startsWith(homeUrl))
    const createdTabStillExists = await chrome.tabs.get(createdTabId!)
      .then(() => true)
      .catch(() => false)

    return {
      activeTabId: homeTabs.find(tab => tab.active)?.id,
      createdTabStillExists,
      homeTabCount: homeTabs.length,
    }
  }, { createdTabId })).toEqual({
    activeTabId: existingTabId,
    createdTabStillExists: false,
    homeTabCount: 1,
  })

  await extensionWorker.evaluate(async () => {
    const key = 'yunji-tab:settings'
    const stored = await chrome.storage.sync.get(key)
    const settings = typeof stored[key] === 'string'
      ? JSON.parse(stored[key]) as Record<string, unknown>
      : {}
    await chrome.storage.sync.set({
      [key]: JSON.stringify({ ...settings, singleHomeTab: false }),
    })
  })
})

test('loads the real extension and manages a native bookmark', async ({
  extensionWorker,
  newTabPage,
}) => {
  await expect(newTabPage.getByText('云吉 Tab', { exact: false }).first()).toBeVisible()
  await newTabPage.getByLabel('添加书签', { exact: true }).click()
  await newTabPage.getByPlaceholder('github.com').fill('https://example.com/e2e')
  await newTabPage.getByPlaceholder('如：GitHub').fill('E2E Example')
  await newTabPage.getByRole('button', { name: '添加', exact: true }).click()

  await expect(newTabPage.getByText('E2E Example', { exact: true })).toBeVisible()
  const matches = await extensionWorker.evaluate(async () =>
    chrome.bookmarks.search({ url: 'https://example.com/e2e' }))
  expect(matches).toHaveLength(1)
})

test('limits the initial bookmark render batch', async ({
  extensionWorker,
  newTabPage,
}) => {
  const folderId = await extensionWorker.evaluate(async () => {
    const folder = await chrome.bookmarks.create({
      parentId: '1',
      title: 'E2E Batch Folder',
    })
    for (let index = 0; index < 60; index += 1) {
      await chrome.bookmarks.create({
        parentId: folder.id,
        title: `E2E Batch ${index}`,
        url: `https://example.com/batch-${index}`,
      })
    }
    return folder.id
  })
  try {
    await newTabPage.reload()
    await newTabPage
      .locator('button[aria-pressed]')
      .filter({ hasText: 'E2E Batch Folder' })
      .click()

    await expect(newTabPage.locator('a[data-nav-item]')).toHaveCount(50)
    await newTabPage.getByRole('button', { name: '加载更多（剩余 10 项）' }).click()
    await expect(newTabPage.locator('a[data-nav-item]')).toHaveCount(60)
  }
  finally {
    await extensionWorker.evaluate(async id => chrome.bookmarks.removeTree(id), folderId)
  }
})

test('reorders native bookmarks by dragging cards in a category', async ({
  extensionWorker,
  newTabPage,
}) => {
  const folderId = await extensionWorker.evaluate(async () => {
    const folder = await chrome.bookmarks.create({
      parentId: '1',
      title: 'E2E Sort Folder',
    })
    await chrome.bookmarks.create({
      parentId: folder.id,
      title: 'E2E Sort First',
      url: 'https://example.com/sort-first-e2e',
    })
    await chrome.bookmarks.create({
      parentId: folder.id,
      title: 'E2E Sort Second',
      url: 'https://example.com/sort-second-e2e',
    })
    return folder.id
  })
  await newTabPage.reload()
  await newTabPage
    .getByRole('button', { name: /E2E Sort Folder/ })
    .first()
    .click()
  await expect(newTabPage.getByText('E2E Sort First', { exact: true }))
    .toBeVisible()

  const source = newTabPage.getByLabel('拖动书签 E2E Sort First')
  const target = newTabPage
    .locator('article')
    .filter({ hasText: 'E2E Sort Second' })
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  expect(sourceBox).not.toBeNull()
  expect(targetBox).not.toBeNull()

  await newTabPage.mouse.move(
    sourceBox!.x + sourceBox!.width / 2,
    sourceBox!.y + sourceBox!.height / 2,
  )
  await newTabPage.mouse.down()
  await newTabPage.mouse.move(
    sourceBox!.x + sourceBox!.width / 2 + 10,
    sourceBox!.y + sourceBox!.height / 2,
  )
  await newTabPage.mouse.move(
    targetBox!.x + targetBox!.width / 2,
    targetBox!.y + targetBox!.height / 2,
    { steps: 8 },
  )
  await newTabPage.mouse.up()

  await expect(
    newTabPage.getByText('已将“E2E Sort First”移到“E2E Sort Second”之后'),
  ).toBeVisible()
  await expect.poll(async () => extensionWorker.evaluate(async parentId =>
    (await chrome.bookmarks.getChildren(parentId))
      .filter(node => node.url)
      .map(node => node.title), folderId)).toEqual([
    'E2E Sort Second',
    'E2E Sort First',
  ])
})

test('separates local bookmark search from web search', async ({
  extensionWorker,
  newTabPage,
}) => {
  const url = 'https://example.com/search-mode-e2e'
  await extensionWorker.evaluate(async (targetUrl) => {
    const existing = await chrome.bookmarks.search({ url: targetUrl })
    if (existing.length === 0) {
      await chrome.bookmarks.create({
        parentId: '1',
        title: 'E2E Search Mode Target',
        url: targetUrl,
      })
    }
  }, url)
  await newTabPage.reload()

  const bookmarkSearch = newTabPage.getByLabel('搜索书签和目录')
  await bookmarkSearch.fill('E2E Search Mode Target')
  await expect(newTabPage.getByText('E2E Search Mode Target', { exact: true })).toBeVisible()
  await expect(newTabPage.getByRole('button', { name: '打开首个书签结果' })).toBeVisible()

  await newTabPage.getByRole('radio', { name: '搜索网页' }).click()
  await expect(newTabPage.getByLabel('搜索网页或输入网址')).toHaveValue('E2E Search Mode Target')
  await expect(newTabPage.getByRole('button', { name: '搜索网页' }).last()).toBeVisible()

  const engineTrigger = newTabPage.getByRole('button', { name: '选择网页搜索引擎' })
  await engineTrigger.focus()
  await newTabPage.keyboard.press('Enter')
  const engineOptions = newTabPage.getByRole('menuitemradio')
  await expect(engineOptions.first()).toBeFocused()
  await newTabPage.keyboard.press('ArrowDown')
  await expect(engineOptions.nth(1)).toBeFocused()
  await newTabPage.keyboard.press('Escape')
  await expect(newTabPage.getByLabel('搜索网页或输入网址')).toBeFocused()

  await newTabPage.getByRole('radio', { name: '搜索书签' }).click()
  await expect(bookmarkSearch).toHaveValue('E2E Search Mode Target')

  await bookmarkSearch.press('Enter')
  await expect.poll(async () => extensionWorker.evaluate(async (targetUrl) => {
    const tab = (await chrome.tabs.query({})).find(item => item.url === targetUrl)
    return tab?.id ?? 0
  }, url)).not.toBe(0)
  await extensionWorker.evaluate(async (targetUrl) => {
    const tab = (await chrome.tabs.query({})).find(item => item.url === targetUrl)
    if (tab?.id)
      await chrome.tabs.remove(tab.id)
  }, url)
})

test('requires an explicit destination before bulk moving bookmarks', async ({
  extensionWorker,
  newTabPage,
}) => {
  const seeded = await extensionWorker.evaluate(async () => {
    const folder = await chrome.bookmarks.create({
      parentId: '1',
      title: 'E2E Bulk Destination',
    })
    await chrome.bookmarks.create({
      parentId: '1',
      title: 'E2E Bulk Safety',
      url: 'https://example.com/bulk-safety-e2e',
    })
    return { destinationId: `cat-${folder.id}` }
  })
  await newTabPage.reload()

  await newTabPage.getByRole('button', { name: '批量管理' }).click()
  const destination = newTabPage.getByLabel('批量移动目标目录')
  const move = newTabPage.getByRole('button', { name: '移动', exact: true })
  await expect(destination).toHaveValue('')
  await newTabPage.getByLabel('选择 E2E Bulk Safety').click()
  await expect(move).toBeDisabled()
  await destination.selectOption(seeded.destinationId)
  await expect(move).toBeEnabled()
  await newTabPage.getByRole('button', { name: '退出批量管理' }).click()
})

test('shows duplicate handling and the settings surfaces', async ({
  extensionWorker,
  newTabPage,
}) => {
  await extensionWorker.evaluate(async () => {
    const existing = await chrome.bookmarks.search({ url: 'https://example.com/e2e' })
    if (existing.length === 0) {
      await chrome.bookmarks.create({
        parentId: '1',
        title: 'E2E Example',
        url: 'https://example.com/e2e',
      })
    }
  })
  await newTabPage.reload()
  await newTabPage.getByLabel('添加书签', { exact: true }).click()
  await newTabPage.getByPlaceholder('github.com').fill('https://example.com/e2e#duplicate')
  await newTabPage.getByPlaceholder('如：GitHub').fill('Duplicate')
  await expect(newTabPage.getByText('这个网址已经收藏')).toBeVisible()
  await newTabPage.getByRole('button', { name: '取消' }).click()

  await openHeaderAction(newTabPage, '打开设置')
  await expect(newTabPage.getByRole('heading', { name: '设置' })).toBeVisible()
  await newTabPage.getByRole('tab', { name: '外观' }).click()
  await expect(newTabPage.getByText('整体风格')).toBeVisible()
  const kamiStyle = newTabPage.getByRole('radio', { name: '纸墨', exact: true })
  await kamiStyle.click()
  await expect(kamiStyle).toHaveAttribute('data-state', 'on')
  await expect(newTabPage.getByRole('link', { name: '查看纸墨风格来源项目' })).toHaveAttribute('href', 'https://github.com/tw93/Kami')
  const advancedAppearance = newTabPage.getByRole('button', { name: '高级自定义' })
  await advancedAppearance.focus()
  await expect.poll(() => advancedAppearance.evaluate(element =>
    getComputedStyle(element).boxShadow)).not.toBe('none')
  await advancedAppearance.click()
  await expect(newTabPage.getByText('布局与表面')).toBeVisible()
  await expect(newTabPage.getByLabel('主题配色')).toHaveValue('kami')
  await expect(newTabPage.getByRole('option', { name: '纸墨专属配色（由整体风格启用）' })).toHaveAttribute('disabled', '')
  await newTabPage.getByRole('tab', { name: '数据与隐私' }).click()
  await expect(newTabPage.getByText('数据备份')).toBeVisible()
  await expect(newTabPage.getByText('隐私与本地数据')).toBeVisible()
  await expect(newTabPage.getByText('跨设备同步')).toBeVisible()
  await expect(newTabPage.getByText(/需要在 Chrome 登录 Google 账号并开启同步/)).toBeVisible()
  await newTabPage.getByRole('button', { name: '了解同步方式' }).click()
  await expect(newTabPage.getByRole('heading', { name: '跨设备同步如何工作' })).toBeVisible()
  await expect(newTabPage.getByText(/不会把数据上传到 Yunji Tab 自建服务器/)).toBeVisible()
  await expect(newTabPage.getByText(/登录同一个 Google 账号/)).toBeVisible()
  await newTabPage.keyboard.press('Escape')
  await newTabPage.getByRole('button', { name: '高级同步设置' }).click()
  await expect(newTabPage.getByText('同步范围')).toBeVisible()
  await expect(newTabPage.getByText('可选加密')).toBeVisible()
  await newTabPage.getByLabel('收件箱').click()
  await newTabPage.getByLabel('同步加密口令').fill('e2e-passphrase')
  await newTabPage.getByRole('button', { name: '启用加密' }).click()
  await expect(newTabPage.getByText('同步加密口令已保存在本机')).toBeVisible()

  const syncSettings = await extensionWorker.evaluate(async () => {
    const rawSettings = (await chrome.storage.sync.get('yunji-tab:settings'))['yunji-tab:settings']
    const rawPassphrase = (await chrome.storage.local.get('yunji-tab:metadata-sync-passphrase'))['yunji-tab:metadata-sync-passphrase']
    const settings = typeof rawSettings === 'string' ? JSON.parse(rawSettings) : rawSettings
    return { settings, rawPassphrase }
  })
  expect(syncSettings.settings.metadataSyncScope.inboxAt).toBe(false)
  expect(syncSettings.settings.metadataSyncEncryptionEnabled).toBe(true)
  expect(String(syncSettings.rawPassphrase)).toContain('e2e-passphrase')

  await newTabPage.getByRole('tab', { name: '内容补全' }).click()
  await expect(newTabPage.getByRole('heading', { name: '补全网站描述' })).toBeVisible()
  await expect(newTabPage.getByText('跨设备同步')).toHaveCount(0)
})

test('supports settings tab keyboard navigation and labeled bookmark fields', async ({ newTabPage }) => {
  await openHeaderAction(newTabPage, '打开设置')
  const generalTab = newTabPage.getByRole('tab', { name: '常规' })
  const appearanceTab = newTabPage.getByRole('tab', { name: '外观' })
  const shortcutsTab = newTabPage.getByRole('tab', { name: '快捷键' })
  const searchTab = newTabPage.getByRole('tab', { name: '搜索' })
  const aboutTab = newTabPage.getByRole('tab', { name: '关于' })

  await expect(generalTab).toHaveAttribute('aria-controls', 'settings-panel-general')
  await generalTab.focus()
  await newTabPage.keyboard.press('ArrowDown')
  await expect(appearanceTab).toHaveAttribute('aria-selected', 'true')
  await newTabPage.keyboard.press('ArrowRight')
  await expect(shortcutsTab).toHaveAttribute('aria-selected', 'true')
  await newTabPage.keyboard.press('ArrowRight')
  await expect(searchTab).toHaveAttribute('aria-selected', 'true')
  await newTabPage.keyboard.press('End')
  await expect(aboutTab).toHaveAttribute('aria-selected', 'true')
  await expect(newTabPage.getByText('云吉 Tab 是由 kiwi 构建的免费开源项目。'))
    .toBeVisible()
  await expect(newTabPage.getByRole('link', { name: /查看项目源码/ }))
    .toHaveAttribute('href', 'https://github.com/kiwiflydream/yunji-tab')
  await expect(newTabPage.getByRole('link', { name: /在 X 上关注 kiwi/ }))
    .toHaveAttribute('href', 'https://x.com/kiwiflysky')
  await newTabPage.keyboard.press('Home')
  await expect(generalTab).toHaveAttribute('aria-selected', 'true')
  await newTabPage.keyboard.press('Escape')

  await newTabPage.getByLabel('添加书签', { exact: true }).click()
  await newTabPage.getByLabel('网址', { exact: true }).fill('https://example.com/a11y')
  await newTabPage.getByLabel('名称', { exact: true }).fill('A11y Example')
  await expect(newTabPage.getByLabel('分类', { exact: true })).toBeVisible()
  await expect(newTabPage.getByLabel('备用 URL（可选）')).toBeHidden()
  await newTabPage.getByRole('button', { name: '更多选项' }).click()
  await expect(newTabPage.getByLabel('备用 URL（可选）')).toBeVisible()
  await expect(newTabPage.getByRole('button', { name: '获取网站信息' })).toBeVisible()
  await newTabPage.keyboard.press('Escape')
})

test('records, validates, and applies a custom home-page shortcut', async ({
  extensionWorker,
  newTabPage,
}) => {
  await newTabPage.setViewportSize({ width: 375, height: 812 })
  await openHeaderAction(newTabPage, '打开设置')
  const settingsDialog = newTabPage.getByRole('dialog', { name: '设置' })
  await expect.poll(() => settingsDialog.evaluate(element =>
    element.scrollWidth <= element.clientWidth)).toBe(true)
  await newTabPage.getByRole('tab', { name: '快捷键' }).click()
  await expect(newTabPage.getByText('快速收藏当前页')).toBeVisible()
  const globalCommandRow = newTabPage
    .getByText('全局命令面板', { exact: true })
    .locator('..')
  await expect(globalCommandRow.getByText('未分配', { exact: true }))
    .toBeVisible()
  const globalShortcutSearch = newTabPage.getByRole('switch', {
    name: '启用全局快捷搜索',
  })
  await expect(globalShortcutSearch).not.toBeChecked()
  await expect.poll(() => settingsDialog.evaluate(element =>
    element.scrollWidth <= element.clientWidth)).toBe(true)
  await globalShortcutSearch.click()
  await expect(globalShortcutSearch).toBeChecked()
  await expect.poll(() => extensionWorker.evaluate(async () => {
    const raw = (await chrome.storage.sync.get('yunji-tab:settings'))[
      'yunji-tab:settings'
    ]
    const settings = typeof raw === 'string' ? JSON.parse(raw) : raw
    return settings.globalCommandPaletteEnabled
  })).toBe(true)
  await globalShortcutSearch.click()
  await expect(globalShortcutSearch).not.toBeChecked()
  await expect(newTabPage.getByText(/chrome:\/\/extensions\/shortcuts/))
    .toBeVisible()
  await expect(newTabPage.getByText('打开后请在列表中找到“云吉 Tab”。'))
    .toBeVisible()
  const [browserShortcutSettingsPage] = await Promise.all([
    newTabPage.context().waitForEvent('page'),
    newTabPage.getByRole('button', { name: '去浏览器修改' }).click(),
  ])
  await expect.poll(() => browserShortcutSettingsPage.url())
    .toBe('chrome://extensions/shortcuts')
  await browserShortcutSettingsPage.close()

  const recorder = newTabPage.getByRole('button', {
    name: /^修改: 打开命令面板/,
  })
  await recorder.click()
  await newTabPage.keyboard.press('n')
  await expect(newTabPage.getByText('该快捷键已被“新增书签”使用。'))
    .toBeVisible()
  await newTabPage.keyboard.press('ControlOrMeta+Shift+P')
  await expect(recorder).toHaveAccessibleName(/(⌘ ⇧ P|Ctrl \+ Shift \+ P)/)

  const persistedShortcut = await extensionWorker.evaluate(async () => {
    const raw = (await chrome.storage.sync.get('yunji-tab:settings'))[
      'yunji-tab:settings'
    ]
    const settings = typeof raw === 'string' ? JSON.parse(raw) : raw
    return settings.keyboardShortcuts.openCommandPalette
  })
  expect(persistedShortcut).toEqual({
    key: 'p',
    primary: true,
    alt: false,
    shift: true,
  })

  await newTabPage.keyboard.press('Escape')
  await newTabPage.keyboard.press('ControlOrMeta+Shift+P')
  await expect(newTabPage.getByRole('heading', { name: '命令面板' }))
    .toBeVisible()
  await newTabPage.keyboard.press('Escape')

  await openHeaderAction(newTabPage, '打开设置')
  await newTabPage.getByRole('tab', { name: '快捷键' }).click()
  await newTabPage.getByRole('button', { name: '恢复默认' }).click()
})

test('keeps global shortcut search disabled by default', async ({
  extensionContext,
  extensionWorker,
  newTabPage,
}) => {
  await extensionWorker.evaluate(async () => {
    const key = 'yunji-tab:settings'
    const stored = await chrome.storage.sync.get(key)
    const settings = typeof stored[key] === 'string'
      ? JSON.parse(stored[key]) as Record<string, unknown>
      : {}
    delete settings.globalCommandPaletteEnabled
    await chrome.storage.sync.set({ [key]: JSON.stringify(settings) })
  })
  const page = await extensionContext.newPage()
  await page.goto('https://www.google.com/robots.txt')
  const tabId = await extensionWorker.evaluate(async targetUrl =>
    (await chrome.tabs.query({})).find(tab => tab.url === targetUrl)?.id, page.url())

  const response = await newTabPage.evaluate(async targetTabId =>
    chrome.runtime.sendMessage({
      type: 'yunji-tab:global-palette-open-for-tab',
      tabId: targetTabId,
    }), tabId)

  expect(response).toEqual({ ok: false })
  await expect(page.locator('#yunji-tab-global-command-palette')).toHaveCount(0)
  await page.close()
})

test('opens the global command palette on a regular web page', async ({
  extensionContext,
  extensionWorker,
  newTabPage,
}) => {
  const primaryUrl = 'https://global-palette.invalid/e2e'
  const alternateUrl
    = 'https://www.google.com/robots.txt?yunji-global-palette=e2e'
  const scrollBookmarkIds = await extensionWorker.evaluate(async ({ alternateUrl, primaryUrl }) => {
    const settingsKey = 'yunji-tab:settings'
    const storedSettings = await chrome.storage.sync.get(settingsKey)
    const settings = typeof storedSettings[settingsKey] === 'string'
      ? JSON.parse(storedSettings[settingsKey]) as Record<string, unknown>
      : {}
    await chrome.storage.sync.set({
      [settingsKey]: JSON.stringify({
        ...settings,
        globalCommandPaletteEnabled: true,
      }),
    })
    const existing = await chrome.bookmarks.search({
      url: primaryUrl,
    })
    if (existing.length === 0) {
      await chrome.bookmarks.create({
        parentId: '1',
        title: 'E2E Global Palette Target',
        url: primaryUrl,
      })
    }
    const stored = await chrome.storage.local.get('yunji-tab:meta')
    const meta = typeof stored['yunji-tab:meta'] === 'string'
      ? JSON.parse(stored['yunji-tab:meta']) as Record<string, unknown>
      : {}
    meta[primaryUrl] = { alternateUrls: [alternateUrl] }
    await chrome.storage.local.set({
      'yunji-tab:meta': JSON.stringify(meta),
    })
    const createdIds: string[] = []
    for (let index = 0; index < 12; index += 1) {
      const bookmark = await chrome.bookmarks.create({
        parentId: '1',
        title: `E2E Global Scroll ${index}`,
        url: `https://global-scroll-${index}.invalid/e2e`,
      })
      createdIds.push(bookmark.id)
    }
    return createdIds
  }, { alternateUrl, primaryUrl })

  const page = await extensionContext.newPage()
  await page.goto('https://www.google.com/robots.txt')
  const hostOverflowBefore = await page.evaluate(() => ({
    body: document.body.style.overflow,
    document: document.documentElement.style.overflow,
  }))
  const tabId = await extensionWorker.evaluate(async targetUrl =>
    (await chrome.tabs.query({})).find(tab => tab.url === targetUrl)?.id, page.url())
  expect(tabId).toBeTruthy()
  const response = await newTabPage.evaluate(async targetTabId =>
    chrome.runtime.sendMessage({
      type: 'yunji-tab:global-palette-open-for-tab',
      tabId: targetTabId,
    }), tabId)
  expect(response).toEqual({ ok: true })
  await page.bringToFront()

  await expect(page.locator('#yunji-tab-global-command-palette')).toHaveCount(1)
  await expect.poll(() => page.frames().some(frame =>
    frame.url().includes('/tabs/global-command-palette.html'))).toBe(true)
  const paletteFrame = page.frames().find(frame =>
    frame.url().includes('/tabs/global-command-palette.html'))!
  const results = paletteFrame.locator('section')
  await expect(results).toBeVisible()
  await expect.poll(() => paletteFrame.evaluate(() => ({
    body: getComputedStyle(document.body).overflowY,
    document: getComputedStyle(document.documentElement).overflowY,
    results: getComputedStyle(document.querySelector('section')!).overflowY,
  }))).toEqual({ body: 'hidden', document: 'hidden', results: 'auto' })
  const scrollMetrics = await results.evaluate(element => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }))
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight)
  await results.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect.poll(() => results.evaluate(element => element.scrollTop))
    .toBeGreaterThan(0)
  expect(await page.evaluate(() => ({
    body: document.body.style.overflow,
    document: document.documentElement.style.overflow,
  }))).toEqual(hostOverflowBefore)
  const paletteSearch = paletteFrame.getByLabel('搜索书签')
  await paletteSearch.fill('E2E Global Palette Target')
  await expect(
    paletteFrame.getByText('E2E Global Palette Target', { exact: true }),
  ).toBeVisible()
  await paletteFrame
    .getByText('E2E Global Palette Target', { exact: true })
    .click()
  await expect(page.locator('#yunji-tab-global-command-palette')).toHaveCount(0)
  await expect.poll(() =>
    extensionWorker.evaluate(async () =>
      Object.keys(await chrome.storage.session.get(null)).filter(key =>
        key.startsWith('yunji-tab:global-palette-session:')).length)).toBe(0)
  await expect.poll(() =>
    extensionWorker.evaluate(async url =>
      (await chrome.tabs.query({})).filter(tab => tab.url === url).length, alternateUrl)).toBe(1)
  await expect.poll(() => extensionWorker.evaluate(async (url) => {
    const stored = await chrome.storage.local.get('yunji-tab:usage')
    const usage = typeof stored['yunji-tab:usage'] === 'string'
      ? JSON.parse(stored['yunji-tab:usage'])
      : {}
    return usage[url]?.openCount ?? 0
  }, primaryUrl)).toBe(1)
  await newTabPage.bringToFront()
  const homeSearch = newTabPage.getByLabel('搜索书签和目录')
  await homeSearch.fill('E2E Global Palette Target')
  await newTabPage
    .getByText('E2E Global Palette Target', { exact: true })
    .click()
  await expect.poll(() => extensionWorker.evaluate(async (url) => {
    const stored = await chrome.storage.local.get('yunji-tab:usage')
    const usage = typeof stored['yunji-tab:usage'] === 'string'
      ? JSON.parse(stored['yunji-tab:usage'])
      : {}
    return usage[url]?.openCount ?? 0
  }, primaryUrl)).toBe(2)
  await extensionWorker.evaluate(async ({ bookmarkIds, urls }) => {
    const ids = (await chrome.tabs.query({}))
      .filter(tab => tab.url !== undefined && urls.includes(tab.url))
      .flatMap(tab => tab.id === undefined ? [] : [tab.id])
    if (ids.length > 0)
      await chrome.tabs.remove(ids)
    await Promise.all(bookmarkIds.map(id => chrome.bookmarks.remove(id)))
  }, { bookmarkIds: scrollBookmarkIds, urls: [primaryUrl, alternateUrl] })
  await page.close()
})

test('opens both command palette shortcuts in the current home tab', async ({
  extensionWorker,
  newTabPage,
}) => {
  await extensionWorker.evaluate(async () => {
    const key = 'yunji-tab:settings'
    const stored = await chrome.storage.sync.get(key)
    const settings = typeof stored[key] === 'string'
      ? JSON.parse(stored[key]) as Record<string, unknown>
      : {}
    await chrome.storage.sync.set({
      [key]: JSON.stringify({
        ...settings,
        globalCommandPaletteEnabled: true,
        singleHomeTab: false,
      }),
    })
  })

  await newTabPage.keyboard.press('ControlOrMeta+k')
  await expect(newTabPage.getByRole('heading', { name: '命令面板' }))
    .toBeVisible()
  await newTabPage.keyboard.press('Escape')

  const homeTabId = await newTabPage.evaluate(async () =>
    (await chrome.tabs.getCurrent()).id)
  const tabCountBefore = await extensionWorker.evaluate(async () =>
    (await chrome.tabs.query({})).length)
  const response = await newTabPage.evaluate(async targetTabId =>
    chrome.runtime.sendMessage({
      type: 'yunji-tab:global-palette-open-for-tab',
      tabId: targetTabId,
    }), homeTabId)

  expect(response).toEqual({ ok: true })
  await expect(newTabPage.getByRole('heading', { name: '命令面板' }))
    .toBeVisible()
  expect(await newTabPage.evaluate(async () =>
    (await chrome.tabs.getCurrent()).id)).toBe(homeTabId)
  expect(await extensionWorker.evaluate(async () =>
    (await chrome.tabs.query({})).length)).toBe(tabCountBefore)
})

test('falls back to the home command palette on a restricted page', async ({
  extensionContext,
  extensionWorker,
  newTabPage,
}) => {
  const homeTabId = await newTabPage.evaluate(async () =>
    (await chrome.tabs.getCurrent()).id)
  await extensionWorker.evaluate(async () => {
    const key = 'yunji-tab:settings'
    const stored = await chrome.storage.sync.get(key)
    const settings = typeof stored[key] === 'string'
      ? JSON.parse(stored[key]) as Record<string, unknown>
      : {}
    await chrome.storage.sync.set({
      [key]: JSON.stringify({
        ...settings,
        globalCommandPaletteEnabled: true,
        singleHomeTab: true,
      }),
    })
  })
  await newTabPage.reload()
  await expect.poll(() => extensionWorker.evaluate(async expectedTabId =>
    (await chrome.storage.session.get('yunji-tab:home-tab-id'))[
      'yunji-tab:home-tab-id'
    ] === expectedTabId, homeTabId)).toBe(true)

  const restrictedPage = await extensionContext.newPage()
  await restrictedPage.goto('chrome://extensions/')
  const tabId = await extensionWorker.evaluate(async targetUrl =>
    (await chrome.tabs.query({})).find(tab => tab.url === targetUrl)?.id, restrictedPage.url())
  expect(tabId).toBeTruthy()

  const response = await newTabPage.evaluate(async targetTabId =>
    chrome.runtime.sendMessage({
      type: 'yunji-tab:global-palette-open-for-tab',
      tabId: targetTabId,
    }), tabId)
  expect(response).toEqual({ ok: true })
  await expect(
    newTabPage.getByRole('heading', { name: '命令面板' }),
  ).toBeVisible()
  expect(await newTabPage.evaluate(async () =>
    (await chrome.tabs.getCurrent()).id)).toBe(homeTabId)

  await extensionWorker.evaluate(async () => {
    const key = 'yunji-tab:settings'
    const stored = await chrome.storage.sync.get(key)
    const settings = typeof stored[key] === 'string'
      ? JSON.parse(stored[key]) as Record<string, unknown>
      : {}
    await chrome.storage.sync.set({
      [key]: JSON.stringify({ ...settings, singleHomeTab: false }),
    })
  })
  await restrictedPage.close()
})

test('switches and persists the interface language', async ({
  extensionWorker,
  newTabPage,
}) => {
  await openHeaderAction(newTabPage, '打开设置')
  const language = newTabPage.locator('#interface-language')

  await language.selectOption('en')
  await expect(newTabPage.getByRole('heading', { name: 'Settings' }))
    .toBeVisible()
  await newTabPage.getByRole('tab', { name: 'Appearance' }).click()
  await expect(newTabPage.getByText('Light and dark mode', { exact: true }))
    .toBeVisible()
  await expect(newTabPage.getByText('Overall style', { exact: true }))
    .toBeVisible()
  await expect(newTabPage.getByRole('radio', { name: 'Light', exact: true }))
    .toBeVisible()
  await expect(newTabPage.getByText('明暗模式', { exact: true })).toHaveCount(0)
  await newTabPage.getByRole('tab', { name: 'General' }).click()
  await expect.poll(async () => extensionWorker.evaluate(async () => {
    const raw = (await chrome.storage.sync.get('yunji-tab:settings'))['yunji-tab:settings']
    const settings = typeof raw === 'string' ? JSON.parse(raw) : raw
    return settings.language
  })).toBe('en')

  for (const [value, heading, appearance, overallStyle, general] of [
    ['zh-TW', '設定', '外觀', '整體風格', '一般'],
    ['ja', '設定', '外観', '全体のスタイル', '一般'],
    ['ko', '설정', '모양', '전체 스타일', '일반'],
    ['es', 'Configuración', 'Apariencia', 'Estilo general', 'General'],
    ['fr', 'Paramètres', 'Apparence', 'Style général', 'Général'],
  ] as const) {
    await language.selectOption(value)
    await expect(newTabPage.getByRole('heading', { name: heading }))
      .toBeVisible()
    await newTabPage.getByRole('tab', { name: appearance }).click()
    await expect(newTabPage.getByText(overallStyle, { exact: true }))
      .toBeVisible()
    await newTabPage.getByRole('tab', { name: general }).click()
  }
  await language.selectOption('en')

  await newTabPage.keyboard.press('Escape')
  await expect(newTabPage.getByRole('button', { name: 'Add bookmark' }))
    .toBeVisible()
  await newTabPage
    .getByRole('button', { name: 'More actions', exact: true })
    .click()
  await newTabPage.getByRole('menuitem', { name: 'Open settings' }).click()
  await newTabPage.locator('#interface-language').selectOption('zh-CN')
  await expect(newTabPage.getByRole('heading', { name: '设置' })).toBeVisible()
  await newTabPage.getByRole('tab', { name: '外观' }).click()
  await expect(newTabPage.getByText('整体风格', { exact: true })).toBeVisible()
})

test('collapses smart categories while keeping the active item visible', async ({ newTabPage }) => {
  await openHeaderAction(newTabPage, '打开设置')
  const smartCategoriesSwitch = newTabPage
    .getByRole('dialog')
    .getByLabel('智能分类')
  if (!(await smartCategoriesSwitch.isChecked()))
    await smartCategoriesSwitch.click()
  await newTabPage.keyboard.press('Escape')

  const toggle = newTabPage.getByRole('button', { name: /^智能分类 \d+$/ })
  const inbox = newTabPage.locator('button[aria-pressed]').filter({ hasText: '收件箱' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(inbox).toBeHidden()

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(inbox).toBeVisible()
  await inbox.click()
  await toggle.click()

  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(inbox).toBeVisible()
  await expect(inbox).toHaveAttribute('aria-pressed', 'true')
})

test('persists and navigates the default sidebar category tree', async ({
  extensionWorker,
  newTabPage,
}) => {
  const runtimeErrors: string[] = []
  newTabPage.on('console', (message) => {
    const text = message.text()
    const expectedFaviconFallback
      = text.includes('https://www.google.com/s2/favicons')
        || text === 'Failed to load resource: net::ERR_FAILED'
    if (message.type() === 'error' && !expectedFaviconFallback)
      runtimeErrors.push(text)
  })
  newTabPage.on('pageerror', error => runtimeErrors.push(error.message))
  await extensionWorker.evaluate(async () => {
    const parent = await chrome.bookmarks.create({
      parentId: '1',
      title: 'E2E Tree Parent',
    })
    await chrome.bookmarks.create({
      parentId: parent.id,
      title: 'E2E Tree Child',
    })
  })
  await newTabPage.reload()

  await openHeaderAction(newTabPage, '打开设置')
  await expect(newTabPage.getByLabel('树状目录')).toBeChecked()
  await newTabPage.getByRole('tab', { name: '外观' }).click()
  await newTabPage.getByRole('radio', { name: '紧凑' }).click()
  await expect(newTabPage.getByRole('radio', { name: '紧凑' })).toBeChecked()
  await newTabPage.keyboard.press('Escape')

  const collapseParent = newTabPage.getByRole('button', { name: '折叠目录 E2E Tree Parent' })
  const childCategory = newTabPage.locator('button[aria-pressed]').filter({ hasText: 'E2E Tree Child' })
  await expect(collapseParent).toBeVisible()
  await expect(childCategory).toBeVisible()
  await expectNoAccessibilityViolations(newTabPage)
  await collapseParent.click()
  await expect(childCategory).toBeHidden()
  const expandParent = newTabPage.getByRole('button', { name: '展开目录 E2E Tree Parent' })
  await expect(expandParent).toBeVisible()
  await expandParent.click()
  await expect(childCategory).toBeVisible()
  await collapseParent.click()
  await expect(childCategory).toBeHidden()

  await newTabPage.keyboard.press('ControlOrMeta+k')
  await newTabPage.getByPlaceholder(/搜索书签、目录和操作/).fill('E2E Tree Child')
  await newTabPage.keyboard.press('Enter')
  await expect(childCategory).toBeVisible()
  await newTabPage.getByRole('button', { name: '折叠目录 E2E Tree Parent' }).click()
  await expect(childCategory).toBeHidden()

  await expect.poll(async () => extensionWorker.evaluate(async () => {
    const raw = (await chrome.storage.sync.get('yunji-tab:settings'))['yunji-tab:settings']
    const settings = typeof raw === 'string' ? JSON.parse(raw) : raw
    return settings.appearance.navItems.categoryTree
  })).toBe(true)

  await newTabPage.reload()
  await expect(newTabPage.getByRole('button', { name: '折叠目录 E2E Tree Parent' })).toBeVisible()
  await expect(childCategory).toBeVisible()

  await openHeaderAction(newTabPage, '打开设置')
  await newTabPage.getByLabel('树状目录').click()
  await newTabPage.keyboard.press('Escape')
  expect(runtimeErrors).toEqual([])
})

test('creates and applies auto organization rules', async ({
  extensionWorker,
  newTabPage,
}) => {
  const seeded = await extensionWorker.evaluate(async () => {
    const folder = await chrome.bookmarks.create({
      parentId: '1',
      title: 'E2E Auto Target',
    })
    const bookmark = await chrome.bookmarks.create({
      parentId: '1',
      title: 'E2E Auto Candidate',
      url: 'https://example.com/auto-rule-e2e',
    })
    const values = await chrome.storage.local.get('yunji-tab:meta')
    const meta = typeof values['yunji-tab:meta'] === 'string'
      ? JSON.parse(values['yunji-tab:meta'])
      : {}
    meta['https://example.com/auto-rule-e2e'] = { inboxAt: Date.now() }
    await chrome.storage.local.set({ 'yunji-tab:meta': JSON.stringify(meta) })
    return { folderId: folder.id, bookmarkId: bookmark.id }
  })

  await newTabPage.reload()
  await openHeaderAction(newTabPage, '打开设置')
  await newTabPage.getByRole('button', { name: '高级：自动整理规则' }).click()
  await expect(newTabPage.getByRole('heading', { name: '自动整理规则' })).toBeVisible()
  await newTabPage.getByLabel('规则名称').fill('E2E Auto Rule')
  await newTabPage.getByLabel('匹配内容').fill('auto-rule-e2e')
  await newTabPage.getByLabel('匹配字段').selectOption('url')
  await newTabPage.getByLabel('目标目录').selectOption(`cat-${seeded.folderId}`)
  await newTabPage.getByLabel('添加标签').fill('auto')
  await newTabPage.getByRole('button', { name: '添加规则' }).click()
  await expect(newTabPage.getByText('E2E Auto Rule')).toBeVisible()
  await newTabPage.getByRole('button', { name: '应用规则' }).click()
  await expect(newTabPage.getByText('已整理 1 个书签')).toBeVisible()

  const result = await extensionWorker.evaluate(async (input) => {
    const [node] = await chrome.bookmarks.get(input.bookmarkId)
    const raw = (await chrome.storage.local.get('yunji-tab:meta'))['yunji-tab:meta']
    const meta = typeof raw === 'string' ? JSON.parse(raw) : {}
    return {
      parentId: node.parentId,
      meta: meta['https://example.com/auto-rule-e2e'],
    }
  }, seeded)
  expect(result.parentId).toBe(seeded.folderId)
  expect(result.meta.tags).toEqual(['auto'])
  expect(result.meta.inboxAt).toBeUndefined()
})

test('has no critical axe violations on core extension surfaces', async ({ newTabPage }) => {
  await expectNoAccessibilityViolations(newTabPage)

  await openHeaderAction(newTabPage, '打开设置')
  await expect(newTabPage.getByRole('heading', { name: '设置' })).toBeVisible()
  await expectNoAccessibilityViolations(newTabPage)
  await newTabPage.keyboard.press('Escape')

  await newTabPage.getByLabel('添加书签', { exact: true }).click()
  await expect(newTabPage.getByRole('heading', { name: '添加书签' })).toBeVisible()
  await expectNoAccessibilityViolations(newTabPage)
})

test('keeps consolidated header actions keyboard accessible at narrow widths', async ({ newTabPage }) => {
  await newTabPage.setViewportSize({ width: 720, height: 800 })
  expect(newTabPage.url()).toMatch(/^chrome-extension:\/\//)
  await expect(newTabPage).toHaveTitle(/云吉 Tab/)
  await expect(newTabPage.locator('header').getByText('云吉 Tab', { exact: true })).toBeVisible()
  const runtimeErrors: string[] = []
  newTabPage.on('console', (message) => {
    if (message.type() === 'error')
      runtimeErrors.push(message.text())
  })
  newTabPage.on('pageerror', error => runtimeErrors.push(error.message))
  const moreButton = newTabPage.locator('button[aria-label="更多操作"]')

  await moreButton.focus()
  await newTabPage.keyboard.press('Enter')
  await expect(moreButton).toHaveAttribute('aria-expanded', 'true')
  const healthItem = newTabPage.getByRole('menuitem', { name: '打开书签健康检查' })
  await expect(healthItem).toBeFocused()
  await newTabPage.keyboard.press('ArrowDown')
  await expect(newTabPage.getByRole('menuitem', { name: '打开垃圾桶与历史' })).toBeFocused()
  await expect(newTabPage.getByRole('menuitem', { name: '打开设置' })).toBeVisible()
  await expect(newTabPage.getByRole('menuitem', { name: '管理标签页会话' })).toBeVisible()

  await newTabPage.keyboard.press('End')
  await expect(newTabPage.getByRole('menuitem', { name: '打开设置' })).toBeFocused()
  await newTabPage.keyboard.press('Enter')
  await expect(newTabPage.getByRole('heading', { name: '设置' })).toBeVisible()
  await expect(moreButton).toHaveAttribute('aria-expanded', 'false')
  await newTabPage.keyboard.press('Escape')

  await moreButton.click()
  await newTabPage.keyboard.press('Escape')
  await expect(moreButton).toHaveAttribute('aria-expanded', 'false')
  await expect(moreButton).toBeFocused()
  expect(runtimeErrors).toEqual([])
})

test('exposes session and activity management dialogs', async ({ newTabPage }) => {
  await openHeaderAction(newTabPage, '管理标签页会话')
  await expect(newTabPage.getByRole('heading', { name: '标签页会话' })).toBeVisible()
  await newTabPage.keyboard.press('Escape')

  await openHeaderAction(newTabPage, '打开垃圾桶与历史')
  await expect(newTabPage.getByRole('heading', { name: '垃圾桶与历史' })).toBeVisible()
  await newTabPage.keyboard.press('Escape')
})

test('hides the task center when no task needs attention', async ({ newTabPage }) => {
  await newTabPage.getByRole('button', { name: '更多操作', exact: true }).click()
  await expect(newTabPage.getByRole('menuitem', { name: '打开任务中心' })).toHaveCount(0)
})

test('saves deduped tab sessions and restores selected tabs', async ({
  extensionContext,
  extensionWorker,
  newTabPage,
}) => {
  await newTabPage.bringToFront()
  await Promise.all(
    extensionContext.pages()
      .filter(page => page !== newTabPage)
      .map(page => page.close()),
  )
  await extensionWorker.evaluate(async () => {
    await chrome.storage.local.remove('yunji-tab:tab-sessions')
  })
  const firstTab = await extensionContext.newPage()
  await firstTab.goto('https://example.com/session-a#one')
  const duplicateTab = await extensionContext.newPage()
  await duplicateTab.goto('https://EXAMPLE.com/session-a#two')
  const secondTab = await extensionContext.newPage()
  await secondTab.goto('https://example.com/session-b')
  const urls = await newTabPage.evaluate(async () => {
    const windows = await chrome.windows.getAll({ populate: true })
    return windows.flatMap(window => (window.tabs ?? []).map(tab => tab.url ?? ''))
  })
  expect(urls.join('\n')).toContain('https://example.com/session-a#one')

  await newTabPage.bringToFront()
  await openHeaderAction(newTabPage, '管理标签页会话')
  await newTabPage.getByPlaceholder('会话名称（可选）').fill('E2E Session')
  await newTabPage.getByRole('button', { name: '保存窗口' }).click()
  await expect(newTabPage.getByText('已保存 2 个去重标签')).toBeVisible()
  await expect(newTabPage.getByText(/2\s+个标签/)).toBeVisible()

  await newTabPage.getByRole('button', { name: /展开会话 E2E Session/ }).click()
  await expect(newTabPage.getByLabel('Example Domain').first()).toBeVisible()
  await newTabPage.getByLabel('Example Domain').last().click()

  const beforeRestore = await extensionWorker.evaluate(async () =>
    (await chrome.tabs.query({})).length)
  await newTabPage.getByRole('button', { name: '恢复会话 E2E Session' }).click()
  await expect(newTabPage.getByText('已恢复 1 个标签')).toBeVisible()
  const afterRestore = await extensionWorker.evaluate(async () =>
    (await chrome.tabs.query({})).length)
  expect(afterRestore).toBe(beforeRestore + 1)

  await newTabPage.getByRole('button', { name: '更新会话 E2E Session' }).click()
  await expect(newTabPage.getByText('已更新“E2E Session”')).toBeVisible()
  await firstTab.close()
  await duplicateTab.close()
  await secondTab.close()
})

test('previews and restores a deleted bookmark from persistent trash', async ({
  extensionWorker,
  newTabPage,
}) => {
  await extensionWorker.evaluate(async () => {
    await chrome.bookmarks.create({
      parentId: '1',
      title: 'E2E Trash',
      url: 'https://example.com/trash-e2e',
    })
  })
  await newTabPage.reload()
  await newTabPage.getByLabel('更多操作 E2E Trash').click()
  await newTabPage.getByRole('menuitem', { name: '删除书签' }).click()
  await expect(newTabPage.getByText('E2E Trash', { exact: true })).toHaveCount(0)

  await openHeaderAction(newTabPage, '打开垃圾桶与历史')
  await newTabPage.getByRole('button', { name: /恢复 书签“E2E Trash”/ }).click()
  await expect(newTabPage.getByRole('heading', { name: '恢复预览' })).toBeVisible()
  await newTabPage.getByRole('button', { name: '确认恢复' }).click()
  await expect(newTabPage.getByText('已恢复 1 项')).toBeVisible()
  await newTabPage.keyboard.press('Escape')

  const restored = await extensionWorker.evaluate(async () =>
    chrome.bookmarks.search({ url: 'https://example.com/trash-e2e' }))
  expect(restored).toHaveLength(1)
})

test('triages inbox bookmarks one by one', async ({ extensionWorker, newTabPage }) => {
  await extensionWorker.evaluate(async () => {
    await chrome.bookmarks.create({
      parentId: '1',
      title: 'E2E Inbox',
      url: 'https://example.com/inbox-e2e',
    })
    const values = await chrome.storage.local.get('yunji-tab:meta')
    const meta = typeof values['yunji-tab:meta'] === 'string'
      ? JSON.parse(values['yunji-tab:meta'])
      : {}
    meta['https://example.com/inbox-e2e'] = { inboxAt: Date.now() }
    await chrome.storage.local.set({ 'yunji-tab:meta': JSON.stringify(meta) })
    await chrome.storage.local.remove('yunji-tab:metadata-sync:local-document')
    await chrome.storage.sync.clear()
  })
  await newTabPage.reload()
  const smartCategoriesToggle = newTabPage.getByRole('button', {
    name: /^智能分类 \d+$/,
  })
  if (await smartCategoriesToggle.isVisible())
    await smartCategoriesToggle.click()
  await newTabPage
    .locator('button[aria-pressed]')
    .filter({ hasText: '收件箱' })
    .click()
  await expect(newTabPage.getByText('E2E Inbox', { exact: true })).toBeVisible()
  await newTabPage.getByRole('button', { name: '逐条整理' }).click()
  await expect(newTabPage.getByRole('heading', { name: '整理收件箱' })).toBeVisible()
  await newTabPage.getByRole('textbox', { name: '标签', exact: true }).fill('E2E, Review')
  await newTabPage.keyboard.press('Enter')
  await expect(newTabPage.getByRole('dialog').getByText('收件箱已整理完成').last()).toBeVisible()

  const savedMeta = await extensionWorker.evaluate(async () => {
    const raw = (await chrome.storage.local.get('yunji-tab:meta'))['yunji-tab:meta']
    return typeof raw === 'string' ? JSON.parse(raw) : {}
  })
  expect(savedMeta['https://example.com/inbox-e2e'].inboxAt).toBeUndefined()
  expect(savedMeta['https://example.com/inbox-e2e'].tags).toEqual(['E2E', 'Review'])
})
