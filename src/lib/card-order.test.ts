import { describe, expect, it } from 'vitest'
import { comparePinnedCards, getPinnedCards, reorderPinnedCards } from './card-order'

describe('mixed pinned card order', () => {
  const cards = [
    { key: 'bookmark:a', pinnedAt: 30 },
    { key: 'group:tools', pinnedAt: 20 },
    { key: 'bookmark:b', pinnedAt: 10 },
  ]

  it('moves groups across bookmarks in both directions without changing pin timestamps', () => {
    const ranks = reorderPinnedCards(cards, 'group:tools', 'bookmark:a')
    const reordered = cards.map(card => ({ ...card, pinnedOrder: ranks.get(card.key) })).sort(comparePinnedCards)
    expect(reordered.map(card => card.key)).toEqual(['group:tools', 'bookmark:a', 'bookmark:b'])
    expect(ranks.size).toBe(1)
    const back = reorderPinnedCards(reordered, 'group:tools', 'bookmark:b')
    expect(reordered.map(card => ({ ...card, pinnedOrder: back.get(card.key) ?? card.pinnedOrder })).sort(comparePinnedCards).map(card => card.key))
      .toEqual(['bookmark:a', 'bookmark:b', 'group:tools'])
    expect(reordered.find(card => card.key === 'group:tools')?.pinnedAt).toBe(20)
  })

  it('uses a midpoint to move a bookmark between two groups', () => {
    const ranks = reorderPinnedCards([
      { key: 'group:a', pinnedAt: 40 },
      { key: 'group:b', pinnedAt: 30 },
      { key: 'bookmark:x', pinnedAt: 20 },
      { key: 'group:c', pinnedAt: 10 },
    ], 'bookmark:x', 'group:b')
    expect(ranks.get('bookmark:x')).toBe(-35)
  })

  it('re-spaces dense and equal ranks without losing items', () => {
    const dense = cards.map(card => ({ ...card, pinnedOrder: -1e15 }))
    const ranks = reorderPinnedCards(dense, 'bookmark:a', 'bookmark:b')
    expect(ranks.size).toBe(3)
    expect(new Set(ranks.values()).size).toBe(3)
    expect(dense.map(card => ({ ...card, pinnedOrder: ranks.get(card.key) })).sort(comparePinnedCards).map(card => card.key))
      .toEqual(['bookmark:b', 'bookmark:a', 'group:tools'])
  })

  it('ignores disappeared cards and handles duplicate URLs as one position', () => {
    expect(reorderPinnedCards(cards, 'missing', 'group:tools').size).toBe(0)
    expect(reorderPinnedCards(cards, 'group:tools', 'group:tools').size).toBe(0)
    expect(getPinnedCards([
      { id: '1', name: 'A', url: 'https://a.test', categoryId: 'cat-1', pinnedAt: 30 },
      { id: '2', name: 'A duplicate', url: 'https://a.test', categoryId: 'cat-2', pinnedAt: 30 },
    ], []).map(card => card.key)).toEqual(['bookmark:https://a.test'])
  })
})
