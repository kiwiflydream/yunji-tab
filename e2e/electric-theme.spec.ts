import AxeBuilder from '@axe-core/playwright'
import { appearanceMessages } from '../src/lib/i18n-appearance'
import { expect, test } from './extension.fixture'

const screenshotDir = '/tmp/yunji-electric'
let seededFolderId: string | undefined

test.afterAll(async ({ extensionWorker }) => {
  // The browser profile is shared with later spec files; remove only our fixtures.
  await extensionWorker.evaluate(async (folderId) => {
    const key = 'yunji-tab:bookmark-group:electric-tools'
    const records = await chrome.storage.sync.get(null)
    await chrome.storage.sync.remove(Object.keys(records).filter(item => item === key || item.startsWith(`${key}:`)))
    if (folderId)
      await chrome.bookmarks.removeTree(folderId)
  }, seededFolderId)
})

test('selects Electric Blue, persists it and restores other theme styles', async ({ extensionWorker, newTabPage }) => {
  seededFolderId = await extensionWorker.evaluate(async () => {
    const folder = await chrome.bookmarks.create({ parentId: '1', title: '开发与设计' })
    for (const [title, url] of [
      ['MDN Web Docs', 'https://developer.mozilla.org/'],
      ['GitHub', 'https://github.com/'],
      ['Figma', 'https://www.figma.com/'],
      ['OpenAI', 'https://openai.com/'],
      ['维基百科', 'https://zh.wikipedia.org/'],
      ['Internet Archive', 'https://archive.org/'],
    ]) {
      await chrome.bookmarks.create({ parentId: folder.id, title, url })
    }
    const group = { id: 'electric-tools', title: '工作工具', description: '文档、代码与设计，一起开始', bookmarks: [{ id: 'electric-docs', title: '开发文档', url: 'https://developer.mozilla.org/' }] }
    const key = `yunji-tab:bookmark-group:${group.id}`
    await chrome.storage.sync.set({
      'yunji-tab:settings': JSON.stringify({ language: 'zh-CN', theme: 'dark', onboardingDismissed: true, appearance: { navLayout: 'top' } }),
      [key]: { version: 1, generation: 'electric', partCount: 1 },
      [`${key}:electric:0`]: JSON.stringify(group),
    })
    return folder.id
  })
  await newTabPage.reload()
  await newTabPage.setViewportSize({ width: 1280, height: 900 })
  await expect(newTabPage.getByText('MDN Web Docs', { exact: true })).toBeVisible()
  await newTabPage.getByRole('button', { name: '更多操作', exact: true }).click()
  await newTabPage.getByRole('menuitem', { name: '打开设置', exact: true }).click()
  await newTabPage.getByRole('tab', { name: '外观', exact: true }).click()
  await newTabPage.getByRole('radio', { name: '电光蓝', exact: true }).click()
  await expect(newTabPage.locator('html')).toHaveClass(/theme-electric/)
  await expect(newTabPage.locator('html')).not.toHaveClass(/dark/)
  await newTabPage.getByRole('button', { name: '高级自定义', exact: true }).click()
  await expect(newTabPage.getByRole('combobox', { name: '强调色', exact: true })).toBeDisabled()
  await expect(newTabPage.getByRole('combobox', { name: '背景', exact: true })).toBeDisabled()
  await expect(newTabPage.getByRole('combobox', { name: /^主题配色/ })).toHaveValue('electric')
  await newTabPage.getByRole('radio', { name: '跟随系统', exact: true }).click()
  for (const colorScheme of ['dark', 'light'] as const) {
    await newTabPage.emulateMedia({ colorScheme })
    await expect(newTabPage.locator('html')).not.toHaveClass(/dark/)
  }
  await newTabPage.keyboard.press('Escape')
  await newTabPage.reload()
  await expect(newTabPage.locator('html')).toHaveClass(/theme-electric/)
  await expect(newTabPage.getByText('MDN Web Docs', { exact: true })).toBeVisible()
  const settings = await extensionWorker.evaluate(async () => JSON.parse(String((await chrome.storage.sync.get('yunji-tab:settings'))['yunji-tab:settings'])))
  expect(settings.appearance.colorTheme).toBe('electric')
  expect(settings.appearance.navLayout).toBe('top')
  await newTabPage.locator('input').evaluateAll(elements => elements.forEach(element => (element as HTMLElement).blur()))
  await newTabPage.locator('header').evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))))
  await newTabPage.screenshot({ path: `${screenshotDir}/desktop.png`, fullPage: true })
  await newTabPage.getByRole('button', { name: /^书签组/ }).click()
  await newTabPage.getByRole('button', { name: '查看书签组 工作工具', exact: true }).click()
  await expect(newTabPage.getByRole('menuitem', { name: '打开书签 开发文档', exact: true })).toBeVisible()
  await newTabPage.locator('.bookmark-group-menu').evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))))
  await newTabPage.screenshot({ path: `${screenshotDir}/group-menu.png`, fullPage: true })
  await newTabPage.keyboard.press('Escape')
  await newTabPage.getByRole('button', { name: '更多操作', exact: true }).click()
  await newTabPage.getByRole('menuitem', { name: '打开设置', exact: true }).click()
  await newTabPage.getByRole('tab', { name: '外观', exact: true }).click()
  await newTabPage.getByRole('radio', { name: '蓝墨版画', exact: true }).click()
  await expect(newTabPage.locator('html')).toHaveClass(/theme-engraving/)
  await expect(newTabPage.locator('html')).not.toHaveClass(/theme-electric/)
  await newTabPage.getByRole('radio', { name: '纸墨', exact: true }).click()
  await expect(newTabPage.locator('html')).toHaveClass(/theme-kami/)
  await expect(newTabPage.locator('html')).not.toHaveClass(/theme-electric|theme-engraving|dark/)
  await newTabPage.getByRole('radio', { name: '平衡', exact: true }).click()
  await expect(newTabPage.locator('html')).not.toHaveClass(/theme-electric|theme-kami|theme-engraving/)
  await expect.poll(() => newTabPage.locator('html').evaluate(element => getComputedStyle(element).getPropertyValue('--foreground').trim())).not.toBe('240 100% 45.5%')
})

