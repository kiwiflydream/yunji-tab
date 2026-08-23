import { expect, test } from './extension.fixture'

test('measures new tab memory metrics on initial open', async ({ newTabPage }) => {
  await newTabPage.waitForTimeout(500)

  const client = await newTabPage.context().newCDPSession(newTabPage)
  await client.send('HeapProfiler.enable')
  await client.send('HeapProfiler.collectGarbage')
  await client.send('Performance.enable')
  const { metrics } = await client.send('Performance.getMetrics')
  const metricsMap = Object.fromEntries(metrics.map(m => [m.name, m.value]))
  const usedHeapMB = (metricsMap.JSHeapUsedSize ?? 0) / (1024 * 1024)

  // Baseline JS heap should remain well below 20MB on initial open after GC
  expect(usedHeapMB).toBeLessThan(20)
})

test('measures new tab memory metrics with 500 bookmarks', async ({ newTabPage }) => {
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
  await newTabPage.waitForTimeout(600)

  const client = await newTabPage.context().newCDPSession(newTabPage)
  await client.send('HeapProfiler.enable')
  await client.send('HeapProfiler.collectGarbage')
  await client.send('Performance.enable')
  const { metrics } = await client.send('Performance.getMetrics')
  const metricsMap = Object.fromEntries(metrics.map(m => [m.name, m.value]))
  const usedHeapMB = (metricsMap.JSHeapUsedSize ?? 0) / (1024 * 1024)

  // Heap with 500 bookmarks should stay under 30MB
  expect(usedHeapMB).toBeLessThan(30)
})
