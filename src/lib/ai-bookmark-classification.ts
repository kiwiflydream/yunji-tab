import type { Bookmark, Category } from './types'
import { DEFAULT_AI_BATCH_SIZE, normalizeAiBatchSize } from './ai-settings'
import { buildCategoryPathMap } from './category-path'

export const MAX_CLASSIFICATION_BOOKMARK_INPUT_CHARS = 64_000
const MAX_CLASSIFICATION_PROMPT_CHARS = 6_000
const REQUEST_TIMEOUT_MS = 60_000
export const AI_CLASSIFICATION_MAX_RETRIES = 2
const AI_CLASSIFICATION_RETRY_BASE_DELAY_MS = 1_000
const AI_CLASSIFICATION_RETRY_MAX_DELAY_MS = 10_000
export const MIN_AI_CLASSIFICATION_CONFIDENCE = 0.65

export interface AiClassificationConfig {
  baseUrl: string
  token: string
  model: string
  prompt: string
  batchSize: number
}

export interface AiClassificationRunOptions {
  signal?: AbortSignal
  beforeBatch?: () => Promise<void>
  onBatchComplete?: (
    suggestions: AiClassificationSuggestion[],
    processedBookmarkIds: string[],
  ) => void | Promise<void>
  onProgress?: (completed: number, total: number) => void
  onRetry?: (attempt: number, maxRetries: number) => void
}

export interface AiClassificationSuggestion {
  bookmarkId: string
  sourceCategoryId: string
  targetCategoryId: string
  confidence: number
  reason: string
}

interface ClassificationInput {
  bookmarkId: string
  title: string
  url: string
  description?: string
  tags?: string[]
  currentCategoryPath: string
}

class AiHttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs?: number,
  ) {
    super(`ai.http_${status}`)
  }
}

const OUTPUT_CONTRACT = `

Return only a JSON array without Markdown. Every item must use this shape:
{"bookmarkId":"an input bookmark ID","targetCategoryId":"an existing input category ID","confidence":0.0,"reason":"a brief reason"}
Omit bookmarks that should stay in place. Never invent IDs.`

function getApiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.trim().replace(/\/+$/, '')}/${path}`
}

export function validateAiEndpoint(baseUrl: string, hasToken = true): URL {
  let url: URL
  try {
    url = new URL(baseUrl.trim())
  }
  catch {
    throw new Error('ai.invalid_base_url')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new Error('ai.invalid_base_url')
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]'])
  if (hasToken && url.protocol === 'http:' && !loopbackHosts.has(url.hostname))
    throw new Error('ai.insecure_token_endpoint')
  return url
}

export function getAiEndpointPermissionPattern(baseUrl: string): string {
  const url = validateAiEndpoint(baseUrl, false)
  return `${url.protocol}//${url.host}/*`
}

export async function ensureAiEndpointPermission(
  baseUrl: string,
): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions)
    return true
  const origins = [getAiEndpointPermissionPattern(baseUrl)]
  if (await chrome.permissions.contains({ origins }))
    return true
  return chrome.permissions.request({ origins })
}

function requestHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}),
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController()
  const abort = () => controller.abort(externalSignal?.reason)
  if (externalSignal?.aborted)
    abort()
  else externalSignal?.addEventListener('abort', abort, { once: true })
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  }
  catch (cause) {
    if (timedOut && !externalSignal?.aborted)
      throw new Error('ai.request_timeout')
    throw cause
  }
  finally {
    clearTimeout(timeout)
    externalSignal?.removeEventListener('abort', abort)
  }
}

function retryAfterMs(response: Response): number | undefined {
  const value = response.headers.get('Retry-After')?.trim()
  if (!value)
    return undefined
  const seconds = Number(value)
  const delay = Number.isFinite(seconds)
    ? seconds * 1_000
    : Date.parse(value) - Date.now()
  if (!Number.isFinite(delay) || delay <= 0)
    return undefined
  return delay
}

function isRetryableClassificationError(cause: unknown): boolean {
  if (cause instanceof AiHttpError) {
    return cause.status === 408
      || cause.status === 425
      || cause.status === 429
      || (cause.status >= 500 && cause.status <= 599)
  }
  return cause instanceof TypeError
    || (cause instanceof Error && cause.message === 'ai.request_timeout')
}

