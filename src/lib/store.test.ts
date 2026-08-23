import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyMaterializedBookmarkMetadata } from './metadata-sync'
import {
  mergeAlternateUrlsForDuplicate,
  metadataAutoSyncDelayMs,
  usagePersistDelayMs,
  useNavStore,
} from './store'

const storageState = vi.hoisted(() => ({
  writes: [] as Array<{ area: string, key: string, value: unknown }>,
  setError: null as Error | null,
}))

vi.mock('@plasmohq/storage', () => ({
  Storage: class Storage {
    area: string

    constructor(options: { area: string }) {
      this.area = options.area
    }

    async get() {
      return undefined
    }

    async set(key: string, value: unknown) {
      if (storageState.setError)
        throw storageState.setError
      storageState.writes.push({ area: this.area, key, value })
    }

    async remove() {}
  },
}))

const initialState = useNavStore.getInitialState()

beforeEach(() => {
  storageState.writes.length = 0
  storageState.setError = null
  useNavStore.setState(initialState, true)
  vi.stubGlobal('chrome', { bookmarks: {} })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('navigation store boundaries', () => {
  it('updates and persists the interface language', async () => {
    await useNavStore.getState().setLanguage('en')

    expect(useNavStore.getState().settings.language).toBe('en')
    expect(storageState.writes).toContainEqual({
      area: 'sync',
      key: 'yunji-tab:settings',
      value: expect.objectContaining({ language: 'en' }),
    })
  })

  it('updates and persists settings through the sync storage boundary', async () => {
    await useNavStore.getState().setTheme('dark')

    expect(useNavStore.getState().settings.theme).toBe('dark')
    expect(storageState.writes).toContainEqual({
      area: 'sync',
      key: 'yunji-tab:settings',
      value: expect.objectContaining({ theme: 'dark' }),
    })
  })

  it('updates and persists a keyboard shortcut without allowing conflicts', async () => {
    await useNavStore.getState().setKeyboardShortcut('focusSearch', {
      key: 'f',
      primary: true,
      alt: false,
      shift: true,
    })

    expect(
      useNavStore.getState().settings.keyboardShortcuts.focusSearch,
    ).toEqual({
      key: 'f',
      primary: true,
      alt: false,
      shift: true,
    })
    expect(storageState.writes).toContainEqual({
      area: 'sync',
      key: 'yunji-tab:settings',
      value: expect.objectContaining({
        keyboardShortcuts: expect.objectContaining({
          focusSearch: expect.objectContaining({ key: 'f' }),
        }),
      }),
    })
    await expect(
      useNavStore
        .getState()
        .setKeyboardShortcut(
          'focusSearch',
          useNavStore.getState().settings.keyboardShortcuts.addBookmark,
        ),
    ).rejects.toThrow('shortcut.conflict')
  })

  it('rejects moving bookmarks into a stale category before writing', async () => {
    useNavStore.setState({
      categories: [],
      bookmarks: [
        {
          id: 'bookmark-1',
          name: 'Example',
          url: 'https://example.com',
          categoryId: 'cat-1',
        },
      ],
    })

    await expect(
      useNavStore.getState().moveBookmarks(['bookmark-1'], 'cat-missing'),
    ).rejects.toThrow('category.target_not_found')
  })

  it('coalesces supplementary metadata changes into one delayed sync', async () => {
    vi.useFakeTimers()
    const syncMetadataNow = vi.fn().mockResolvedValue(undefined)
    useNavStore.setState({ syncMetadataNow })

    await useNavStore.getState().setBookmarkMeta('https://one.example', {
      description: 'One',
    })
    await useNavStore.getState().setBookmarkMeta('https://two.example', {
      description: 'Two',
    })

    await vi.advanceTimersByTimeAsync(metadataAutoSyncDelayMs - 1)
    expect(syncMetadataNow).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(syncMetadataNow).toHaveBeenCalledTimes(1)
  })

  it('coalesces rapid usage updates into one storage write', async () => {
    vi.useFakeTimers()

    await useNavStore.getState().recordBookmarkOpen('https://example.test')
    await useNavStore.getState().recordBookmarkOpen('https://example.test')
    expect(
      storageState.writes.filter(write => write.key === 'yunji-tab:usage'),
    ).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(usagePersistDelayMs)
    expect(
      storageState.writes.filter(write => write.key === 'yunji-tab:usage'),
    ).toEqual([
      {
        area: 'local',
        key: 'yunji-tab:usage',
        value: {
          'https://example.test': expect.objectContaining({ openCount: 2 }),
        },
      },
    ])
  })

  it('preserves unaffected bookmark objects during metadata updates', async () => {
    const untouched = {
      id: 'two',
      name: 'Two',
      url: 'https://two.example',
      categoryId: 'cat-1',
    }
    useNavStore.setState({
      bookmarks: [
        {
          id: 'one',
          name: 'One',
          url: 'https://one.example',
          categoryId: 'cat-1',
        },
        untouched,
      ],
    })

    await useNavStore.getState().setBookmarkMeta('https://one.example', {
      description: 'Updated',
    })

    expect(useNavStore.getState().bookmarks[0]?.description).toBe('Updated')
    expect(useNavStore.getState().bookmarks[1]).toBe(untouched)
  })

  it('reorders pinned bookmarks without moving their native folders', async () => {
    useNavStore.setState({
      bookmarks: [
        {
          id: 'one',
          name: 'One',
          url: 'https://one.example',
          categoryId: 'cat-1',
          pinnedAt: 30,
        },
        {
          id: 'two',
          name: 'Two',
          url: 'https://two.example',
          categoryId: 'cat-2',
          pinnedAt: 20,
        },
        {
          id: 'three',
          name: 'Three',
          url: 'https://three.example',
          categoryId: 'cat-3',
          pinnedAt: 10,
        },
      ],
      meta: {
        'https://one.example': { pinnedAt: 30 },
        'https://two.example': { pinnedAt: 20 },
        'https://three.example': { pinnedAt: 10 },
      },
      recordActivity: vi.fn().mockResolvedValue(undefined),
    })

    await useNavStore.getState().reorderPinnedBookmark('one', 'three')

    expect(
      useNavStore.getState().bookmarks
        .toSorted((left, right) => (right.pinnedAt ?? 0) - (left.pinnedAt ?? 0))
        .map(bookmark => bookmark.id),
    ).toEqual(['two', 'three', 'one'])
    expect(useNavStore.getState().bookmarks.map(bookmark => bookmark.categoryId))
      .toEqual(['cat-1', 'cat-2', 'cat-3'])
  })

  it('moves duplicate pinned URLs as one group', async () => {
    useNavStore.setState({
      bookmarks: [
        { id: 'one-a', name: 'One A', url: 'https://one.example', categoryId: 'cat-1', pinnedAt: 30 },
        { id: 'one-b', name: 'One B', url: 'https://one.example', categoryId: 'cat-2', pinnedAt: 30 },
        { id: 'two', name: 'Two', url: 'https://two.example', categoryId: 'cat-3', pinnedAt: 20 },
      ],
      meta: {
        'https://one.example': { pinnedAt: 30 },
        'https://two.example': { pinnedAt: 20 },
      },
      recordActivity: vi.fn().mockResolvedValue(undefined),
    })

    await useNavStore.getState().reorderPinnedBookmark('one-b', 'two')

    const [oneA, oneB, two] = useNavStore.getState().bookmarks
    expect(oneA?.pinnedAt).toBe(oneB?.pinnedAt)
    expect(oneA?.pinnedAt).toBeLessThan(two?.pinnedAt ?? 0)
  })

  it('keeps the current order when pinned-order persistence fails', async () => {
    const bookmarks = [
      { id: 'one', name: 'One', url: 'https://one.example', categoryId: 'cat-1', pinnedAt: 20 },
      { id: 'two', name: 'Two', url: 'https://two.example', categoryId: 'cat-2', pinnedAt: 10 },
    ]
    useNavStore.setState({ bookmarks })
    storageState.setError = new Error('storage failed')

    await expect(
      useNavStore.getState().reorderPinnedBookmark('one', 'two'),
    ).rejects.toThrow('storage failed')
    expect(useNavStore.getState().bookmarks).toBe(bookmarks)
  })

  it('migrates alternate URLs when a native bookmark URL changes', async () => {
    useNavStore.setState({
      bookmarks: [{
        id: 'bm-1',
        name: 'Example',
        url: 'https://old.example',
        categoryId: 'cat-1',
      }],
      meta: {
        'https://old.example': {
          alternateUrls: ['https://backup.example'],
        },
      },
    })

    await useNavStore.getState().reconcileBookmarkUrlChange(
      '1',
      'https://new.example',
    )

    expect(useNavStore.getState().meta).toEqual({
      'https://new.example': {
        alternateUrls: ['https://backup.example'],
      },
    })
  })

  it('keeps metadata on an old URL that another bookmark still uses', async () => {
    const sharedMeta = {
      alternateUrls: ['https://backup.example'],
    }
    useNavStore.setState({
      bookmarks: [
        {
          id: 'bm-1',
          name: 'First',
          url: 'https://old.example',
          categoryId: 'cat-1',
        },
        {
          id: 'bm-2',
          name: 'Second',
          url: 'https://old.example',
          categoryId: 'cat-1',
        },
      ],
      meta: { 'https://old.example': sharedMeta },
    })

    await useNavStore.getState().reconcileBookmarkUrlChange(
      '1',
      'https://new.example',
    )

    expect(useNavStore.getState().meta).toEqual({
      'https://old.example': sharedMeta,
      'https://new.example': sharedMeta,
    })
  })

  it('keeps alternate URLs entered while an older sync is in flight', () => {
    const baseline = {
      'https://example.test': { description: 'Before' },
    }
    const current = {
      'https://example.test': {
        description: 'Before',
        alternateUrls: ['https://backup.example'],
      },
    }

    expect(applyMaterializedBookmarkMetadata(
      current,
      { 'https://example.test': { description: 'Remote' } },
      undefined,
      { baseline },
    )).toEqual({
      'https://example.test': {
        description: 'Remote',
        alternateUrls: ['https://backup.example'],
      },
    })
  })

  it('keeps local metadata for bookmarks omitted from the sync payload', () => {
    const local = {
      'https://example.test': {
        alternateUrls: ['https://backup.example'],
      },
    }

    expect(applyMaterializedBookmarkMetadata(
      local,
      {},
      undefined,
      { omittedUrls: ['https://example.test'] },
    )).toEqual(local)
  })

  it('merges alternate URLs when adding data to a duplicate bookmark', () => {
    expect(mergeAlternateUrlsForDuplicate(
      ['https://backup-one.example'],
      ['backup-two.example', 'https://backup-one.example'],
      'https://primary.example',
    )).toEqual([
      'https://backup-one.example',
      'https://backup-two.example',
    ])
  })

  it('restores a metadata sync recovery point', async () => {
    vi.useFakeTimers()
    useNavStore.setState({
      meta: { 'https://example.test': { description: 'Remote' } },
      categoryMeta: { 'cat-1': { emoji: 'B' } },
      metadataSyncRecovery: [
        {
          id: 'recovery-1',
          label: '同步前快照',
          createdAt: 1,
          expiresAt: Date.now() + 60_000,
          direction: 'downloaded',
          bookmarkMeta: { 'https://example.test': { description: 'Local' } },
          categoryMeta: { 'cat-1': { emoji: 'A' } },
          changedBookmarkCount: 1,
          changedCategoryCount: 1,
          removedFieldCount: 0,
        },
      ],
    })

    await expect(
      useNavStore.getState().restoreMetadataSyncRecovery('recovery-1'),
    ).resolves.toBe(true)

    expect(useNavStore.getState().meta).toEqual({
      'https://example.test': { description: 'Local' },
    })
    expect(useNavStore.getState().categoryMeta).toEqual({
      'cat-1': { emoji: 'A' },
    })
    expect(useNavStore.getState().metadataSyncRecovery).toEqual([])
  })
})
