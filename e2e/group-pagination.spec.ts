import type { Page, Worker } from '@playwright/test'
import { encodeBookmarkGroup } from '../src/lib/bookmark-groups'
import { expect, test } from './extension.fixture'

const GROUP_COUNT = 60
const BATCH_SIZE = 50
// The first 55 groups carry the search token in their description; the last 5
// do not. Keeping the token out of titles and member titles leaves the pinned
// rank order numeric and keeps bookmark matches at zero.
const SEARCH_MATCH_COUNT = 55
const SEARCH_TOKEN = '甲组'
const pinnedFixtures = [
  { title: 'Pinned Alpha', url: 'https://example.com/pagination/pm-a', pinnedAt: 97500 },
  { title: 'Pinned Beta', url: 'https://example.com/pagination/pm-b', pinnedAt: 94500 },
]
let previousStorage: { sync: Record<string, unknown>, local: Record<string, unknown> }

test.beforeEach(async ({ extensionWorker }) => {
  previousStorage = await extensionWorker.evaluate(async () => ({
    sync: await chrome.storage.sync.get(null),
    local: await chrome.storage.local.get(null),
  }))
})

test.afterEach(async ({ extensionWorker }) => {
  await extensionWorker.evaluate(async ({ previous, urls }) => {
    const values = await chrome.storage.sync.get(null)
    await chrome.storage.sync.remove(Object.keys(values).filter(key => key.startsWith('yunji-tab:bookmark-group:')))
    for (const url of urls) {
      for (const bookmark of await chrome.bookmarks.search({ url }))
        await chrome.bookmarks.remove(bookmark.id)
    }
    await chrome.storage.sync.clear()
    await chrome.storage.local.clear()
    await chrome.storage.sync.set(previous.sync)
    await chrome.storage.local.set(previous.local)
  }, { previous: previousStorage, urls: pinnedFixtures.map(item => item.url) })
})

function groupTitle(index: number) {
  return `分页组 ${String(index).padStart(2, '0')}`
}

function groupId(index: number) {
  return `pg-${String(index).padStart(2, '0')}`
}

async function seedGroups(worker: Worker, { pinned = false, withPinnedBookmarks = false }: { pinned?: boolean, withPinnedBookmarks?: boolean } = {}) {
  const groups = Array.from({ length: GROUP_COUNT }, (_, index) => ({
    id: groupId(index),
    title: groupTitle(index),
    description: index < SEARCH_MATCH_COUNT ? SEARCH_TOKEN : '',
    // Descending timestamps rank group 0 first; pinned bookmarks then land
    // between groups 2/3 and 5/6.
    ...(pinned ? { pinnedAt: 100000 - index * 1000 } : {}),
    bookmarks: [{ id: `member-${index}`, url: `https://example.com/group-pagination/${index}`, title: `成员 ${groupTitle(index)}` }],
  }))
  const records = Object.assign({}, ...groups.map(group => encodeBookmarkGroup(group, 'pagination')))
  await worker.evaluate(async ({ records, withPinnedBookmarks, sample }) => {
    await chrome.storage.sync.clear()
    await chrome.storage.local.clear()
    await chrome.storage.sync.set({
      ...records,
      'yunji-tab:settings': JSON.stringify({ language: 'zh-CN', theme: 'light', onboardingDismissed: true }),
    })
    for (const item of sample) {
      for (const existing of await chrome.bookmarks.search({ url: item.url }))
        await chrome.bookmarks.remove(existing.id)
      if (withPinnedBookmarks)
        await chrome.bookmarks.create({ parentId: '1', title: item.title, url: item.url })
    }
    if (withPinnedBookmarks)
      await chrome.storage.local.set({ 'yunji-tab:meta': JSON.stringify(Object.fromEntries(sample.map(item => [item.url, { pinnedAt: item.pinnedAt }]))) })
  }, { records, withPinnedBookmarks, sample: pinnedFixtures })
}

