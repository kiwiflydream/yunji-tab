import type { Bookmark, Category } from './types'
import { describe, expect, it } from 'vitest'
import { bookmarkSearchEntryScore } from './bookmark-search'
import { getNavigationDerivedData } from './navigation-derived'

describe('navigation derived data', () => {
  it('reuses unchanged search entries after editing one bookmark or reloading category objects', () => {
    const categories: Category[] = [{ id: 'docs', name: '文档', emoji: '📁', parentId: 'all', modifiable: true }]
    const bookmarks: Bookmark[] = [
      { id: 'one', name: 'One', url: 'https://one.example', categoryId: 'docs' },
      { id: 'two', name: 'Two', url: 'https://two.example', categoryId: 'docs' },
    ]
    const original = getNavigationDerivedData(bookmarks, categories).searchEntries
    const edited = [{ ...bookmarks[0], description: 'changed' }, bookmarks[1]]
    const next = getNavigationDerivedData(edited, categories.map(category => ({ ...category }))).searchEntries
    expect(next[0]).not.toBe(original[0])
    expect(next[1]).toBe(original[1])
    expect(bookmarkSearchEntryScore(next[0], 'changed')).toBeGreaterThan(0)
  })

  it('invalidates only entries under renamed ancestors and keeps older snapshots valid', () => {
    const categories: Category[] = [
      { id: 'work', name: '工作', emoji: '📁', parentId: 'all', modifiable: true },
      { id: 'docs', name: '文档', emoji: '📁', parentId: 'work', modifiable: true },
      { id: 'other', name: 'Other', emoji: '📁', parentId: 'all', modifiable: true },
    ]
    const bookmarks: Bookmark[] = [
      { id: 'one', name: 'One', url: 'https://one.example', categoryId: 'docs' },
      { id: 'two', name: 'Two', url: 'https://two.example', categoryId: 'other' },
    ]
    const original = getNavigationDerivedData(bookmarks, categories).searchEntries
    const next = getNavigationDerivedData(bookmarks, categories.map(category => category.id === 'work' ? { ...category, name: 'Projects' } : category)).searchEntries
    expect(next[0]).not.toBe(original[0])
    expect(next[1]).toBe(original[1])
    expect(bookmarkSearchEntryScore(next[0], 'folder:projects')).toBeGreaterThan(0)
    expect(bookmarkSearchEntryScore(original[0], 'folder:projects')).toBe(-1)
  })

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