for (const [language, messages] of Object.entries(appearanceMessages)) {
  test(`renders Electric Blue in ${language} without overflow`, async ({ extensionWorker, newTabPage }) => {
    await extensionWorker.evaluate(async language => chrome.storage.sync.set({
      'yunji-tab:settings': JSON.stringify({ language, theme: 'dark', onboardingDismissed: true, appearance: { colorTheme: 'electric', accentColor: 'rose', backgroundStyle: 'subtle', navLayout: language === 'en' ? 'top' : 'sidebar', radius: 'sm', cardStyle: 'plain' } }),
    }), language)
    await newTabPage.reload()
    await expect(newTabPage.locator('html')).toHaveClass(/theme-electric/)
    await expect(newTabPage.locator('html')).not.toHaveClass(/dark/)
    await expect.poll(() => newTabPage.locator('html').evaluate(element => getComputedStyle(element).getPropertyValue('--primary').trim())).toBe('240 100% 45.5%')
    for (const width of [320, 1280]) {
      await newTabPage.setViewportSize({ width, height: 900 })
      await expect.poll(() => newTabPage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
      if (language === 'zh-CN' && width === 320) {
        await newTabPage.locator('input').evaluateAll(elements => elements.forEach(element => (element as HTMLElement).blur()))
        await newTabPage.locator('header').evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))))
        await newTabPage.screenshot({ path: `${screenshotDir}/mobile.png`, fullPage: true })
      }
      await newTabPage.locator('header button[aria-haspopup="menu"]').click()
      await newTabPage.getByRole('menuitem').last().click()
      await newTabPage.getByRole('tab').nth(1).click()
      const preset = newTabPage.getByRole('radio', { name: messages.appearanceStyleElectric, exact: true })
      await preset.scrollIntoViewIfNeeded()
      await expect(preset).toBeVisible()
      const dialog = newTabPage.getByRole('dialog')
      await dialog.evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))))
      await expect.poll(() => dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      if (language === 'zh-CN' || language === 'en') {
        const violations = (await new AxeBuilder({ page: newTabPage }).analyze()).violations
        expect(violations.filter(item => ['critical', 'serious'].includes(item.impact ?? ''))).toEqual([])
      }
      await newTabPage.screenshot({ path: `${screenshotDir}/${language}-${width}-settings.png`, fullPage: true })
      await newTabPage.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
    }
  })
}
