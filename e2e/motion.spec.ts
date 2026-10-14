import type { Page } from '@playwright/test'
import { expect, test } from './extension.fixture'

async function switchLayout(page: Page, name: string) {
  await page.getByRole('button', { name: '更多操作', exact: true }).click()
  await page.getByRole('menuitem', { name, exact: true }).click()
}

test('updates card view without a page error when the browser skips the transition', async ({ extensionWorker, newTabPage }) => {
  const url = 'https://example.com/skipped-motion'
  const original = await extensionWorker.evaluate(async (url) => {
    const settings = await chrome.storage.sync.get('yunji-tab:settings')
    await chrome.bookmarks.create({ parentId: '1', title: 'Skipped motion', url })
    await chrome.storage.sync.set({ 'yunji-tab:settings': JSON.stringify({ language: 'zh-CN', onboardingDismissed: true, defaultCategoryId: 'all', appearance: { homeLayout: 'workspace' } }) })
    return settings
  }, url)
  const errors: string[] = []
  newTabPage.on('pageerror', error => errors.push(error.message))
  try {
    await newTabPage.reload()
    await expect(newTabPage.getByText('Skipped motion', { exact: true })).toBeVisible()
    await newTabPage.evaluate(() => {
      const start = document.startViewTransition.bind(document)
      document.startViewTransition = ((update: ViewTransitionUpdateCallback) => {
        const transition = start(update)
        transition.skipTransition()
        return transition
      }) as typeof document.startViewTransition
    })
    await newTabPage.getByRole('radio', { name: '紧凑视图', exact: true }).click()
    await expect(newTabPage.getByRole('radio', { name: '紧凑视图', exact: true })).toBeChecked()
    await expect(newTabPage.locator('html')).not.toHaveClass(/card-morph/)
    await expect.poll(() => extensionWorker.evaluate(async () => JSON.parse(String((await chrome.storage.sync.get('yunji-tab:settings'))['yunji-tab:settings'])).bookmarkViewMode)).toBe('compact')
    expect(errors).toEqual([])
  }
  finally {
    await extensionWorker.evaluate(async ({ original, url }) => {
      for (const bookmark of await chrome.bookmarks.search({ url }))
        await chrome.bookmarks.remove(bookmark.id)
      await chrome.storage.sync.remove('yunji-tab:settings')
      await chrome.storage.sync.set(original)
    }, { original, url })
  }
})

test('accepts undo before expiry even when the next snapshot reaches the deadline', async ({ extensionWorker, newTabPage }) => {
  const url = 'https://example.com/undo-motion-deadline'
  const original = await extensionWorker.evaluate(async (url) => {
    const settings = await chrome.storage.sync.get('yunji-tab:settings')
    await chrome.bookmarks.create({ parentId: '1', title: 'Undo deadline', url })
    await chrome.storage.sync.set({ 'yunji-tab:settings': JSON.stringify({ language: 'zh-CN', onboardingDismissed: true, defaultCategoryId: 'all', appearance: { homeLayout: 'workspace' } }) })
    return settings
  }, url)
  try {
    await newTabPage.addInitScript(() => {
      const set = window.setTimeout.bind(window)
      const clear = window.clearTimeout.bind(window)
      let expiry: { id: number, fire: () => void } | undefined
      window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
        const id = set(handler, delay, ...args)
        if (delay === 10_000 && typeof handler === 'function')
          expiry = { id, fire: () => handler(...args) }
        return id
      }) as typeof window.setTimeout
      window.clearTimeout = (id) => {
        if (expiry?.id === id)
          expiry = undefined
        clear(id)
      }
      // Reach the undo deadline precisely when its transition begins taking a snapshot.
      document.addEventListener('expire-undo-at-snapshot', () => {
        const start = document.startViewTransition.bind(document)
        document.startViewTransition = ((update: ViewTransitionUpdateCallback) => {
          if (expiry) {
            const pending = expiry
            expiry = undefined
            clear(pending.id)
            pending.fire()
          }
          return start(update)
        }) as typeof document.startViewTransition
      }, { once: true })
    })
    await newTabPage.reload()
    await newTabPage.getByLabel('更多操作 Undo deadline', { exact: true }).click()
    await newTabPage.getByRole('menuitem', { name: '删除书签', exact: true }).click()
    await expect(newTabPage.getByRole('button', { name: '撤销', exact: true })).toBeVisible()
    await expect(newTabPage.locator('html')).not.toHaveClass(/card-morph/)
    await newTabPage.evaluate(() => document.dispatchEvent(new Event('expire-undo-at-snapshot')))
    await newTabPage.getByRole('button', { name: '撤销', exact: true }).click()
    await expect.poll(() => extensionWorker.evaluate(async url => (await chrome.bookmarks.search({ url })).length, url)).toBe(1)
    await expect(newTabPage.getByText('Undo deadline', { exact: true })).toBeVisible()
  }
  finally {
    await extensionWorker.evaluate(async ({ original, url }) => {
      for (const bookmark of await chrome.bookmarks.search({ url }))
        await chrome.bookmarks.remove(bookmark.id)
      await chrome.storage.sync.remove('yunji-tab:settings')
      await chrome.storage.sync.set(original)
    }, { original, url })
  }
})

