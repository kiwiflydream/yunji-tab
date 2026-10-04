import { expect, test } from './extension.fixture'

test.beforeEach(async ({ extensionWorker, newTabPage }) => {
  await extensionWorker.evaluate(async () => {
    const key = 'yunji-tab:settings'
    const stored = (await chrome.storage.sync.get(key))[key]
    const settings = stored ? JSON.parse(String(stored)) : {}
    await chrome.storage.sync.set({ [key]: JSON.stringify({ ...settings, language: 'zh-CN' }) })
  })
  await newTabPage.reload()
})

test('keeps engine menu focus when the search-mode animation frame completes', async ({ newTabPage }) => {
  await expect(newTabPage.getByLabel('搜索书签和目录')).toBeFocused()
  await expect(newTabPage.locator('[data-nav-item]').first()).toBeVisible()
  await newTabPage.evaluate(() => {
    const original = window.requestAnimationFrame
    const callbacks: FrameRequestCallback[] = []
    window.requestAnimationFrame = (callback) => {
      callbacks.push(callback)
      return callbacks.length
    }
    Object.assign(window, {
      finishSearchFrames: () => {
        window.requestAnimationFrame = original
        callbacks.forEach(callback => callback(performance.now()))
      },
    })
  })

  await newTabPage.getByRole('radio', { name: '搜索网页' }).click()
  await expect(newTabPage.getByLabel('搜索网页或输入网址')).toHaveValue('')
  await newTabPage.getByRole('button', { name: '选择网页搜索引擎' }).focus()
  await newTabPage.keyboard.press('Enter')
  const options = newTabPage.getByRole('menuitemradio')
  await expect(options.first()).toBeFocused()
  await newTabPage.evaluate(() => {
    (window as typeof window & { finishSearchFrames: () => void }).finishSearchFrames()
  })
  await expect(options.first()).toBeFocused()

  await newTabPage.evaluate(() => {
    Object.assign(window, { bookmarkFocusCount: 0 })
    document.addEventListener('focusin', (event) => {
      if ((event.target as HTMLElement).matches('[data-nav-item]')) {
        const tracked = window as typeof window & { bookmarkFocusCount: number }
        tracked.bookmarkFocusCount += 1
      }
    })
  })
  await newTabPage.keyboard.press('ArrowDown')
  await expect(options.nth(1)).toBeFocused()
  expect(await newTabPage.evaluate(() =>
    (window as typeof window & { bookmarkFocusCount: number }).bookmarkFocusCount)).toBe(0)
  await newTabPage.keyboard.press('Escape')
  await expect(newTabPage.getByLabel('搜索网页或输入网址')).toBeFocused()
})

test('moves settings focus with every rapid arrow-key event', async ({ newTabPage }) => {
  await newTabPage.getByRole('button', { name: '更多操作', exact: true }).click()
  await newTabPage.getByRole('menuitem', { name: '打开设置', exact: true }).click()
  await newTabPage.getByRole('tab', { name: '常规' }).focus()
  await newTabPage.evaluate(() => {
    for (const key of ['ArrowDown', 'ArrowRight', 'ArrowRight']) {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
      }))
    }
  })
  const search = newTabPage.getByRole('tab', { name: '搜索' })
  await expect(search).toHaveAttribute('aria-selected', 'true')
  await expect(search).toBeFocused()
})

test('opens the restored bookmark search result without clicking a stale directory', async ({
  extensionWorker,
  newTabPage,
}) => {
  const url = 'https://example.com/keyboard-search-result'
  await extensionWorker.evaluate(async (url) => {
    await chrome.bookmarks.create({ parentId: '1', title: 'Keyboard Search Result', url })
  }, url)
  await newTabPage.reload()
  const input = newTabPage.getByLabel('搜索书签和目录')
  await input.fill('Keyboard Search Result')
  await expect(newTabPage.getByText('Keyboard Search Result', { exact: true })).toBeVisible()
  await newTabPage.getByRole('radio', { name: '搜索网页' }).click()
  await expect(newTabPage.getByLabel('搜索网页或输入网址')).toHaveValue('Keyboard Search Result')
  await expect(newTabPage.getByRole('button', { name: '打开目录 Bookmarks Bar', exact: true })).toBeVisible()
  await newTabPage.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('[role="radio"][aria-label="搜索书签"]')!
    button.click()
    // Submit after the mode commit, before deferred filtering gets another task.
    queueMicrotask(() => {
      const input = document.querySelector<HTMLInputElement>('#yunji-tab-search')!
      const first = Array.from(document.querySelectorAll<HTMLElement>('[data-nav-item]'))
        .find(item => item.offsetParent !== null)
      Object.assign(window, {
        immediateSearch: {
          label: input.getAttribute('aria-label'),
          value: input.value,
          firstLabel: first?.getAttribute('aria-label'),
        },
      })
      input.focus()
      input.form!.requestSubmit()
    })
  })
  const immediate = await newTabPage.evaluate(() =>
    (window as typeof window & {
      immediateSearch: { label: string, value: string, firstLabel: string }
    }).immediateSearch)
  expect(immediate.label).toBe('搜索书签和目录')
  expect(immediate.value).toBe('Keyboard Search Result')
  expect(immediate.firstLabel).toContain('Bookmarks Bar')
  await expect.poll(async () => extensionWorker.evaluate(async url =>
    (await chrome.tabs.query({})).some(tab => tab.url === url), url)).toBe(true)
  await extensionWorker.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({})
    for (const tab of tabs) {
      if (tab.url === url && tab.id)
        await chrome.tabs.remove(tab.id)
    }
  }, url)
})
