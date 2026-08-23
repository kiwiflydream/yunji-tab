export const CHROME_SHORTCUT_SETTINGS_URL
  = 'chrome://extensions/shortcuts'
export const EDGE_SHORTCUT_SETTINGS_URL = 'edge://extensions/shortcuts'

export interface BrowserShortcutSettingsTarget {
  browser: 'edge' | 'chromium'
  primaryUrl: string
  urls: string[]
}

interface NavigatorWithUserAgentData extends Navigator {
  userAgentData?: {
    brands?: Array<{ brand: string }>
  }
}

export type BrowserShortcutTabOpener = (url: string) => Promise<unknown>

export function resolveBrowserShortcutSettingsTarget(
  userAgent: string,
  brands: readonly string[] = [],
): BrowserShortcutSettingsTarget {
  const isEdge
    = /\bEdg(?:A|iOS)?\//i.test(userAgent)
      || brands.some(brand => /Microsoft Edge/i.test(brand))

  if (isEdge) {
    return {
      browser: 'edge',
      primaryUrl: EDGE_SHORTCUT_SETTINGS_URL,
      urls: [EDGE_SHORTCUT_SETTINGS_URL, CHROME_SHORTCUT_SETTINGS_URL],
    }
  }

  return {
    browser: 'chromium',
    primaryUrl: CHROME_SHORTCUT_SETTINGS_URL,
    urls: [CHROME_SHORTCUT_SETTINGS_URL],
  }
}

export function getBrowserShortcutSettingsTarget(): BrowserShortcutSettingsTarget {
  if (typeof navigator === 'undefined')
    return resolveBrowserShortcutSettingsTarget('')

  const currentNavigator = navigator as NavigatorWithUserAgentData
  return resolveBrowserShortcutSettingsTarget(
    currentNavigator.userAgent,
    currentNavigator.userAgentData?.brands?.map(({ brand }) => brand),
  )
}

async function openBrowserTab(url: string): Promise<unknown> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.create)
    throw new Error('Browser tabs API is unavailable')
  return chrome.tabs.create({ url })
}

export async function openBrowserShortcutSettings(
  target: BrowserShortcutSettingsTarget,
  openTab: BrowserShortcutTabOpener = openBrowserTab,
): Promise<string> {
  let lastError: unknown

  for (const url of target.urls) {
    try {
      await openTab(url)
      return url
    }
    catch (error) {
      lastError = error
    }
  }

  if (lastError instanceof Error)
    throw lastError
  throw new Error('Unable to open browser shortcut settings')
}
