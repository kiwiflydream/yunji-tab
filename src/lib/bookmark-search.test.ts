import type { Bookmark, Category } from './types'

import { describe, expect, it } from 'vitest'
import {
  bookmarkSearchScore,
  categorySearchScore,
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
