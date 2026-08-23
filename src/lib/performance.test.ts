import type { Bookmark } from './types'
import { describe, expect, it } from 'vitest'
import { bookmarkSearchEntryScore, createBookmarkSearchEntry } from './bookmark-search'
import { createMetadataSyncPayload } from './metadata-sync'

function createBookmarks(count: number): Bookmark[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `bookmark-${index}`,
    name: index === count - 1 ? 'Unique Performance Target' : `Bookmark ${index}`,
    url: `https://site-${index}.example.com/docs/${index}`,
    description: `Reference documentation number ${index}`,
    categoryId: `cat-${index % 50}`,
    tags: [`tag-${index % 20}`],
  }))
}

describe('large bookmark performance', () => {
  it('indexes and searches 10k bookmarks within the regression budget', () => {
    const bookmarks = createBookmarks(10_000)
    const startedAt = performance.now()
    const entries = bookmarks.map(bookmark =>
      createBookmarkSearchEntry(bookmark, ['Root', bookmark.categoryId]))
    const results = entries.filter(entry =>
      bookmarkSearchEntryScore(entry, 'unique performance target') >= 0)
    const elapsed = performance.now() - startedAt

    expect(results).toHaveLength(1)
    expect(elapsed).toBeLessThan(2_000)
  })

  it('packs 10k metadata entries in linear time', () => {
    const meta = Object.fromEntries(createBookmarks(10_000).map(bookmark => [
      bookmark.url,
      { tags: bookmark.tags, description: bookmark.description },
    ]))
    const startedAt = performance.now()
    const payload = createMetadataSyncPayload({
      meta,
      categoryMeta: {},
      categories: [],
      updatedAt: 1,
      deviceId: 'performance-device',
    })
    const elapsed = performance.now() - startedAt

    expect(payload.byteCount).toBeLessThanOrEqual(90_000)
    expect(payload.omittedBookmarkCount).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(2_000)
  })
})
