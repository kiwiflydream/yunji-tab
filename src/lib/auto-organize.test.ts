import { describe, expect, it } from 'vitest'
import {
  autoOrganizeRuleMatches,
  previewAutoOrganizeRules,
} from './auto-organize'

const categories = [
  { id: 'cat-work', name: 'Work', emoji: '', parentId: 'all', modifiable: true },
]

describe('auto organize rules', () => {
  it('matches bookmarks by domain and creates move/tag patches', () => {
    const bookmark = {
      id: 'b1',
      name: 'Docs',
      url: 'https://docs.example.com/guide',
      categoryId: 'all',
      tags: ['old'],
      inboxAt: 1,
    }
    const rule = {
      id: 'r1',
      name: 'Docs domain',
      enabled: true,
      field: 'domain' as const,
      operator: 'contains' as const,
      value: 'example.com',
      targetCategoryId: 'cat-work',
      addTags: ['docs'],
      clearInbox: true,
    }

    expect(autoOrganizeRuleMatches(bookmark, rule)).toBe(true)
    expect(previewAutoOrganizeRules([bookmark], [rule], categories))
      .toEqual([{
        bookmark,
        rule,
        patch: {
          categoryId: 'cat-work',
          tags: ['old', 'docs'],
          inboxAt: 0,
        },
      }])
  })

  it('ignores disabled rules and no-op patches', () => {
    const bookmark = {
      id: 'b1',
      name: 'Docs',
      url: 'https://example.com',
      categoryId: 'cat-work',
      tags: ['docs'],
    }
    expect(previewAutoOrganizeRules([bookmark], [{
      id: 'r1',
      name: 'Disabled',
      enabled: false,
      field: 'url',
      operator: 'contains',
      value: 'example.com',
      targetCategoryId: 'cat-work',
      addTags: ['docs'],
      clearInbox: true,
    }], categories)).toEqual([])
  })
})
