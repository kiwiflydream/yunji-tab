import { expect, test } from './extension.fixture'

const manifestKey = 'yunji-tab:metadata-sync:manifest'

interface StartupProbe {
  rejections: string[]
  stubCalls: number
}

declare global {
  interface Window {
    __startupProbe?: StartupProbe
  }
}

// Wraps the app's metadata-sync manifest read while leaving settings reads
// (a different key) untouched, and records that the stub actually fired so the
// assertions can't pass on an unexercised code path.
async function installMetadataSyncManifestStub(
  page: import('@playwright/test').Page,
  mode: 'hang' | 'reject',
  account: StartupProbe,
) {
  await page.addInitScript(
    ({ mode, manifestKey, probe }) => {
      window.__startupProbe = probe
      const recordStubCall = () => {
        probe.stubCalls += 1
      }
      const sync = chrome.storage.sync
      const originalGet = sync.get.bind(sync)
      const touchesManifest = (keys: unknown) =>
        keys === manifestKey
        || (Array.isArray(keys) && keys.includes(manifestKey))
      Object.defineProperty(sync, 'get', {
        configurable: true,
        writable: true,
        value: (keys?: unknown, callback?: unknown) => {
          if (touchesManifest(keys)) {
            recordStubCall()
            return mode === 'reject'
              ? Promise.reject(new Error('metadata sync unavailable'))
              : new Promise(() => {})
          }
          return (originalGet as (k?: unknown, cb?: unknown) => unknown)(
            keys,
            callback,
          )
        },
      })
      window.addEventListener('unhandledrejection', (event) => {
        probe.rejections.push(String(event.reason))
      })
    },
    { mode, manifestKey, probe: account },
  )
}

test('finishes loading before a slow metadata sync resolves', async ({ newTabPage }) => {
  const probe: StartupProbe = { rejections: [], stubCalls: 0 }
  await installMetadataSyncManifestStub(newTabPage, 'hang', probe)
  await newTabPage.reload()

  // 正向证据：stub 确实被命中（元数据同步已启动），骨架屏收起，页面标记为 ready，导航已渲染。
  await expect.poll(() => newTabPage.evaluate(() => window.__startupProbe?.stubCalls ?? 0)).toBeGreaterThan(0)
  await expect(newTabPage.locator('.newtab-shell')).toHaveAttribute(
    'data-newtab-ready',
    'true',
  )
  await expect(newTabPage.getByTestId('bookmark-grid-loading')).toHaveCount(0)
  await expect(newTabPage.getByLabel('搜索书签和目录')).toBeVisible()
  await expect(newTabPage.locator('nav button').first()).toBeVisible()
  expect(await newTabPage.evaluate(() => window.__startupProbe?.rejections ?? []))
    .toEqual([])
})

test('stays ready and reports no unhandled rejection when metadata sync rejects', async ({ newTabPage }) => {
  const probe: StartupProbe = { rejections: [], stubCalls: 0 }
  await installMetadataSyncManifestStub(newTabPage, 'reject', probe)
  await newTabPage.reload()

  // 先确认 stub 被触发并已发生真实失败（重试耗尽），再断言页面仍 ready 且无冒泡 rejection。
  await expect.poll(() => newTabPage.evaluate(() => window.__startupProbe?.stubCalls ?? 0)).toBeGreaterThanOrEqual(3)
  await expect.poll(() => newTabPage.evaluate(async () => {
    const key = 'yunji-tab:metadata-sync-log'
    const raw = (await chrome.storage.local.get(key))[key]
    const log = typeof raw === 'string' ? JSON.parse(raw) : raw
    return log?.[0]?.state
  })).toBe('error')
  await expect(newTabPage.locator('.newtab-shell')).toHaveAttribute(
    'data-newtab-ready',
    'true',
  )
  await expect(newTabPage.getByTestId('bookmark-grid-loading')).toHaveCount(0)
  await newTabPage.getByLabel('搜索书签和目录').fill('startup probe')
  await expect.poll(() => newTabPage.evaluate(() => window.__startupProbe?.rejections ?? []))
    .toEqual([])
})
