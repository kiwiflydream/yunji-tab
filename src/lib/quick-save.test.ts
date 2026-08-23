import { describe, expect, it } from 'vitest'
import { canonicalizeBookmarkUrl } from './bookmark-urls'
import { currentPageFromTab, getDuplicateBookmark } from './quick-save'

describe('quick save', () => {
  it('canonicalizes cosmetic URL differences', () => {
    expect(canonicalizeBookmarkUrl('HTTPS://Example.COM:443/#section'))
      .toBe('https://example.com/')
  })

  it('finds an existing bookmark after canonicalization', () => {
    const bookmarks = [{ url: 'https://example.com/' }]
    expect(getDuplicateBookmark(bookmarks, 'https://EXAMPLE.com/#top'))
      .toBe(bookmarks[0])
  })

  it('rejects browser-internal pages', () => {
    expect(currentPageFromTab({ title: 'Extensions', url: 'chrome://extensions' }))
      .toBeNull()
  })
})