async function openGroupsEntry(page: Page) {
  await page.getByRole('navigation', { name: '书签分类' }).getByRole('button', { name: '书签组', exact: true }).click()
}

async function openPinned(page: Page) {
  const nav = page.getByRole('navigation', { name: '书签分类' })
  const pinned = nav.getByRole('button', { name: /置顶/, includeHidden: true })
  if (!await pinned.isVisible())
    await nav.getByRole('button', { name: /智能分类/ }).click()
  await pinned.click()
}

const groupCards = (page: Page) => page.locator('[data-bookmark-group-id]')
const groupLoadMore = (page: Page) => page.getByRole('button', { name: /加载更多/ })

async function mixedOrder(page: Page) {
  return page.locator('main article').evaluateAll(nodes => nodes.flatMap((node) => {
    const id = node.getAttribute('data-bookmark-group-id')
    if (id)
      return [`group:${id}`]
    const link = node.querySelector<HTMLAnchorElement>('a[data-nav-item]')
    return link ? [`bookmark:${new URL(link.href).pathname}`] : []
  }))
}

test('renders one batch, loads the rest, and resets after a reload', async ({ extensionWorker, newTabPage }) => {
  await seedGroups(extensionWorker)
  await newTabPage.reload()
  await openGroupsEntry(newTabPage)

  await expect(groupCards(newTabPage)).toHaveCount(BATCH_SIZE)
  await expect(groupLoadMore(newTabPage)).toHaveAccessibleName(/书签组/)
  await expect(groupLoadMore(newTabPage)).toHaveAccessibleName(/剩余 10 项/)
  await expect(newTabPage.locator(`[data-bookmark-group-id="${groupId(49)}"]`)).toBeVisible()
  // The later groups are absent from the DOM, not merely scrolled out of view.
  await expect(newTabPage.locator(`[data-bookmark-group-id="${groupId(59)}"]`)).toHaveCount(0)

  await groupLoadMore(newTabPage).click()
  await expect(groupCards(newTabPage)).toHaveCount(GROUP_COUNT)
  await expect(newTabPage.locator(`[data-bookmark-group-id="${groupId(59)}"]`)).toBeVisible()
  await expect(groupLoadMore(newTabPage)).toHaveCount(0)

  await newTabPage.reload()
  await openGroupsEntry(newTabPage)
  await expect(groupCards(newTabPage)).toHaveCount(BATCH_SIZE)
})

test('keeps the full total and pinned interleave while batching groups', async ({ extensionWorker, newTabPage }) => {
  await seedGroups(extensionWorker, { pinned: true, withPinnedBookmarks: true })
  await newTabPage.reload()
  await openPinned(newTabPage)

  await expect(groupCards(newTabPage)).toHaveCount(BATCH_SIZE)
  // Two pinned bookmarks never batch at this size, so the group control is the
  // only load-more button on the mixed page and cannot be ambiguous.
  await expect(groupLoadMore(newTabPage)).toHaveCount(1)
  await expect(newTabPage.getByText(`${GROUP_COUNT + pinnedFixtures.length} 个项目`, { exact: true })).toBeVisible()

  await groupLoadMore(newTabPage).click()
  await expect(groupCards(newTabPage)).toHaveCount(GROUP_COUNT)
  await expect(newTabPage.locator('main article')).toHaveCount(GROUP_COUNT + pinnedFixtures.length)
  // Groups and pinned bookmarks stay ranked together after the batch grows.
  const expected = [
    `group:${groupId(0)}`,
    `group:${groupId(1)}`,
    `group:${groupId(2)}`,
    'bookmark:/pagination/pm-a',
    `group:${groupId(3)}`,
    `group:${groupId(4)}`,
    `group:${groupId(5)}`,
    'bookmark:/pagination/pm-b',
    ...Array.from({ length: GROUP_COUNT - 6 }, (_, offset) => `group:${groupId(offset + 6)}`),
  ]
  await expect.poll(() => mixedOrder(newTabPage)).toEqual(expected)
})

