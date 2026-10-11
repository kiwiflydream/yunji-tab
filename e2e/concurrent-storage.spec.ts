import type { Page } from '@playwright/test'
import { expect, test } from './extension.fixture'

async function holdStorageLock(page: Page, key: string) {
  await page.evaluate(key => new Promise<void>((ready) => {
    void navigator.locks.request(key, async () => {
      await new Promise<void>((release) => {
        Object.assign(window, { releaseStorageLock: release })
        ready()
      })
    })
  }), key)
}

async function releaseStorageLock(page: Page) {
  await page.evaluate(() => {
    (window as typeof window & { releaseStorageLock: () => void }).releaseStorageLock()
  })
}

test.beforeEach(async ({ extensionWorker, newTabPage }) => {
  await extensionWorker.evaluate(async () => {
    const key = 'yunji-tab:settings'
    const raw = (await chrome.storage.sync.get(key))[key]
    const settings = typeof raw === 'string' ? JSON.parse(raw) : raw ?? {}
    await chrome.storage.sync.set({ [key]: JSON.stringify({ ...settings, language: 'zh-CN', singleHomeTab: false, defaultCategoryId: 'all' }) })
  })
  await newTabPage.reload()
})

test('retains opens from two pages, including simultaneous opens of the same bookmark', async ({ extensionContext, extensionWorker, newTabPage, extensionId }) => {
  const urls = ['https://same.concurrent.example/', 'https://other.concurrent.example/']
  await extensionWorker.evaluate(async urls => Promise.all(urls.map((url, index) =>
    chrome.bookmarks.create({ parentId: '1', title: `Concurrent Usage ${index}`, url }))), urls)
  const secondPage = await extensionContext.newPage()
  try {
    await newTabPage.reload()
    await secondPage.goto(`chrome-extension://${extensionId}/newtab.html`)
    for (const page of [newTabPage, secondPage]) {
      await page.getByLabel('搜索书签和目录').fill('Concurrent Usage')
      await expect(page.locator(`article a[href="${urls[0]}"]`)).toBeVisible()
    }
    await holdStorageLock(newTabPage, 'yunji-tab:usage')
    try {
      await Promise.all([newTabPage, secondPage].map((page, index) => page.evaluate((urls) => {
        // Exercise real card handlers while suppressing navigation in this isolated profile.
        const preventNavigation = (event: Event) => event.preventDefault()
        document.addEventListener('click', preventNavigation)
        for (const url of urls) {
          document.querySelector<HTMLAnchorElement>(`article a[href="${url}"]`)!
            .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }))
        }
        document.removeEventListener('click', preventNavigation)
        window.dispatchEvent(new Event('pagehide'))
      }, index === 0 ? urls : [urls[0]])))
    }
    finally {
      await releaseStorageLock(newTabPage)
    }
    await expect.poll(() => extensionWorker.evaluate(async (urls) => {
      const raw = (await chrome.storage.local.get('yunji-tab:usage'))['yunji-tab:usage']
      const usage = typeof raw === 'string' ? JSON.parse(raw) : raw ?? {}
      return urls.map(url => usage[url]?.openCount ?? 0)
    }, urls)).toEqual([2, 1])
  }
  finally {
    await secondPage.close()
  }
})

test('saves category icons from two pages without overwriting either edit', async ({ extensionContext, extensionWorker, newTabPage, extensionId }) => {
  const folders = await extensionWorker.evaluate(async () => Promise.all([0, 1].map(index =>
    chrome.bookmarks.create({ parentId: '1', title: `Concurrent Folder ${index}` }))))
  const secondPage = await extensionContext.newPage()
  try {
    await newTabPage.reload()
    await secondPage.goto(`chrome-extension://${extensionId}/newtab.html`)
    for (const [index, page] of [newTabPage, secondPage].entries()) {
      await page.getByLabel('搜索书签和目录').fill('Concurrent Folder')
      await page.getByRole('main').getByRole('button', { name: `编辑目录 Concurrent Folder ${index}`, exact: true }).click()
      await page.getByRole('dialog').getByLabel('图标', { exact: true }).fill(index === 0 ? 'A' : 'B')
    }
    await holdStorageLock(newTabPage, 'yunji-tab:meta')
    try {
      await Promise.all([newTabPage, secondPage].map(page =>
        page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click()))
      await expect(newTabPage.getByRole('dialog')).toBeVisible()
      await expect(secondPage.getByRole('dialog')).toBeVisible()
    }
    finally {
      await releaseStorageLock(newTabPage)
    }
    await expect.poll(() => extensionWorker.evaluate(async (ids) => {
      const raw = (await chrome.storage.local.get('yunji-tab:category-meta'))['yunji-tab:category-meta']
      const meta = typeof raw === 'string' ? JSON.parse(raw) : raw ?? {}
      return ids.map(id => meta[`cat-${id}`]?.emoji)
    }, folders.map(folder => folder.id))).toEqual(['A', 'B'])
    await expect(newTabPage.getByRole('dialog')).toHaveCount(0)
    await expect(secondPage.getByRole('dialog')).toHaveCount(0)
  }
  finally {
    await secondPage.close()
  }
})
