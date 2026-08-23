export function createCoalescedAsyncRunner() {
  let active: Promise<unknown> | undefined
  let rerunRequested = false

  return function runCoalesced<T>(task: () => Promise<T>): Promise<T> {
    if (active) {
      rerunRequested = true
      return active as Promise<T>
    }

    active = (async () => {
      let result: T
      do {
        rerunRequested = false
        result = await task()
      } while (rerunRequested)
      return result
    })().finally(() => {
      active = undefined
    })
    return active as Promise<T>
  }
}
