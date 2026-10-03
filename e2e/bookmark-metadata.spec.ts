import type { Page } from '@playwright/test'
import { expect, test } from './extension.fixture'

async function editBookmark(page: Page, name: string) {
  await page.getByRole('button', { name: `更多操作 ${name}`, exact: true }).click()
  await page.getByRole('menuitem', { name: '编辑书签', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const field = page.getByLabel('备用 URL（可选）', { exact: true })
  try {
    await expect(field).toBeVisible({ timeout: 1_000 })
  }
  catch {
    await page.getByRole('button', { name: /更多选项/ }).click()
  }
  await expect(field).toBeVisible()
  return field
}

test('reflects alternate URL changes in another open home page', async ({
  extensionContext,
  extensionWorker,
  newTabPage,
}) => {
  const name = 'Live metadata update'
  await extensionWorker.evaluate(async name =>
    chrome.bookmarks.create({ parentId: '1', title: name, url: 'https://live-meta.example/' }), name)
  await newTabPage.reload()
  const otherPage = await extensionContext.newPage()
  try {
    await otherPage.goto(newTabPage.url())
    await expect(otherPage.getByRole('button', { name: `更多操作 ${name}`, exact: true })).toBeVisible()
    const field = await editBookmark(newTabPage, name)
    await field.fill('https://backup.example/\nhttps://intranet.example/')
    await newTabPage.getByRole('button', { name: '保存', exact: true }).click()
    await expect(newTabPage.getByRole('dialog')).toBeHidden()

    const received = await editBookmark(otherPage, name)
    await expect(received).toHaveValue('https://backup.example/\nhttps://intranet.example/')
  }
  finally {
    await otherPage.close()
  }
})

test('keeps new alternate URLs when an already-open old editor saves another field', async ({
  extensionContext,
  extensionWorker,
  newTabPage,
}) => {
  const name = 'Stale metadata editor'
  const url = 'https://stale-meta.example/'
  await extensionWorker.evaluate(async ({ name, url }) => {
    await chrome.bookmarks.create({ parentId: '1', title: name, url })
    const key = 'yunji-tab:meta'
    const stored = await chrome.storage.local.get(key)
    const meta = typeof stored[key] === 'string' ? JSON.parse(stored[key]) : {}
    meta[url] = { alternateUrls: ['https://old.example/'] }
    await chrome.storage.local.set({ [key]: JSON.stringify(meta) })
  }, { name, url })
  await newTabPage.reload()
  const oldPage = await extensionContext.newPage()
  try {
    await oldPage.goto(newTabPage.url())
    const oldField = await editBookmark(oldPage, name)
    await expect(oldField).toHaveValue('https://old.example/')
    await oldPage.getByLabel('描述（可选）', { exact: true }).fill('Only description changed')

    const field = await editBookmark(newTabPage, name)
    await field.fill('https://new.example/\nhttps://intranet.example/')
    await newTabPage.getByRole('button', { name: '保存', exact: true }).click()
    await expect(newTabPage.getByRole('dialog')).toBeHidden()
    await oldPage.getByRole('button', { name: '保存', exact: true }).click()
    await expect(oldPage.getByRole('dialog')).toBeHidden()

    await expect.poll(() => extensionWorker.evaluate(async (url) => {
      const stored = await chrome.storage.local.get('yunji-tab:meta')
      const raw = stored['yunji-tab:meta']
      return typeof raw === 'string' ? JSON.parse(raw)[url] : undefined
    }, url)).toEqual({
      alternateUrls: ['https://new.example/', 'https://intranet.example/'],
      description: 'Only description changed',
    })
    await newTabPage.reload()
    await expect(await editBookmark(newTabPage, name))
      .toHaveValue('https://new.example/\nhttps://intranet.example/')
  }
  finally {
    await oldPage.close()
  }
})
