import type { Bookmark, Category } from './types'

import { describe, expect, it } from 'vitest'
import {
  bookmarkSearchEntryScore,
  bookmarkSearchScore,
  categorySearchScore,
  compileBookmarkSearchQuery,
  countMatchingSearchEntries,
  createBookmarkSearchEntry,
} from './bookmark-search'

function bookmark(patch: Partial<Bookmark>): Bookmark {
  return {
    id: 'bookmark-1',
    name: '微信公众平台',
    url: 'https://mp.weixin.qq.com',
    description: '内容运营后台',
    categoryId: 'cat-work',
    ...patch,
  }
}

function category(patch: Partial<Category>): Category {
  return {
    id: 'cat-work',
    name: '工作文档',
    emoji: '📁',
    parentId: 'all',
    modifiable: true,
    ...patch,
  }
}

describe('bookmarkSearchScore', () => {
  it('matches Chinese names by pinyin initials', () => {
    expect(bookmarkSearchScore(bookmark({}), 'wx', ['工作'])).toBeGreaterThan(
      0,
    )
  })

  it('prioritizes host matches over generic URL matches', () => {
    const hostScore = bookmarkSearchScore(
      bookmark({ name: '平台', url: 'https://github.com/acme/repo' }),
      'github',
      ['开发'],
    )
    const pathScore = bookmarkSearchScore(
      bookmark({ name: '平台', url: 'https://example.com/github/docs' }),
      'github',
      ['开发'],
    )

    expect(hostScore).toBeGreaterThan(pathScore)
  })

  it('requires every query token to match', () => {
    expect(
      bookmarkSearchScore(bookmark({}), 'wx impossible-token', ['工作']),
    ).toBe(-1)
  })

  it('matches and filters by tags', () => {
    expect(
      bookmarkSearchScore(bookmark({ tags: ['AI', '文档'] }), 'tag:ai', [
        '工作',
      ]),
    ).toBeGreaterThan(0)
    expect(
      bookmarkSearchScore(bookmark({ tags: ['文档'] }), 'tag:ai', ['工作']),
    ).toBe(-1)
  })

  it('filters by site and folder syntax', () => {
    expect(
      bookmarkSearchScore(
        bookmark({ url: 'https://github.com/acme/repo' }),
        'site:github.com folder:开发',
        ['工作', '开发'],
      ),
    ).toBeGreaterThan(0)
  })
})

describe('categorySearchScore', () => {
  it('matches category names by pinyin initials', () => {
    expect(categorySearchScore(category({}), 'gz', ['工作文档'])).toBeGreaterThan(
      0,
    )
  })
})

describe('compiled bookmark search queries', () => {
  it('compiles a query text once and reuses the same tokens across calls', () => {
    const first = compileBookmarkSearchQuery('wx tag:ai')
    const second = compileBookmarkSearchQuery('wx tag:ai')

    expect(second).toBe(first)
    expect(first.tokens.map(token => token.kind)).toEqual(['token', 'tag'])
    expect(first.tokens[0]).toMatchObject({ token: 'wx', compact: 'wx' })
    expect(first.tokens[1]).toMatchObject({ token: 'ai', compact: 'ai' })
  })

  it('reproduces the pre-refactor scoring baseline for keys, empty subjects and punctuation', () => {
    // 这些期望值由 HEAD 版本的 bookmarkSearchEntryScore 在同一合成数据上跑出，
    // 覆盖 tag:/site:/folder: 前缀、空 subject 和含标点的查询，锁住重构前的评分语义。
    const tagged = createBookmarkSearchEntry(
      bookmark({ tags: ['AI', '文档'], url: 'https://github.com/acme/repo' }),
      ['工作', '开发'],
    )
    const plain = createBookmarkSearchEntry(bookmark({}), ['工作'])
    const baseline: Array<[string, number, number]> = [
      ['wx', 260, 260],
      ['tag:ai', 500, -1],
      ['tag:', 400, -1],
      ['site:github.com', 480, -1],
      ['site:', 380, 380],
      ['folder:开发', 260, -1],
      ['folder:', 360, 360],
      ['github', 240, -1],
      ['mp.weixin', -1, 240],
      ['tag:ai folder:开发 site:github.com', 1240, -1],
      ['wx impossible-token', -1, -1],
      ['微信', 300, 300],
      ['  wx  ', 260, 260],
      ['WX', 260, 260],
      ['', 0, 0],
      ['   ', 0, 0],
    ]

    for (const [query, taggedScore, plainScore] of baseline) {
      expect(bookmarkSearchEntryScore(tagged, query)).toBe(taggedScore)
      expect(bookmarkSearchEntryScore(plain, query)).toBe(plainScore)
    }
  })

  it('counts matches once per query across many entries', () => {
    const entries = [
      createBookmarkSearchEntry(
        bookmark({ id: 'a', name: '微信公众平台' }),
        ['工作'],
      ),
      createBookmarkSearchEntry(
        bookmark({ id: 'b', name: 'Another', url: 'https://example.com' }),
        ['工作'],
      ),
      createBookmarkSearchEntry(
        bookmark({ id: 'c', name: '微信读书', url: 'https://weread.qq.com' }),
        ['阅读'],
      ),
    ]

    expect(countMatchingSearchEntries(entries, 'wx')).toBe(2)
    expect(countMatchingSearchEntries(entries, 'folder:阅读')).toBe(1)
    expect(countMatchingSearchEntries(entries, 'nothing-matches')).toBe(0)
    // 空查询沿用 bookmarkSearchEntryScore：不筛掉任何条目。
    expect(countMatchingSearchEntries(entries, '   ')).toBe(3)
  })
})
