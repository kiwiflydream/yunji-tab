import type {
  AiClassificationConfig,
  AiClassificationSuggestion,
} from './ai-bookmark-classification'
import type { Bookmark, Category } from './types'
import { Storage } from '@plasmohq/storage'
import { classifyBookmarks } from './ai-bookmark-classification'

export type AiClassificationJobStatus
  = | 'idle'
    | 'running'
    | 'pausing'
    | 'paused'
    | 'completed'
    | 'error'
    | 'terminated'

export interface AiClassificationJobSnapshot {
  status: AiClassificationJobStatus
  ownerId: string
  completed: number
  total: number
  retryAttempt: number
  retryMax: number
  bookmarkIds: string[]
  completedBookmarkIds: string[]
  suggestions: AiClassificationSuggestion[]
  error: string
}

const JOB_STORAGE_KEY = 'yunji-tab:ai-classification-job'
const JOB_LOCK_NAME = 'yunji-tab:ai-classification-job-lock'
const jobStorage = new Storage({ area: 'local' })
const contextId = globalThis.crypto?.randomUUID?.()
  ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
const EMPTY_JOB: AiClassificationJobSnapshot = {
  status: 'idle',
  ownerId: '',
  completed: 0,
  total: 0,
  retryAttempt: 0,
  retryMax: 0,
  bookmarkIds: [],
  completedBookmarkIds: [],
  suggestions: [],
  error: '',
}

let snapshot = EMPTY_JOB
let initialized = false
let initialization: Promise<void> | null = null
let activeRun: Promise<void> | null = null
let abortController: AbortController | null = null
let pauseRequested = false
let resumePausedRun: (() => void) | null = null
let runVersion = 0
let persistenceQueue: Promise<void> = Promise.resolve()
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach(listener => listener())
}

function persist(value = snapshot): Promise<void> {
  persistenceQueue = persistenceQueue
    .then(() => jobStorage.set(JOB_STORAGE_KEY, value))
    .catch(() => {
      // Storage failure must not interrupt an in-flight classification request.
    })
  return persistenceQueue
}

function update(next: Partial<AiClassificationJobSnapshot>): void {
  snapshot = { ...snapshot, ...next }
  emit()
  void persist()
}

export function getAiClassificationJobSnapshot(): AiClassificationJobSnapshot {
  return snapshot
}

export function subscribeAiClassificationJob(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function isCurrentAiClassificationJobOwner(): boolean {
  return snapshot.ownerId === contextId
}

async function hasActiveJobLock(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.locks)
    return false
  const lockState = await navigator.locks.query()
  return lockState.held?.some(lock => lock.name === JOB_LOCK_NAME) === true
}

export async function initializeAiClassificationJob(): Promise<void> {
  if (initialized)
    return
  if (initialization)
    return initialization
  initialization = (async () => {
    let shouldPersist = false
    try {
      const stored
        = await jobStorage.get<AiClassificationJobSnapshot>(JOB_STORAGE_KEY)
      if (
        stored
        && Array.isArray(stored.bookmarkIds)
        && Array.isArray(stored.suggestions)
      ) {
        const hasActiveOwner = await hasActiveJobLock()
        const restoredStatus
          = (stored.status === 'running' || stored.status === 'pausing')
            && !hasActiveOwner
            ? 'paused'
            : stored.status
        shouldPersist = restoredStatus !== stored.status
        snapshot = {
          ...EMPTY_JOB,
          ...stored,
          status: restoredStatus,
        }
        snapshot.completed = snapshot.completedBookmarkIds.length
      }
    }
    finally {
      initialized = true
      initialization = null
      emit()
      if (shouldPersist)
        await persist()
    }
  })()
  return initialization
}

function errorCode(cause: unknown): string {
  if (cause instanceof Error && cause.message.startsWith('ai.'))
    return cause.message
  return 'ai.request_failed'
}

async function waitBeforeBatch(version: number): Promise<void> {
  if (version !== runVersion)
    throw new DOMException('Terminated', 'AbortError')
  if (!pauseRequested)
    return
  update({ status: 'paused' })
  await new Promise<void>((resolve) => {
    resumePausedRun = resolve
  })
  resumePausedRun = null
  if (version !== runVersion)
    throw new DOMException('Terminated', 'AbortError')
}

