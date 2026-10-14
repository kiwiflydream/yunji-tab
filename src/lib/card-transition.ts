import { flushSync } from 'react-dom'
import { finishContentCssAnimations, HOME_LAYOUT_MORPH_START_EVENT } from '~/lib/home-layout-transition'
import { runViewTransition } from '~/lib/view-transition'

// Marks a card view transition; names live on the cards only while it runs (see main.css).
export const CARD_MORPH_CLASS = 'card-morph'
// Bookmark API calls usually settle in a few frames; past this the change lands without the morph instead of holding a frozen page.
const MAX_FROZEN_MS = 400
const MAX_NAMED_CARDS = 80

function cardsNearViewport(): HTMLElement[] {
  const bottom = window.innerHeight * 1.5
  return Array.from(document.querySelectorAll<HTMLElement>('[data-card-key]')).filter((card) => {
    const rect = card.getBoundingClientRect()
    return rect.width > 0 && rect.bottom > 0 && rect.top < bottom
  }).slice(0, MAX_NAMED_CARDS)
}

/**
 * Applies a change to the cards inside a view transition, so they glide to their new places, removed cards shrink away
 * and new ones grow in. `update` may be async; it resolves with the update's own result (or rejects with its error).
 */
export function runCardTransition<T>(update: () => T | Promise<T>): Promise<T> {
  const root = document.documentElement
  if (
    !document.startViewTransition
    || document.visibilityState !== 'visible'
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return Promise.resolve().then(update)
  }
  const names = new Map<string, string>()
  const named = new Set<HTMLElement>()
  const nameCards = () => {
    const seen = new Set<string>()
    for (const card of cardsNearViewport()) {
      const key = card.dataset.cardKey!
      if (seen.has(key))
        continue
      seen.add(key)
      let name = names.get(key)
      if (!name) {
        name = `card-${names.size}`
        names.set(key, name)
      }
      card.style.viewTransitionName = name
      named.add(card)
    }
  }
  let result: Promise<T> = Promise.resolve(undefined as T)
  const transition = runViewTransition({
    prepare: () => {
      root.classList.add(CARD_MORPH_CLASS)
      document.dispatchEvent(new Event(HOME_LAYOUT_MORPH_START_EVENT))
      finishContentCssAnimations()
      nameCards()
    },
    update: async (owns) => {
      result = Promise.resolve().then(update)
      await Promise.race([result.catch(() => undefined), new Promise(resolve => window.setTimeout(resolve, MAX_FROZEN_MS))])
      // The new snapshot is taken when this returns, so whatever the store changed must be on screen by then.
      // eslint-disable-next-line react/dom-no-flush-sync
      flushSync(() => {})
      if (!owns())
        return
      finishContentCssAnimations()
      nameCards()
    },
    cleanup: () => {
      named.forEach(card => card.style.removeProperty('view-transition-name'))
      root.classList.remove(CARD_MORPH_CLASS)
    },
  })
  return transition.updateCallbackDone.catch(() => undefined).then(() => result)
}
