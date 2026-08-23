import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  consumeBookmarkDeletionSuppression,
  suppressBookmarkDeletionArchive,
} from './bookmark-deletion-safety'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('bookmark deletion safety', () => {
  it('consumes a local deletion suppression only once', async () => {
    const state: Record<string, unknown> = {}
    vi.stubGlobal('chrome', {
      storage: {
        session: {
          get: vi.fn(async (key: string) => ({ [key]: state[key] })),
          set: vi.fn(async (values: Record<string, unknown>) => {
            Object.assign(state, values)
          }),
        },
      },
    })

    await suppressBookmarkDeletionArchive(['bookmark-1'])

    await expect(consumeBookmarkDeletionSuppression('bookmark-1')).resolves.toBe(true)
    await expect(consumeBookmarkDeletionSuppression('bookmark-1')).resolves.toBe(false)
  })
})
