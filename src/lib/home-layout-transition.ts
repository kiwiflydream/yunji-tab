import { flushSync } from 'react-dom'

// Marks the elements that move between layouts; names are only set while a switch runs (see main.css).
export const HOME_LAYOUT_MORPH_CLASS = 'home-layout-morph'
export const HOME_LAYOUT_MORPH_START_EVENT = 'home-layout-morph-start'

function finishContentCssAnimations(): void {
  for (const animation of document.getAnimations()) {
    const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null
    if (animation instanceof CSSAnimation && target instanceof Element
      && target.matches('.home-hero-entrance > *, .surface-panel.animate-in')) {
      animation.finish()
    }
  }
}

/** Applies a home-layout change inside a view transition so search, clock and grid glide to their new places. */
export function runHomeLayoutTransition(update: () => void): void {
  const root = document.documentElement
  if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update()
    return
  }
  root.classList.add(HOME_LAYOUT_MORPH_CLASS)
  document.dispatchEvent(new Event(HOME_LAYOUT_MORPH_START_EVENT))
  finishContentCssAnimations()
  // The transition snapshots the new state when the callback returns, so React must commit synchronously.
  const transition = document.startViewTransition(() => {
    // eslint-disable-next-line react/dom-no-flush-sync
    flushSync(update)
    finishContentCssAnimations()
  })
  void transition.finished.catch(() => undefined).finally(() => root.classList.remove(HOME_LAYOUT_MORPH_CLASS))
}
