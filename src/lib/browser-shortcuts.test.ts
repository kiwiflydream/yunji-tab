import { describe, expect, it, vi } from 'vitest'
import {
  CHROME_SHORTCUT_SETTINGS_URL,
  EDGE_SHORTCUT_SETTINGS_URL,
  openBrowserShortcutSettings,
  resolveBrowserShortcutSettingsTarget,
} from './browser-shortcuts'

describe('browser shortcut settings', () => {
  it('uses the Edge settings URL for an Edge user agent', () => {
    const target = resolveBrowserShortcutSettingsTarget(
      'Mozilla/5.0 Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
    )

    expect(target).toEqual({
      browser: 'edge',
      primaryUrl: EDGE_SHORTCUT_SETTINGS_URL,
      urls: [EDGE_SHORTCUT_SETTINGS_URL, CHROME_SHORTCUT_SETTINGS_URL],
    })
  })

  it('detects Edge from user-agent client hints', () => {
    const target = resolveBrowserShortcutSettingsTarget(
      'Mozilla/5.0 Chrome/126.0.0.0 Safari/537.36',
      ['Chromium', 'Microsoft Edge'],
    )

    expect(target.primaryUrl).toBe(EDGE_SHORTCUT_SETTINGS_URL)
  })

  it('uses the Chromium-compatible URL for Chrome and unknown browsers', () => {
    const target = resolveBrowserShortcutSettingsTarget(
      'Mozilla/5.0 Chrome/126.0.0.0 Safari/537.36',
    )

    expect(target).toEqual({
      browser: 'chromium',
      primaryUrl: CHROME_SHORTCUT_SETTINGS_URL,
      urls: [CHROME_SHORTCUT_SETTINGS_URL],
    })
  })

  it('falls back to the Chrome URL when Edge rejects its primary URL', async () => {
    const target = resolveBrowserShortcutSettingsTarget(
      'Mozilla/5.0 Edg/126.0.0.0',
    )
    const openTab = vi.fn()
      .mockRejectedValueOnce(new Error('blocked'))
      .mockResolvedValueOnce(undefined)

    await expect(openBrowserShortcutSettings(target, openTab))
      .resolves
      .toBe(CHROME_SHORTCUT_SETTINGS_URL)
    expect(openTab).toHaveBeenNthCalledWith(1, EDGE_SHORTCUT_SETTINGS_URL)
    expect(openTab).toHaveBeenNthCalledWith(2, CHROME_SHORTCUT_SETTINGS_URL)
  })

  it('reports an error when every browser URL is rejected', async () => {
    const target = resolveBrowserShortcutSettingsTarget('Chrome/126.0.0.0')
    const openTab = vi.fn().mockRejectedValue(new Error('blocked'))

    await expect(openBrowserShortcutSettings(target, openTab))
      .rejects
      .toThrow('blocked')
  })
})
