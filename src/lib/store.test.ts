import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { decodeBookmarkGroups, encodeBookmarkGroup } from './bookmark-groups'
import { useBookmarkGroupsStore } from './bookmark-groups-store'
import { getPinnedCards } from './card-order'
import * as metadataSync from './metadata-sync'
import { applyMaterializedBookmarkMetadata } from './metadata-sync'
import * as siteMetadata from './site-metadata'
import {
  mergeAlternateUrlsForDuplicate,
  metadataAutoSyncDelayMs,
  usagePersistDelayMs,
  useNavStore,
} from './store'
import { metaStorage, withBookmarkMetadataLock } from './store-persistence'

const storageState = vi.hoisted(() => ({
  writes: [] as Array<{ area: string, key: string, value: unknown }>,
  values: new Map<string, unknown>(),
  setError: null as Error | null,
  setHook: null as ((key: string) => Promise<void>) | null,
}))

vi.mock('@plasmohq/storage', () => ({
  Storage: class Storage {
    area: string

    constructor(options: { area: string }) {
      this.area = options.area
    }

    async get(key: string) {
      return structuredClone(storageState.values.get(`${this.area}:${key}`))
    }

    async set(key: string, value: unknown) {
      await storageState.setHook?.(key)
      if (storageState.setError)
        throw storageState.setError
      storageState.writes.push({ area: this.area, key, value })
      storageState.values.set(`${this.area}:${key}`, structuredClone(value))
    }

    async remove() {}
  },
}))

const initialState = useNavStore.getInitialState()

