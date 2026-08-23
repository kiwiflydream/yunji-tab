import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { getDomain } from 'tldts'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getBrowserFaviconUrl(pageUrl: string): string | undefined {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.getURL)
      return undefined
    const normalizedPageUrl = new URL(pageUrl).toString()
    const faviconUrl = new URL(chrome.runtime.getURL('/_favicon/'))
    faviconUrl.searchParams.set('pageUrl', normalizedPageUrl)
    faviconUrl.searchParams.set('size', '128')
    return faviconUrl.toString()
  }
  catch {
    return undefined
  }
}

export function getFaviconUrls(pageUrl: string): string[] {
  try {
    const hostname = new URL(pageUrl).hostname
    const registrableDomain = getDomain(hostname, {
      allowPrivateDomains: true,
    })
    const domains = Array.from(
      new Set([hostname, registrableDomain].filter(Boolean)),
    )
    const remoteUrls = domains.map(
      domain => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    )
    const browserUrl = getBrowserFaviconUrl(pageUrl)
    return browserUrl ? [...remoteUrls, browserUrl] : remoteUrls
  }
  catch {
    return []
  }
}

export function isLegacyFaviconUrl(url?: string): boolean {
  if (!url)
    return false
  try {
    return new URL(url).hostname === 'favicon.im'
  }
  catch {
    return false
  }
}