function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
      return
    }
    let timer: ReturnType<typeof setTimeout>
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, delayMs)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export async function fetchCompatibleModels(
  baseUrl: string,
  token: string,
): Promise<string[]> {
  validateAiEndpoint(baseUrl, Boolean(token.trim()))
  const response = await fetchWithTimeout(getApiUrl(baseUrl, 'models'), {
    headers: requestHeaders(token),
  })
  if (!response.ok)
    throw new Error(`ai.http_${response.status}`)
  const body = (await response.json()) as { data?: Array<{ id?: unknown }> }
  return [
    ...new Set(
      (body.data ?? []).flatMap(item =>
        typeof item.id === 'string' && item.id.trim() ? [item.id.trim()] : [],
      ),
    ),
  ].sort((left, right) => left.localeCompare(right))
}

async function classifyChunkWithRetry(
  config: AiClassificationConfig,
  inputs: ClassificationInput[],
  categories: Category[],
  bookmarks: Bookmark[],
  options: AiClassificationRunOptions,
): Promise<AiClassificationSuggestion[]> {
  for (let retry = 0; ; retry += 1) {
    try {
      return await classifyChunk(
        config,
        inputs,
        categories,
        bookmarks,
        options.signal,
      )
    }
    catch (cause) {
      if (
        retry >= AI_CLASSIFICATION_MAX_RETRIES
        || !isRetryableClassificationError(cause)
        || options.signal?.aborted
        || (cause instanceof AiHttpError
          && cause.retryAfterMs !== undefined
          && cause.retryAfterMs > AI_CLASSIFICATION_RETRY_MAX_DELAY_MS)
      ) {
        throw cause
      }
      const delay = cause instanceof AiHttpError && cause.retryAfterMs
        ? cause.retryAfterMs
        : Math.min(
            AI_CLASSIFICATION_RETRY_BASE_DELAY_MS * 2 ** retry,
            AI_CLASSIFICATION_RETRY_MAX_DELAY_MS,
          )
      options.onRetry?.(retry + 1, AI_CLASSIFICATION_MAX_RETRIES)
      await waitForRetry(delay, options.signal)
      await options.beforeBatch?.()
      options.signal?.throwIfAborted()
    }
  }
}

function sanitizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    return `${url.origin}${url.pathname}`.slice(0, 400)
  }
  catch {
    return rawUrl.split(/[?#]/, 1)[0].slice(0, 400)
  }
}

export function createClassificationInput(
  bookmarks: Bookmark[],
  categories: Category[],
): ClassificationInput[] {
  const categoryPaths = buildCategoryPathMap(categories)
  return bookmarks.map(bookmark => ({
    bookmarkId: bookmark.id,
    title: bookmark.name.slice(0, 200),
    url: sanitizeUrl(bookmark.url),
    description: bookmark.description?.slice(0, 300) || undefined,
    tags: bookmark.tags
      ?.slice(0, 10)
      .map(tag => tag.trim().slice(0, 80))
      .filter(Boolean),
    currentCategoryPath:
      categoryPaths.get(bookmark.categoryId)?.join(' / ').slice(0, 300) ?? '',
  }))
}

export function createClassificationBatches(
  inputs: ClassificationInput[],
  batchSize = DEFAULT_AI_BATCH_SIZE,
): ClassificationInput[][] {
  const normalizedBatchSize = normalizeAiBatchSize(batchSize)
  const batches: ClassificationInput[][] = []
  let currentBatch: ClassificationInput[] = []
  let currentChars = 0

  for (const input of inputs) {
    const inputChars = JSON.stringify(input).length + 1
    const exceedsCount = currentBatch.length >= normalizedBatchSize
    const exceedsChars
      = currentBatch.length > 0
        && currentChars + inputChars > MAX_CLASSIFICATION_BOOKMARK_INPUT_CHARS
    if (exceedsCount || exceedsChars) {
      batches.push(currentBatch)
      currentBatch = []
      currentChars = 0
    }
    currentBatch.push(input)
    currentChars += inputChars
  }
  if (currentBatch.length > 0)
    batches.push(currentBatch)
  return batches
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim()
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  return JSON.parse(withoutFence)
}

export function validateClassificationSuggestions(
  value: unknown,
  bookmarks: Bookmark[],
  categories: Category[],
): AiClassificationSuggestion[] {
  const candidates = Array.isArray(value)
    ? value
    : typeof value === 'object' && value !== null
      ? (value as { items?: unknown }).items
      : undefined
  if (!Array.isArray(candidates))
    throw new Error('ai.invalid_response')

  const bookmarksById = new Map(
    bookmarks.map(bookmark => [bookmark.id, bookmark]),
  )
  const categoryIds = new Set(categories.map(category => category.id))
  const seen = new Set<string>()
  return candidates.flatMap((candidate) => {
    if (typeof candidate !== 'object' || candidate === null)
      return []
    const item = candidate as Partial<AiClassificationSuggestion>
    const bookmark
      = typeof item.bookmarkId === 'string'
        ? bookmarksById.get(item.bookmarkId)
        : undefined
    if (
      !bookmark
      || typeof item.targetCategoryId !== 'string'
      || !categoryIds.has(item.targetCategoryId)
      || bookmark.categoryId === item.targetCategoryId
      || seen.has(bookmark.id)
      || typeof item.confidence !== 'number'
      || !Number.isFinite(item.confidence)
      || item.confidence < MIN_AI_CLASSIFICATION_CONFIDENCE
      || item.confidence > 1
      || typeof item.reason !== 'string'
      || !item.reason.trim()
    ) {
      return []
    }
    seen.add(bookmark.id)
    return [
      {
        bookmarkId: bookmark.id,
        sourceCategoryId: bookmark.categoryId,
        targetCategoryId: item.targetCategoryId,
        confidence: item.confidence,
        reason: item.reason.trim().slice(0, 300),
      },
    ]
  })
}

async function classifyChunk(
  config: AiClassificationConfig,
  inputs: ClassificationInput[],
  categories: Category[],
  bookmarks: Bookmark[],
  signal?: AbortSignal,
): Promise<AiClassificationSuggestion[]> {
  const categoryPaths = buildCategoryPathMap(categories)
  const response = await fetchWithTimeout(
    getApiUrl(config.baseUrl, 'chat/completions'),
    {
      method: 'POST',
      headers: requestHeaders(config.token),
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: `${config.prompt.trim().slice(0, MAX_CLASSIFICATION_PROMPT_CHARS)}${OUTPUT_CONTRACT}`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              categories: categories.map(category => ({
                id: category.id,
                path: (
                  categoryPaths.get(category.id)?.join(' / ') ?? category.name
                ).slice(0, 300),
              })),
              bookmarks: inputs,
            }),
          },
        ],
      }),
    },
    signal,
  )
  if (!response.ok)
    throw new AiHttpError(response.status, retryAfterMs(response))
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>
  }
  const content = body.choices?.[0]?.message?.content
  if (typeof content !== 'string')
    throw new Error('ai.invalid_response')
  return validateClassificationSuggestions(
    parseJsonContent(content),
    bookmarks,
    categories,
  )
}

export async function classifyBookmarks(
  config: AiClassificationConfig,
  bookmarks: Bookmark[],
  categories: Category[],
  options: AiClassificationRunOptions = {},
): Promise<AiClassificationSuggestion[]> {
  validateAiEndpoint(config.baseUrl, Boolean(config.token.trim()))
  if (!config.model.trim())
    throw new Error('ai.model_required')
  if (!config.prompt.trim())
    throw new Error('ai.prompt_required')
  const inputs = createClassificationInput(bookmarks, categories)
  const batches = createClassificationBatches(inputs, config.batchSize)
  const suggestions: AiClassificationSuggestion[] = []
  let completed = 0
  for (const chunkInputs of batches) {
    await options.beforeBatch?.()
    options.signal?.throwIfAborted()
    const chunkIds = new Set(chunkInputs.map(item => item.bookmarkId))
    const chunkBookmarks = bookmarks.filter(bookmark =>
      chunkIds.has(bookmark.id),
    )
    // Requests stay sequential so progress and provider rate limits remain predictable.
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    const chunkSuggestions = await classifyChunkWithRetry(
      config,
      chunkInputs,
      categories,
      chunkBookmarks,
      options,
    )
    suggestions.push(...chunkSuggestions)
    completed += chunkInputs.length
    await options.onBatchComplete?.(
      chunkSuggestions,
      chunkInputs.map(item => item.bookmarkId),
    )
    options.onProgress?.(completed, inputs.length)
  }
  return suggestions
}
