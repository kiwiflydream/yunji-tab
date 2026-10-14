import type { RefObject } from 'react'
import { useLayoutEffect, useRef } from 'react'
import { CARD_MORPH_CLASS } from '~/lib/card-transition'
import { HOME_LAYOUT_MORPH_CLASS, HOME_LAYOUT_MORPH_START_EVENT } from '~/lib/home-layout-transition'

const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)'
const STAGGER_MS = 24
const MAX_STAGGER_MS = 240

/** Content motion stays off for reduced motion and while a home-layout or card view transition owns the page. */
export function contentMotionAllowed(): boolean {
  const root = document.documentElement
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    && !root.classList.contains(HOME_LAYOUT_MORPH_CLASS)
    && !root.classList.contains(CARD_MORPH_CLASS)
}

/** Where entering cards come from: below by default, or sideways when moving deeper into or back out of a folder. */
export type EntranceDirection = 'up' | 'forward' | 'back'

const entranceOffset: Record<EntranceDirection, string> = {
  up: 'translateY(6px)',
  forward: 'translateX(14px)',
  back: 'translateX(-14px)',
}

/** Fades the children currently in the viewport into place, one after another, whenever `key` changes. */
export function useStaggeredEntrance(containerRef: RefObject<HTMLElement | null>, key: string, direction: EntranceDirection = 'up'): void {
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container || typeof container.animate !== 'function' || !contentMotionAllowed())
      return
    const viewportBottom = window.innerHeight
    const visible = Array.from(container.children).filter((child): child is HTMLElement => {
      const rect = child.getBoundingClientRect()
      return rect.bottom > 0 && rect.top < viewportBottom
    })
    const animations = visible.map((child, index) => child.animate(
      [{ opacity: 0, transform: entranceOffset[direction] }, { opacity: 1, transform: 'none' }],
      { duration: 260, delay: Math.min(index * STAGGER_MS, MAX_STAGGER_MS), easing: EASE_OUT, fill: 'backwards' },
    ))
    const stop = () => {
      document.removeEventListener(HOME_LAYOUT_MORPH_START_EVENT, stop)
      animations.forEach(animation => animation.cancel())
    }
    document.addEventListener(HOME_LAYOUT_MORPH_START_EVENT, stop, { once: true })
    return stop
  }, [containerRef, key, direction])
}

/**
 * Slides `indicatorRef` from the item that lost the `selector` match to the one that gained it whenever `key` changes.
 * Several items can match at once (a saved search keeps "All" selected), so only a clean one-for-one swap slides.
 * The new item keeps its own highlight hidden until the indicator lands on it.
 */
export function useSlidingIndicator(
  containerRef: RefObject<HTMLElement | null>,
  indicatorRef: RefObject<HTMLElement | null>,
  selector: string,
  key: string,
): void {
  const selectedRef = useRef<HTMLElement[]>([])
  useLayoutEffect(() => {
    const container = containerRef.current
    const indicator = indicatorRef.current
    const selected = container ? Array.from(container.querySelectorAll<HTMLElement>(selector)) : []
    const before = selectedRef.current
    selectedRef.current = selected
    const gained = selected.filter(element => !before.includes(element))
    const lost = before.filter(element => element.isConnected && !selected.includes(element))
    if (
      !container || !indicator || gained.length !== 1 || lost.length !== 1
      || typeof indicator.animate !== 'function' || !contentMotionAllowed()
    ) {
      return
    }
    const [current] = gained
    const [previous] = lost
    const origin = container.getBoundingClientRect()
    const place = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect()
      return {
        transform: `translate(${rect.left - origin.left + container.scrollLeft}px, ${rect.top - origin.top + container.scrollTop}px)`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      }
    }
    current.dataset.indicatorPending = ''
    current.dataset.indicatorStill = ''
    indicator.hidden = false
    const animation = indicator.animate([place(previous), place(current)], { duration: 260, easing: EASE_OUT, fill: 'both' })
    const land = () => {
      document.removeEventListener(HOME_LAYOUT_MORPH_START_EVENT, land)
      indicator.hidden = true
      animation.cancel()
      // Restore the item's own highlight before its transitions come back, so it doesn't fade in again.
      delete current.dataset.indicatorPending
      void getComputedStyle(current).backgroundColor
      delete current.dataset.indicatorStill
    }
    animation.finished.then(land, () => undefined)
    document.addEventListener(HOME_LAYOUT_MORPH_START_EVENT, land, { once: true })
    return () => {
      document.removeEventListener(HOME_LAYOUT_MORPH_START_EVENT, land)
      if (animation.playState !== 'idle')
        land()
    }
  }, [containerRef, indicatorRef, selector, key])
}
