import { expect, test } from './extension.fixture'

test('loads remote favicons with a browser API fallback', async ({ newTabPage }) => {
  const results = await newTabPage.evaluate(async () => {
    const browserUrl = new URL(chrome.runtime.getURL('/_favicon/'))
    browserUrl.searchParams.set('pageUrl', 'https://example.com')
    browserUrl.searchParams.set('size', '128')
    const remote = await chrome.runtime.sendMessage({
      type: 'yunji-tab:fetch-remote-favicon',
      url: 'https://www.google.com/s2/favicons?domain=lemonsqueezy.com&sz=128',
    }) as { base64?: string, bytes?: number[], ok: boolean, type?: string }
    const browserResponse = await fetch(browserUrl)
    const browserBlob = await browserResponse.blob()

    const remoteSize = remote.base64
      ? atob(remote.base64).length
      : (remote.bytes?.length ?? 0)

    return [
      {
        ok: remote.ok,
        size: remoteSize,
        type: remote.type ?? '',
      },
      {
        ok: browserResponse.ok,
        size: browserBlob.size,
        type: browserBlob.type,
      },
    ]
  })

  for (const result of results) {
    expect(result.ok).toBe(true)
    expect(result.size).toBeGreaterThan(0)
    expect(result.type).toMatch(/^image\//)
  }
})
