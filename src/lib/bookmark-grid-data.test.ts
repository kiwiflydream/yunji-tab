import type { Bookmark, BookmarkUsage, Category } from './types'
import { describe, expect, it } from 'vitest'
import {
  countGridItems,
  filterGridCategories,
  isSmartBookmarkView,
  selectBookmarksForView,
} from './bookmark-grid-data'

function bookmark(id: string, patch: Partial<Bookmark> = {}): Bookmark {
  return {
    id,
    name: id,
    url: `https://${id}.example.com`,
    categoryId: 'work',
    ...patch,
  }
}

const categories: Category[] = [
  { id: 'work', name: '工作', emoji: '💼', parentId: 'all', modifiable: true },
  { id: 'docs', name: '文档', emoji: '📄', parentId: 'work', modifiable: true },
]

describe('bookmark grid data', () => {
  it('selects and sorts usage views while keeping pinned bookmarks first', () => {
    const bookmarks = [
      bookmark('low', { pinnedAt: 10 }),
      bookmark('high'),
      bookmark('unused'),
    ]
    const usage: Record<string, BookmarkUsage> = {
      [bookmarks[0].url]: { openCount: 1, lastOpenedAt: 5 },
      [bookmarks[1].url]: { openCount: 8, lastOpenedAt: 20 },
    }

    expect(
      selectBookmarksForView(bookmarks, 'frequent', 'manual', usage).map(
        item => item.id,
      ),
    ).toEqual(['low', 'high'])
  })

  it('selects smart categories without mixing unrelated bookmarks', () => {
    const bookmarks = [
      bookmark('inbox', { inboxAt: 1 }),
      bookmark('untagged'),
      bookmark('tagged', { tags: ['reference'], pinnedAt: 10 }),
      bookmark('newer-pinned', { pinnedAt: 20 }),
      bookmark('described', { description: 'ready' }),
    ]

    expect(
      selectBookmarksForView(bookmarks, 'inbox', 'manual', {}).map(
        item => item.id,
      ),
    ).toEqual(['inbox'])
    expect(
      selectBookmarksForView(bookmarks, 'untagged', 'manual', {}).map(
        item => item.id,
      ),
    ).toEqual(['newer-pinned', 'inbox', 'untagged', 'described'])
    expect(
      selectBookmarksForView(bookmarks, 'pinned', 'manual', {}).map(
        item => item.id,
      ),
    ).toEqual(['newer-pinned', 'tagged'])
    expect(isSmartBookmarkView('pinned')).toBe(true)
    expect(isSmartBookmarkView('undescribed')).toBe(true)
  })

  it('returns child categories only for regular views', () => {
    const paths = new Map([
      ['work', ['工作']],
      ['docs', ['工作', '文档']],
    ])

    expect(
      filterGridCategories(categories, 'work', paths, '').map(item => item.id),
    ).toEqual(['docs'])
    expect(filterGridCategories(categories, 'inbox', paths, '')).toEqual([])
    expect(filterGridCategories(categories, 'pinned', paths, '')).toEqual([])
  })

  it('counts bookmarks and direct child categories separately', () => {
    const counts = countGridItems(
      [bookmark('one'), bookmark('two', { categoryId: 'docs' })],
      categories,
    )

    expect(counts.bookmarkCountByCategory.get('work')).toBe(1)
    expect(counts.childCountByCategory.get('all')).toBe(1)
    expect(counts.childCountByCategory.get('work')).toBe(1)
  })
})
