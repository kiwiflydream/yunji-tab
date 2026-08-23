import type { DragDropMessageKey } from './i18n-drag-drop'
import type { Category } from './types'

export interface BookmarkDragData {
  type: 'bookmark'
  bookmarkId: string
  url: string
  categoryId: string
  label: string
  index: number
  pinned: boolean
  reorderEnabled: boolean
  pinnedReorder: boolean
}

export interface CategoryDragData {
  type: 'category'
  categoryId: string
  parentId: string
  label: string
  emoji: string
}

export interface CategoryDropData {
  type: 'category-drop'
  categoryId: string
  label: string
}

export interface BookmarkDropData {
  type: 'bookmark-drop'
  bookmarkId: string
  url: string
  categoryId: string
  label: string
  index: number
  pinned: boolean
}

export type DragItemData = BookmarkDragData | CategoryDragData

export interface DropValidation {
  status: 'valid' | 'invalid' | 'noop'
  messageKey: DragDropMessageKey
  completedMessageKey?: DragDropMessageKey
  params?: Record<string, number | string>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function readDragItemData(value: unknown): DragItemData | null {
  if (!isRecord(value) || typeof value.type !== 'string')
    return null

  if (
    value.type === 'bookmark'
    && typeof value.bookmarkId === 'string'
    && typeof value.url === 'string'
    && typeof value.categoryId === 'string'
    && typeof value.label === 'string'
    && typeof value.index === 'number'
    && typeof value.pinned === 'boolean'
    && typeof value.reorderEnabled === 'boolean'
    && typeof value.pinnedReorder === 'boolean'
  ) {
    return value as unknown as BookmarkDragData
  }

  if (
    value.type === 'category'
    && typeof value.categoryId === 'string'
    && typeof value.parentId === 'string'
    && typeof value.label === 'string'
    && typeof value.emoji === 'string'
  ) {
    return value as unknown as CategoryDragData
  }

  return null
}

export function readCategoryDropData(value: unknown): CategoryDropData | null {
  if (
    !isRecord(value)
    || value.type !== 'category-drop'
    || typeof value.categoryId !== 'string'
    || typeof value.label !== 'string'
  ) {
    return null
  }

  return value as unknown as CategoryDropData
}

export function readBookmarkDropData(value: unknown): BookmarkDropData | null {
  if (
    !isRecord(value)
    || value.type !== 'bookmark-drop'
    || typeof value.bookmarkId !== 'string'
    || typeof value.url !== 'string'
    || typeof value.categoryId !== 'string'
    || typeof value.label !== 'string'
    || typeof value.index !== 'number'
    || typeof value.pinned !== 'boolean'
  ) {
    return null
  }

  return value as unknown as BookmarkDropData
}

export type BookmarkDropPlacement = 'before' | 'after'

export function getBookmarkDropPlacement(
  item: BookmarkDragData,
  target: BookmarkDropData,
): BookmarkDropPlacement {
  return item.index < target.index ? 'after' : 'before'
}

export function validateBookmarkDrop(
  item: DragItemData,
  target: BookmarkDropData,
): DropValidation {
  if (item.type !== 'bookmark') {
    return { status: 'invalid', messageKey: 'dragFolderCannotReorderBookmarks' }
  }
  if (!item.reorderEnabled) {
    return {
      status: 'invalid',
      messageKey: 'dragSwitchToNativeOrder',
    }
  }
  if (
    item.bookmarkId === target.bookmarkId
    || (item.pinnedReorder && item.url === target.url)
  ) {
    return { status: 'noop', messageKey: 'dragBookmarkPositionUnchanged' }
  }
  if (!item.pinnedReorder && item.categoryId !== target.categoryId) {
    return {
      status: 'invalid',
      messageKey: 'dragSameFolderOnly',
    }
  }
  if (item.pinned !== target.pinned) {
    return {
      status: 'invalid',
      messageKey: 'dragPinnedGroupsCannotCross',
    }
  }

  const placement = getBookmarkDropPlacement(item, target)
  return {
    status: 'valid',
    messageKey: placement === 'before' ? 'dragMoveBefore' : 'dragMoveAfter',
    completedMessageKey: placement === 'before' ? 'dragMovedBefore' : 'dragMovedAfter',
    params: { item: item.label, target: target.label },
  }
}

function collectDescendantIds(
  rootId: string,
  categories: Category[],
): Set<string> {
  const ids = new Set([rootId])
  let previousSize = 0

  while (ids.size !== previousSize) {
    previousSize = ids.size
    for (const category of categories) {
      if (ids.has(category.parentId))
        ids.add(category.id)
    }
  }

  return ids
}

export function validateCategoryDrop(
  item: DragItemData,
  targetId: string,
  categories: Category[],
): DropValidation {
  if (targetId === 'all') {
    return { status: 'invalid', messageKey: 'dragAllIsNotFolder' }
  }
  const target = categories.find(category => category.id === targetId)
  if (!target) {
    return { status: 'invalid', messageKey: 'dragTargetFolderMissing' }
  }

  if (item.type === 'bookmark') {
    if (item.categoryId === target.id) {
      return {
        status: 'noop',
        messageKey: 'dragAlreadyInFolder',
        params: { item: item.label, target: target.name },
      }
    }
    return {
      status: 'valid',
      messageKey: 'dragMoveToFolder',
      completedMessageKey: 'dragMovedToFolder',
      params: { item: item.label, target: target.name },
    }
  }

  const source = categories.find(category => category.id === item.categoryId)
  if (!source || !source.modifiable) {
    return { status: 'invalid', messageKey: 'dragFolderCannotMove' }
  }
  if (source.id === target.id) {
    return { status: 'invalid', messageKey: 'dragCannotMoveIntoSelf' }
  }
  if (collectDescendantIds(source.id, categories).has(target.id)) {
    return {
      status: 'invalid',
      messageKey: 'dragCannotMoveParentIntoChild',
    }
  }
  if (source.parentId === target.id) {
    return {
      status: 'noop',
      messageKey: 'dragAlreadyInFolder',
      params: { item: source.name, target: target.name },
    }
  }

  return {
    status: 'valid',
    messageKey: 'dragMoveToFolder',
    completedMessageKey: 'dragMovedToFolder',
    params: { item: source.name, target: target.name },
  }
}
