import { expect, test } from './extension.fixture'

declare global {
  interface Window {
    __nativeTreeReads?: number
  }
}

test('updates native titles without a full tree read and refreshes after a move', async ({ extensionWorker, newTabPage }) => {
  const { folder, other, bookmark } = await extensionWorker.evaluate(async () => {
    const folder = await chrome.bookmarks.create({ parentId: '1', title: 'Native Title Folder' })
    const other = await chrome.bookmarks.create({ parentId: '1', title: 'Native Destination' })
    const bookmark = await chrome.bookmarks.create({ parentId: folder.id, title: 'Native Original', url: 'https://native-title.example/' })
    return { folder, other, bookmark }
  })
  await newTabPage.addInitScript(() => {
    const original = chrome.bookmarks.getTree.bind(chrome.bookmarks)
    window.__nativeTreeReads = 0
    Object.defineProperty(chrome.bookmarks, 'getTree', {
      configurable: true,
      value: () => {
        window.__nativeTreeReads = (window.__nativeTreeReads ?? 0) + 1
        return original()
      },
    })
  })
  await newTabPage.reload()
  await expect(newTabPage.locator('.newtab-shell')).toHaveAttribute('data-newtab-ready', 'true')
  const search = newTabPage.getByLabel('搜索书签和目录')
  await search.fill('Native Original')
  const card = newTabPage.locator('article').filter({ has: newTabPage.locator(`a[href="${bookmark.url}"]`) })
  await expect(card).toBeVisible()
  const reads = await newTabPage.evaluate(() => window.__nativeTreeReads)
  expect(reads).toBeGreaterThan(0)

  await extensionWorker.evaluate(async id => chrome.bookmarks.update(id, { title: 'Native Renamed' }), bookmark.id)
  await search.fill('Native Renamed')
  await expect(card).toBeVisible()
  await expect(card).toContainText('Native Renamed')
  expect(await newTabPage.evaluate(() => window.__nativeTreeReads)).toBe(reads)

  await extensionWorker.evaluate(async id => chrome.bookmarks.update(id, { title: 'Renamed Parent' }), folder.id)
  await search.fill('folder:Renamed')
  await expect(card).toBeVisible()
  await expect(card).toContainText('Renamed Parent')
  expect(await newTabPage.evaluate(() => window.__nativeTreeReads)).toBe(reads)

  await extensionWorker.evaluate(async ({ id, parentId }) => chrome.bookmarks.move(id, { parentId }), { id: bookmark.id, parentId: other.id })
  await expect.poll(() => newTabPage.evaluate(() => window.__nativeTreeReads ?? 0)).toBeGreaterThan(reads!)
  await expect(card).toHaveCount(0)
  await search.fill('folder:Destination')
  await expect(card).toBeVisible()
})
