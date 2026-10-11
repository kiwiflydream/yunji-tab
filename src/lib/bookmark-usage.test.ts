import type { BookmarkUsageMap } from './bookmark-usage'
import { describe, expect, it, vi } from 'vitest'
import { createBookmarkUsagePersistence, mergeBookmarkUsageMaps } from './bookmark-usage'

describe('bookmark usage merging', () => {
  it('keeps newer external counts without dropping local pending updates', () => {
    expect(mergeBookmarkUsageMaps(
      { 'https://a.example': { openCount: 2, lastOpenedAt: 20 } },
      { 'https://a.example': { openCount: 1, lastOpenedAt: 30 } },
    )).toEqual({
      'https://a.example': { openCount: 2, lastOpenedAt: 30 },
    })
  })

  it('merges entries that exist in only one context', () => {
    expect(mergeBookmarkUsageMaps(
      { 'https://a.example': { openCount: 1, lastOpenedAt: 10 } },
      { 'https://b.example': { openCount: 2, lastOpenedAt: 20 } },
    )).toEqual({
      'https://a.example': { openCount: 1, lastOpenedAt: 10 },
      'https://b.example': { openCount: 2, lastOpenedAt: 20 },
    })
  })
})

function usageContexts() {
  let stored: BookmarkUsageMap = {}
  let queue: Promise<unknown> = Promise.resolve()
  const write = vi.fn(async (usage: BookmarkUsageMap) => {
    stored = structuredClone(usage)
  })
  const withLock = <T>(commit: () => Promise<T>) => {
    const next = queue.then(commit, commit)
    queue = next.catch(() => undefined)
    return next
  }
  const create = () => {
    const onChange = vi.fn()
    const recorder = createBookmarkUsagePersistence({
      read: async () => structuredClone(stored),
      write,
      withLock,
      onChange,
    })
    return { recorder, onChange }
  }
  return { create, write, read: () => stored }
}

describe('usage persistence across pages', () => {
  it('sums simultaneous opens of the same URL and retains unrelated entries', async () => {
    const contexts = usageContexts()
    const first = contexts.create().recorder
    const second = contexts.create().recorder
    first.record('https://same.example/', 10)
    first.record('https://first.example/', 20)
    second.record('https://same.example/', 30)
    await Promise.all([first.flush(), second.flush()])
    expect(contexts.read()).toEqual({
      'https://same.example/': { openCount: 2, lastOpenedAt: 30 },
      'https://first.example/': { openCount: 1, lastOpenedAt: 20 },
    })
    await first.flush()
    expect(contexts.write).toHaveBeenCalledTimes(2)
  })

  it('retries a failed batch without dropping opens recorded during the write', async () => {
    const contexts = usageContexts()
    const { recorder } = contexts.create()
    contexts.write.mockImplementationOnce(async () => {
      recorder.record('https://same.example/', 20)
      throw new Error('write failed')
    })
    recorder.record('https://same.example/', 10)
    await expect(recorder.flush()).rejects.toThrow('write failed')
    expect(recorder.hasPending()).toBe(true)
    await recorder.flush()
    expect(contexts.read()).toEqual({ 'https://same.example/': { openCount: 2, lastOpenedAt: 20 } })
  })

  it('leaves an open recorded during a successful write for the next batch', async () => {
    const contexts = usageContexts()
    const { recorder, onChange } = contexts.create()
    const originalWrite = contexts.write.getMockImplementation()!
    contexts.write.mockImplementationOnce(async (usage) => {
      recorder.record('https://same.example/', 20)
      await originalWrite(usage)
    })
    recorder.record('https://same.example/', 10)
    await recorder.flush()
    expect(contexts.read()['https://same.example/'].openCount).toBe(1)
    expect(onChange).toHaveBeenLastCalledWith({ 'https://same.example/': { openCount: 2, lastOpenedAt: 20 } })
    await recorder.flush()
    expect(contexts.read()['https://same.example/'].openCount).toBe(2)
  })

  it('clears pending opens durably and refreshes a second page without resurrecting old counts', async () => {
    const contexts = usageContexts()
    const first = contexts.create()
    const second = contexts.create()
    first.recorder.record('https://same.example/', 10)
    await first.recorder.flush()
    first.recorder.record('https://same.example/', 20)
    await first.recorder.update(() => ({}))
    await first.recorder.flush()
    await second.recorder.refresh()
    expect(contexts.read()).toEqual({})
    expect(second.onChange).toHaveBeenLastCalledWith({})
    second.recorder.record('https://same.example/', 30)
    await second.recorder.flush()
    expect(contexts.read()['https://same.example/'].openCount).toBe(1)
  })

  it('moves opens recorded during a URL migration into the new URL’s pending batch', async () => {
    const contexts = usageContexts()
    const { recorder, onChange } = contexts.create()
    recorder.record('https://old.example/', 10)
    const originalWrite = contexts.write.getMockImplementation()!
    contexts.write.mockImplementationOnce(async (usage) => {
      recorder.record('https://old.example/', 20)
      await originalWrite(usage)
    })
    await recorder.migrate('https://old.example/', 'https://new.example/')
    expect(onChange).toHaveBeenLastCalledWith({ 'https://new.example/': { openCount: 2, lastOpenedAt: 20 } })
    await recorder.flush()
    expect(contexts.read()).toEqual({ 'https://new.example/': { openCount: 2, lastOpenedAt: 20 } })
  })

  it('retries a failed URL migration before the next usage flush', async () => {
    const contexts = usageContexts()
    const { recorder } = contexts.create()
    recorder.record('https://old.example/', 10)
    contexts.write.mockRejectedValueOnce(new Error('temporary storage failure'))
    await expect(recorder.migrate('https://old.example/', 'https://new.example/')).rejects.toThrow('temporary storage failure')
    await recorder.flush()
    expect(contexts.read()).toEqual({ 'https://new.example/': { openCount: 1, lastOpenedAt: 10 } })
  })

  it('retries a migration of persisted usage without requiring another open', async () => {
    const contexts = usageContexts()
    const { recorder } = contexts.create()
    await contexts.write({ 'https://old.example/': { openCount: 3, lastOpenedAt: 10 } })
    contexts.write.mockRejectedValueOnce(new Error('temporary storage failure'))
    await expect(recorder.migrate('https://old.example/', 'https://new.example/')).rejects.toThrow('temporary storage failure')
    expect(recorder.hasPending()).toBe(true)
    await recorder.flush()
    expect(contexts.read()).toEqual({ 'https://new.example/': { openCount: 3, lastOpenedAt: 10 } })
  })

  it('replays a failed migration before a later URL change', async () => {
    const contexts = usageContexts()
    const { recorder } = contexts.create()
    recorder.record('https://old.example/', 10)
    contexts.write.mockRejectedValueOnce(new Error('temporary storage failure'))
    await expect(recorder.migrate('https://old.example/', 'https://middle.example/')).rejects.toThrow('temporary storage failure')
    recorder.record('https://middle.example/', 20)
    await recorder.migrate('https://middle.example/', 'https://new.example/')
    expect(contexts.read()).toEqual({ 'https://new.example/': { openCount: 2, lastOpenedAt: 20 } })
  })
})
