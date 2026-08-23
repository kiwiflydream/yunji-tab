import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyMaterializedBookmarkMetadata,
  createMetadataSyncPayload,
  isMetadataSyncWriteQuotaError,
  materializeMetadataDocument,
  mergeMetadataDocuments,
  metadataSyncManifestKey,
  synchronizeMetadata,
} from './metadata-sync'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('metadata sync payload', () => {
  it('maps category metadata by stable path', () => {
    const payload = createMetadataSyncPayload({
      meta: {},
      categoryMeta: { 'cat-2': { emoji: 'X' } },
      categories: [
        { id: 'cat-1', name: 'Work', emoji: '', parentId: 'all', modifiable: true },
        { id: 'cat-2', name: 'Docs', emoji: '', parentId: 'cat-1', modifiable: true },
      ],
      updatedAt: 1,
      deviceId: 'device-a',
    })
    expect(materializeMetadataDocument(payload.document).categoryMeta)
      .toEqual([{ path: ['Work', 'Docs'], emoji: 'X' }])
  })

  it('merges concurrent changes field by field', () => {
    const left = createMetadataSyncPayload({
      meta: { 'https://example.com': { description: 'Left', tags: ['old'] } },
      categoryMeta: {},
      categories: [],
      updatedAt: 10,
      deviceId: 'device-a',
    }).document
    const right = createMetadataSyncPayload({
      meta: { 'https://example.com': { description: 'Old', tags: ['right'] } },
      categoryMeta: {},
      categories: [],
      updatedAt: 5,
      deviceId: 'device-b',
    }).document
    right.bookmarkMeta['https://example.com'].fields.tags = {
      value: ['right'],
      updatedAt: 20,
      deviceId: 'device-b',
    }
    const merged = materializeMetadataDocument(mergeMetadataDocuments(left, right))
    expect(merged.bookmarkMeta['https://example.com']).toEqual({
      description: 'Left',
      tags: ['right'],
    })
  })

  it('keeps deletion tombstones newer than old values', () => {
    const left = createMetadataSyncPayload({
      meta: { 'https://example.com': { description: 'Old' } },
      categoryMeta: {},
      categories: [],
      updatedAt: 1,
      deviceId: 'device-a',
    }).document
    const right = structuredClone(left)
    right.bookmarkMeta['https://example.com'].fields.description = {
      deleted: true,
      updatedAt: 2,
      deviceId: 'device-b',
    }
    expect(materializeMetadataDocument(mergeMetadataDocuments(left, right)).bookmarkMeta)
      .toEqual({})
  })

  it('prioritizes pinned metadata when the sync budget is exceeded', () => {
    const payload = createMetadataSyncPayload({
      meta: {
        'https://important.example': { pinnedAt: 1, tags: ['work'] },
        'https://large.example': { description: 'a'.repeat(89_000) },
      },
      categoryMeta: {},
      categories: [],
      updatedAt: 1,
      deviceId: 'device-a',
    })
    expect(payload.document.bookmarkMeta['https://important.example']).toBeDefined()
    expect(payload.byteCount).toBeLessThanOrEqual(90_000)
  })

  it('omits fields outside the selected sync scope', () => {
    const payload = createMetadataSyncPayload({
      meta: {
        'https://example.com': {
          description: 'Keep',
          tags: ['local-only'],
          pinnedAt: 1,
        },
      },
      categoryMeta: { 'cat-1': { emoji: 'X' } },
      categories: [
        { id: 'cat-1', name: 'Work', emoji: '', parentId: 'all', modifiable: true },
      ],
      updatedAt: 1,
      deviceId: 'device-a',
      scope: {
        tags: false,
        pinnedAt: false,
        categoryIcons: false,
      },
    })
    const materialized = materializeMetadataDocument(payload.document, {
      tags: false,
      pinnedAt: false,
      categoryIcons: false,
    })
    expect(materialized.bookmarkMeta['https://example.com']).toEqual({
      description: 'Keep',
    })
    expect(materialized.categoryMeta).toEqual([])
  })

  it('applies only enabled fields and preserves local-only metadata', () => {
    expect(applyMaterializedBookmarkMetadata(
      {
        'https://example.com': {
          description: 'Local',
          icon: 'https://example.com/old.png',
          tags: ['local-only'],
        },
      },
      { 'https://example.com': { description: 'Remote' } },
      { tags: false },
    )).toEqual({
      'https://example.com': {
        description: 'Remote',
        tags: ['local-only'],
      },
    })
  })
})

describe('metadata sync storage writes', () => {
  function stubStorage(syncSet: ReturnType<typeof vi.fn>) {
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
        sync: {
          get: vi.fn().mockResolvedValue({}),
          set: syncSet,
        },
      },
    })
  }

  it('stores all parts and the manifest in one write operation', async () => {
    const syncSet = vi.fn().mockResolvedValue(undefined)
    stubStorage(syncSet)

    await synchronizeMetadata({
      meta: { 'https://example.com': { description: 'Example' } },
      categoryMeta: {},
      categories: [],
    })

    expect(syncSet).toHaveBeenCalledTimes(1)
    expect(syncSet).toHaveBeenCalledWith(expect.objectContaining({
      'yunji-tab:metadata-sync:part:0': expect.any(String),
      [metadataSyncManifestKey]: expect.objectContaining({ partCount: 1 }),
    }))
  })

  it('does not immediately retry a write-frequency quota error', async () => {
    const quotaError = new Error(
      'This request exceeds the MAX_WRITE_OPERATIONS_PER_MINUTE quota.',
    )
    const syncSet = vi.fn().mockRejectedValue(quotaError)
    stubStorage(syncSet)

    await expect(synchronizeMetadata({
      meta: { 'https://example.com': { description: 'Example' } },
      categoryMeta: {},
      categories: [],
    })).rejects.toBe(quotaError)

    expect(isMetadataSyncWriteQuotaError(quotaError)).toBe(true)
    expect(syncSet).toHaveBeenCalledTimes(1)
  })
})
