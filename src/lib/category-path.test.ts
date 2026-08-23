import type { Category } from './types'

import { describe, expect, it } from 'vitest'
import {
  buildCategoryPathMap,
  findCategoryByPath,
  getCategoryPath,
} from './category-path'

const categories: Category[] = [
  {
    id: 'cat-work',
    name: '工作',
    emoji: '📁',
    parentId: 'all',
    modifiable: true,
  },
  {
    id: 'cat-docs',
    name: '文档',
    emoji: '📁',
    parentId: 'cat-work',
    modifiable: true,
  },
]

describe('category paths', () => {
  it('builds a nested category path', () => {
    expect(getCategoryPath('cat-docs', categories)).toEqual(['工作', '文档'])
  })

  it('finds a category by path', () => {
    expect(findCategoryByPath(['工作', '文档'], categories)?.id).toBe(
      'cat-docs',
    )
  })

  it('builds a map for every reachable category', () => {
    expect(buildCategoryPathMap(categories).get('cat-docs')).toEqual([
      '工作',
      '文档',
    ])
  })
})
