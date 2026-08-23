import type { BrowserContext, Page, Worker } from '@playwright/test'
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test as base, chromium } from '@playwright/test'

interface ExtensionWorkerFixtures {
  extensionContext: BrowserContext
  extensionId: string
  extensionWorker: Worker
}

interface ExtensionTestFixtures {
  newTabPage: Page
}

export const test = base.extend<ExtensionTestFixtures, ExtensionWorkerFixtures>({
  extensionContext: [async ({}, use) => {
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'yunji-tab-e2e-'))
    const extensionPath = path.resolve('build/chrome-mv3-prod')
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      locale: 'zh-CN',
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    })
    await use(context)
    await context.close()
  }, { scope: 'worker' }],

  extensionWorker: [async ({ extensionContext }, use) => {
    let [worker] = extensionContext.serviceWorkers()
    worker ??= await extensionContext.waitForEvent('serviceworker')
    await use(worker)
  }, { scope: 'worker' }],

  extensionId: [async ({ extensionWorker }, use) => {
    await use(new URL(extensionWorker.url()).host)
  }, { scope: 'worker' }],

  newTabPage: async ({ extensionContext, extensionId }, use) => {
    const page = await extensionContext.newPage()
    await page.goto(`chrome-extension://${extensionId}/newtab.html`)
    await page.waitForLoadState('domcontentloaded')
    await use(page)
    await page.close()
  },
})

export { expect } from '@playwright/test'
