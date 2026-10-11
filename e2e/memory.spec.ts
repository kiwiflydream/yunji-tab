import { resolveBrowserLanguage, translate } from '../src/lib/i18n'
import { expect, test } from './extension.fixture'

test('measures new tab memory metrics on initial open', async ({ newTabPage }) => {
  // 正向等待真实加载完成：页面标记 ready 且骨架屏收起后再采样，避免在初始化中途读到空指标。
  await expect(newTabPage.locator('.newtab-shell')).toHaveAttribute(
    'data-newtab-ready',
    'true',
  )
  await expect(newTabPage.getByTestId('bookmark-grid-loading')).toHaveCount(0)

  const client = await newTabPage.context().newCDPSession(newTabPage)
  await client.send('HeapProfiler.enable')
  await client.send('HeapProfiler.collectGarbage')
  await client.send('Performance.enable')
  const { metrics } = await client.send('Performance.getMetrics')
  const metricsMap = Object.fromEntries(metrics.map(m => [m.name, m.value]))
  const heapBytes = metricsMap.JSHeapUsedSize

  expect(metrics.length).toBeGreaterThan(0)
  expect(Number.isFinite(heapBytes)).toBe(true)
  expect(heapBytes).toBeGreaterThan(0)
  const usedHeapMB = heapBytes / (1024 * 1024)

  // Baseline JS heap should remain well below 20MB on initial open after GC
  expect(usedHeapMB).toBeLessThan(20)
})

test('measures new tab memory metrics with 500 bookmarks', async ({ newTabPage }) => {
  const expectedCount = 500
  await newTabPage.evaluate(async () => {
    const parent = await chrome.bookmarks.create({ title: 'Perf Category', parentId: '1' })
    const promises = []
    for (let i = 0; i < 500; i++) {
      promises.push(
        chrome.bookmarks.create({
          parentId: parent.id,
          title: `Bookmark Benchmark Item ${i} 中文测试`,
          url: `https://site-${i}.example.com/docs/${i}`,
        }),
      )
    }
    await Promise.all(promises)
  })

  await newTabPage.reload()
  await newTabPage.waitForLoadState('domcontentloaded')
  // 明确等待真实加载：ready 标记 + 骨架屏收起后再确认 500 条数据全部进入视图。
  await expect(newTabPage.locator('.newtab-shell')).toHaveAttribute(
    'data-newtab-ready',
    'true',
  )
  await expect(newTabPage.getByTestId('bookmark-grid-loading')).toHaveCount(0)
  await newTabPage.getByLabel('搜索书签和目录').fill('Bookmark Benchmark Item')
  await expect(newTabPage.locator('[data-bookmark-search-query]')).toHaveAttribute(
    'data-bookmark-search-query',
    'Bookmark Benchmark Item',
  )
  // 工具条计数来自完整过滤结果，确认 500 条数据已加载（首屏仅渲染首批）。
  const language = resolveBrowserLanguage(
    await newTabPage.evaluate(() => navigator.language),
  )
  await expect(
    newTabPage.getByText(translate(language, 'itemCount', { count: expectedCount })),
  ).toBeVisible()
  await expect(
    newTabPage.locator('article a[data-nav-item]').first(),
  ).toBeVisible()

  const client = await newTabPage.context().newCDPSession(newTabPage)
  await client.send('HeapProfiler.enable')
  await client.send('HeapProfiler.collectGarbage')
  await client.send('Performance.enable')
  const { metrics } = await client.send('Performance.getMetrics')
  const metricsMap = Object.fromEntries(metrics.map(m => [m.name, m.value]))
  const heapBytes = metricsMap.JSHeapUsedSize

  expect(metrics.length).toBeGreaterThan(0)
  expect(Number.isFinite(heapBytes)).toBe(true)
  expect(heapBytes).toBeGreaterThan(0)
  const usedHeapMB = heapBytes / (1024 * 1024)

  // Heap with 500 bookmarks should stay under 30MB
  expect(usedHeapMB).toBeLessThan(30)
})
