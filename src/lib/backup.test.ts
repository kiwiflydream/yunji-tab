import type { Category, Settings } from './types'

import { describe, expect, it } from 'vitest'
import { DEFAULT_APPEARANCE_SETTINGS } from './appearance'
import {
  createFullBookmarkSnapshot,
  createYunjiTabBackup,
  parseFullBookmarkSnapshot,
  parseYunjiTabBackup,
} from './backup'
import { DEFAULT_KEYBOARD_SHORTCUTS } from './keyboard-shortcuts'

const settings: Settings = {
  language: 'zh-CN',
  theme: 'system',
  defaultCategoryId: 'cat-docs',
  singleHomeTab: true,
  globalCommandPaletteEnabled: true,
  descriptionIgnoredDomains: [],
  customSearchEngines: [],
  bookmarkSortMode: 'manual',
  bookmarkViewMode: 'grid',
  appearance: DEFAULT_APPEARANCE_SETTINGS,
  savedSearches: [],
  metadataSyncScope: {
    description: true,
    icon: true,
    alternateUrls: true,
    pinnedAt: true,
    tags: true,
    inboxAt: true,
    categoryIcons: true,
  },
  metadataSyncEncryptionEnabled: false,
  autoOrganizeRules: [],
  keyboardShortcuts: DEFAULT_KEYBOARD_SHORTCUTS,
}

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

describe('yunji tab backup', () => {
  it('keeps bookmark metadata including pinned state', () => {
    const backup = createYunjiTabBackup({
      settings,
      categories,
      meta: {
        'https://example.com': {
          description: 'Example',
          pinnedAt: 123,
          tags: ['AI', '文档'],
          inboxAt: 789,
        },
      },
      categoryMeta: {
        'cat-docs': { emoji: '📚' },
      },
      usage: {
        'https://example.com': {
          openCount: 2,
          lastOpenedAt: 456,
        },
      },
    })

    const parsed = parseYunjiTabBackup(JSON.stringify(backup))

    expect(parsed.bookmarkMeta['https://example.com']?.pinnedAt).toBe(123)
    expect(parsed.bookmarkMeta['https://example.com']?.tags).toEqual([
      'AI',
      '文档',
    ])
    expect(parsed.bookmarkMeta['https://example.com']?.inboxAt).toBe(789)
    expect(parsed.categoryMeta).toEqual([
      { path: ['工作', '文档'], emoji: '📚' },
    ])
    expect(parsed.defaultCategoryPath).toEqual(['工作', '文档'])
    expect(parsed.settings.globalCommandPaletteEnabled).toBe(true)
  })

  it('parses full native bookmark snapshots', () => {
    const yunjiTabBackup = createYunjiTabBackup({
      settings,
      categories,
      meta: {},
      categoryMeta: {},
      usage: {},
    })
    const snapshot = createFullBookmarkSnapshot({
      yunjiTab: yunjiTabBackup,
      nativeRoots: [
        {
          id: '1',
          title: '书签栏',
          children: [
            {
              id: '10',
              title: '工作',
              children: [{ id: '11', title: 'Example', url: 'https://e.test' }],
            },
          ],
        } as chrome.bookmarks.BookmarkTreeNode,
      ],
    })

    const parsed = parseFullBookmarkSnapshot(JSON.stringify(snapshot))

    expect(parsed.roots[0]?.title).toBe('书签栏')
    expect(parsed.roots[0]?.children?.[0]?.children?.[0]?.url).toBe(
      'https://e.test',
    )
  })
})
