import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(root, 'docs/images')
const extensionPath = path.join(root, 'build/chrome-mv3-prod')
const profile = await mkdtemp(path.join(os.tmpdir(), 'yunji-docs-'))
const staging = path.join(profile, 'documentation-images')
const fixedTime = new Date('2026-10-15T02:08:00Z')
const folders = [
  { title: 'AI 工具', sites: [
    ['ChatGPT', 'https://chatgpt.com/', '讨论想法、整理资料与辅助编程', ['AI', '对话']],
    ['Claude', 'https://claude.ai/', '长文阅读、写作与代码协作', ['AI', '写作']],
    ['Perplexity', 'https://www.perplexity.ai/', '带来源的搜索与资料检索', ['AI', '搜索']],
    ['Hugging Face', 'https://huggingface.co/', '寻找开源模型、数据集和应用', ['AI', '开源']],
  ] },
  { title: '开发与文档', sites: [
    ['GitHub', 'https://github.com/', '代码托管、开源项目与团队协作', ['开发', '开源']],
    ['MDN Web Docs', 'https://developer.mozilla.org/zh-CN/', '查阅 Web 标准和浏览器 API', ['开发', '文档']],
    ['React', 'https://react.dev/', '学习组件、状态与界面开发', ['开发', '文档']],
    ['TypeScript', 'https://www.typescriptlang.org/', 'JavaScript 的类型系统与开发工具', ['开发', '文档']],
  ] },
  { title: '设计灵感', sites: [
    ['Figma', 'https://www.figma.com/', '协作设计界面与交互原型', ['设计', '工具']],
    ['Dribbble', 'https://dribbble.com/', '收集界面、插画和品牌设计灵感', ['设计', '灵感']],
    ['Unsplash', 'https://unsplash.com/', '寻找照片与视觉素材', ['设计', '图片']],
    ['Coolors', 'https://coolors.co/', '探索和保存配色方案', ['设计', '配色']],
  ] },
  { title: '阅读与生活', sites: [
    ['Wikipedia', 'https://www.wikipedia.org/', '从一个词条开始探索新知识', ['阅读', '百科']],
    ['少数派', 'https://sspai.com/', '数字工具与日常生活的使用经验', ['阅读', '效率']],
    ['家里的 NAS', 'https://nas.example.com/', '照片、文件和家庭备份的统一入口', ['生活', '自建服务']],
    ['OpenStreetMap', 'https://www.openstreetmap.org/', '开放地图与出行参考', ['生活', '地图']],
  ] },
]
let context
let page
const captured = []

