import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertBookmarkGroupCapacity, bookmarkGroupsKeyPrefix, decodeBookmarkGroups, encodeBookmarkGroup, groupManifestKey, parseBookmarkGroup, resolveGroupBookmark } from './bookmark-groups'
import { bookmarkGroupsCacheKey, bookmarkGroupSourcesKey, useBookmarkGroupsStore } from './bookmark-groups-store'

const group = {
  id: 'group-one',
  title: 'Work',
  description: 'Daily tools',
  bookmarks: [{ id: 'member-one', url: 'https://example.test', title: 'My shortcut' }],
}
let values: Record<string, unknown>
let localValues: Record<string, unknown>
let sync: { get: ReturnType<typeof vi.fn>, set: ReturnType<typeof vi.fn>, remove: ReturnType<typeof vi.fn> }

beforeEach(() => {
  values = {}
  localValues = {}
  sync = {
    get: vi.fn(async () => structuredClone(values)),
    set: vi.fn(async (items) => { Object.assign(values, structuredClone(items)) }),
    remove: vi.fn(async (keys: string[]) => { for (const key of keys) delete values[key] }),
  }
  vi.stubGlobal('chrome', { storage: { sync, local: {
    get: vi.fn(async () => structuredClone(localValues)),
    set: vi.fn(async (items) => { Object.assign(localValues, structuredClone(items)) }),
  } } })
  useBookmarkGroupsStore.setState({ groups: [], error: false })
})
afterEach(() => vi.unstubAllGlobals())

