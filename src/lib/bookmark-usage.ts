import type { BookmarkUsage } from './types'

export type BookmarkUsageMap = Record<string, BookmarkUsage>

export function mergeBookmarkUsageMaps(
  ...maps: Array<BookmarkUsageMap | null | undefined>
): BookmarkUsageMap {
  const merged: BookmarkUsageMap = {}
  for (const map of maps) {
    for (const [url, usage] of Object.entries(map ?? {})) {
      const current = merged[url]
      merged[url] = current
        ? {
            openCount: Math.max(current.openCount, usage.openCount),
            lastOpenedAt: Math.max(
              current.lastOpenedAt,
              usage.lastOpenedAt,
            ),
          }
        : { ...usage }
    }
  }
  return merged
}
