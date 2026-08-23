import type { Category } from './types'
import { describe, expect, it } from 'vitest'
import { buildCategoryTree, getCategoryAncestorIds } from './category-tree'

const categories: Category[] = [
  { id: 'root', name: 'Root', emoji: '📁', parentId: 'all', modifiable: false },
  { id: 'child', name: 'Child', emoji: '📁', parentId: 'root', modifiable: true },
  { id: 'leaf', name: 'Leaf', emoji: '📁', parentId: 'child', modifiable: true },
  { id: 'orphan', name: 'Orphan', emoji: '📁', parentId: 'missing', modifiable: true },
]

describe('category tree', () => {
  it('preserves category order and promotes orphaned categories to roots', () => {
    const tree = buildCategoryTree(categories)

    expect(tree.map(node => node.category.id)).toEqual(['root', 'orphan'])
    expect(tree[0].children[0].category.id).toBe('child')
    expect(tree[0].children[0].children[0].category.id).toBe('leaf')
  })

  it('returns every ancestor for an active nested category', () => {
    expect([...getCategoryAncestorIds('leaf', categories)]).toEqual(['child', 'root'])
    expect([...getCategoryAncestorIds('missing', categories)]).toEqual([])
  })
})