describe('bookmark groups', () => {
  it('saves manual group order through reload, edits, migration and restore', async () => {
    const groups = ['A', 'B', 'C'].map(title => ({ ...group, id: `order-${title}`, title }))
    for (const item of groups)
      await useBookmarkGroupsStore.getState().save(item.id, item, true)
    await useBookmarkGroupsStore.getState().reorder('order-A', 'order-C')
    expect(decodeBookmarkGroups(values).map(item => item.title)).toEqual(['B', 'C', 'A'])
    await useBookmarkGroupsStore.getState().save('order-A', { description: 'Latest description' })
    await useBookmarkGroupsStore.getState().migrateUrl('https://example.test', 'https://new.test')
    useBookmarkGroupsStore.setState({ groups: [] })
    await useBookmarkGroupsStore.getState().load()
    const backup = structuredClone(useBookmarkGroupsStore.getState().groups)
    expect(backup.map(item => item.title)).toEqual(['B', 'C', 'A'])
    values = {}
    await useBookmarkGroupsStore.getState().restore(backup, 'replace')
    expect(decodeBookmarkGroups(values).map(item => item.title)).toEqual(['B', 'C', 'A'])
    expect(decodeBookmarkGroups(values)[2].description).toBe('Latest description')
  })

  it('preserves concurrent edits and keeps the old order when a reorder write fails', async () => {
    const second = { ...group, id: 'group-two', title: 'Z', description: 'Remote description' }
    values = { ...encodeBookmarkGroup(group, 'one'), ...encodeBookmarkGroup(second, 'two') }
    useBookmarkGroupsStore.setState({ groups: [group, { ...second, description: 'Stale' }] })
    sync.set.mockRejectedValueOnce(new Error('order write failed'))
    await expect(useBookmarkGroupsStore.getState().reorder(group.id, second.id)).rejects.toThrow('order write failed')
    expect(useBookmarkGroupsStore.getState().groups.map(item => item.id)).toEqual([group.id, second.id])
    await useBookmarkGroupsStore.getState().reorder(group.id, second.id)
    expect(decodeBookmarkGroups(values).map(item => item.id)).toEqual([second.id, group.id])
    expect(decodeBookmarkGroups(values)[0].description).toBe('Remote description')
    await useBookmarkGroupsStore.getState().save('new-group', { ...group, title: 'A new group' }, true)
    expect(decodeBookmarkGroups(values).map(item => item.id)).toEqual([second.id, group.id, 'new-group'])
  })

  it('validates order fields and resets the pinned order on a new pin', async () => {
    expect(parseBookmarkGroup({ ...group, sortOrder: Infinity, pinnedOrder: '1' })).toEqual(group)
    values = encodeBookmarkGroup({ ...group, pinnedAt: 10, pinnedOrder: -100, sortOrder: 2 }, 'rank')
    await useBookmarkGroupsStore.getState().save(group.id, { pinnedAt: 20 })
    expect(decodeBookmarkGroups(values)[0]).toMatchObject({ pinnedAt: 20, sortOrder: 2 })
    expect(decodeBookmarkGroups(values)[0].pinnedOrder).toBeUndefined()
  })
  it('preserves custom group icons through sync, migration, pinning and restore', async () => {
    await useBookmarkGroupsStore.getState().save(group.id, { ...group, icon: ' 🐱 ' }, true)
    await useBookmarkGroupsStore.getState().save(group.id, { pinnedAt: 123 })
    await useBookmarkGroupsStore.getState().migrateUrl('https://example.test', 'https://new.test')
    useBookmarkGroupsStore.setState({ groups: [] })
    await useBookmarkGroupsStore.getState().load()
    expect(useBookmarkGroupsStore.getState().groups[0]).toMatchObject({ icon: '🐱', pinnedAt: 123 })
    await useBookmarkGroupsStore.getState().save(group.id, { icon: 'https://example.test/logo.png' })
    expect(decodeBookmarkGroups(values)[0].icon).toBe('https://example.test/logo.png')
    await useBookmarkGroupsStore.getState().save(group.id, { icon: '' })
    expect(decodeBookmarkGroups(values)[0].icon).toBeUndefined()
    await useBookmarkGroupsStore.getState().restore([{ ...group, icon: '🛠️' }], 'merge')
    expect(decodeBookmarkGroups(values)[0].icon).toBeUndefined()
    await useBookmarkGroupsStore.getState().restore([{ ...group, icon: '🛠️' }], 'replace')
    expect(decodeBookmarkGroups(values)[0].icon).toBe('🛠️')
  })

  it('retains a newer group icon when an old editor only changes another field', async () => {
    values = encodeBookmarkGroup({ ...group, icon: '🚀' }, 'remote-icon')
    useBookmarkGroupsStore.setState({ groups: [group] })
    await useBookmarkGroupsStore.getState().save(group.id, { description: 'Edited description' })
    expect(decodeBookmarkGroups(values)[0]).toMatchObject({ icon: '🚀', description: 'Edited description' })
    expect(parseBookmarkGroup({ ...group, icon: 42 })?.icon).toBeUndefined()
  })

  it('validates groups and preserves member aliases without modifying the source bookmark', () => {
    const bookmark = { id: 'bm-1', name: 'Original', url: 'https://example.test', categoryId: 'all' }
    expect(parseBookmarkGroup({ ...group, title: ' Work ' })).toEqual(group)
    expect(resolveGroupBookmark(group.bookmarks[0], [bookmark])).toBe(bookmark)
    expect(bookmark.name).toBe('Original')
    expect(parseBookmarkGroup({ ...group, bookmarks: [] })).toBeUndefined()
    expect(parseBookmarkGroup({ ...group, bookmarks: [{ url: 'javascript:alert(1)', title: 'Bad' }] })).toBeUndefined()
    expect(parseBookmarkGroup({ ...group, bookmarks: [{ url: 'https://valid.test', title: '' }] })).toBeUndefined()
  })

  it('round-trips a large multilingual group within every sync item quota', () => {
    const large = { ...group, bookmarks: Array.from({ length: 150 }, (_, index) => ({
      id: `member-${index}`,
      url: `https://example.test/${index}`,
      title: `中文书签 ${index} "标题" \\ ${'说明'.repeat(25)}`,
    })) }
    const encoded = encodeBookmarkGroup(large, 'generation-one')
    expect(Object.keys(encoded).length).toBeGreaterThan(2)
    for (const [key, value] of Object.entries(encoded))
      expect(new TextEncoder().encode(key + JSON.stringify(value)).length).toBeLessThan(8192)
    expect(decodeBookmarkGroups(encoded)).toEqual([large])
  })

  it('keeps the last complete group when remote parts arrive out of order', () => {
    const encoded = encodeBookmarkGroup({ ...group, title: 'Remote' }, 'remote')
    const manifestOnly = { [groupManifestKey(group.id)]: encoded[groupManifestKey(group.id)] }
    expect(decodeBookmarkGroups(manifestOnly, [group])).toEqual([group])
    expect(decodeBookmarkGroups({ ...manifestOnly, ...encodeBookmarkGroup(group, 'old') }, [group]))
      .toEqual([group])
    expect(decodeBookmarkGroups(encoded, [group])[0].title).toBe('Remote')
    expect(decodeBookmarkGroups({}, [group])).toEqual([])
  })

  it('saves, reloads, and removes a group without touching native bookmarks', async () => {
    await useBookmarkGroupsStore.getState().save(group.id, group, true)
    expect(Object.keys(values).every(key => key.startsWith(bookmarkGroupsKeyPrefix))).toBe(true)
    useBookmarkGroupsStore.setState({ groups: [] })
    await useBookmarkGroupsStore.getState().load()
    expect(useBookmarkGroupsStore.getState().groups).toEqual([group])
    await useBookmarkGroupsStore.getState().remove(group.id)
    expect(values).toEqual({})
    expect(useBookmarkGroupsStore.getState().groups).toEqual([])
  })

  it('keeps groups created by two overlapping writers', async () => {
    const second = { ...group, id: 'group-two', title: 'Other' }
    await Promise.all([
      useBookmarkGroupsStore.getState().save(group.id, group, true),
      useBookmarkGroupsStore.getState().save(second.id, second, true),
    ])
    expect(decodeBookmarkGroups(values)).toHaveLength(2)
  })

  it('applies an old editor patch to the latest group and cleans up old parts', async () => {
    const latest = { ...group, bookmarks: [{ id: 'member-two', url: 'https://new.test', title: 'New member' }] }
    values = encodeBookmarkGroup(latest, 'old-generation')
    useBookmarkGroupsStore.setState({ groups: [group] })
    await useBookmarkGroupsStore.getState().save(group.id, { description: 'Only description changed' })
    expect(decodeBookmarkGroups(values)).toEqual([{ ...latest, description: 'Only description changed' }])
    expect(Object.keys(values).some(key => key.includes('old-generation'))).toBe(false)
  })

  it('does not display a failed save or resurrect a deleted group', async () => {
    sync.set.mockRejectedValueOnce(new Error('QUOTA_BYTES'))
    await expect(useBookmarkGroupsStore.getState().save(group.id, group, true)).rejects.toThrow()
    expect(useBookmarkGroupsStore.getState().groups).toEqual([])
    await expect(useBookmarkGroupsStore.getState().save(group.id, { title: 'Old editor' })).rejects.toThrow('unavailable')
  })

  it('migrates a changed source URL while retaining its group alias', async () => {
    values = encodeBookmarkGroup(group, 'old-generation')
    await useBookmarkGroupsStore.getState().migrateUrl('https://example.test', 'https://new.test')
    expect(decodeBookmarkGroups(values)[0].bookmarks).toEqual([{ id: 'member-one', url: 'https://new.test', title: 'My shortcut' }])
    expect(resolveGroupBookmark(group.bookmarks[0], [])).toBeUndefined()
  })

  it('keeps a migrated URL when an old editor changes the member alias', async () => {
    values = encodeBookmarkGroup(group, 'old-generation')
    await useBookmarkGroupsStore.getState().migrateUrl('https://example.test', 'https://new.test')
    await useBookmarkGroupsStore.getState().save(group.id, {
      bookmarks: [{ ...group.bookmarks[0], title: 'Edited alias' }],
    })
    expect(decodeBookmarkGroups(values)[0].bookmarks)
      .toEqual([{ id: 'member-one', url: 'https://new.test', title: 'Edited alias' }])
  })

  it('rejects duplicate member IDs and reserves capacity before creating an uneditable group', async () => {
    expect(parseBookmarkGroup({ ...group, bookmarks: [...group.bookmarks, { ...group.bookmarks[0], url: 'https://second.test' }] })).toBeUndefined()
    const huge = { ...group, description: '长'.repeat(20000) }
    expect(() => assertBookmarkGroupCapacity({}, encodeBookmarkGroup(huge, 'large'))).toThrow()
    await expect(useBookmarkGroupsStore.getState().save(huge.id, huge, true)).rejects.toThrow()
    expect(values).toEqual({})
    const moderate = { ...group, description: '长'.repeat(8000) }
    await useBookmarkGroupsStore.getState().save(group.id, moderate, true)
    await useBookmarkGroupsStore.getState().save(group.id, { title: 'Still editable' })
    expect(decodeBookmarkGroups(values)[0].title).toBe('Still editable')
  })

  it('recovers editing capacity after an old generation cleanup fails', async () => {
    sync.set.mockImplementation(async (items) => {
      const next = { ...values, ...structuredClone(items) }
      const bytes = Object.entries(next).reduce((total, [key, value]) => total + new TextEncoder().encode(key + JSON.stringify(value)).length, 0)
      if (bytes > 102400)
        throw new Error('QUOTA_BYTES')
      values = next
    })
    await useBookmarkGroupsStore.getState().save(group.id, { ...group, description: '长'.repeat(15000) }, true)
    sync.remove.mockRejectedValueOnce(new Error('temporary cleanup failure'))
    await useBookmarkGroupsStore.getState().save(group.id, { title: 'First edit' })
    expect(decodeBookmarkGroups(values)[0].title).toBe('First edit')
    useBookmarkGroupsStore.setState({ groups: [] })
    await useBookmarkGroupsStore.getState().load()
    await useBookmarkGroupsStore.getState().save(group.id, { title: 'Retry edit' })
    expect(decodeBookmarkGroups(values)[0].title).toBe('Retry edit')
    expect(new Set(Object.keys(values).filter(key => key.startsWith(`${groupManifestKey(group.id)}:`)).map(key => key.split(':').at(-2))).size).toBe(1)
  })

  it('preserves incoming parts that precede their manifest when a local save fails', async () => {
    const incoming = { ...group, title: 'Incoming edit', pinnedAt: 123 }
    const encoded = encodeBookmarkGroup(incoming, 'incoming')
    values = {
      ...encodeBookmarkGroup(group, 'current'),
      ...Object.fromEntries(Object.entries(encoded).filter(([key]) => key !== groupManifestKey(group.id))),
    }
    localValues[bookmarkGroupsCacheKey] = [group]
    useBookmarkGroupsStore.setState({ groups: [group] })
    sync.set.mockRejectedValueOnce(new Error('WRITE_RATE_LIMIT'))
    await expect(useBookmarkGroupsStore.getState().save(group.id, { title: 'Local edit' })).rejects.toThrow('WRITE_RATE_LIMIT')
    values[groupManifestKey(group.id)] = encoded[groupManifestKey(group.id)]
    expect(decodeBookmarkGroups(values)).toEqual([incoming])
    await useBookmarkGroupsStore.getState().load()
    expect(useBookmarkGroupsStore.getState().groups).toEqual([incoming])
  })

  it('keeps the current generation and form state when retry cleanup fails', async () => {
    const current = { ...group, title: 'Current', pinnedAt: 123 }
    values = { ...encodeBookmarkGroup(group, 'old'), ...encodeBookmarkGroup(current, 'current') }
    localValues[bookmarkGroupsCacheKey] = [current]
    localValues['yunji-tab:bookmark-group-retired-parts'] = [`${groupManifestKey(group.id)}:old:0`]
    useBookmarkGroupsStore.setState({ groups: [current] })
    sync.remove.mockRejectedValueOnce(new Error('cleanup unavailable'))
    await expect(useBookmarkGroupsStore.getState().save(group.id, { title: 'Edited' })).rejects.toThrow('cleanup unavailable')
    expect(sync.set).not.toHaveBeenCalled()
    expect(decodeBookmarkGroups(values)).toEqual([current])
    expect(useBookmarkGroupsStore.getState().groups).toEqual([current])
    expect(localValues[bookmarkGroupsCacheKey]).toEqual([current])
    await useBookmarkGroupsStore.getState().save(group.id, { title: 'Edited' })
    expect(decodeBookmarkGroups(values)).toEqual([{ ...current, title: 'Edited' }])
  })

  it('does not reclaim fallback parts before replacing an incomplete incoming group', async () => {
    const old = encodeBookmarkGroup(group, 'old')
    values = { ...old, [groupManifestKey(group.id)]: { version: 1, generation: 'incoming', partCount: 1 } }
    localValues[bookmarkGroupsCacheKey] = [group]
    localValues['yunji-tab:bookmark-group-retired-parts'] = [`${groupManifestKey(group.id)}:old:0`]
    sync.set.mockImplementation(async (items) => {
      expect(values[`${groupManifestKey(group.id)}:old:0`]).toBe(old[`${groupManifestKey(group.id)}:old:0`])
      expect(sync.remove).not.toHaveBeenCalled()
      Object.assign(values, structuredClone(items))
    })
    await useBookmarkGroupsStore.getState().restore([{ ...group, title: 'Restored' }], 'replace')
    expect(decodeBookmarkGroups(values)).toEqual([{ ...group, title: 'Restored' }])
    expect(values[`${groupManifestKey(group.id)}:old:0`]).toBe(old[`${groupManifestKey(group.id)}:old:0`])
  })

  it('keeps unknown incoming parts after a successful local save', async () => {
    const incoming = { ...group, title: 'Remote edit' }
    const encoded = encodeBookmarkGroup(incoming, 'incoming')
    values = {
      ...encodeBookmarkGroup(group, 'current'),
      ...Object.fromEntries(Object.entries(encoded).filter(([key]) => key !== groupManifestKey(group.id))),
    }
    await useBookmarkGroupsStore.getState().save(group.id, { title: 'Local edit' })
    expect(decodeBookmarkGroups(values)[0].title).toBe('Local edit')
    values[groupManifestKey(group.id)] = encoded[groupManifestKey(group.id)]
    expect(decodeBookmarkGroups(values)).toEqual([incoming])
  })

  it('does not consume replacement capacity when retirement journaling fails', async () => {
    const large = { ...group, description: '长'.repeat(15000) }
    sync.set.mockImplementation(async (items) => {
      const next = { ...values, ...structuredClone(items) }
      const bytes = Object.entries(next).reduce((total, [key, value]) => total + new TextEncoder().encode(key + JSON.stringify(value)).length, 0)
      if (bytes > 102400)
        throw new Error('QUOTA_BYTES')
      values = next
    })
    await useBookmarkGroupsStore.getState().save(group.id, large, true)
    const original = structuredClone(values)
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('local write failed'))
    await expect(useBookmarkGroupsStore.getState().save(group.id, { title: 'Saved' })).rejects.toThrow('local write failed')
    expect(values).toEqual(original)
    expect(useBookmarkGroupsStore.getState().groups).toEqual([large])
    expect(sync.remove).not.toHaveBeenCalled()
    await useBookmarkGroupsStore.getState().save(group.id, { title: 'Saved' })
    await useBookmarkGroupsStore.getState().save(group.id, { title: 'Still editable' })
    expect(decodeBookmarkGroups(values)).toEqual([{ ...large, title: 'Still editable' }])
  })

  it('merges old alias edits with new members and never resurrects concurrently removed members', async () => {
    const second = { id: 'second', url: 'https://second.test', title: 'Second' }
    const third = { id: 'third', url: 'https://third.test', title: 'Third' }
    const baseline = [...group.bookmarks, second]
    values = encodeBookmarkGroup({ ...group, bookmarks: [...group.bookmarks, third] }, 'latest')
    await useBookmarkGroupsStore.getState().save(group.id, {
      bookmarks: [{ ...group.bookmarks[0], title: 'Changed alias' }, second],
    }, false, baseline)
    expect(decodeBookmarkGroups(values)[0].bookmarks).toEqual([{ ...group.bookmarks[0], title: 'Changed alias' }, third])
  })

  it('keeps a complete cached group when reopened before remote parts arrive', async () => {
    values = encodeBookmarkGroup(group, 'old')
    await useBookmarkGroupsStore.getState().load()
    expect(localValues[bookmarkGroupsCacheKey]).toEqual([group])
    values = { [groupManifestKey(group.id)]: { version: 1, generation: 'remote', partCount: 1 } }
    useBookmarkGroupsStore.setState({ groups: [] })
    await useBookmarkGroupsStore.getState().load()
    expect(useBookmarkGroupsStore.getState().groups).toEqual([group])
  })

  it('repairs closed-page native URL changes after incomplete sync generations become complete', async () => {
    const node = { id: 'native-source', title: 'Source', url: 'https://new.test' }
    vi.stubGlobal('chrome', { ...chrome, bookmarks: { getTree: vi.fn(async () => [{ id: 'folder', title: 'Folder', children: [node] }]) } })
    localValues[bookmarkGroupSourcesKey] = { 'native-source': group.bookmarks[0].url }
    values = { [groupManifestKey(group.id)]: { version: 1, generation: 'remote', partCount: 1 } }
    await useBookmarkGroupsStore.getState().reconcileSources()
    values = encodeBookmarkGroup(group, 'remote')
    await useBookmarkGroupsStore.getState().load()
    expect(decodeBookmarkGroups(values)[0].bookmarks[0])
      .toEqual({ ...group.bookmarks[0], url: 'https://new.test' })
  })

  it('does not retarget a removed bookmark that reused a historical source URL', async () => {
    let nodes = [{ id: 'one', title: 'First', url: 'https://new.test' }]
    vi.stubGlobal('chrome', { ...chrome, bookmarks: { getTree: vi.fn(async () => nodes) } })
    localValues[bookmarkGroupSourcesKey] = { one: group.bookmarks[0].url }
    values = encodeBookmarkGroup(group, 'initial')
    await useBookmarkGroupsStore.getState().reconcileSources()
    nodes.push({ id: 'two', title: 'Reused', url: group.bookmarks[0].url })
    await useBookmarkGroupsStore.getState().reconcileSources()
    const reused = { ...group, id: 'reused-group', title: 'Reused' }
    await useBookmarkGroupsStore.getState().save(reused.id, reused, true)
    nodes = nodes.filter(node => node.id !== 'two')
    await useBookmarkGroupsStore.getState().reconcileSources()
    expect(decodeBookmarkGroups(values).find(item => item.id === reused.id)?.bookmarks[0].url).toBe(group.bookmarks[0].url)
  })

  it('preserves unrelated cached partial groups when another group migrates during reopening', async () => {
    const complete = { ...group, id: 'complete-group', title: 'Complete', bookmarks: [{ id: 'other', url: 'https://other.test', title: 'Other' }] }
    localValues[bookmarkGroupsCacheKey] = [group, complete]
    localValues[bookmarkGroupSourcesKey] = { source: 'https://other.test' }
    vi.stubGlobal('chrome', { ...chrome, bookmarks: { getTree: vi.fn(async () => [{ id: 'source', title: 'Source', url: 'https://new.test' }]) } })
    values = { ...encodeBookmarkGroup(complete, 'initial'), [groupManifestKey(group.id)]: { version: 1, generation: 'remote', partCount: 1 } }
    await useBookmarkGroupsStore.getState().load()
    expect(useBookmarkGroupsStore.getState().groups).toHaveLength(2)
    expect(useBookmarkGroupsStore.getState().groups.find(item => item.id === group.id)).toEqual(group)
    expect(localValues[bookmarkGroupsCacheKey]).toHaveLength(2)
  })

  it('prefers the latest durable cache to an older page while incoming parts are incomplete', async () => {
    localValues[bookmarkGroupsCacheKey] = [{ ...group, title: 'Latest cached title' }]
    useBookmarkGroupsStore.setState({ groups: [group] })
    values = { [groupManifestKey(group.id)]: { version: 1, generation: 'incoming', partCount: 1 } }
    await useBookmarkGroupsStore.getState().load()
    expect(useBookmarkGroupsStore.getState().groups[0].title).toBe('Latest cached title')
    expect((localValues[bookmarkGroupsCacheKey] as typeof group[])[0].title).toBe('Latest cached title')
  })

  it('keeps newer unrelated groups and cached pins when an old page deletes another group', async () => {
    const stale = { ...group, id: 'cached-group', title: 'Old title' }
    const cached = { ...stale, title: 'Latest cached title', pinnedAt: 123 }
    const remote = { ...group, id: 'remote-group', title: 'Remote group' }
    values = {
      ...encodeBookmarkGroup(group, 'original'),
      ...encodeBookmarkGroup(remote, 'remote'),
      [groupManifestKey(stale.id)]: { version: 1, generation: 'incoming', partCount: 1 },
    }
    localValues[bookmarkGroupsCacheKey] = [group, cached]
    useBookmarkGroupsStore.setState({ groups: [group, stale] })
    sync.remove.mockRejectedValueOnce(new Error('remove failed'))
    await expect(useBookmarkGroupsStore.getState().remove(group.id)).rejects.toThrow('remove failed')
    expect(useBookmarkGroupsStore.getState().groups).toEqual([group, stale])
    expect(localValues[bookmarkGroupsCacheKey]).toEqual([group, cached])

    await useBookmarkGroupsStore.getState().remove(group.id)
    expect(useBookmarkGroupsStore.getState().groups).toEqual([cached, remote])
    expect(localValues[bookmarkGroupsCacheKey]).toEqual([cached, remote])
    expect(Object.keys(values).some(key => key === groupManifestKey(group.id) || key.startsWith(`${groupManifestKey(group.id)}:`))).toBe(false)
    useBookmarkGroupsStore.setState({ groups: [] })
    await useBookmarkGroupsStore.getState().load()
    expect(useBookmarkGroupsStore.getState().groups).toEqual([cached, remote])
  })

  it('syncs and clears group pins without losing newer editor fields', async () => {
    await useBookmarkGroupsStore.getState().save(group.id, group, true)
    await useBookmarkGroupsStore.getState().save(group.id, { title: 'Edited in another page' })
    await useBookmarkGroupsStore.getState().save(group.id, { pinnedAt: 123 })
    expect(decodeBookmarkGroups(values)[0]).toEqual({ ...group, title: 'Edited in another page', pinnedAt: 123 })
    useBookmarkGroupsStore.setState({ groups: [] })
    await useBookmarkGroupsStore.getState().load()
    expect(useBookmarkGroupsStore.getState().groups[0].pinnedAt).toBe(123)
    await useBookmarkGroupsStore.getState().save(group.id, { description: 'An old editor changes only this' })
    expect(decodeBookmarkGroups(values)[0].pinnedAt).toBe(123)
    sync.set.mockRejectedValueOnce(new Error('QUOTA_BYTES'))
    await expect(useBookmarkGroupsStore.getState().save(group.id, { pinnedAt: 0 })).rejects.toThrow()
    expect(useBookmarkGroupsStore.getState().groups[0].pinnedAt).toBe(123)
    await useBookmarkGroupsStore.getState().save(group.id, { pinnedAt: 0 })
    expect(decodeBookmarkGroups(values)[0].pinnedAt).toBeUndefined()
    expect(decodeBookmarkGroups(values)[0].description).toBe('An old editor changes only this')
  })

  it('accepts old groups and rejects invalid pin ranks without breaking the group', () => {
    expect(parseBookmarkGroup(group)?.pinnedAt).toBeUndefined()
    for (const pinnedAt of [0, -1, NaN, Infinity, '123', 1.5])
      expect(parseBookmarkGroup({ ...group, pinnedAt })?.pinnedAt).toBeUndefined()
    expect(parseBookmarkGroup({ ...group, pinnedAt: 123 })?.pinnedAt).toBe(123)
  })

  it('preserves group pins through URL migration and backup restore strategies', async () => {
    values = encodeBookmarkGroup({ ...group, pinnedAt: 123 }, 'pinned')
    await useBookmarkGroupsStore.getState().migrateUrl(group.bookmarks[0].url, 'https://migrated.test')
    expect(decodeBookmarkGroups(values)[0].pinnedAt).toBe(123)
    await useBookmarkGroupsStore.getState().restore([{ ...group, pinnedAt: 456 }], 'merge')
    expect(decodeBookmarkGroups(values)[0].pinnedAt).toBe(123)
    await useBookmarkGroupsStore.getState().save(group.id, { pinnedAt: 0 })
    await useBookmarkGroupsStore.getState().restore([{ ...group, pinnedAt: 456 }], 'merge')
    expect(decodeBookmarkGroups(values)[0].pinnedAt).toBeUndefined()
    await useBookmarkGroupsStore.getState().restore([{ ...group, pinnedAt: 456 }], 'replace')
    expect(decodeBookmarkGroups(values)[0].pinnedAt).toBe(456)
  })

  it('restores groups with merge, skip, and replace while keeping unrelated groups', async () => {
    const unrelated = { ...group, id: 'unrelated', title: 'Unrelated' }
    values = { ...encodeBookmarkGroup(group, 'original'), ...encodeBookmarkGroup(unrelated, 'unrelated') }
    const imported = { ...group, title: 'Imported', bookmarks: [{ id: 'imported-member', url: 'https://imported.test', title: 'Imported alias' }] }
    await useBookmarkGroupsStore.getState().restore([imported], 'skip')
    expect(decodeBookmarkGroups(values).find(item => item.id === group.id)).toEqual(group)
    await useBookmarkGroupsStore.getState().restore([imported], 'merge')
    expect(decodeBookmarkGroups(values).find(item => item.id === group.id))
      .toEqual({ ...group, bookmarks: [...group.bookmarks, ...imported.bookmarks] })
    await useBookmarkGroupsStore.getState().restore([imported], 'replace')
    expect(decodeBookmarkGroups(values).find(item => item.id === group.id)).toEqual(imported)
    expect(decodeBookmarkGroups(values).find(item => item.id === unrelated.id)).toEqual(unrelated)
  })

  it('keeps durable groups and state when restore exceeds the sync quota', async () => {
    values = encodeBookmarkGroup(group, 'original')
    await useBookmarkGroupsStore.getState().load()
    sync.set.mockRejectedValueOnce(new Error('QUOTA_BYTES'))
    await expect(useBookmarkGroupsStore.getState().restore([{ ...group, title: 'Imported' }], 'replace')).rejects.toThrow()
    expect(decodeBookmarkGroups(values)).toEqual([group])
    expect(useBookmarkGroupsStore.getState().groups).toEqual([group])
  })

  it('ignores a storage read that finishes after a newer save', async () => {
    let finish!: (items: Record<string, unknown>) => void
    sync.get.mockImplementationOnce(() => new Promise<Record<string, unknown>>((resolve) => {
      finish = resolve
    }))
    const load = useBookmarkGroupsStore.getState().load()
    await useBookmarkGroupsStore.getState().save(group.id, group, true)
    finish({})
    await load
    expect(useBookmarkGroupsStore.getState().groups).toEqual([group])
  })
})