test('finishes card entrances before a layout transition takes its snapshots', async ({ extensionWorker, newTabPage }) => {
  const original = await extensionWorker.evaluate(async () => {
    const settings = await chrome.storage.sync.get('yunji-tab:settings')
    const folder = await chrome.bookmarks.create({ parentId: '1', title: 'Motion folder' })
    await chrome.storage.sync.set({ 'yunji-tab:settings': JSON.stringify({ language: 'zh-CN', onboardingDismissed: true, appearance: { homeLayout: 'workspace' } }) })
    return { settings, folderId: folder.id }
  })
  try {
    await newTabPage.addInitScript(() => {
      const animate = Element.prototype.animate
      Element.prototype.animate = function (keyframes, options) {
        const animation = animate.call(this, keyframes, options)
        if (Array.isArray(keyframes) && keyframes.some(frame => frame.opacity === 0)) {
          animation.pause()
          animation.currentTime = 100
        }
        return animation
      }
    })
    await newTabPage.reload()
    await expect(newTabPage.locator('[data-slot="folder-card-icon"]').first()).toBeVisible()
    await expect.poll(() => newTabPage.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'paused').length)).toBeGreaterThan(0)
    await newTabPage.evaluate(() => {
      const transitionDocument = document as unknown as { startViewTransition: (update: () => void | Promise<void>) => Pick<ViewTransition, 'finished' | 'ready' | 'updateCallbackDone' | 'skipTransition'> }
      transitionDocument.startViewTransition = (update) => {
        document.documentElement.dataset.pendingAtSnapshot = String(document.getAnimations().filter(animation => animation.playState === 'paused').length)
        const updated = Promise.resolve().then(update)
        return { finished: updated, ready: updated, updateCallbackDone: updated, skipTransition: () => {} }
      }
    })
    await switchLayout(newTabPage, '切换到居中布局')
    await expect(newTabPage.locator('html')).toHaveAttribute('data-pending-at-snapshot', '0')
  }
  finally {
    await extensionWorker.evaluate(async ({ settings, folderId }) => {
      await chrome.bookmarks.removeTree(folderId)
      await chrome.storage.sync.remove('yunji-tab:settings')
      await chrome.storage.sync.set(settings)
    }, original)
  }
})

test('keeps a settled empty state visible after a layout transition', async ({ extensionWorker, newTabPage }) => {
  const original = await extensionWorker.evaluate(async () => {
    const settings = await chrome.storage.sync.get('yunji-tab:settings')
    const folder = await chrome.bookmarks.create({ parentId: '1', title: 'Empty motion folder' })
    await chrome.storage.sync.set({ 'yunji-tab:settings': JSON.stringify({ language: 'zh-CN', onboardingDismissed: true, appearance: { homeLayout: 'workspace' } }) })
    return { settings, folderId: folder.id }
  })
  try {
    await newTabPage.reload()
    await newTabPage.getByRole('navigation', { name: '书签分类' }).getByRole('button', { name: 'Empty motion folder', exact: true }).click()
    const panel = newTabPage.locator('.surface-panel.animate-in')
    await expect(panel).toBeVisible()
    await panel.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)))
    await newTabPage.getByRole('button', { name: '更多操作', exact: true }).click()
    // Watch from before the switch starts until its view transition has finished.
    await newTabPage.evaluate(() => {
      const root = document.documentElement
      let morphing = false
      const observer = new MutationObserver(() => {
        if (root.classList.contains('home-layout-morph')) {
          morphing = true
          return
        }
        if (!morphing)
          return
        observer.disconnect()
        const panel = document.querySelector('.surface-panel.animate-in')!
        root.dataset.replayed = String(panel.getAnimations().some(animation => animation.playState === 'running'))
      })
      observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    })
    await newTabPage.getByRole('menuitem', { name: '切换到居中布局', exact: true }).click()
    await expect(newTabPage.locator('html')).toHaveAttribute('data-replayed', 'false')
  }
  finally {
    await extensionWorker.evaluate(async ({ settings, folderId }) => {
      await chrome.bookmarks.removeTree(folderId)
      await chrome.storage.sync.remove('yunji-tab:settings')
      await chrome.storage.sync.set(settings)
    }, original)
  }
})
