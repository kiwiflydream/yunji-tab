export const fetchRemoteFaviconMessage = 'yunji-tab:fetch-remote-favicon'

export interface RemoteFaviconResponse {
  ok: boolean
  base64?: string
  bytes?: number[]
  type?: string
}

export function isRemoteFaviconUrl(value: unknown): value is string {
  if (typeof value !== 'string')
    return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
      && url.hostname === 'www.google.com'
      && url.pathname === '/s2/favicons'
  }
  catch {
    return false
  }
}
