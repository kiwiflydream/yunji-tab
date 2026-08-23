import type { Bookmark } from './types'

export type DescriptionSyncStatus = 'eligible' | 'ignored' | 'ineligible'

export function normalizeIgnoredDomains(values: string[]): string[] {
  const domains = new Set<string>()

  for (const value of values) {
    const candidate = value.trim().toLowerCase().replace(/^\*\./, '')
    if (!candidate)
      continue

    try {
      const parsed = new URL(
        candidate.includes('://') ? candidate : `https://${candidate}`,
      )
      const hostname = parsed.hostname.replace(/\.$/, '')
      if (hostname)
        domains.add(hostname)
    }
    catch {
      // 忽略无法解析的配置项，避免错误规则意外放行或拦截。
    }
  }

  return [...domains].sort()
}

export function getDescriptionSyncStatus(
  bookmark: Bookmark,
  ignoredDomains: string[],
): DescriptionSyncStatus {
  if (bookmark.description)
    return 'ineligible'

  try {
    const url = new URL(bookmark.url)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return 'ineligible'
    }

    const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
    const ignored = ignoredDomains.some(
      domain => hostname === domain || hostname.endsWith(`.${domain}`),
    )
    return ignored ? 'ignored' : 'eligible'
  }
  catch {
    return 'ineligible'
  }
}
