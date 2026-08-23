import { canonicalizeBookmarkUrl, normalizeBookmarkUrl } from './bookmark-urls'

export const tabSessionsStorageKey = 'yunji-tab:tab-sessions'
export const maxTabSessions = 50

export interface SavedTab {
  title: string
  url: string
}

export interface TabSession {
  id: string
  name: string
  createdAt: number
  tabs: SavedTab[]
  updatedAt?: number
}

export function collectSessionTabs(
  tabs: Array<Pick<chrome.tabs.Tab, 'title' | 'url'> & Partial<Pick<chrome.tabs.Tab, 'pinned'>>>,
  options: { excludePinned?: boolean } = {},
): SavedTab[] {
  const seen = new Set<string>()
  return tabs.flatMap((tab) => {
    if (options.excludePinned && tab.pinned)
      return []
    const url = normalizeBookmarkUrl(tab.url ?? '')
    if (!url)
      return []
    const canonical = canonicalizeBookmarkUrl(url)
    if (!canonical || seen.has(canonical))
      return []
    seen.add(canonical)
    return [{ title: tab.title?.trim() || new URL(url).hostname, url }]
  }).slice(0, 100)
}

export function parseTabSessions(
  value: unknown,
  fallbackName = 'Untitled session',
): TabSession[] {
  if (!Array.isArray(value))
    return []
  return value.flatMap((candidate) => {
    if (typeof candidate !== 'object' || candidate === null)
      return []
    const item = candidate as Partial<TabSession>
    if (typeof item.id !== 'string' || typeof item.name !== 'string'
      || typeof item.createdAt !== 'number' || !Array.isArray(item.tabs)) {
      return []
    }
    const tabs = item.tabs.flatMap((tab) => {
      if (typeof tab !== 'object' || tab === null)
        return []
      const saved = tab as Partial<SavedTab>
      const url = normalizeBookmarkUrl(saved.url ?? '')
      return url ? [{ title: saved.title?.trim() || new URL(url).hostname, url }] : []
    }).slice(0, 100)
    return tabs.length > 0
      ? [{
          id: item.id,
          name: item.name.trim() || fallbackName,
          createdAt: item.createdAt,
          updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : undefined,
          tabs,
        }]
      : []
  }).slice(0, maxTabSessions)
}
