import { runViewTransition, viewTransitionActive } from '~/lib/view-transition'

// A theme picked by pointer spreads from where it was picked; other changes (keys, system, sync) cross-fade.
const POINTER_ORIGIN_MS = 1000
let lastPointer: { x: number, y: number, at: number } | null = null

/** Remembers the latest press so a theme change can reveal from it. */
export function trackThemeTransitionOrigin(): () => void {
  const onPointerDown = (event: PointerEvent) => {
    lastPointer = { x: event.clientX, y: event.clientY, at: performance.now() }
  }
  window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true })
  return () => window.removeEventListener('pointerdown', onPointerDown, { capture: true })
}

/** Applies theme classes and variables inside a view transition instead of flipping every colour at once. */
export function runThemeTransition(apply: () => void): void {
  const root = document.documentElement
  if (
    !document.startViewTransition
    || document.visibilityState !== 'visible'
    // A layout or card morph keeps the page: cards it names would change outside the reveal, so the theme just lands.
    || viewTransitionActive()
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    apply()
    return
  }
  const origin = lastPointer && performance.now() - lastPointer.at < POINTER_ORIGIN_MS ? lastPointer : null
  lastPointer = null
  const mode = origin ? 'theme-reveal' : 'theme-fade'
  const transition = runViewTransition({
    prepare: () => root.classList.add(mode),
    update: apply,
    cleanup: () => root.classList.remove(mode),
  })
  if (origin) {
    void transition.ready.then(() => {
      const radius = Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y))
      root.animate(
        { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`] },
        { duration: 560, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', pseudoElement: '::view-transition-new(root)' },
      )
    }, () => undefined)
  }
}
