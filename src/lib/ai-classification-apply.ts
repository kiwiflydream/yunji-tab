import type { AiClassificationSuggestion } from './ai-bookmark-classification'
import type { Bookmark, Category } from './types'
import { Storage } from '@plasmohq/storage'
import { toNodeId } from './bookmark-tree'

const RECOVERY_KEY = 'yunji-tab:ai-classification-recovery'
export const AI_CLASSIFICATION_RECOVERY_MS = 24 * 60 * 60_000
const recoveryStorage = new Storage({ area: 'local' })

export interface AiClassificationRecoveryItem {
  bookmarkId: string
  previousCategoryId: string
  previousIndex?: number
  targetCategoryId: string
}

export interface AiClassificationRecovery {
  createdAt: number
  items: AiClassificationRecoveryItem[]
}

export interface ApplyClassificationResult {
  moved: number
  skipped: number
  recovery: AiClassificationRecovery | null
}

export async function loadAiClassificationRecovery(): Promise<AiClassificationRecovery | null> {
  const recovery = await recoveryStorage.get<AiClassificationRecovery>(RECOVERY_KEY)
  if (
    !recovery
    || !Array.isArray(recovery.items)
    || Date.now() - recovery.createdAt > AI_CLASSIFICATION_RECOVERY_MS
  ) {
    await recoveryStorage.remove(RECOVERY_KEY)
    return null
  }
  return recovery
}

export async function clearAiClassificationRecovery(): Promise<void> {
  await recoveryStorage.remove(RECOVERY_KEY)
}

export async function applyClassificationSuggestions(
  suggestions: AiClassificationSuggestion[],
  currentBookmarks: Bookmark[],
  categories: Category[],
  moveOne: (bookmarkId: string, targetCategoryId: string) => Promise<void>,
): Promise<ApplyClassificationResult> {
  const bookmarksById = new Map(currentBookmarks.map(bookmark => [bookmark.id, bookmark]))
  const categoryIds = new Set(categories.map(category => category.id))
  const recovery: AiClassificationRecovery = { createdAt: Date.now(), items: [] }
  let skipped = 0

  for (const suggestion of suggestions) {
    const bookmark = bookmarksById.get(suggestion.bookmarkId)
    if (
      !bookmark
      || !categoryIds.has(suggestion.targetCategoryId)
      || bookmark.categoryId !== suggestion.sourceCategoryId
      || bookmark.categoryId === suggestion.targetCategoryId
    ) {
      skipped += 1
      continue
    }
    // Persist after every successful move so an interrupted batch stays recoverable.
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    await moveOne(bookmark.id, suggestion.targetCategoryId)
    recovery.items.push({
      bookmarkId: bookmark.id,
      previousCategoryId: bookmark.categoryId,
      previousIndex: bookmark.index,
      targetCategoryId: suggestion.targetCategoryId,
    })
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    await recoveryStorage.set(RECOVERY_KEY, recovery)
  }

  return {
    moved: recovery.items.length,
    skipped,
    recovery: recovery.items.length > 0 ? recovery : null,
  }
}

export async function undoAiClassification(
  recovery: AiClassificationRecovery,
  currentBookmarks: Bookmark[],
  categories: Category[],
  moveNative: (
    bookmarkId: string,
    destination: chrome.bookmarks.MoveDestination,
  ) => Promise<unknown> = (bookmarkId, destination) =>
    chrome.bookmarks.move(toNodeId(bookmarkId), destination),
): Promise<{ restored: number, skipped: number }> {
  const categoryIds = new Set(categories.map(category => category.id))
  const bookmarksById = new Map(currentBookmarks.map(bookmark => [bookmark.id, bookmark]))
  let restored = 0
  let skipped = 0
  for (const item of [...recovery.items].reverse()) {
    if (
      !categoryIds.has(item.previousCategoryId)
      || bookmarksById.get(item.bookmarkId)?.categoryId !== item.targetCategoryId
    ) {
      skipped += 1
      continue
    }
    try {
      // Reverse order plus original indexes best preserves the pre-move ordering.
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      await moveNative(item.bookmarkId, {
        parentId: toNodeId(item.previousCategoryId),
        ...(item.previousIndex === undefined ? {} : { index: item.previousIndex }),
      })
      restored += 1
    }
    catch {
      skipped += 1
    }
  }
  await clearAiClassificationRecovery()
  return { restored, skipped }
}
