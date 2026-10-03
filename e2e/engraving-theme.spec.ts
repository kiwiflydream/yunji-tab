import AxeBuilder from '@axe-core/playwright'
import { appearanceMessages } from '../src/lib/i18n-appearance'
import { expect, test } from './extension.fixture'

test('selects and persists Blue Engraving, then restores the existing themes', async ({ extensionWorker, newTabPage }) => {
  await extensionWorker.evaluate(async () => {
    for (const [title, url] of [
      ['MDN Web Docs', 'https://developer.mozilla.org/'],
      ['GitHub', 'https://github.com/'],
      ['Figma', 'https://www.figma.com/'],
      ['OpenAI', 'https://openai.com/'],
      ['维基百科', 'https://zh.wikipedia.org/'],
      ['Internet Archive', 'https://archive.org/'],
    ]) {
      await chrome.bookmarks.create({ parentId: '1', title, url })
    }
    await chrome.storage.sync.set({ 'yunji-tab:settings': JSON.stringify({ language: 'zh-CN', theme: 'light', appearance: { navLayout: 'top' } }) })
  })
  await newTabPage.reload()
  await newTabPage.setViewportSize({ width: 1280, height: 900 })
  await expect(newTabPage.getByText('MDN Web Docs', { exact: true })).toBeVisible()
  await newTabPage.screenshot({ path: '/tmp/yunji-theme-before.png', fullPage: true })
  await newTabPage.getByRole('button', { name: '更多操作', exact: true }).click()
  await newTabPage.getByRole('menuitem', { name: '打开设置', exact: true }).click()
  await newTabPage.getByRole('tab', { name: '外观', exact: true }).click()
  await newTabPage.getByRole('radio', { name: '蓝墨版画', exact: true }).click()
  await expect(newTabPage.locator('html')).toHaveClass(/theme-engraving/)
  await expect(newTabPage.locator('html')).toHaveClass(/dark/)
  await newTabPage.getByRole('button', { name: '高级自定义', exact: true }).click()
  await expect(newTabPage.getByRole('combobox', { name: '强调色', exact: true })).toBeDisabled()
  await expect(newTabPage.getByRole('combobox', { name: '背景', exact: true })).toBeDisabled()
  await expect(newTabPage.getByRole('combobox', { name: /^主题配色/ })).toHaveValue('engraving')
  await newTabPage.getByRole('radio', { name: '跟随系统', exact: true }).click()
  await newTabPage.emulateMedia({ colorScheme: 'light' })
  await expect(newTabPage.locator('html')).toHaveClass(/dark/)
  await newTabPage.keyboard.press('Escape')
  await newTabPage.reload()
  const landscape = newTabPage.locator('.engraving-landscape img')
  await expect(landscape).toBeVisible()
  await expect.poll(() => landscape.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await expect(newTabPage.getByText('MDN Web Docs', { exact: true })).toBeVisible()
  await newTabPage.locator('header').evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))))
  await newTabPage.screenshot({ path: '/tmp/yunji-engraving-desktop.png', fullPage: true })
  await newTabPage.setViewportSize({ width: 1920, height: 1000 })
  await newTabPage.screenshot({ path: '/tmp/yunji-engraving-wide.png', fullPage: true })
  await newTabPage.setViewportSize({ width: 1280, height: 900 })
  const settings = await extensionWorker.evaluate(async () => JSON.parse(String((await chrome.storage.sync.get('yunji-tab:settings'))['yunji-tab:settings'])))
  expect(settings.appearance.colorTheme).toBe('engraving')
  expect(settings.appearance.navLayout).toBe('top')

  await newTabPage.getByRole('button', { name: '更多操作', exact: true }).click()
  await newTabPage.getByRole('menuitem', { name: '打开设置', exact: true }).click()
  await newTabPage.getByRole('tab', { name: '外观', exact: true }).click()
  await newTabPage.getByRole('radio', { name: '纸墨', exact: true }).click()
  await expect(newTabPage.locator('html')).toHaveClass(/theme-kami/)
  await expect(newTabPage.locator('html')).not.toHaveClass(/theme-engraving|dark/)
  await expect(landscape).toHaveCount(0)
  await newTabPage.getByRole('radio', { name: '平衡', exact: true }).click()
  await expect(newTabPage.locator('html')).not.toHaveClass(/theme-kami|theme-engraving|dark/)
  await newTabPage.keyboard.press('Escape')
})

for (const [language, messages] of Object.entries(appearanceMessages)) {
  test(`renders engraving in ${language} across screen sizes`, async ({ extensionWorker, newTabPage }) => {
    await extensionWorker.evaluate(async language => chrome.storage.sync.set({
      'yunji-tab:settings': JSON.stringify({ language, theme: 'system', appearance: { colorTheme: 'engraving', navLayout: language === 'en' ? 'top' : 'sidebar', radius: 'sm', cardStyle: 'outline' } }),
    }), language)
    await newTabPage.reload()
    await expect(newTabPage.locator('html')).toHaveClass(/theme-engraving/)
    for (const width of [320, 375, 1280, 1920]) {
      await newTabPage.setViewportSize({ width, height: 900 })
      await expect.poll(() => newTabPage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), { message: `${language} at ${width}px overflows the viewport` }).toBeLessThanOrEqual(0)
      await expect(newTabPage.locator('.engraving-landscape img')).toBeVisible()
      const more = newTabPage.locator('header button[aria-haspopup="menu"]')
      await more.click()
      // The settings item is last in the existing header menu in every locale.
      await newTabPage.getByRole('menuitem').last().click()
      await newTabPage.getByRole('tab').nth(1).click()
      await expect(newTabPage.getByRole('radio', { name: messages.appearanceStyleEngraving, exact: true })).toBeVisible()
      const dialog = newTabPage.getByRole('dialog')
      await dialog.evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))))
      await expect.poll(() => dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      if (width === 375 || width === 1280) {
        const violations = (await new AxeBuilder({ page: newTabPage }).analyze()).violations
        expect(violations.filter(item => ['critical', 'serious'].includes(item.impact ?? ''))).toEqual([])
      }
      await newTabPage.screenshot({ path: `/tmp/yunji-engraving-${language}-${width}-settings.png`, fullPage: true })
      await newTabPage.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      if (language === 'zh-CN' && width === 375)
        await newTabPage.screenshot({ path: '/tmp/yunji-engraving-mobile.png', fullPage: true })
    }
  })
}
