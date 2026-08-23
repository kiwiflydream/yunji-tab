import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertBookmarksApi, bookmarkApi } from './bookmark-repository'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('bookmark repository', () => {
  it('reports unsupported environments at the boundary', () => {
    vi.stubGlobal('chrome', undefined)

    expect(() => assertBookmarksApi()).toThrow('bookmarks.api_unavailable')
  })

  it('forwards writes to the Chrome bookmarks API', async () => {
    const created = {
      id: '42',
      title: 'Docs',
      url: 'https://example.com',
      syncing: false,
    } as chrome.bookmarks.BookmarkTreeNode
    const create = vi.fn().mockResolvedValue(created)
    const remove = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', {
      bookmarks: { create, remove },
    })

    await expect(
      bookmarkApi.create({ title: 'Docs', url: 'https://example.com' }),
    ).resolves.toBe(created)
    await bookmarkApi.remove('42')

    expect(create).toHaveBeenCalledWith({
      title: 'Docs',
      url: 'https://example.com',
    })
    expect(remove).toHaveBeenCalledWith('42')
  })
})
