import type { RemoteFaviconResponse } from './favicon-messages'
import { createConcurrencyLimiter } from './concurrency-limiter'
import {
  fetchRemoteFaviconMessage,
  isRemoteFaviconUrl,
} from './favicon-messages'
import { getFaviconUrls, isLegacyFaviconUrl } from './utils'

const FAVICON_CACHE_NAME = 'yunji-tab:favicons:v4'
const LEGACY_FAVICON_CACHE_NAMES = [
  'yunji-tab:favicons:v1',
  'yunji-tab:favicons:v2',
  'yunji-tab:favicons:v3',
]
const FAVICON_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const FAVICON_FETCH_TIMEOUT_MS = 8_000
export const faviconFetchConcurrency = 8
const CACHED_AT_HEADER = 'x-yunji-tab-cached-at'

const pendingFavicons = new Map<string, Promise<Blob | undefined>>()
const runFaviconFetch = createConcurrencyLimiter(faviconFetchConcurrency)
let faviconCachePromise: Promise<Cache | undefined> | undefined

export async function clearFaviconCache(): Promise<void> {
  pendingFavicons.clear()
  faviconCachePromise = undefined
  if ('caches' in globalThis) {
    await Promise.all(
      [FAVICON_CACHE_NAME, ...LEGACY_FAVICON_CACHE_NAMES]
        .map(cacheName => caches.delete(cacheName)),
    )
  }
}

function openFaviconCache(): Promise<Cache | undefined> {
  if (!('caches' in globalThis))
    return Promise.resolve(undefined)
  if (!faviconCachePromise) {
    faviconCachePromise = (async () => {
      try {
        await Promise.all(
          LEGACY_FAVICON_CACHE_NAMES.map(cacheName => caches.delete(cacheName)),
        )
        return await caches.open(FAVICON_CACHE_NAME)
      }
      catch {
        return undefined
      }
    })()
  }
  return faviconCachePromise
}

async function readCachedFavicon(
  cache: Cache | undefined,
  key: string,
): Promise<Blob | undefined> {
  if (!cache)
    return undefined

  try {
    const response = await cache.match(key)
    if (!response)
      return undefined

    const cachedAt = Number(response.headers.get(CACHED_AT_HEADER))
    if (!cachedAt || Date.now() - cachedAt > FAVICON_CACHE_TTL_MS) {
      await cache.delete(key)
      return undefined
    }

    return response.blob()
  }
  catch {
    return undefined
  }
}

async function fetchRemoteFavicon(url: string): Promise<Blob | undefined> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage)
    return undefined
  try {
    const response = await chrome.runtime.sendMessage({
      type: fetchRemoteFaviconMessage,
      url,
    }) as RemoteFaviconResponse
    if (!response.ok)
      return undefined
    if (response.base64) {
      const binaryString = atob(response.base64)
      const len = binaryString.length
      const bytes = new Uint8Array(len)
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      return new Blob([bytes], {
        type: response.type || 'image/png',
      })
    }
    if (response.bytes?.length) {
      return new Blob([Uint8Array.from(response.bytes)], {
        type: response.type || 'image/png',
      })
    }
    return undefined
  }
  catch {
    return undefined
  }
}

async function fetchFavicon(url: string): Promise<Blob | undefined> {
  if (isRemoteFaviconUrl(url))
    return fetchRemoteFavicon(url)

  const controller = new AbortController()
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    FAVICON_FETCH_TIMEOUT_MS,
  )

  try {
    const response = await fetch(url, {
      credentials: 'omit',
      redirect: 'follow',
      signal: controller.signal,
    })
    if (!response.ok)
      return undefined

    const blob = await response.blob()
    const validType
      = blob.type.startsWith('image/')
        || blob.type === 'application/octet-stream'
    return blob.size > 0 && validType ? blob : undefined
  }
  catch {
    return undefined
  }
  finally {
    globalThis.clearTimeout(timeout)
  }
}

async function cacheFavicon(
  cache: Cache | undefined,
  key: string,
  blob: Blob,
): Promise<void> {
  if (!cache)
    return

  try {
    await cache.put(
      key,
      new Response(blob, {
        headers: {
          'Content-Type': blob.type || 'image/x-icon',
          [CACHED_AT_HEADER]: String(Date.now()),
        },
      }),
    )
  }
  catch {
    // 缓存配额不足时继续显示图标，不影响正常使用
  }
}

function loadAndCacheFavicon(url: string): Promise<Blob | undefined> {
  const pending = pendingFavicons.get(url)
  if (pending)
    return pending

  const request = (async () => {
    const cache = await openFaviconCache()
    const cached = await readCachedFavicon(cache, url)
    if (cached)
      return cached

    const blob = await runFaviconFetch(() => fetchFavicon(url))
    if (blob)
      await cacheFavicon(cache, url, blob)
    return blob
  })().finally(() => {
    pendingFavicons.delete(url)
  })

  pendingFavicons.set(url, request)
  return request
}

async function loadCandidateFavicon(
  bookmarkUrl: string,
  triedUrls: ReadonlySet<string> = new Set(),
): Promise<{ blob: Blob, url: string } | undefined> {
  for (const url of getFaviconUrls(bookmarkUrl)) {
    if (triedUrls.has(url))
      continue
    const blob = await loadAndCacheFavicon(url)
    if (blob)
      return { blob, url }
  }
}

/** 获取并持久缓存书签图标，远程高清图标失败时回退到 Chrome favicon API。 */
export async function loadFavicon(
  bookmarkUrl: string,
  customIconUrl?: string,
): Promise<Blob> {
  const triedUrls = new Set<string>()
  if (customIconUrl && !isLegacyFaviconUrl(customIconUrl)) {
    triedUrls.add(customIconUrl)
    const customIcon = await loadAndCacheFavicon(customIconUrl)
    if (customIcon)
      return customIcon
  }

  const candidateIcon = await loadCandidateFavicon(bookmarkUrl, triedUrls)
  if (candidateIcon)
    return candidateIcon.blob
  throw new Error('favicon.load_failed')
}
