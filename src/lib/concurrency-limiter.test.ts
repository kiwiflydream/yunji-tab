import { describe, expect, it } from 'vitest'
import { createConcurrencyLimiter } from './concurrency-limiter'

describe('concurrency limiter', () => {
  it('never runs more than the configured number of tasks', async () => {
    const runLimited = createConcurrencyLimiter(3)
    let active = 0
    let peak = 0

    const tasks = Array.from({ length: 10 }, (_, index) => runLimited(async () => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise(resolve => setTimeout(resolve, 5))
      active -= 1
      return index
    }))

    await expect(Promise.all(tasks)).resolves.toEqual(
      Array.from({ length: 10 }, (_, index) => index),
    )
    expect(peak).toBe(3)
  })
})
