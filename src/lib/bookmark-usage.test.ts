import { describe, expect, it } from 'vitest'
import { mergeBookmarkUsageMaps } from './bookmark-usage'

describe('bookmark usage merging', () => {
  it('keeps newer external counts without dropping local pending updates', () => {
    expect(mergeBookmarkUsageMaps(
      { 'https://a.example': { openCount: 2, lastOpenedAt: 20 } },
      { 'https://a.example': { openCount: 1, lastOpenedAt: 30 } },
    )).toEqual({
      'https://a.example': { openCount: 2, lastOpenedAt: 30 },
    })
  })

  it('merges entries that exist in only one context', () => {
    expect(mergeBookmarkUsageMaps(
      { 'https://a.example': { openCount: 1, lastOpenedAt: 10 } },
      { 'https://b.example': { openCount: 2, lastOpenedAt: 20 } },
    )).toEqual({
      'https://a.example': { openCount: 1, lastOpenedAt: 10 },
      'https://b.example': { openCount: 2, lastOpenedAt: 20 },
    })
  })
})
