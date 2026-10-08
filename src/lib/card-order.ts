import type { BookmarkGroup } from './bookmark-groups'
import type { Bookmark } from './types'

export interface PinnedCard {
  key: string
  pinnedAt: number
  pinnedOrder?: number
}

export function bookmarkCardKey(url: string): string {
  return `bookmark:${url}`
}

export function groupCardKey(id: string): string {
  return `group:${id}`
}

export function pinnedCardRank(card: Pick<PinnedCard, 'pinnedAt' | 'pinnedOrder'>): number {
  return Number.isFinite(card.pinnedOrder) ? card.pinnedOrder! : -card.pinnedAt
}

export function comparePinnedCards(left: PinnedCard, right: PinnedCard): number {
  return pinnedCardRank(left) - pinnedCardRank(right) || left.key.localeCompare(right.key)
}

export function getPinnedCards(bookmarks: Bookmark[], groups: BookmarkGroup[]): PinnedCard[] {
  const cards = new Map<string, PinnedCard>()
  for (const bookmark of bookmarks) {
    if (bookmark.pinnedAt) {
      const key = bookmarkCardKey(bookmark.url)
      cards.set(key, { key, pinnedAt: bookmark.pinnedAt, pinnedOrder: bookmark.pinnedOrder })
    }
  }
  for (const group of groups) {
    if (group.pinnedAt) {
      const key = groupCardKey(group.id)
      cards.set(key, { key, pinnedAt: group.pinnedAt, pinnedOrder: group.pinnedOrder })
    }
  }
  return [...cards.values()].sort(comparePinnedCards)
}

export function reorderPinnedCards(cards: PinnedCard[], sourceKey: string, targetKey: string): Map<string, number> {
  const ordered = cards.toSorted(comparePinnedCards)
  const sourceIndex = ordered.findIndex(card => card.key === sourceKey)
  const targetIndex = ordered.findIndex(card => card.key === targetKey)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex)
    return new Map()
  const [source] = ordered.splice(sourceIndex, 1)
  ordered.splice(targetIndex, 0, source)
  const previous = ordered[targetIndex - 1]
  const next = ordered[targetIndex + 1]
  const low = previous ? pinnedCardRank(previous) : undefined
  const high = next ? pinnedCardRank(next) : undefined
  const rank = low === undefined ? high! - 1024 : high === undefined ? low + 1024 : low + (high - low) / 2
  if (Number.isFinite(rank) && (low === undefined || rank > low) && (high === undefined || rank < high))
    return new Map([[sourceKey, rank]])
  // Re-space a dense interval rather than losing a move to floating point rounding.
  const firstRank = -Date.now() - ordered.length * 1024
  return new Map(ordered.map((card, index) => [card.key, firstRank + index * 1024]))
}
