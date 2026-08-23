type ObserverCallback = () => void

const callbacks = new Map<Element, ObserverCallback>()
let sharedObserver: IntersectionObserver | null = null

function getObserver(): IntersectionObserver {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const cb = callbacks.get(entry.target)
            if (cb) {
              callbacks.delete(entry.target)
              sharedObserver?.unobserve(entry.target)
              cb()
            }
          }
        }
      },
      { rootMargin: '300px' },
    )
  }
  return sharedObserver
}

/**
 * Register an element with the shared IntersectionObserver.
 * Invokes `onIntersect` once when element intersects, and automatically unobserves.
 * Returns an unobserve teardown function for unmounting.
 */
export function observeSharedIntersection(
  element: Element,
  onIntersect: ObserverCallback,
): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    onIntersect()
    return () => {}
  }
  callbacks.set(element, onIntersect)
  getObserver().observe(element)
  return () => {
    callbacks.delete(element)
    sharedObserver?.unobserve(element)
  }
}
