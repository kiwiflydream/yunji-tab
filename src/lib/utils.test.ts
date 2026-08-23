import { afterEach, describe, expect, it, vi } from 'vitest'
import { isRemoteFaviconUrl } from './favicon-messages'
import {
  getBrowserFaviconUrl,
  getFaviconUrls,
  isLegacyFaviconUrl,
} from './utils'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('favicon utilities', () => {
  it('constructs a Chrome favicon URL for the page', () => {
    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://test-extension${path}`,
      },
    })

    const result = getBrowserFaviconUrl('https://example.com/docs?q=one')
    const faviconUrl = new URL(result!)
    expect(faviconUrl.protocol).toBe('chrome-extension:')
    expect(faviconUrl.host).toBe('test-extension')
    expect(faviconUrl.pathname).toBe('/_favicon/')
    expect(faviconUrl.searchParams.get('pageUrl'))
      .toBe('https://example.com/docs?q=one')
    expect(faviconUrl.searchParams.get('size')).toBe('128')
  })

  it('returns no browser URL outside an extension or for an invalid page URL', () => {
    expect(getBrowserFaviconUrl('https://example.com')).toBeUndefined()

    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://test-extension${path}`,
      },
    })
    expect(getBrowserFaviconUrl('not a URL')).toBeUndefined()
  })

  it('prefers Google candidates and keeps the browser API as fallback', () => {
    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://test-extension${path}`,
      },
    })

    expect(getFaviconUrls('https://docs.example.com/guide')).toEqual([
      'https://www.google.com/s2/favicons?domain=docs.example.com&sz=128',
      'https://www.google.com/s2/favicons?domain=example.com&sz=128',
      'chrome-extension://test-extension/_favicon/?pageUrl=https%3A%2F%2Fdocs.example.com%2Fguide&size=128',
    ])
  })

  it('recognizes only favicon providers that remain retired', () => {
    expect(isLegacyFaviconUrl('https://favicon.im/example.com')).toBe(true)
    expect(isLegacyFaviconUrl(
      'https://www.google.com/s2/favicons?domain=example.com&sz=128',
    )).toBe(false)
    expect(isLegacyFaviconUrl('https://example.com/favicon.ico')).toBe(false)
  })

  it('only delegates the approved remote favicon endpoint', () => {
    expect(isRemoteFaviconUrl(
      'https://www.google.com/s2/favicons?domain=example.com&sz=128',
    )).toBe(true)
    expect(isRemoteFaviconUrl('https://example.com/favicon.ico')).toBe(false)
    expect(isRemoteFaviconUrl('not a URL')).toBe(false)
  })
})