beforeEach(() => {
  storageState.writes.length = 0
  storageState.values.clear()
  storageState.setError = null
  storageState.setHook = null
  useNavStore.setState(initialState, true)
  useBookmarkGroupsStore.setState({ groups: [], error: false })
  vi.stubGlobal('chrome', { bookmarks: {} })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('navigation store boundaries', () => {
  it('lets a metadata-locked URL migration finish while a pinned reorder is waiting', async () => {
    vi.useFakeTimers()
    const group = { id: 'tools', title: 'Tools', description: '', pinnedAt: 20, bookmarks: [{ url: 'https://one.example/', title: 'One' }] }
    const values = encodeBookmarkGroup(group, 'initial')
    vi.stubGlobal('chrome', { storage: { sync: {
      get: vi.fn(async () => structuredClone(values)),
      set: vi.fn(async changes => Object.assign(values, changes)),
      remove: vi.fn(async () => {}),
    } }, bookmarks: {} })
    useNavStore.setState({ syncMetadataNow: vi.fn().mockResolvedValue(undefined), bookmarks: [] })
    const entered = deferred<void>()
    const release = deferred<void>()
    const migration = withBookmarkMetadataLock(async () => {
      entered.resolve()
      await release.promise
      await useBookmarkGroupsStore.getState().migrateUrl('https://one.example/', 'https://new.example/')
    })
    await entered.promise
    const reorder = useNavStore.getState().reorderPinnedCard('group:tools', 'bookmark:https://one.example/')
    // Let the reorder reach whichever lock it acquires first.
    await vi.advanceTimersByTimeAsync(0)
    release.resolve()
    const outcome = Promise.race([
      Promise.all([migration, reorder]).then(() => 'completed'),
      new Promise<string>(resolve => setTimeout(resolve, 100, 'deadlocked')),
    ])
    await vi.advanceTimersByTimeAsync(100)
    expect(await outcome).toBe('completed')
    expect(decodeBookmarkGroups(values)[0].bookmarks[0].url).toBe('https://new.example/')
  })
  it('rolls back only order fields if a dense mixed reorder cannot save group ranks', async () => {
    vi.useFakeTimers()
    const group = { id: 'tools', title: 'Tools', description: '', pinnedAt: 20, pinnedOrder: -100, bookmarks: [{ url: 'https://one.example/', title: 'One' }] }
    const values = encodeBookmarkGroup(group, 'initial')
    vi.stubGlobal('chrome', { storage: { sync: {
      get: vi.fn(async () => structuredClone(values)),
      set: vi.fn(async () => {
        storageState.values.set('local:yunji-tab:meta', {
          ...storageState.values.get('local:yunji-tab:meta') as object,
          'https://one.example/': { pinnedAt: 30, pinnedOrder: -100, tags: ['concurrent edit'] },
        })
        throw new Error('sync write rejected')
      }),
    } }, bookmarks: {} })
    const meta = {
      'https://one.example/': { pinnedAt: 30, pinnedOrder: -100 },
      'https://two.example/': { pinnedAt: 10, pinnedOrder: -100 },
    }
    storageState.values.set('local:yunji-tab:meta', meta)
    useNavStore.setState({ meta, syncMetadataNow: vi.fn().mockResolvedValue(undefined), bookmarks: [
      { id: 'one', name: 'One', url: 'https://one.example/', categoryId: 'cat-1', pinnedAt: 30, pinnedOrder: -100 },
      { id: 'two', name: 'Two', url: 'https://two.example/', categoryId: 'cat-2', pinnedAt: 10, pinnedOrder: -100 },
    ] })
    await expect(useNavStore.getState().reorderPinnedCard('bookmark:https://one.example/', 'bookmark:https://two.example/'))
      .rejects
      .toThrow('sync write rejected')
    expect(useNavStore.getState().meta['https://one.example/']).toEqual({ pinnedAt: 30, pinnedOrder: -100, tags: ['concurrent edit'] })
    expect(useNavStore.getState().meta['https://two.example/'].pinnedOrder).toBe(-100)
    expect(decodeBookmarkGroups(values)[0].pinnedOrder).toBe(-100)
    await vi.advanceTimersByTimeAsync(metadataAutoSyncDelayMs)
  })
  it('reorders mixed pinned cards with fresh metadata while retaining concurrent group edits', async () => {
    vi.useFakeTimers()
    const group = { id: 'tools', title: 'Tools', description: 'Remote edit', pinnedAt: 20, bookmarks: [{ url: 'https://one.example/', title: 'One' }] }
    const values = encodeBookmarkGroup(group, 'initial')
    const sync = {
      get: vi.fn(async () => structuredClone(values)),
      set: vi.fn(async (changes) => {
        Object.assign(values, changes)
      }),
      remove: vi.fn(async () => {}),
    }
    vi.stubGlobal('chrome', { storage: { sync }, bookmarks: {} })
    useBookmarkGroupsStore.setState({ groups: [{ ...group, description: 'Stale' }] })
    useNavStore.setState({ syncMetadataNow: vi.fn().mockResolvedValue(undefined), bookmarks: [
      { id: 'one', name: 'One', url: 'https://one.example/', categoryId: 'cat-1', pinnedAt: 30 },
      { id: 'two', name: 'Two', url: 'https://two.example/', categoryId: 'cat-2', pinnedAt: 10 },
    ] })
    storageState.values.set('local:yunji-tab:meta', {
      'https://one.example/': { pinnedAt: 30, tags: ['latest'] },
      'https://two.example/': { pinnedAt: 10 },
    })
    await useNavStore.getState().reorderPinnedCard('group:tools', 'bookmark:https://one.example/')
    expect(getPinnedCards(useNavStore.getState().bookmarks, decodeBookmarkGroups(values)).map(item => item.key))
      .toEqual(['group:tools', 'bookmark:https://one.example/', 'bookmark:https://two.example/'])
    expect(decodeBookmarkGroups(values)[0]).toMatchObject({ pinnedAt: 20, description: 'Remote edit' })
    await useNavStore.getState().reorderPinnedCard('bookmark:https://two.example/', 'group:tools')
    expect(getPinnedCards(useNavStore.getState().bookmarks, decodeBookmarkGroups(values)).map(item => item.key))
      .toEqual(['bookmark:https://two.example/', 'group:tools', 'bookmark:https://one.example/'])
    expect(useNavStore.getState().meta['https://one.example/'].tags).toEqual(['latest'])
    expect(useNavStore.getState().bookmarks.map(item => item.categoryId)).toEqual(['cat-1', 'cat-2'])
    await vi.advanceTimersByTimeAsync(metadataAutoSyncDelayMs)
  })
  it('preserves metadata saved by another page when editing a stale bookmark', async () => {
    vi.useFakeTimers()
    storageState.values.set('local:yunji-tab:meta', {
      'https://example.com/': { alternateUrls: ['https://backup.example.com/'] },
      'https://other.example/': { tags: ['other'] },
    })

    await useNavStore.getState().setBookmarkMeta('https://example.com/', {
      description: 'Only edit description',
    })

    expect(useNavStore.getState().meta).toEqual({
      'https://example.com/': {
        alternateUrls: ['https://backup.example.com/'],
        description: 'Only edit description',
      },
      'https://other.example/': { tags: ['other'] },
    })
    expect(storageState.values.get('local:yunji-tab:meta'))
      .toEqual(useNavStore.getState().meta)
    await vi.advanceTimersByTimeAsync(metadataAutoSyncDelayMs)
  })

  it('preserves both metadata edits when saves overlap', async () => {
    vi.useFakeTimers()
    await Promise.all([
      useNavStore.getState().setBookmarkMeta('https://example.com/', {
        alternateUrls: ['https://backup.example.com/'],
      }),
      useNavStore.getState().setBookmarkMeta('https://example.com/', {
        description: 'Concurrent description',
      }),
    ])

    expect(storageState.values.get('local:yunji-tab:meta')).toEqual({
      'https://example.com/': {
        alternateUrls: ['https://backup.example.com/'],
        description: 'Concurrent description',
      },
    })
    await vi.advanceTimersByTimeAsync(metadataAutoSyncDelayMs)
  })

  it('does not display an unsaved metadata edit when storage rejects it', async () => {
    const meta = { 'https://example.com/': { tags: ['saved'] } }
    useNavStore.setState({ meta })
    storageState.setError = new Error('storage failed')

    await expect(useNavStore.getState().setBookmarkMeta('https://example.com/', {
      alternateUrls: ['https://backup.example.com/'],
    })).rejects.toThrow('storage failed')

    expect(useNavStore.getState().meta).toBe(meta)
  })

  it('updates and persists the interface language', async () => {
    await useNavStore.getState().setLanguage('en')

    expect(useNavStore.getState().settings.language).toBe('en')
    expect(storageState.writes).toContainEqual({
      area: 'sync',
      key: 'yunji-tab:settings',
      value: expect.objectContaining({ language: 'en' }),
    })
  })

  it('preserves the group toggle when another setting changes during its pending save', async () => {
    const pending: Array<() => void> = []
    storageState.setHook = () => new Promise<void>((resolve) => {
      pending.push(resolve)
    })
    const disable = useNavStore.getState().setBookmarkGroupsEnabled(false)
    const language = useNavStore.getState().setLanguage('en')
    expect(pending).toHaveLength(2)
    pending[0]()
    await disable
    pending[1]()
    await language

    expect(useNavStore.getState().settings).toMatchObject({ bookmarkGroupsEnabled: false, language: 'en' })
    expect(storageState.values.get('sync:yunji-tab:settings')).toMatchObject({ bookmarkGroupsEnabled: false, language: 'en' })
    expect(storageState.writes.map(write => (write.value as { bookmarkGroupsEnabled: boolean }).bookmarkGroupsEnabled)).toEqual([false, false])
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
    expect(storageState.values.get('local:yunji-tab:meta')).toEqual(useNavStore.getState().meta)
  })
})

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function drainMetadataTimer() {
  vi.stubGlobal('chrome', { bookmarks: {} })
  await vi.advanceTimersByTimeAsync(metadataAutoSyncDelayMs)
}

describe('metadata concurrency regressions', () => {
  it('ignores an older storage refresh that finishes after a newer refresh', async () => {
    const oldRead = deferred<Record<string, { alternateUrls: string[] }>>()
    vi.spyOn(metaStorage, 'get').mockImplementationOnce(() => oldRead.promise)
    const oldRefresh = useNavStore.getState().refreshSupplementaryMetadata()
    storageState.values.set('local:yunji-tab:meta', {
      'https://example.test': { alternateUrls: ['https://new.example'] },
    })
    await useNavStore.getState().refreshSupplementaryMetadata()
    oldRead.resolve({ 'https://example.test': { alternateUrls: ['https://old.example'] } })
    await oldRefresh
    expect(useNavStore.getState().meta['https://example.test'].alternateUrls)
      .toEqual(['https://new.example'])
  })

  it('keeps a durable edit made during a pending storage refresh', async () => {
    vi.useFakeTimers()
    const oldRead = deferred<Record<string, { alternateUrls: string[] }>>()
    vi.spyOn(metaStorage, 'get').mockImplementationOnce(() => oldRead.promise)
    const refresh = useNavStore.getState().refreshSupplementaryMetadata()
    await useNavStore.getState().setBookmarkMeta('https://example.test', {
      alternateUrls: ['https://new.example'],
    })
    oldRead.resolve({ 'https://example.test': { alternateUrls: ['https://old.example'] } })
    await refresh
    expect(useNavStore.getState().meta['https://example.test'].alternateUrls)
      .toEqual(['https://new.example'])
    await drainMetadataTimer()
  })

  it('moves metadata through rapid native URL changes before refreshing or saving', async () => {
    vi.useFakeTimers()
    const oldUrl = 'https://old.example'
    const newUrl = 'https://new.example'
    const finalUrl = 'https://final.example'
    useNavStore.setState({
      bookmarks: [{ id: 'bm-1', name: 'Site', url: oldUrl, categoryId: 'all' }],
      meta: { [oldUrl]: { alternateUrls: ['https://old-backup.example'] } },
    })
    vi.stubGlobal('chrome', { bookmarks: { getTree: async () => [{
      id: '0',
      title: '',
      children: [{ id: '1', title: 'Site', url: finalUrl }],
    }] } })
    const entered = deferred<void>()
    const release = deferred<void>()
    const blocker = withBookmarkMetadataLock(async () => {
      entered.resolve()
      await release.promise
    })
    await entered.promise
    const firstMigration = useNavStore.getState().reconcileBookmarkUrlChange('1', newUrl)
    const secondMigration = useNavStore.getState().reconcileBookmarkUrlChange('1', finalUrl)
    const save = useNavStore.getState().updateBookmark('bm-1', {
      alternateUrls: ['https://new-backup.example'],
    })
    const refresh = useNavStore.getState().loadBookmarks()
    release.resolve()
    await Promise.all([blocker, firstMigration, secondMigration, save, refresh])
    expect(storageState.values.get('local:yunji-tab:meta')).toEqual({
      [finalUrl]: { alternateUrls: ['https://new-backup.example'] },
    })
    expect(useNavStore.getState().bookmarks[0]).toMatchObject({
      url: finalUrl,
      alternateUrls: ['https://new-backup.example'],
    })
    await drainMetadataTimer()
  })

  it('discards a native tree snapshot captured before an URL migration', async () => {
    vi.useFakeTimers()
    const oldUrl = 'https://old.example'
    const newUrl = 'https://new.example'
    useNavStore.setState({
      bookmarks: [{ id: 'bm-1', name: 'Site', url: oldUrl, categoryId: 'all' }],
      meta: { [oldUrl]: { alternateUrls: ['https://backup.example'] } },
    })
    const oldTree = deferred<chrome.bookmarks.BookmarkTreeNode[]>()
    const entered = deferred<void>()
    const getTree = vi.fn().mockImplementationOnce(() => {
      entered.resolve()
      return oldTree.promise
    }).mockResolvedValue([{
      id: '0',
      title: '',
      children: [{ id: '1', title: 'Site', url: newUrl }],
    }])
    vi.stubGlobal('chrome', { bookmarks: { getTree } })
    const load = useNavStore.getState().loadBookmarks()
    await entered.promise
    await useNavStore.getState().reconcileBookmarkUrlChange('1', newUrl)
    oldTree.resolve([{
      id: '0',
      title: '',
      syncing: false,
      children: [{ id: '1', title: 'Site', url: oldUrl, syncing: false }],
    }])
    await load
    expect(getTree).toHaveBeenCalledTimes(2)
    expect(useNavStore.getState().bookmarks[0]).toMatchObject({
      url: newUrl,
      alternateUrls: ['https://backup.example'],
    })
    await drainMetadataTimer()
  })

  it('merges duplicate alternate URLs against the latest stored values', async () => {
    vi.useFakeTimers()
    storageState.values.set('local:yunji-tab:meta', {
      'https://example.test': { alternateUrls: ['https://other-page.example'] },
    })
    await useNavStore.getState().setBookmarkMeta('https://example.test', latest => ({
      alternateUrls: mergeAlternateUrlsForDuplicate(
        latest.alternateUrls,
        ['https://entered.example'],
        'https://example.test',
      ),
    }))
    expect(useNavStore.getState().meta['https://example.test'].alternateUrls)
      .toEqual(['https://other-page.example', 'https://entered.example'])
    await drainMetadataTimer()
  })

  it('preserves other-page metadata when importing a backup into stale state', async () => {
    vi.useFakeTimers()
    const backup = JSON.parse(useNavStore.getState().exportBackup())
    backup.bookmarkMeta = { 'https://example.test': { description: 'Imported' } }
    storageState.values.set('local:yunji-tab:meta', {
      'https://example.test': { alternateUrls: ['https://backup.example'] },
      'https://other.example': { tags: ['keep'] },
    })
    vi.stubGlobal('chrome', { bookmarks: { getTree: async () => [{ id: '0', title: '', children: [] }] } })
    await useNavStore.getState().importBackup(JSON.stringify(backup))
    expect(storageState.values.get('local:yunji-tab:meta')).toEqual({
      'https://example.test': { alternateUrls: ['https://backup.example'], description: 'Imported' },
      'https://other.example': { tags: ['keep'] },
    })
    await drainMetadataTimer()
  })

  it('preserves alternate URLs saved while a description is being fetched', async () => {
    vi.useFakeTimers()
    const fetched = deferred<string | undefined>()
    vi.spyOn(siteMetadata, 'fetchSiteDescription').mockReturnValue(fetched.promise)
    useNavStore.setState({
      bookmarks: [{ id: 'bm-1', name: 'Site', url: 'https://example.test', categoryId: 'all' }],
    })
    const fetch = useNavStore.getState().syncBookmarkDescriptions(['bm-1'])
    await useNavStore.getState().setBookmarkMeta('https://example.test', {
      alternateUrls: ['https://backup.example'],
    })
    fetched.resolve('Fetched description')
    await fetch
    expect(storageState.values.get('local:yunji-tab:meta')).toEqual({
      'https://example.test': {
        alternateUrls: ['https://backup.example'],
        description: 'Fetched description',
      },
    })
    await drainMetadataTimer()
  })

  it('preserves an edit queued while cloud application saves its recovery point', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('chrome', { bookmarks: {}, storage: { sync: {} } })
    vi.spyOn(metadataSync, 'synchronizeMetadata').mockResolvedValue({
      direction: 'downloaded',
      document: { bookmarkMeta: { 'https://example.test': { description: 'Remote' } }, categoryMeta: [] },
      omittedBookmarkCount: 0,
      omittedBookmarkUrls: [],
      byteCount: 100,
      syncedAt: 1,
      retryCount: 0,
    })
    const entered = deferred<void>()
    const release = deferred<void>()
    storageState.setHook = async (key) => {
      if (key === 'yunji-tab:metadata-sync-recovery') {
        entered.resolve()
        await release.promise
      }
    }
    const sync = useNavStore.getState().syncMetadataNow()
    await entered.promise
    const save = useNavStore.getState().setBookmarkMeta('https://example.test', {
      alternateUrls: ['https://backup.example'],
    })
    release.resolve()
    await Promise.all([sync, save])
    expect(storageState.values.get('local:yunji-tab:meta')).toEqual({
      'https://example.test': { description: 'Remote', alternateUrls: ['https://backup.example'] },
    })
    await drainMetadataTimer()
  })
})
