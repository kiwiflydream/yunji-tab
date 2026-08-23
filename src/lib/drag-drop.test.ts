import type { BookmarkDragData, BookmarkDropData } from './drag-drop'
import { describe, expect, it } from 'vitest'
import {
  getBookmarkDropPlacement,
  readBookmarkDropData,
  readDragItemData,
  validateBookmarkDrop,
} from './drag-drop'

const dragged: BookmarkDragData = {
  type: 'bookmark',
  bookmarkId: 'bookmark-a',
  url: 'https://a.example',
  categoryId: 'category-a',
  label: 'A',
  index: 2,
  pinned: false,
  reorderEnabled: true,
  pinnedReorder: false,
}

const target: BookmarkDropData = {
  type: 'bookmark-drop',
  bookmarkId: 'bookmark-b',
  url: 'https://b.example',
  categoryId: 'category-a',
  label: 'B',
  index: 5,
  pinned: false,
}

describe('bookmark drag and drop', () => {
  it('reads sortable bookmark drag and drop data', () => {
    expect(readDragItemData(dragged)).toEqual(dragged)
    expect(readBookmarkDropData(target)).toEqual(target)
    expect(readDragItemData({ ...dragged, index: '2' })).toBeNull()
  })

  it('places a forward move after the target and a backward move before it', () => {
    expect(getBookmarkDropPlacement(dragged, target)).toBe('after')
    expect(
      getBookmarkDropPlacement(
        { ...dragged, index: 8 },
        { ...target, index: 3 },
      ),
    ).toBe('before')
  })

  it('allows reordering inside the same category and pin group', () => {
    expect(validateBookmarkDrop(dragged, target)).toEqual({
      status: 'valid',
      messageKey: 'dragMoveAfter',
      completedMessageKey: 'dragMovedAfter',
      params: { item: 'A', target: 'B' },
    })
  })

  it('rejects reordering across categories or pin groups', () => {
    expect(
      validateBookmarkDrop(dragged, {
        ...target,
        categoryId: 'category-b',
      }).status,
    ).toBe('invalid')
    expect(
      validateBookmarkDrop(dragged, { ...target, pinned: true }).status,
    ).toBe('invalid')
  })

  it('allows pinned-view reordering across categories', () => {
    expect(validateBookmarkDrop(
      { ...dragged, pinned: true, pinnedReorder: true },
      { ...target, categoryId: 'category-b', pinned: true },
    ).status).toBe('valid')
  })

  it('treats duplicate URLs as the same pinned position', () => {
    expect(validateBookmarkDrop(
      { ...dragged, pinned: true, pinnedReorder: true },
      { ...target, url: dragged.url, pinned: true },
    ).status).toBe('noop')
  })

  it('allows duplicate URLs to reorder inside a native folder', () => {
    expect(validateBookmarkDrop(
      dragged,
      { ...target, url: dragged.url },
    ).status).toBe('valid')
  })

  it('rejects sorting when the current view is not reorderable', () => {
    expect(
      validateBookmarkDrop({ ...dragged, reorderEnabled: false }, target),
    ).toEqual({
      status: 'invalid',
      messageKey: 'dragSwitchToNativeOrder',
    })
  })
})
