import type { AiClassificationRunOptions } from './ai-bookmark-classification'
import type { Bookmark, Category } from './types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const storageValues = new Map<string, unknown>()
const classifyBookmarksMock = vi.fn()

vi.mock('@plasmohq/storage', () => ({
  Storage: class Storage {
    async get<T>(key: string): Promise<T | undefined> {
      return storageValues.get(key) as T | undefined
    }

    async set(key: string, value: unknown): Promise<void> {
      storageValues.set(key, value)
    }

    async remove(key: string): Promise<void> {
      storageValues.delete(key)
    }
  },
}))

vi.mock('./ai-bookmark-classification', async (importOriginal) => {
  const original
    = await importOriginal<typeof import('./ai-bookmark-classification')>()
  return { ...original, classifyBookmarks: classifyBookmarksMock }
})

const bookmarks: Bookmark[] = [
  { id: 'bm-1', name: 'One', url: 'https://one.test', categoryId: 'cat-1' },
  { id: 'bm-2', name: 'Two', url: 'https://two.test', categoryId: 'cat-1' },
]
const categories: Category[] = [
  { id: 'cat-1', name: 'Inbox', emoji: '', parentId: 'all', modifiable: true },
  { id: 'cat-2', name: 'Docs', emoji: '', parentId: 'all', modifiable: true },
]
const config = {
  baseUrl: 'https://api.example.test/v1',
  token: 'secret',
  model: 'model',
  prompt: 'prompt',
  batchSize: 1,
}

describe('ai classification job', () => {
  beforeEach(async () => {
    classifyBookmarksMock.mockReset()
    const { clearAiClassificationJob }
      = await import('./ai-classification-job')
    await clearAiClassificationJob()
  })

  afterEach(() => vi.unstubAllGlobals())

  it('persists batch progress and pauses after the active batch', async () => {
    let finishActiveBatch = () => {}
    const activeBatch = new Promise<void>((resolve) => {
      finishActiveBatch = resolve
    })
    classifyBookmarksMock.mockImplementation(
      async (
        _config,
        _bookmarks,
        _categories,
        options: AiClassificationRunOptions,
      ) => {
        await options.beforeBatch?.()
        await activeBatch
        await options.onBatchComplete?.(
          [
            {
              bookmarkId: 'bm-1',
              sourceCategoryId: 'cat-1',
              targetCategoryId: 'cat-2',
              confidence: 0.9,
              reason: 'Docs',
            },
          ],
          ['bm-1'],
        )
        await options.beforeBatch?.()
        await options.onBatchComplete?.([], ['bm-2'])
        return []
      },
    )

    const job = await import('./ai-classification-job')
    await job.startAiClassificationJob(config, bookmarks, categories)
    job.pauseAiClassificationJob()
    expect(job.getAiClassificationJobSnapshot().status).toBe('pausing')

    finishActiveBatch()
    await vi.waitFor(() => {
      expect(job.getAiClassificationJobSnapshot()).toMatchObject({
        status: 'paused',
        completed: 1,
      })
    })
    expect(JSON.stringify([...storageValues.values()])).not.toContain('secret')

    await job.resumeAiClassificationJob(config, bookmarks, categories)
    await vi.waitFor(() => {
      expect(job.getAiClassificationJobSnapshot()).toMatchObject({
        status: 'completed',
        completed: 2,
      })
    })
  })

  it('aborts the active request when terminated', async () => {
    classifyBookmarksMock.mockImplementation(
      async (
        _config,
        _bookmarks,
        _categories,
        options: AiClassificationRunOptions,
      ) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')))
        }),
    )

    const job = await import('./ai-classification-job')
    await job.startAiClassificationJob(config, bookmarks, categories)
    job.terminateAiClassificationJob()
    expect(job.getAiClassificationJobSnapshot().status).toBe('terminated')
  })

  it('exposes transient retry progress to the settings UI', async () => {
    classifyBookmarksMock.mockImplementation(
      async (
        _config,
        _bookmarks,
        _categories,
        options: AiClassificationRunOptions,
      ) => new Promise((_resolve, reject) => {
        options.onRetry?.(1, 2)
        options.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')))
      }),
    )

    const job = await import('./ai-classification-job')
    await job.startAiClassificationJob(config, bookmarks, categories)
    await vi.waitFor(() => {
      expect(job.getAiClassificationJobSnapshot()).toMatchObject({
        retryAttempt: 1,
        retryMax: 2,
      })
    })
    job.terminateAiClassificationJob()
  })

  it('does not overwrite a task owned by another extension page', async () => {
    vi.stubGlobal('navigator', {
      locks: {
        request: vi.fn(async (
          _name: string,
          _options: LockOptions,
          callback: (lock: Lock | null) => Promise<void>,
        ) => callback(null)),
      },
    })

    const job = await import('./ai-classification-job')
    await expect(
      job.startAiClassificationJob(config, bookmarks, categories),
    ).rejects.toThrow('ai.job_running_elsewhere')
    expect(job.getAiClassificationJobSnapshot().status).toBe('idle')
    expect(classifyBookmarksMock).not.toHaveBeenCalled()
  })
})