try {
  await mkdir(output, { recursive: true })
  await mkdir(staging)
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-first-run', '--no-default-browser-check'],
  })
  let [worker] = context.serviceWorkers()
  worker ??= await context.waitForEvent('serviceworker', { timeout: 20_000 })
  const extensionId = new URL(worker.url()).host
  await worker.evaluate(async ({ folders, timestamp }) => {
    const metadata = {}
    const sites = {}
    for (const folder of folders) {
      const parent = await globalThis.chrome.bookmarks.create({ parentId: '1', title: folder.title })
      for (const [title, url, description, tags] of folder.sites) {
        const bookmark = await globalThis.chrome.bookmarks.create({ parentId: parent.id, title, url })
        sites[title] = { id: bookmark.id, url, title }
        metadata[url] = { description, tags }
      }
    }
    for (const [index, title] of ['GitHub', 'ChatGPT', 'Figma', 'MDN Web Docs', 'Wikipedia'].entries()) {
      Object.assign(metadata[sites[title].url], { pinnedAt: timestamp - index, pinnedOrder: index + 1 })
    }
    Object.assign(metadata[sites['家里的 NAS'].url], { icon: '🏠', alternateUrls: ['http://nas.home.arpa/'] })
    for (const title of ['Hugging Face', 'Coolors', 'OpenStreetMap'])
      metadata[sites[title].url].inboxAt = timestamp
    const groups = [
      { id: 'docs-ai', title: 'AI 工作台', description: '提问、阅读与检索，一组打开常用工具', pinnedAt: timestamp, pinnedOrder: 0, bookmarks: ['ChatGPT', 'Claude', 'Perplexity'].map(title => sites[title]) },
      { id: 'docs-dev', title: '前端开发', description: '从代码到文档，随时查阅', bookmarks: ['GitHub', 'MDN Web Docs', 'React', 'TypeScript'].map(title => sites[title]) },
      { id: 'docs-design', title: '设计工具箱', description: '原型、灵感、照片与配色', bookmarks: ['Figma', 'Dribbble', 'Unsplash', 'Coolors'].map(title => sites[title]) },
    ]
    const sync = {
      'yunji-tab:settings': JSON.stringify({
        language: 'zh-CN',
        theme: 'light',
        onboardingDismissed: true,
        headerWidget: { location: { name: '上海', latitude: 31.22, longitude: 121.46 } },
      }),
    }
    for (const group of groups) {
      const key = `yunji-tab:bookmark-group:${group.id}`
      sync[key] = { version: 1, generation: 'docs', partCount: 1 }
      sync[`${key}:docs:0`] = JSON.stringify(group)
    }
    await globalThis.chrome.storage.local.set({ 'yunji-tab:meta': JSON.stringify(metadata) })
    await globalThis.chrome.storage.sync.set(sync)
  }, { folders, timestamp: fixedTime.getTime() })

  page = await context.newPage()
  page.setDefaultTimeout(10_000)
  await page.clock.setFixedTime(fixedTime)
  // Only the isolated screenshot page receives fixture weather and permissions.
  await page.addInitScript(() => {
    globalThis.chrome.permissions.contains = async () => true
  })
  await page.route('https://api.open-meteo.com/**', route => route.fulfill({ json: { current: { temperature_2m: 26, weather_code: 0, is_day: 1 } } }))

  async function waitForHome() {
    await expect(page.locator('.newtab-shell')).toHaveAttribute('data-newtab-ready', 'true')
    await expect(page.locator('article').filter({ hasText: 'GitHub' }).first()).toBeVisible()
    await expect(page.getByTestId('header-widget')).toContainText('26°C')
  }

  await page.goto(`chrome-extension://${extensionId}/newtab.html`)
  await waitForHome()
  await expect(page.locator('[data-home-hero]')).toBeVisible()

  async function capture(name, target = page, keepPointer = false) {
    if (!keepPointer)
      await page.mouse.move(1430, 950)
    await expect(page.locator('[data-slot="bookmark-icon"] .animate-pulse:visible, [data-slot="group-member-icon"] .animate-pulse:visible')).toHaveCount(0, { timeout: 45_000 })
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all(Array.from(document.images, image => image.decode().catch(() => {})))
      await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})))
    })
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Unexpected horizontal overflow')
    await target.screenshot({ path: path.join(staging, `${name}.png`), animations: 'disabled' })
    captured.push(name)
    console.log(`Captured ${name}`)
  }

  async function settings(tab) {
    await page.getByRole('button', { name: '更多操作', exact: true }).click()
    await page.getByRole('menuitem', { name: '打开设置', exact: true }).click()
    await page.getByRole('tab', { name: tab, exact: true }).click()
    return page.getByRole('dialog', { name: '设置', exact: true })
  }

  async function layout(homeLayout) {
    await worker.evaluate(async (homeLayout) => {
      const key = 'yunji-tab:settings'
      const value = JSON.parse((await globalThis.chrome.storage.sync.get(key))[key])
      await globalThis.chrome.storage.sync.set({ [key]: JSON.stringify({ ...value, appearance: { ...value.appearance, colorTheme: 'sky', homeLayout } }) })
    }, homeLayout)
    await page.reload()
    await waitForHome()
    await expect(page.locator('.newtab-shell')).toHaveAttribute('data-home-layout', homeLayout)
  }

  await capture('yunji-tab-overview')
  await page.getByTestId('header-widget').click()
  await expect(page.getByRole('switch', { name: '天气背景', exact: true })).toBeVisible()
  await capture('time-and-weather', page.getByRole('dialog', { name: '时间与天气', exact: true }))
  await page.keyboard.press('Escape')

  await layout('workspace')
  await capture('workspace-layout')
  await page.locator('#yunji-tab-search').fill('tag:AI')
  await expect(page.getByText('Hugging Face', { exact: true })).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 620 })
  await capture('bookmark-search')
  await page.locator('#yunji-tab-search').fill('')

  await page.getByRole('button', { name: /^书签组/ }).click()
  await page.getByRole('button', { name: '查看书签组 AI 工作台', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: '打开书签 ChatGPT', exact: true })).toBeVisible()
  // Keep the pointer in the menu so it remains open during the screenshot.
  await page.getByRole('menuitem', { name: '打开书签 ChatGPT', exact: true }).hover()
  await capture('bookmark-groups', page, true)
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 1440, height: 960 })

  await page.getByRole('button', { name: '打开命令面板', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '命令面板', exact: true })).toBeVisible()
  await capture('command-palette', page.getByRole('dialog', { name: '命令面板', exact: true }))
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: /^智能分类/ }).click()
  await page.getByRole('button', { name: /^收件箱/ }).click()
  await page.getByRole('button', { name: '逐条整理', exact: true }).click()
  await capture('inbox-triage', page.getByRole('dialog', { name: '整理收件箱', exact: true }))
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: /^阅读与生活/ }).first().click()
  await page.getByRole('button', { name: '更多操作 家里的 NAS', exact: true }).click()
  await page.getByRole('menuitem', { name: /编辑书签/ }).click()
  await expect(page.getByRole('dialog', { name: '编辑书签', exact: true })).toBeVisible()
  await expect(page.getByLabel('备用 URL（可选）')).toBeVisible()
  await capture('bookmark-editor', page.getByRole('dialog'))
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: /^开发与文档/ }).first().click()
  await page.getByRole('button', { name: '整理', exact: true }).click()
  await page.getByRole('menuitem', { name: '批量管理', exact: true }).click()
  for (const title of ['GitHub', 'MDN Web Docs', 'React'])
    await page.getByRole('checkbox', { name: `选择 ${title}`, exact: true }).check()
  await page.setViewportSize({ width: 1440, height: 620 })
  await capture('bookmark-bulk-actions')
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.getByRole('button', { name: '退出批量管理', exact: true }).click()

  await capture('appearance-settings', await settings('外观'))
  await page.getByRole('radio', { name: '蓝墨版画', exact: true }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /^置顶/ }).first().click()
  await capture('engraving-theme')

  await layout('workspace')
  const dataDialog = await settings('数据与隐私')
  await capture('backup-and-restore', dataDialog)
  await page.getByRole('heading', { name: 'WebDAV 备份', exact: true }).evaluate(element => element.scrollIntoView({ block: 'start' }))
  await capture('webdav-backup', dataDialog)
  for (const name of captured)
    await copyFile(path.join(staging, `${name}.png`), path.join(output, `${name}.png`))
  console.log(`Updated ${captured.length} screenshots in docs/images`)
}
catch (error) {
  if (page) {
    await page.screenshot({ path: path.join(os.tmpdir(), 'yunji-docs-error.png') }).catch(() => {})
    console.error(await page.locator('body').textContent().catch(() => 'Page unavailable'))
  }
  throw error
}
finally {
  try {
    await context?.close()
  }
  finally {
    await rm(profile, { recursive: true, force: true })
  }
}
