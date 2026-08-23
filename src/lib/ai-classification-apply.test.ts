import type { AiClassificationSuggestion } from './ai-bookmark-classification'
import type { Bookmark, Category } from './types'
import { describe, expect, it, vi } from 'vitest'
import { applyClassificationSuggestions, undoAiClassification } from './ai-classification-apply'

const categories: Category[] = [
  { id: 'cat-1', name: 'One', emoji: '', parentId: 'all', modifiable: false },
  { id: 'cat-2', name: 'Two', emoji: '', parentId: 'all', modifiable: false },
]
const bookmarks: Bookmark[] = [
  { id: 'bm-1', name: 'One', url: 'https://one.example', categoryId: 'cat-1', index: 3 },
]
const suggestions: AiClassificationSuggestion[] = [
  { bookmarkId: 'bm-1', sourceCategoryId: 'cat-1', targetCategoryId: 'cat-2', confidence: 0.9, reason: 'Match' },
]

describe('ai classification apply safety', () => {
  it('moves only suggestions that still refer to current data', async () => {
    const moveOne = vi.fn().mockResolvedValue(undefined)
    const result = await applyClassificationSuggestions(
      [...suggestions, { ...suggestions[0], bookmarkId: 'bm-missing' }],
      bookmarks,
      categories,
      moveOne,
    )
    expect(moveOne).toHaveBeenCalledOnce()
    expect(moveOne).toHaveBeenCalledWith('bm-1', 'cat-2')
    expect(result.moved).toBe(1)
    expect(result.skipped).toBe(1)
  })

  it('restores the original folder and index', async () => {
    const moveNative = vi.fn().mockResolvedValue(undefined)
    const result = await undoAiClassification({
      createdAt: Date.now(),
      items: [{
        bookmarkId: 'bm-1',
        previousCategoryId: 'cat-1',
        previousIndex: 3,
        targetCategoryId: 'cat-2',
      }],
    }, [{ ...bookmarks[0], categoryId: 'cat-2' }], categories, moveNative)
    expect(moveNative).toHaveBeenCalledWith('bm-1', {
      parentId: '1',
      index: 3,
    })
    expect(result).toEqual({ restored: 1, skipped: 0 })
  })
})
