import type { Bookmark, Category } from './types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  classifyBookmarks,
  createClassificationBatches,
  createClassificationInput,
  getAiEndpointPermissionPattern,
  MAX_CLASSIFICATION_BOOKMARK_INPUT_CHARS,
  validateAiEndpoint,
  validateClassificationSuggestions,
} from './ai-bookmark-classification'

const categories: Category[] = [
  {
    id: 'cat-1',
    name: 'Bookmarks bar',
    emoji: '',
    parentId: 'all',
    modifiable: false,
  },
  {
    id: 'cat-2',
    name: 'Development',
    emoji: '',
    parentId: 'cat-1',
    modifiable: true,
  },
]
const bookmarks: Bookmark[] = [
  {
    id: 'bm-1',
    name: 'Example',
    url: 'https://example.com/docs?q=secret#part',
    categoryId: 'cat-1',
    tags: ['reference'],
  },
]

describe('ai bookmark classification', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('removes query strings and hashes from model input', () => {
    expect(createClassificationInput(bookmarks, categories)).toEqual([
      {
        bookmarkId: 'bm-1',
        title: 'Example',
        url: 'https://example.com/docs',
        currentCategoryPath: 'Bookmarks bar',
        description: undefined,
        tags: ['reference'],
      },
    ])
  })

  it('accepts only valid, meaningful, confident suggestions', () => {
    expect(
      validateClassificationSuggestions(
        [
          {
            bookmarkId: 'bm-1',
            targetCategoryId: 'cat-2',
            confidence: 0.91,
            reason: 'Developer docs',
          },
          {
            bookmarkId: 'bm-1',
            targetCategoryId: 'cat-1',
            confidence: 1,
            reason: 'Duplicate',
          },
          {
            bookmarkId: 'unknown',
            targetCategoryId: 'cat-2',
            confidence: 1,
            reason: 'Unknown',
          },
          {
            bookmarkId: 'bm-1',
            targetCategoryId: 'missing',
            confidence: 1,
            reason: 'Bad folder',
          },
        ],
        bookmarks,
        categories,
      ),
    ).toEqual([
      {
        bookmarkId: 'bm-1',
        sourceCategoryId: 'cat-1',
        targetCategoryId: 'cat-2',
        confidence: 0.91,
        reason: 'Developer docs',
      },
    ])
  })

  it('rejects non-array model output', () => {
    expect(() =>
      validateClassificationSuggestions(
        { unexpected: true },
        bookmarks,
        categories,
      ),
    ).toThrow('ai.invalid_response')
  })

  it('allows insecure token transport only for loopback endpoints', () => {
    expect(() => validateAiEndpoint('http://api.example.com/v1')).toThrow(
      'ai.insecure_token_endpoint',
    )
    expect(validateAiEndpoint('http://localhost:11434/v1').host).toBe(
      'localhost:11434',
    )
    expect(getAiEndpointPermissionPattern('https://api.example.com/v1')).toBe(
      'https://api.example.com/*',
    )
  })

  it('splits requests by both bookmark count and serialized input size', () => {
    const manyBookmarks = Array.from({ length: 45 }, (_, index): Bookmark => ({
      id: `bm-${index}`,
      name: `Bookmark ${index}`,
      url: `https://example.com/${index}`,
      categoryId: 'cat-1',
      description: 'x'.repeat(500),
      tags: Array.from({ length: 20 }, () => 'y'.repeat(120)),
    }))
    const inputs = createClassificationInput(manyBookmarks, categories)
    const batches = createClassificationBatches(inputs, 10)

    expect(batches.length).toBe(5)
    expect(batches.flat()).toHaveLength(manyBookmarks.length)
    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(10)
      expect(
        batch.reduce(
          (total, input) => total + JSON.stringify(input).length + 1,
          0,
        ),
      ).toBeLessThanOrEqual(MAX_CLASSIFICATION_BOOKMARK_INPUT_CHARS)
    }
  })

  it('sends large libraries as multiple bounded requests', async () => {
    const manyBookmarks = Array.from({ length: 45 }, (_, index): Bookmark => ({
      id: `bm-${index}`,
      name: `Bookmark ${index}`,
      url: `https://example.com/${index}`,
      categoryId: 'cat-1',
      description: 'x'.repeat(500),
      tags: Array.from({ length: 20 }, () => 'y'.repeat(120)),
    }))
    const requests: Array<{ messages: Array<{ content: string }> }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input, init: RequestInit) => {
        requests.push(JSON.parse(String(init.body)))
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '[]' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }),
    )
    const progress = vi.fn()

    await classifyBookmarks(
      {
        baseUrl: 'https://api.example.com/v1',
        token: 'token',
        model: 'model',
        prompt: 'Classify bookmarks',
        batchSize: 10,
      },
      manyBookmarks,
      categories,
      { onProgress: progress },
    )

    expect(requests.length).toBeGreaterThan(2)
    for (const request of requests) {
      const userInput = JSON.parse(request.messages[1].content) as {
        bookmarks: unknown[]
      }
      expect(userInput.bookmarks.length).toBeLessThanOrEqual(10)
      expect(JSON.stringify(userInput.bookmarks).length).toBeLessThanOrEqual(
        MAX_CLASSIFICATION_BOOKMARK_INPUT_CHARS,
      )
    }
    expect(progress).toHaveBeenLastCalledWith(45, 45)
  })

  it('retries transient provider failures and reports each retry', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: '[]' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const onRetry = vi.fn()

    const classification = classifyBookmarks({
      baseUrl: 'https://api.example.com/v1',
      token: 'token',
      model: 'model',
      prompt: 'Classify bookmarks',
      batchSize: 80,
    }, bookmarks, categories, { onRetry })
    await vi.runAllTimersAsync()

    await expect(classification).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, 2)
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, 2)
  })

  it('does not retry configuration and authentication failures', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(classifyBookmarks({
      baseUrl: 'https://api.example.com/v1',
      token: 'invalid',
      model: 'model',
      prompt: 'Classify bookmarks',
      batchSize: 80,
    }, bookmarks, categories)).rejects.toThrow('ai.http_401')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('cancels a pending retry when the task is terminated', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    const onRetry = vi.fn()
    const classification = classifyBookmarks({
      baseUrl: 'https://api.example.com/v1',
      token: 'token',
      model: 'model',
      prompt: 'Classify bookmarks',
      batchSize: 80,
    }, bookmarks, categories, { signal: controller.signal, onRetry })
    const rejection = expect(classification).rejects.toMatchObject({
      name: 'AbortError',
    })

    await vi.waitFor(() => expect(onRetry).toHaveBeenCalledOnce())
    controller.abort()

    await rejection
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('does not retry before a server-specified long rate-limit window', async () => {
    const fetchMock = vi.fn(async () => new Response('', {
      status: 429,
      headers: { 'Retry-After': '60' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const onRetry = vi.fn()

    await expect(classifyBookmarks({
      baseUrl: 'https://api.example.com/v1',
      token: 'token',
      model: 'model',
      prompt: 'Classify bookmarks',
      batchSize: 80,
    }, bookmarks, categories, { onRetry })).rejects.toThrow('ai.http_429')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('passes through the pause gate before sending a retry', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: '[]' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    let resume = () => {}
    const beforeBatch = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        resume = resolve
      }))

    const classification = classifyBookmarks({
      baseUrl: 'https://api.example.com/v1',
      token: 'token',
      model: 'model',
      prompt: 'Classify bookmarks',
      batchSize: 80,
    }, bookmarks, categories, { beforeBatch })
    await vi.runAllTimersAsync()
    await vi.waitFor(() => expect(beforeBatch).toHaveBeenCalledTimes(2))
    expect(fetchMock).toHaveBeenCalledOnce()

    resume()
    await expect(classification).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
