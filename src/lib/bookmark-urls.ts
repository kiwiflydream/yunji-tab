const PROBE_TIMEOUT_MS = 1200

function toHttpUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed)
    return ''

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? candidate
      : ''
  }
  catch {
    return ''
  }
}

export function normalizeBookmarkUrl(value: string): string {
  return toHttpUrl(value)
}

/** Normalize cosmetic URL differences for duplicate comparisons. */
export function canonicalizeBookmarkUrl(value: string): string {
  const normalized = normalizeBookmarkUrl(value)
  if (!normalized)
    return ''

  const url = new URL(normalized)
  url.hash = ''
  url.hostname = url.hostname.toLowerCase()
  if ((url.protocol === 'https:' && url.port === '443')
    || (url.protocol === 'http:' && url.port === '80')) {
    url.port = ''
  }
  if (url.pathname === '/')
    url.pathname = ''
  return url.toString()
}

export function normalizeAlternateBookmarkUrls(
  urls: string[],
  primaryUrl: string,
): string[] {
  const primary = normalizeBookmarkUrl(primaryUrl)
  const seen = new Set(primary ? [primary] : [])
  const normalized: string[] = []

  for (const url of urls) {
    const candidate = normalizeBookmarkUrl(url)
    if (!candidate || seen.has(candidate))
      continue
    seen.add(candidate)
    normalized.push(candidate)
  }

  return normalized
}

export function getBookmarkUrlCandidates(bookmark: {
  url: string
  alternateUrls?: string[]
}): string[] {
  const primary = normalizeBookmarkUrl(bookmark.url)
  return [
    primary,
    ...normalizeAlternateBookmarkUrls(bookmark.alternateUrls ?? [], primary),
  ].filter(Boolean)
}

async function probeUrl(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(
    () => controller.abort(),
    PROBE_TIMEOUT_MS,
  )

  try {
    await fetch(url, {
      cache: 'no-store',
      mode: 'no-cors',
      signal: controller.signal,
    })
    return true
  }
  catch {
    return false
  }
  finally {
    globalThis.clearTimeout(timer)
  }
}

export async function resolveFastestBookmarkUrl(bookmark: {
  url: string
  alternateUrls?: string[]
}): Promise<string> {
  const candidates = getBookmarkUrlCandidates(bookmark)
  if (candidates.length <= 1)
    return candidates[0] ?? bookmark.url

  return new Promise((resolve) => {
    let pending = candidates.length
    let resolved = false

    for (const url of candidates) {
      void probeUrl(url).then((reachable) => {
        if (resolved)
          return
        if (reachable) {
          resolved = true
          resolve(url)
          return
        }

        pending -= 1
        if (pending === 0)
          resolve(candidates[0])
      })
    }
  })
}

export async function openBookmarkUrl(bookmark: {
  url: string
  alternateUrls?: string[]
}): Promise<void> {
  const url = await resolveFastestBookmarkUrl(bookmark)

  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    try {
      await chrome.tabs.create({ url })
      return
    }
    catch {
      // 非扩展预览环境或浏览器拦截时回退到普通打开方式。
    }
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}