test('filters groups by search, resets the batch, and restores the full total', async ({ extensionWorker, newTabPage }) => {
  await seedGroups(extensionWorker, { pinned: true, withPinnedBookmarks: true })
  await newTabPage.reload()
  await openPinned(newTabPage)

  // Load everything first so the search reset is observable instead of a fresh mount.
  await groupLoadMore(newTabPage).click()
  await expect(groupCards(newTabPage)).toHaveCount(GROUP_COUNT)

  await newTabPage.locator('#yunji-tab-search').fill(SEARCH_TOKEN)
  // 55 matching groups reset the window to 50 with 5 remaining; the total still
  // reports every match, and no bookmark matches the token.
  await expect(groupCards(newTabPage)).toHaveCount(BATCH_SIZE)
  await expect(groupLoadMore(newTabPage)).toHaveAccessibleName(/剩余 5 项/)
  await expect(newTabPage.getByText(`${SEARCH_MATCH_COUNT} 个项目`, { exact: true })).toBeVisible()
  await expect(newTabPage.locator(`[data-bookmark-group-id="${groupId(55)}"]`)).toHaveCount(0)

  // Clearing without loading another batch must discard the previous expanded
  // window too, rather than resurrecting its limit when the old query returns.
  await newTabPage.locator('#yunji-tab-search').fill('')
  await expect(groupCards(newTabPage)).toHaveCount(BATCH_SIZE)
  await newTabPage.locator('#yunji-tab-search').fill(SEARCH_TOKEN)
  await expect(groupLoadMore(newTabPage)).toHaveAccessibleName(/剩余 5 项/)

  await groupLoadMore(newTabPage).click()
  await expect(groupCards(newTabPage)).toHaveCount(SEARCH_MATCH_COUNT)
  await expect(groupLoadMore(newTabPage)).toHaveCount(0)

  await newTabPage.locator('#yunji-tab-search').fill('')
  await expect(groupCards(newTabPage)).toHaveCount(BATCH_SIZE)
  await expect(newTabPage.getByText(`${GROUP_COUNT + pinnedFixtures.length} 个项目`, { exact: true })).toBeVisible()
})

test('keeps a boundary card menu toggleable across a batch change', async ({ extensionWorker, newTabPage }) => {
  await seedGroups(extensionWorker)
  await newTabPage.reload()
  await openGroupsEntry(newTabPage)

  const boundaryTitle = groupTitle(49)
  const boundary = newTabPage.getByRole('button', { name: `查看书签组 ${boundaryTitle}`, exact: true })
  await boundary.click()
  await expect(newTabPage.getByRole('menuitem', { name: `打开书签 成员 ${boundaryTitle}`, exact: true })).toBeVisible()
  await newTabPage.keyboard.press('Escape')
  await expect(newTabPage.getByRole('menu')).toHaveCount(0)

  // Reopening the same trigger proves the dismissal did not stick to the card.
  await boundary.click()
  await expect(newTabPage.getByRole('menu', { name: `查看书签组 ${boundaryTitle}`, exact: true })).toBeVisible()
  // Growing the batch is an outside interaction, so it dismisses the menu and
  // must not leave the card stuck closed.
  await groupLoadMore(newTabPage).click()
  await expect(groupCards(newTabPage)).toHaveCount(GROUP_COUNT)
  await expect(newTabPage.getByRole('menu')).toHaveCount(0)
  await boundary.click()
  await expect(newTabPage.getByRole('menuitem', { name: `打开书签 成员 ${boundaryTitle}`, exact: true })).toBeVisible()
  await newTabPage.keyboard.press('Escape')
  // A card revealed by the expanded batch window keeps its own menu wiring.
  const revealed = newTabPage.getByRole('button', { name: `查看书签组 ${groupTitle(59)}`, exact: true })
  await revealed.click()
  await expect(newTabPage.getByRole('menuitem', { name: `打开书签 成员 ${groupTitle(59)}`, exact: true })).toBeVisible()
})
