import type { Bookmark, Category } from './types'
import { describe, expect, it } from 'vitest'
import { getNavigationDerivedData } from './navigation-derived'

describe('navigation derived data', () => {
  it('shares paths, search entries, trees, and counts for stable inputs', () => {
    const categories: Category[] = [
      { id: 'work', name: '工作', emoji: '📁', parentId: 'all', modifiable: true },
      { id: 'docs', name: '文档', emoji: '📁', parentId: 'work', modifiable: true },
    ]
    const bookmarks: Bookmark[] = [{
      id: 'one',
      name: 'One',
      url: 'https://example.com',
      categoryId: 'docs',
      inboxAt: 1,
    }]

    const first = getNavigationDerivedData(bookmarks, categories)
    const second = getNavigationDerivedData(bookmarks, categories)
    expect(second).toBe(first)
    expect(first.categoryPathMap.get('docs')).toEqual(['工作', '文档'])
    expect(first.searchEntries).toHaveLength(1)
    expect(first.categoryTree[0]?.children[0]?.category.id).toBe('docs')
    expect(first.bookmarkCountByCategory.get('docs')).toBe(1)
    expect(first.childCategoryCountByCategory.get('work')).toBe(1)
    expect(first.smartCounts.inbox).toBe(1)
  })
})
