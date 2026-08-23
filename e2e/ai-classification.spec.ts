import { expect, test } from './extension.fixture'

async function openSettings(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '更多操作', exact: true }).click()
  await page.getByRole('menuitem', { name: '打开设置', exact: true }).click()
}

test('previews AI classification before moving a bookmark', async ({
  extensionWorker,
  newTabPage,
}) => {
  const seeded = await extensionWorker.evaluate(async () => {
    const source = await chrome.bookmarks.create({
      parentId: '1',
      title: 'AI Source',
    })
    const target = await chrome.bookmarks.create({
      parentId: '1',
      title: 'AI Target',
    })
    const bookmark = await chrome.bookmarks.create({
      parentId: source.id,
      title: 'AI Preview Bookmark',
      url: 'https://ai-preview.example/docs?private=value',
    })
    return {
      sourceId: source.id,
      targetId: target.id,
      bookmarkId: bookmark.id,
    }
  })
  await newTabPage.reload()
  let classificationRequestCount = 0
  await newTabPage.route(
    'https://www.google.com/v1/chat/completions',
    async (route) => {
      classificationRequestCount += 1
      if (classificationRequestCount === 1) {
        await route.fulfill({ status: 401, body: 'invalid token' })
        return
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  {
                    bookmarkId: `bm-${seeded.bookmarkId}`,
                    targetCategoryId: `cat-${seeded.targetId}`,
                    confidence: 0.94,
                    reason: 'Matches the target folder',
                  },
                ]),
              },
            },
          ],
        }),
      })
    },
  )

  await openSettings(newTabPage)
  await newTabPage.getByRole('tab', { name: 'AI', exact: true }).click()
  const classificationTop = await newTabPage
    .getByRole('heading', {
      name: '智能分类',
      exact: true,
    })
    .evaluate(element => element.getBoundingClientRect().top)
  const configurationTrigger = newTabPage.getByRole('button', {
    name: /OpenAI 兼容配置/,
  })
  const providerTop = await configurationTrigger.evaluate(
    element => element.getBoundingClientRect().top,
  )
  expect(classificationTop).toBeLessThan(providerTop)
  await expect(newTabPage.getByLabel('Base URL')).not.toBeVisible()
  await configurationTrigger.click()
  await expect(newTabPage.getByLabel('Base URL')).toBeVisible()
  await expect(newTabPage.getByLabel('每批书签数')).toHaveValue('80')
  await newTabPage.getByLabel('Base URL').fill('https://www.google.com/v1')
  await newTabPage
    .getByRole('textbox', { name: 'Token', exact: true })
    .fill('e2e-token')
  await newTabPage.getByLabel('模型').fill('e2e-model')
  await newTabPage.getByRole('button', { name: '生成分类预览' }).click()

  const requestError = newTabPage.getByText(
    'AI 请求失败，请检查地址、Token、模型和服务兼容性。',
    { exact: true },
  )
  await expect(requestError).toBeVisible()
  const generateButtonBottom = await newTabPage
    .getByRole('button', {
      name: '生成分类预览',
    })
    .evaluate(element => element.getBoundingClientRect().bottom)
  const errorTop = await requestError.evaluate(
    element => element.getBoundingClientRect().top,
  )
  expect(errorTop).toBeGreaterThanOrEqual(generateButtonBottom)

  await newTabPage.getByRole('button', { name: '生成分类预览' }).click()

  await expect(
    newTabPage.getByRole('heading', { name: '智能分类预览' }),
  ).toBeVisible()
  await expect(newTabPage.getByText('AI Source / AI Target')).toHaveCount(0)
  expect(
    await extensionWorker.evaluate(
      async bookmarkId =>
        (await chrome.bookmarks.get(bookmarkId))[0].parentId,
      seeded.bookmarkId,
    ),
  ).toBe(seeded.sourceId)

  await newTabPage.getByRole('button', { name: '取消' }).click()
  expect(
    await extensionWorker.evaluate(
      async bookmarkId =>
        (await chrome.bookmarks.get(bookmarkId))[0].parentId,
      seeded.bookmarkId,
    ),
  ).toBe(seeded.sourceId)

  await newTabPage.getByRole('button', { name: '生成分类预览' }).click()
  await newTabPage.getByRole('button', { name: '确认移动' }).click()
  await expect
    .poll(() =>
      extensionWorker.evaluate(
        async bookmarkId =>
          (await chrome.bookmarks.get(bookmarkId))[0].parentId,
        seeded.bookmarkId,
      ),
    )
    .toBe(seeded.targetId)
  await expect(
    newTabPage.getByRole('button', { name: '撤销智能分类' }),
  ).toBeVisible()

  const syncStorage = await extensionWorker.evaluate(async () =>
    chrome.storage.sync.get(null),
  )
  expect(JSON.stringify(syncStorage)).not.toContain('e2e-token')
})