async function runPending(
  config: AiClassificationConfig,
  bookmarks: Bookmark[],
  categories: Category[],
): Promise<void> {
  const version = ++runVersion
  abortController = new AbortController()
  pauseRequested = false
  update({ status: 'running', error: '', retryAttempt: 0, retryMax: 0 })

  const completedIds = new Set(snapshot.completedBookmarkIds)
  const bookmarkById = new Map(
    bookmarks.map(bookmark => [bookmark.id, bookmark]),
  )
  const missingIds = snapshot.bookmarkIds.filter(
    id => !completedIds.has(id) && !bookmarkById.has(id),
  )
  if (missingIds.length > 0) {
    snapshot = {
      ...snapshot,
      completedBookmarkIds: [...snapshot.completedBookmarkIds, ...missingIds],
      completed: snapshot.completedBookmarkIds.length + missingIds.length,
    }
  }
  const pending = snapshot.bookmarkIds
    .filter(id => !completedIds.has(id))
    .flatMap(id => bookmarkById.get(id) ?? [])

  try {
    await classifyBookmarks(config, pending, categories, {
      signal: abortController.signal,
      beforeBatch: () => waitBeforeBatch(version),
      onBatchComplete: async (nextSuggestions, processedBookmarkIds) => {
        if (version !== runVersion)
          return
        snapshot = {
          ...snapshot,
          completedBookmarkIds: [
            ...snapshot.completedBookmarkIds,
            ...processedBookmarkIds,
          ],
          completed:
            snapshot.completedBookmarkIds.length + processedBookmarkIds.length,
          suggestions: [...snapshot.suggestions, ...nextSuggestions],
          retryAttempt: 0,
          retryMax: 0,
        }
        emit()
        await persist()
      },
      onRetry: (attempt, maxRetries) => {
        update({ retryAttempt: attempt, retryMax: maxRetries })
      },
    })
    if (version === runVersion)
      update({ status: 'completed', completed: snapshot.total })
  }
  catch (cause) {
    if (version === runVersion && snapshot.status !== 'terminated')
      update({ status: 'error', error: errorCode(cause) })
  }
  finally {
    if (version === runVersion) {
      abortController = null
      activeRun = null
      resumePausedRun = null
    }
  }
}

async function launchWithExclusiveLock(
  prepare: () => Promise<void>,
  config: AiClassificationConfig,
  bookmarks: Bookmark[],
  categories: Category[],
): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    await prepare()
    activeRun = runPending(config, bookmarks, categories)
    return true
  }

  let reportAcquisition = (_acquired: boolean) => {}
  const acquisition = new Promise<boolean>((resolve) => {
    reportAcquisition = resolve
  })
  const lockedRun = navigator.locks
    .request(JOB_LOCK_NAME, { ifAvailable: true }, async (lock) => {
      if (!lock) {
        reportAcquisition(false)
        return
      }
      await prepare()
      reportAcquisition(true)
      await runPending(config, bookmarks, categories)
    })
    .then(() => undefined)
  activeRun = lockedRun
  const acquired = await acquisition
  if (!acquired && activeRun === lockedRun)
    activeRun = null
  return acquired
}

export async function startAiClassificationJob(
  config: AiClassificationConfig,
  bookmarks: Bookmark[],
  categories: Category[],
): Promise<void> {
  await initializeAiClassificationJob()
  const acquired = await launchWithExclusiveLock(async () => {
    terminateAiClassificationJob(false)
    snapshot = {
      ...EMPTY_JOB,
      status: 'running',
      ownerId: contextId,
      total: bookmarks.length,
      bookmarkIds: bookmarks.map(bookmark => bookmark.id),
    }
    emit()
    await persist()
  }, config, bookmarks, categories)
  if (!acquired)
    throw new Error('ai.job_running_elsewhere')
}

export async function resumeAiClassificationJob(
  config: AiClassificationConfig,
  bookmarks: Bookmark[],
  categories: Category[],
): Promise<void> {
  await initializeAiClassificationJob()
  if (snapshot.status !== 'paused' && snapshot.status !== 'error')
    return
  pauseRequested = false
  if (activeRun) {
    update({ status: 'running', error: '' })
    resumePausedRun?.()
    return
  }
  const acquired = await launchWithExclusiveLock(async () => {
    update({ ownerId: contextId, status: 'running', error: '' })
    await persist()
  }, config, bookmarks, categories)
  if (!acquired)
    throw new Error('ai.job_running_elsewhere')
}

export function pauseAiClassificationJob(): void {
  if (snapshot.status !== 'running' || !isCurrentAiClassificationJobOwner())
    return
  pauseRequested = true
  update({ status: 'pausing' })
}

export function terminateAiClassificationJob(persistState = true): void {
  if (
    !['running', 'pausing', 'paused'].includes(snapshot.status)
    || !isCurrentAiClassificationJobOwner()
  ) {
    return
  }
  runVersion += 1
  pauseRequested = false
  abortController?.abort()
  resumePausedRun?.()
  abortController = null
  activeRun = null
  resumePausedRun = null
  snapshot = { ...snapshot, status: 'terminated', error: '' }
  emit()
  if (persistState)
    void persist()
}

export async function clearAiClassificationJob(): Promise<void> {
  terminateAiClassificationJob(false)
  snapshot = EMPTY_JOB
  emit()
  persistenceQueue = persistenceQueue
    .then(() => jobStorage.remove(JOB_STORAGE_KEY))
    .catch(() => {})
  await persistenceQueue
}
