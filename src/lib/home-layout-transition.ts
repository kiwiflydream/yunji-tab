import { flushSync } from 'react-dom'

// Marks the elements that move between layouts; names are only set while a switch runs (see main.css).
const MORPH_CLASS = 'home-layout-morph'

/** Applies a home-layout change inside a view transition so search, clock and grid glide to their new places. */
export function runHomeLayoutTransition(update: () => void): void {
  const root = document.documentElement
  if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update()
    return
  }
  root.classList.add(MORPH_CLASS)
  // The transition snapshots the new state when the callback returns, so React must commit synchronously.
  // eslint-disable-next-line react/dom-no-flush-sync
  const transition = document.startViewTransition(() => flushSync(update))
  void transition.finished.catch(() => undefined).finally(() => root.classList.remove(MORPH_CLASS))
}
