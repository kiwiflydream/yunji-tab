import { describe, expect, it } from 'vitest'
import { createCoalescedAsyncRunner } from './coalesced-async'

describe('coalesced async runner', () => {
  it('coalesces concurrent requests into one follow-up run', async () => {
    const runCoalesced = createCoalescedAsyncRunner()
    const releases: Array<() => void> = []
    let runCount = 0
    const task = async () => {
      runCount += 1
      await new Promise<void>(resolve => releases.push(resolve))
      return runCount
    }

    const first = runCoalesced(task)
    const second = runCoalesced(task)
    const third = runCoalesced(task)
    expect(runCount).toBe(1)
    expect(second).toBe(first)
    expect(third).toBe(first)

    releases.shift()?.()
    await Promise.resolve()
    await Promise.resolve()
    expect(runCount).toBe(2)
    releases.shift()?.()

    await expect(Promise.all([first, second, third])).resolves.toEqual([2, 2, 2])
    expect(runCount).toBe(2)
  })
})
