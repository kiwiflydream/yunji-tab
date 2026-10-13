import type { Route } from '@playwright/test'
import { expect, test } from './extension.fixture'

test.beforeEach(async ({ extensionWorker }) => {
  await extensionWorker.evaluate(async () => {
    await chrome.storage.sync.set({ 'yunji-tab:settings': JSON.stringify({ language: 'zh-CN', onboardingDismissed: true }) })
    const cache = await chrome.storage.local.get(null)
    await chrome.storage.local.remove(Object.keys(cache).filter(key => key.startsWith('yunji-weather:')))
  })
})

test('configures time and weather, persists settings and fits small screens', async ({ newTabPage, extensionWorker }) => {
  await newTabPage.addInitScript(() => {
    chrome.permissions.request = async () => true
    chrome.permissions.contains = async () => true
  })
  await newTabPage.route('https://geocoding-api.open-meteo.com/**', route => route.fulfill({ json: { results: [{ name: '上海', admin1: '上海市', country: '中国', latitude: 31.22, longitude: 121.46 }] } }))
  await newTabPage.route('https://api.open-meteo.com/**', route => route.fulfill({ json: { current: { temperature_2m: route.request().url().includes('fahrenheit') ? 79 : 26, weather_code: 0, is_day: 1 } } }))
  await newTabPage.reload()
  await newTabPage.setViewportSize({ width: 1440, height: 900 })
  await expect(newTabPage.locator('html')).toHaveClass(/theme-electric/)
  const widget = newTabPage.getByTestId('header-widget')
  await expect(widget.locator('time')).toContainText(/\d{1,2}:\d{2}/)
  await widget.click()
  await newTabPage.getByRole('textbox', { name: '城市', exact: true }).fill('上海')
  await newTabPage.getByRole('button', { name: '搜索', exact: true }).click()
  await newTabPage.getByRole('button', { name: '上海 · 上海市 · 中国', exact: true }).click()
  await expect(widget).toContainText('26°C')
  await newTabPage.keyboard.press('Escape')
  await newTabPage.screenshot({ path: '/tmp/yunji-header-widget/default-desktop.png' })
  await widget.click()
  await newTabPage.getByRole('combobox', { name: '温度单位' }).selectOption('fahrenheit')
  await expect(widget).toContainText('79°F')
  await newTabPage.getByRole('combobox', { name: '温度单位' }).selectOption('celsius')
  await expect(widget).toContainText('26°C')
  await newTabPage.getByRole('combobox', { name: '时间格式' }).selectOption('12')
  await newTabPage.getByRole('switch', { name: '显示日期' }).click()
  await expect(newTabPage.getByRole('switch', { name: '显示日期' })).not.toBeChecked()
  await newTabPage.screenshot({ path: '/tmp/yunji-header-widget/settings.png' })
  await newTabPage.keyboard.press('Escape')
  await newTabPage.reload()
  await expect(widget).toContainText('26°C')
  await expect.poll(async () => extensionWorker.evaluate(async () => JSON.parse(String((await chrome.storage.sync.get('yunji-tab:settings'))['yunji-tab:settings'])).headerWidget)).toMatchObject({ hour12: true, showDate: false, location: { name: '上海 · 上海市 · 中国' } })
  await newTabPage.screenshot({ path: '/tmp/yunji-header-widget/desktop.png' })
  for (const width of [375, 768, 1024]) {
    await newTabPage.setViewportSize({ width, height: 900 })
    await expect(widget).toBeVisible()
    expect(await newTabPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const widgetBox = await widget.boundingBox()
    const logoBox = await newTabPage.getByRole('heading', { name: '云吉 Tab', exact: true }).boundingBox()
    expect(widgetBox!.x).toBeGreaterThan(logoBox!.x + logoBox!.width)
    expect(logoBox!.height).toBeLessThan(25)
    await newTabPage.screenshot({ path: `/tmp/yunji-header-widget/width-${width}.png` })
  }
  await widget.click()
  await newTabPage.getByRole('switch', { name: '显示时间' }).click()
  await newTabPage.getByRole('switch', { name: '显示天气' }).click()
  await expect(widget).toHaveCount(0)
  await newTabPage.reload()
  await expect(widget).toHaveCount(0)
  await newTabPage.getByRole('button', { name: '更多操作', exact: true }).click()
  await newTabPage.getByRole('menuitem', { name: '打开设置', exact: true }).click()
  await newTabPage.getByRole('switch', { name: '显示时间' }).click()
  await expect(widget).toBeVisible()
})

test('handles permission denial, failed searches and unavailable weather', async ({ newTabPage, extensionWorker }) => {
  await newTabPage.addInitScript(() => {
    chrome.permissions.request = async () => false
  })
  await newTabPage.reload()
  const widget = newTabPage.getByTestId('header-widget')
  await widget.click()
  const cityInput = newTabPage.getByRole('textbox', { name: '城市', exact: true })
  await cityInput.fill('上海')
  await newTabPage.getByRole('button', { name: '搜索', exact: true }).click()
  await expect(newTabPage.getByRole('alert')).toContainText('需要允许访问天气服务')
  await expect(cityInput).toHaveValue('上海')
  await newTabPage.evaluate(() => {
    chrome.storage.sync.set = async () => {
      throw new Error('Test storage quota exceeded')
    }
  })
  await newTabPage.getByRole('switch', { name: '显示日期' }).click()
  await expect(newTabPage.getByRole('alert')).toContainText('保存失败')
  await expect(newTabPage.getByRole('switch', { name: '显示日期' })).toBeChecked()
  await newTabPage.evaluate(() => {
    chrome.permissions.request = async () => true
  })
  await newTabPage.route('https://geocoding-api.open-meteo.com/**', route => route.fulfill({ status: 503 }))
  await newTabPage.getByRole('button', { name: '搜索', exact: true }).click()
  await expect(newTabPage.getByRole('alert')).toContainText('城市搜索失败')
  await expect(cityInput).toHaveValue('上海')
  await extensionWorker.evaluate(async () => {
    await chrome.storage.sync.set({ 'yunji-tab:settings': JSON.stringify({ language: 'zh-CN', onboardingDismissed: true, headerWidget: { location: { name: '上海', latitude: 31.22, longitude: 121.46 } } }) })
  })
  await newTabPage.reload()
  await expect(widget.locator('[aria-label^="天气暂不可用"]')).toBeVisible()
  await expect(widget.locator('time')).toBeVisible()
})

test('refreshes weather when the cached reading expires after a slow first request', async ({ newTabPage, extensionWorker }) => {
  await newTabPage.addInitScript(() => {
    chrome.permissions.contains = async () => true
  })
  await extensionWorker.evaluate(async () => {
    await chrome.storage.sync.set({ 'yunji-tab:settings': JSON.stringify({ language: 'zh-CN', onboardingDismissed: true, headerWidget: { clockEnabled: false, location: { name: '上海', latitude: 31.22, longitude: 121.46 } } }) })
  })
  await newTabPage.clock.install({ time: new Date('2026-10-13T03:00:00Z') })
  let requestCount = 0
  let firstRequest: Route | undefined
  await newTabPage.route('https://api.open-meteo.com/**', async (route) => {
    requestCount += 1
    if (requestCount === 1) {
      firstRequest = route
      return
    }
    await route.fulfill({ json: { current: { temperature_2m: 21, weather_code: 0, is_day: 1 } } })
  })
  await newTabPage.reload()
  await expect.poll(() => requestCount).toBe(1)
  await newTabPage.clock.fastForward(5000)
  await firstRequest!.fulfill({ json: { current: { temperature_2m: 20, weather_code: 0, is_day: 1 } } })
  const widget = newTabPage.getByTestId('header-widget')
  await expect(widget).toContainText('20°C')
  await newTabPage.clock.runFor(15 * 60_000 + 1000)
  await expect.poll(() => requestCount).toBe(2)
  await expect(widget).toContainText('21°C')
})

test('disables weather in all open home pages without reloading', async ({ newTabPage, extensionContext, extensionWorker }) => {
  await extensionWorker.evaluate(async () => {
    await chrome.storage.sync.set({ 'yunji-tab:settings': JSON.stringify({ language: 'zh-CN', onboardingDismissed: true, headerWidget: { clockEnabled: false, location: { name: '上海', latitude: 31.22, longitude: 121.46 } } }) })
  })
  await newTabPage.reload()
  const other = await extensionContext.newPage()
  try {
    await other.goto(newTabPage.url())
    await expect(other.getByTestId('header-widget')).toBeVisible()
    await newTabPage.getByTestId('header-widget').click()
    await newTabPage.getByRole('switch', { name: '显示天气' }).click()
    await expect(newTabPage.getByTestId('header-widget')).toHaveCount(0)
    await expect(other.getByTestId('header-widget')).toHaveCount(0)
  }
  finally {
    await other.close()
  }
})
