import type { Bookmark } from './types'

export type BookmarkHealthIssue
  = 'duplicate' | 'redirected' | 'http-error' | 'unreachable'

export interface BookmarkHealthResult {
  bookmarkId: string
  name: string
  url: string
  categoryId: string
  issues: BookmarkHealthIssue[]
  finalUrl?: string
  statusCode?: number
  duplicateIds?: string[]
  ignored?: boolean
}

interface UrlCheck {
  issue?: 'redirected' | 'http-error' | 'unreachable'
  finalUrl?: string
  statusCode?: number
}

interface ScanOptions {
  ignoredDomains?: string[]
  concurrency?: number
  timeoutMs?: number
  onProgress?: (completed: number, total: number) => void
  fetcher?: typeof fetch
}

function canonicalUrl(value: string): string {
  try {
    const url = new URL(value)
    url.hash = ''
    if (url.pathname !== '/')
      url.pathname = url.pathname.replace(/\/+$/, '')
    return url.toString()
  }
  catch {
    return value.trim()
  }
}

function isIgnored(url: string, domains: string[]): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/\.$/, '')
    return domains.some(
      domain => hostname === domain || hostname.endsWith(`.${domain}`),
    )
  }
  catch {
    return false
  }
}

async function requestUrl(
  url: string,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<UrlCheck> {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  try {
    let response = await fetcher(url, {
      method: 'HEAD',
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
    })
    if (response.status === 405 || response.status === 501) {
      response = await fetcher(url, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow',
        headers: { Range: 'bytes=0-0' },
        signal: controller.signal,
      })
    }

    const statusCode = response.status
    const finalUrl = response.url || url
    if (statusCode >= 400) {
      return { issue: 'http-error', finalUrl, statusCode }
    }
    if (canonicalUrl(finalUrl) !== canonicalUrl(url)) {
      return { issue: 'redirected', finalUrl, statusCode }
    }
    return { finalUrl, statusCode }
  }
  catch {
    return { issue: 'unreachable' }
  }
  finally {
    globalThis.clearTimeout(timer)
  }
}

async function forEachConcurrent<T>(
  values: T[],
  concurrency: number,
  task: (value: T) => Promise<void>,
): Promise<void> {
  let index = 0
  const worker = async () => {
    while (index < values.length) {
      const value = values[index]
      index += 1
      await task(value)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, worker),
  )
}

export async function scanBookmarkHealth(
  bookmarks: Bookmark[],
  options: ScanOptions = {},
): Promise<BookmarkHealthResult[]> {
  const ignoredDomains = options.ignoredDomains ?? []
  const fetcher = options.fetcher ?? fetch
  const timeoutMs = options.timeoutMs ?? 6_000
  const byCanonicalUrl = new Map<string, Bookmark[]>()
  for (const bookmark of bookmarks) {
    const key = canonicalUrl(bookmark.url)
    byCanonicalUrl.set(key, [...(byCanonicalUrl.get(key) ?? []), bookmark])
  }

  const uniqueTargets = [...byCanonicalUrl.entries()].filter(([url]) => {
    try {
      const protocol = new URL(url).protocol
      return (
        (protocol === 'http:' || protocol === 'https:')
        && !isIgnored(url, ignoredDomains)
      )
    }
    catch {
      return false
    }
  })
  const checks = new Map<string, UrlCheck>()
  let completed = 0
  options.onProgress?.(completed, uniqueTargets.length)
  await forEachConcurrent(
    uniqueTargets,
    options.concurrency ?? 5,
    async ([url]) => {
      checks.set(url, await requestUrl(url, fetcher, timeoutMs))
      completed += 1
      options.onProgress?.(completed, uniqueTargets.length)
    },
  )

  return bookmarks.map((bookmark) => {
    const key = canonicalUrl(bookmark.url)
    const duplicates = byCanonicalUrl.get(key) ?? []
    const check = checks.get(key)
    const issues: BookmarkHealthIssue[] = []
    if (duplicates.length > 1)
      issues.push('duplicate')
    if (check?.issue)
      issues.push(check.issue)
    return {
      bookmarkId: bookmark.id,
      name: bookmark.name,
      url: bookmark.url,
      categoryId: bookmark.categoryId,
      issues,
      finalUrl: check?.finalUrl,
      statusCode: check?.statusCode,
      duplicateIds:
        duplicates.length > 1
          ? duplicates.map(candidate => candidate.id)
          : undefined,
      ignored: isIgnored(bookmark.url, ignoredDomains),
    }
  })
}
