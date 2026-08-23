import { describe, expect, it } from 'vitest'
import { collectSessionTabs, parseTabSessions } from './tab-sessions'

describe('tab sessions', () => {
  it('captures only web tabs', () => {
    expect(collectSessionTabs([
      { title: 'Docs', url: 'https://example.com/docs' },
      { title: 'Extensions', url: 'chrome://extensions' },
    ])).toEqual([{ title: 'Docs', url: 'https://example.com/docs' }])
  })

  it('deduplicates URLs and can exclude pinned tabs', () => {
    expect(collectSessionTabs([
      { title: 'One', url: 'https://example.com/', pinned: false },
      { title: 'Duplicate', url: 'https://EXAMPLE.com/#top', pinned: false },
      { title: 'Pinned', url: 'https://pinned.test', pinned: true },
    ], { excludePinned: true })).toEqual([
      { title: 'One', url: 'https://example.com/' },
    ])
  })

  it('drops invalid saved sessions', () => {
    expect(parseTabSessions([{ id: 'x', name: 'Work', createdAt: 1, tabs: [] }]))
      .toEqual([])
  })
})
