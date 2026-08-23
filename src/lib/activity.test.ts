import { describe, expect, it } from 'vitest'
import {
  createTrashRestorePreview,
  pruneHistory,
  pruneMetadataSyncRecovery,
  pruneTrash,
  summarizeMetadataChanges,
} from './activity'

describe('activity persistence', () => {
  it('removes expired trash', () => {
    expect(pruneTrash([{ id: '1', label: 'Old', deletedAt: 1, expiresAt: 5, roots: [], categoryMeta: {} }], 10)).toEqual([])
  })

  it('reads activity arrays serialized by extension storage changes', () => {
    const value = JSON.stringify([{
      id: '1',
      label: '书签“Example”',
      deletedAt: 1,
      expiresAt: 20,
      roots: [],
      categoryMeta: {},
    }])

    expect(pruneTrash(value, 10)).toHaveLength(1)
  })

  it('preserves localized message descriptors for display-time translation', () => {
    const value = [{
      id: '1',
      label: { key: 'runtimeBookmarkCountLabel', params: { count: 2 } },
      deletedAt: 1,
      expiresAt: 20,
      roots: [],
      categoryMeta: {},
    }]

    expect(pruneTrash(value, 10)[0]?.label).toEqual(value[0].label)
  })

  it('rejects invalid history', () => {
    expect(pruneHistory([{ id: '1', action: 'unknown', label: 'X', createdAt: 1 }])).toEqual([])
  })

  it('previews only roots that still need restoration', () => {
    const entry = {
      id: '1',
      label: 'Two bookmarks',
      deletedAt: 1,
      expiresAt: 100,
      categoryMeta: {},
      restoredRootIndexes: [0],
      roots: [
        { id: '1', title: 'Done', url: 'https://done.test', parentId: '1', syncing: false },
        { id: '2', title: 'Pending', url: 'https://pending.test', parentId: '99', syncing: false },
      ],
    }
    expect(createTrashRestorePreview(entry, ['https://pending.test'], []))
      .toMatchObject({ nodeCount: 1, duplicateUrlCount: 1, fallbackParentCount: 1 })
  })

  it('summarizes remote metadata replacements and deletions', () => {
    expect(summarizeMetadataChanges(
      { 'https://example.test': { description: 'Old', tags: ['local'] } },
      { 'https://example.test': { description: 'New' } },
      { 'cat-1': { emoji: 'A' } },
      { 'cat-1': { emoji: 'B' } },
    )).toEqual({
      changedBookmarkCount: 1,
      changedCategoryCount: 1,
      removedFieldCount: 1,
    })
  })

  it('removes expired metadata sync recovery points', () => {
    expect(pruneMetadataSyncRecovery([{
      id: 'recovery-1',
      label: 'Old sync',
      createdAt: 1,
      expiresAt: 5,
      direction: 'downloaded',
      bookmarkMeta: {},
      categoryMeta: {},
      changedBookmarkCount: 1,
      changedCategoryCount: 0,
      removedFieldCount: 0,
    }], 10)).toEqual([])
  })
})
