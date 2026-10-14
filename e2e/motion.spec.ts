import { expect, test } from './extension.fixture'

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
    const pendingAtSnapshot = await newTabPage.evaluate(() => {
      let pending = -1
      const transitionDocument = document as unknown as { startViewTransition: (update: () => void) => { finished: Promise<void> } }
      transitionDocument.startViewTransition = (update) => {
        pending = document.getAnimations().filter(animation => animation.playState === 'paused').length
        update()
        return { finished: Promise.resolve() }
      }
      document.querySelector<HTMLButtonElement>('header button[aria-label="切换到居中布局"]')!.click()
      return pending
    })
    expect(pendingAtSnapshot).toBe(0)
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
    const replayed = await newTabPage.evaluate(() => new Promise<boolean>((resolve) => {
      const observer = new MutationObserver(() => {
        if (document.documentElement.classList.contains('home-layout-morph'))
          return
        observer.disconnect()
        const panel = document.querySelector('.surface-panel.animate-in')!
        resolve(panel.getAnimations().some(animation => animation.playState === 'running'))
      })
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
      document.querySelector<HTMLButtonElement>('header button[aria-label="切换到居中布局"]')!.click()
    }))
    expect(replayed).toBe(false)
  }
  finally {
    await extensionWorker.evaluate(async ({ settings, folderId }) => {
      await chrome.bookmarks.removeTree(folderId)
      await chrome.storage.sync.remove('yunji-tab:settings')
      await chrome.storage.sync.set(settings)
    }, original)
  }
})
