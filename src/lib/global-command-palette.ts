import type { Bookmark, Category, Language, ThemeMode } from './types'

export const openGlobalCommandPaletteCommand = 'open-global-command-palette'
export const globalPaletteSessionPrefix = 'yunji-tab:global-palette-session:'
export const globalPaletteValidateMessage = 'yunji-tab:global-palette-validate'
export const globalPaletteOpenForTabMessage = 'yunji-tab:global-palette-open-for-tab'
export const globalPaletteOpenBookmarkMessage
  = 'yunji-tab:global-palette-open-bookmark'
export const globalPaletteSavePageMessage
  = 'yunji-tab:global-palette-save-page'
export const globalPaletteOpenHomeMessage
  = 'yunji-tab:global-palette-open-home'
export const globalPaletteCloseMessage = 'yunji-tab:global-palette-close'
export const globalPaletteHomeHash = '#command-palette'

export const globalPaletteSessionTtlMs = 5 * 60 * 1000

export interface GlobalPaletteSession {
  expiresAt: number
  tabId: number
}

export interface GlobalPaletteData {
  bookmarks: Bookmark[]
  categories: Category[]
  language: Language
  theme: ThemeMode
}

export function globalPaletteSessionKey(token: string): string {
  return `${globalPaletteSessionPrefix}${token}`
}

export function isGlobalPaletteSessionValid(
  session: unknown,
  expectedTabId: number | undefined,
  now = Date.now(),
): session is GlobalPaletteSession {
  if (!session || typeof session !== 'object')
    return false
  const candidate = session as Partial<GlobalPaletteSession>
  return (
    typeof candidate.tabId === 'number'
    && typeof candidate.expiresAt === 'number'
    && candidate.expiresAt > now
    && (expectedTabId === undefined || candidate.tabId === expectedTabId)
  )
}

/**
 * Runs inside Chrome's isolated scripting world. Keep this function
 * self-contained because chrome.scripting serializes it before execution.
 */
export function toggleGlobalCommandPalette(
  iframeUrl: string,
  sessionToken: string,
): 'closed' | 'opened' {
  const hostId = 'yunji-tab-global-command-palette'
  type PaletteHost = HTMLDivElement & { cleanupPalette?: () => void }
  const existingHost = document.getElementById(hostId) as PaletteHost | null
  if (existingHost) {
    existingHost.cleanupPalette?.()
    return 'closed'
  }

  const host = document.createElement('div') as PaletteHost
  host.id = hostId
  host.style.cssText
    = 'all:initial;position:fixed;inset:0;z-index:2147483647;display:block;'
  const shadow = host.attachShadow({ mode: 'closed' })

  const backdrop = document.createElement('button')
  backdrop.type = 'button'
  backdrop.setAttribute('aria-label', 'Close Yunji Tab command palette')
  backdrop.style.cssText
    = 'all:initial;position:absolute;inset:0;display:block;background:rgba(9,12,20,.46);backdrop-filter:blur(3px);cursor:default;'

  const iframe = document.createElement('iframe')
  iframe.src = iframeUrl
  iframe.title = 'Yunji Tab command palette'
  iframe.style.cssText
    = 'all:initial;position:absolute;left:50%;top:max(24px,12vh);transform:translateX(-50%);display:block;width:min(680px,calc(100vw - 24px));height:min(610px,calc(100vh - max(48px,12vh)));border:0;background:transparent;color-scheme:light dark;'

  const listenerController = new AbortController()
  const close = () => {
    listenerController.abort()
    host.remove()
    void chrome.runtime.sendMessage({
      type: 'yunji-tab:global-palette-close',
      token: sessionToken,
    }).catch(() => undefined)
  }
  const onMessage = (event: MessageEvent) => {
    if (
      event.source === iframe.contentWindow
      && event.data?.type === 'yunji-tab:global-palette-dismiss'
    ) {
      close()
    }
  }
  host.cleanupPalette = close
  backdrop.addEventListener('click', close, { once: true })
  window.addEventListener('message', onMessage, {
    signal: listenerController.signal,
  })
  window.addEventListener('pagehide', close, {
    once: true,
    signal: listenerController.signal,
  })

  shadow.append(backdrop, iframe)
  document.documentElement.append(host)
  return 'opened'
}
