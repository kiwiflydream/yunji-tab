// A hidden or throttled tab never paints the frame a view transition waits for before calling its update.
const SNAPSHOT_GRACE_MS = 300

interface ViewTransitionRun {
  /** Root classes and snapshot names this run sets up just before the old snapshot is taken. */
  prepare: () => void
  /** Changes the page; `owns()` turns false once a newer transition has taken the page over. */
  update: (owns: () => boolean) => Promise<void> | void
  /** Removes whatever `prepare` and `update` set up; runs once, when the run finishes or is replaced. */
  cleanup: () => void
}

let releaseCurrent: (() => void) | null = null

/** True while a home-layout, card or theme transition owns the page. */
export function viewTransitionActive(): boolean {
  return releaseCurrent !== null
}

/**
 * Starts a view transition that owns the page until it finishes. Starting another one releases it first, so its
 * cleanup never strips the newcomer's classes or names later. The update runs exactly once even if the old snapshot
 * is never taken: after a short grace period it runs on its own and the transition is skipped.
 */
export function runViewTransition({ prepare, update, cleanup }: ViewTransitionRun): ViewTransition {
  releaseCurrent?.()
  let owned = true
  const release = () => {
    if (!owned)
      return
    owned = false
    if (releaseCurrent === release)
      releaseCurrent = null
    cleanup()
  }
  releaseCurrent = release
  prepare()
  let run: Promise<void> | undefined
  const once = () => (run ??= Promise.resolve().then(() => update(() => owned)))
  const transition = document.startViewTransition(once)
  // Skipping a transition rejects `ready`, even when its update completes normally.
  void transition.ready.catch(() => undefined)
  window.setTimeout(() => {
    if (run)
      return
    void once()
    transition.skipTransition()
  }, SNAPSHOT_GRACE_MS)
  void transition.finished.catch(() => undefined).finally(release)
  return transition
}
