import type { Locator, Page, Worker } from '@playwright/test'
import { encodeBookmarkGroup } from '../src/lib/bookmark-groups'
import { expect, test } from './extension.fixture'

let previousStorage: { sync: Record<string, unknown>, local: Record<string, unknown> }

test.beforeEach(async ({ extensionWorker }) => {
  previousStorage = await extensionWorker.evaluate(async () => ({
    sync: await chrome.storage.sync.get(null),
    local: await chrome.storage.local.get(null),
  }))
})

test.afterEach(async ({ extensionWorker }) => {
  await extensionWorker.evaluate(async (previous) => {
    for (const url of ['https://example.com/drag-source', 'https://example.com/drag-ordinary']) {
      for (const bookmark of await chrome.bookmarks.search({ url }))
        await chrome.bookmarks.remove(bookmark.id)
    }
    await chrome.storage.sync.clear()
    await chrome.storage.local.clear()
    await chrome.storage.sync.set(previous.sync)
    await chrome.storage.local.set(previous.local)
  }, previousStorage)
})

async function seed(worker: Worker, pinned = false) {
  const groups = ['A', 'B', 'C'].map((title, index) => ({
    id: `drag-group-${title}`,
    title: `Drag group ${title}`,
    description: '',
    ...(pinned ? { pinnedAt: 3000 - index * 1000 } : {}),
    bookmarks: [{ id: `member-${title}`, url: 'https://example.com/drag-source', title: 'Source' }],
  }))
  const records = Object.assign({}, ...groups.map(group => encodeBookmarkGroup(group, 'initial')))
  await worker.evaluate(async (records) => {
    for (const bookmark of await chrome.bookmarks.search('Drag ')) {
      if (bookmark.url && ['Drag source', 'Drag ordinary'].includes(bookmark.title))
        await chrome.bookmarks.remove(bookmark.id)
    }
    await chrome.storage.sync.clear()
    await chrome.storage.local.clear()
    await chrome.storage.sync.set({
      ...records,
      'yunji-tab:settings': JSON.stringify({ language: 'zh-CN', theme: 'light', onboardingDismissed: true }),
    })
    await chrome.bookmarks.create({ parentId: '1', title: 'Drag source', url: 'https://example.com/drag-source' })
    await chrome.bookmarks.create({ parentId: '1', title: 'Drag ordinary', url: 'https://example.com/drag-ordinary' })
    await chrome.storage.local.set({ 'yunji-tab:meta': JSON.stringify({
      'https://example.com/drag-source': { pinnedAt: 4000 },
      'https://example.com/drag-ordinary': { pinnedAt: 500 },
    }) })
  }, records)
}

async function drag(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded()
  const from = await source.boundingBox()
  const to = await target.boundingBox()
  expect(from).not.toBeNull()
  expect(to).not.toBeNull()
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2)
  await page.mouse.down()
  await page.mouse.move(from!.x + from!.width / 2 + 10, from!.y + from!.height / 2, { steps: 3 })
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 15 })
  await page.mouse.up()
}

async function groupOrder(page: Page) {
  return page.locator('[data-bookmark-group-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-bookmark-group-id')))
}

async function openPinned(page: Page) {
  const nav = page.locator('nav[aria-label="书签分类"]')
  const pinned = nav.getByRole('button', { name: /置顶/, includeHidden: true })
  if (!await pinned.isVisible())
    await nav.getByRole('button', { name: /智能分类/ }).click()
  await pinned.click()
}

test('drags group cards, persists order and updates another home page', async ({ extensionContext, extensionWorker, newTabPage }) => {
  await seed(extensionWorker)
  await newTabPage.reload()
  await newTabPage.getByRole('button', { name: /^书签组/ }).click()
  const other = await extensionContext.newPage()
  try {
    await other.goto(newTabPage.url())
    await other.getByRole('button', { name: /^书签组/ }).click()
    await expect(newTabPage.getByRole('button', { name: '拖动书签组 Drag group A', exact: true })).toBeVisible()
    await drag(newTabPage, newTabPage.getByRole('button', { name: '拖动书签组 Drag group A', exact: true }), newTabPage.locator('[data-bookmark-group-id="drag-group-C"]'))
    await expect.poll(() => groupOrder(newTabPage)).toEqual(['drag-group-B', 'drag-group-C', 'drag-group-A'])
    await expect.poll(() => groupOrder(other)).toEqual(['drag-group-B', 'drag-group-C', 'drag-group-A'])
    await expect(newTabPage.getByRole('menu')).toHaveCount(0)
    await newTabPage.reload()
    await newTabPage.getByRole('button', { name: /^书签组/ }).click()
    await expect.poll(() => groupOrder(newTabPage)).toEqual(['drag-group-B', 'drag-group-C', 'drag-group-A'])
    // Drag from the card body as well as the explicit handle.
    await drag(newTabPage, newTabPage.getByRole('button', { name: '查看书签组 Drag group A', exact: true }), newTabPage.locator('[data-bookmark-group-id="drag-group-B"]'))
    await expect.poll(() => groupOrder(newTabPage)).toEqual(['drag-group-A', 'drag-group-B', 'drag-group-C'])
  }
  finally { await other.close() }
})

test('interleaves pinned groups and bookmarks and preserves native folders', async ({ extensionContext, extensionWorker, newTabPage }) => {
  await seed(extensionWorker, true)
  await newTabPage.reload()
  await openPinned(newTabPage)
  const other = await extensionContext.newPage()
  const order = (page: Page) => page.locator('main article').evaluateAll(nodes => nodes.flatMap((node) => {
    const groupId = node.getAttribute('data-bookmark-group-id')
    if (groupId)
      return [groupId]
    const link = node.querySelector<HTMLAnchorElement>('a[data-nav-item]')
    return link ? [new URL(link.href).pathname] : []
  }))
  try {
    await other.goto(newTabPage.url())
    await openPinned(other)
    await drag(newTabPage, newTabPage.getByRole('button', { name: '拖动书签组 Drag group A', exact: true }), newTabPage.locator('article').filter({ has: newTabPage.getByRole('link', { name: /Drag ordinary/ }) }))
    await expect.poll(() => order(newTabPage)).toEqual(['/drag-source', 'drag-group-B', 'drag-group-C', '/drag-ordinary', 'drag-group-A'])
    await expect.poll(() => order(other)).toEqual(await order(newTabPage))
    await drag(newTabPage, newTabPage.getByRole('button', { name: '拖动书签 Drag ordinary', exact: true }), newTabPage.locator('[data-bookmark-group-id="drag-group-B"]'))
    await expect.poll(() => order(newTabPage)).toEqual(['/drag-source', '/drag-ordinary', 'drag-group-B', 'drag-group-C', 'drag-group-A'])
    await expect.poll(() => order(other)).toEqual(await order(newTabPage))
    const expected = await order(newTabPage)
    await newTabPage.reload()
    await openPinned(newTabPage)
    await expect.poll(() => order(newTabPage)).toEqual(expected)
    const native = await extensionWorker.evaluate(async () => chrome.bookmarks.search({ title: 'Drag ordinary' }))
    expect(native.every(bookmark => bookmark.parentId === '1')).toBe(true)
    await newTabPage.screenshot({ path: '/tmp/yunji-tab-group-drag-order.png', fullPage: true })
  }
  finally { await other.close() }
})
