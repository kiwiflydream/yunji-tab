import { LocalizedError } from './localized-error'

export interface SiteMetadata {
  name?: string
  description?: string
  icon?: string
}

const META_TIMEOUT_MS = 10_000

interface SiteDocument {
  document: Document
  finalUrl: string
}

function content(document: Document, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const value = document
      .querySelector<HTMLMetaElement>(selector)
      ?.content
      .trim()
    if (value)
      return value
  }
}

function resolveIcon(document: Document, pageUrl: string): string | undefined {
  const links = document.querySelectorAll<HTMLLinkElement>(
    'link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]',
  )

  for (const link of links) {
    const href = link.getAttribute('href')?.trim()
    if (!href)
      continue
    try {
      const icon = new URL(href, pageUrl)
      if (icon.protocol === 'http:' || icon.protocol === 'https:') {
        return icon.toString()
      }
    }
    catch {
      // 跳过无效图标地址，继续尝试下一个候选项
    }
  }

  try {
    return new URL('/favicon.ico', pageUrl).toString()
  }
  catch {
    return undefined
  }
}

function description(document: Document): string | undefined {
  return content(document, [
    'meta[property="og:description"]',
    'meta[name="description"]',
    'meta[name="twitter:description"]',
  ])
}

async function fetchSiteDocument(url: string): Promise<SiteDocument> {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    META_TIMEOUT_MS,
  )

  try {
    const response = await fetch(url, {
      credentials: 'omit',
      redirect: 'follow',
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new LocalizedError('runtimeSiteHttpError', {
        status: response.status,
      })
    }

    const html = await response.text()
    return {
      document: new DOMParser().parseFromString(html, 'text/html'),
      finalUrl: response.url || url,
    }
  }
  catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new LocalizedError('runtimeSiteRequestTimeout')
    }
    throw error
  }
  finally {
    globalThis.clearTimeout(timeout)
  }
}

/** 只抓取网页描述，供缺失描述的后台补全队列使用。 */
export async function fetchSiteDescription(
  url: string,
): Promise<string | undefined> {
  const site = await fetchSiteDocument(url)
  return description(site.document)
}

/** 抓取网页 HTML，并从标准 meta/link 标签提取站点信息。 */
export async function fetchSiteMetadata(url: string): Promise<SiteMetadata> {
  const site = await fetchSiteDocument(url)

  return {
    name:
      content(site.document, [
        'meta[property="og:title"]',
        'meta[name="twitter:title"]',
      ])
      ?? (site.document.title.trim() || undefined),
    description: description(site.document),
    icon: resolveIcon(site.document, site.finalUrl),
  }
}
