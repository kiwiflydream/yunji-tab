import type { BookmarkGroup, BookmarkGroupMember } from './bookmark-groups'
import { create } from 'zustand'
import { assertBookmarkGroupCapacity, bookmarkGroupsKeyPrefix, decodeBookmarkGroups, encodeBookmarkGroup, groupManifestKey, mergeGroupMembers, parseBookmarkGroup } from './bookmark-groups'
import { normalizeBookmarkUrl } from './bookmark-urls'

let queue: Promise<unknown> = Promise.resolve()
let refreshRevision = 0
export const bookmarkGroupsCacheKey = 'yunji-tab:bookmark-groups-cache'
export const bookmarkGroupSourcesKey = 'yunji-tab:bookmark-group-sources'
const pendingUrlsKey = 'yunji-tab:bookmark-group-url-migrations'
const retiredPartsKey = 'yunji-tab:bookmark-group-retired-parts'

function stringValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return {}
  return Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === 'string'))
}

async function cachedGroupFallback(memory: BookmarkGroup[]): Promise<BookmarkGroup[]> {
  const stored = await chrome.storage.local?.get(bookmarkGroupsCacheKey).catch(() => ({}))
  const persisted = stored?.[bookmarkGroupsCacheKey]
  const cached = (Array.isArray(persisted) ? persisted : []).flatMap((item: unknown) => {
    const group = parseBookmarkGroup(item)
    return group ? [group] : []
  })
  return [...new Map([...memory, ...cached].map(group => [group.id, group])).values()]
}

async function cacheGroups(groups: BookmarkGroup[]): Promise<void> {
  await chrome.storage.local?.set({ [bookmarkGroupsCacheKey]: groups }).catch(() => undefined)
}

async function withGroupLock<T>(commit: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks)
    return navigator.locks.request(bookmarkGroupsKeyPrefix, commit)
  const pending = queue.then(commit, commit)
  queue = pending.catch(() => undefined)
  return pending
}

async function writeGroupChanges(values: Record<string, unknown>, changes: Record<string, unknown>): Promise<void> {
  assertBookmarkGroupCapacity(values, changes)
  // Unknown generations may be incoming parts whose manifest has not arrived.
  // Reclaim only recorded former references, guarded by a complete replacement.
  const stored = await chrome.storage.local?.get(retiredPartsKey)
  const pending = stored?.[retiredPartsKey]
  const retired = new Set<string>((Array.isArray(pending) ? pending : []).filter((key: unknown): key is string => typeof key === 'string' && key.startsWith(bookmarkGroupsKeyPrefix) && Object.hasOwn(values, key)))
  const completeKeys = new Set(decodeBookmarkGroups(values).map(group => groupManifestKey(group.id)))
  const updatedKeys = Object.keys(changes).filter(key => completeKeys.has(key))
  const staleParts = [...retired].filter(key => updatedKeys.some((manifestKey) => {
    const manifest = values[manifestKey] as { generation: string }
    return key.startsWith(`${manifestKey}:`) && !key.startsWith(`${manifestKey}:${manifest.generation}:`)
  }))
  if (staleParts.length) {
    await chrome.storage.sync.remove(staleParts)
    for (const key of staleParts) {
      delete values[key]
      retired.delete(key)
    }
  }
  for (const key of Object.keys(values)) {
    if (updatedKeys.some((manifestKey) => {
      const manifest = values[manifestKey] as { generation: string }
      return key.startsWith(`${manifestKey}:${manifest.generation}:`)
    })) {
      retired.add(key)
    }
  }
  // Record exact previous references before the sync write so failed journaling
  // cannot consume the last replacement capacity. If sync fails, the current
  // manifest reference guard still protects these parts from reclamation.
  await chrome.storage.local?.set({ [retiredPartsKey]: [...retired] })
  await chrome.storage.sync.set(changes)
  try {
    const cleanup = [...retired].filter(key => updatedKeys.some(manifestKey => key.startsWith(`${manifestKey}:`)))
    if (cleanup.length) {
      await chrome.storage.sync.remove(cleanup)
      for (const key of cleanup) {
        delete values[key]
        retired.delete(key)
      }
      await chrome.storage.local?.set({ [retiredPartsKey]: [...retired] })
    }
  }
  catch { /* Retry known retired parts on the next write. */ }
}

interface BookmarkGroupsState {
  groups: BookmarkGroup[]
  error: boolean
  load: () => Promise<void>
  save: (id: string, patch: Partial<Omit<BookmarkGroup, 'id'>>, create?: boolean, baseline?: BookmarkGroupMember[]) => Promise<void>
  reconcileSources: () => Promise<void>
  restore: (groups: BookmarkGroup[], strategy?: 'merge' | 'replace' | 'skip') => Promise<void>
  remove: (id: string) => Promise<void>
  migrateUrl: (oldUrl: string, newUrl: string) => Promise<void>
}

export const useBookmarkGroupsStore = create<BookmarkGroupsState>((set, get) => ({
  groups: [],
  error: false,
  load: async () => {
    const revision = ++refreshRevision
    try {
      await get().reconcileSources()
      const values = await chrome.storage.sync.get(null)
      if (revision !== refreshRevision)
        return
      await withGroupLock(async () => {
        if (revision !== refreshRevision)
          return
        const fallback = await cachedGroupFallback(get().groups)
        if (revision !== refreshRevision)
          return
        const groups = decodeBookmarkGroups(values, fallback)
        set({ groups, error: false })
        await cacheGroups(groups)
      })
    }
    catch {
      if (revision === refreshRevision)
        set({ error: true })
    }
  },
  save: async (id, patch, creating = false, baseline) => {
    await withGroupLock(async () => {
      const values = await chrome.storage.sync.get(null)
      const latest = decodeBookmarkGroups(values)
      const existing = latest.find(group => group.id === id)
      if (!creating && !existing)
        throw new Error('group unavailable')
      const bookmarks = patch.bookmarks ? mergeGroupMembers(existing?.bookmarks ?? [], patch.bookmarks, baseline) : undefined
      const group = parseBookmarkGroup({ ...existing, ...patch, ...(bookmarks ? { bookmarks } : {}), id })
      if (!group)
        throw new Error('invalid group')
      const encoded = encodeBookmarkGroup(group, crypto.randomUUID())
      await writeGroupChanges(values, encoded)
      // Publish state only after a durable write; failed writes leave the editor open.
      refreshRevision += 1
      set({ groups: decodeBookmarkGroups({ ...values, ...encoded }, await cachedGroupFallback(get().groups)), error: false })
      await cacheGroups(get().groups)
    })
  },
  restore: async (imported, strategy = 'merge') => {
    if (!imported.length)
      return
    await withGroupLock(async () => {
      const values = await chrome.storage.sync.get(null)
      const current = decodeBookmarkGroups(values)
      const changes: Record<string, unknown> = {}
      for (const item of imported) {
        const group = parseBookmarkGroup(item)
        if (!group)
          throw new Error('invalid group backup')
        const existing = current.find(value => value.id === group.id)
        if (existing && strategy === 'skip')
          continue
        const next = existing && strategy === 'merge'
          ? parseBookmarkGroup({ ...group, ...existing, pinnedAt: existing.pinnedAt ?? 0, bookmarks: [...existing.bookmarks, ...group.bookmarks.filter(member => !existing.bookmarks.some(current => current.id === member.id))] })!
          : group
        Object.assign(changes, encodeBookmarkGroup(next, crypto.randomUUID()))
      }
      if (!Object.keys(changes).length)
        return
      await writeGroupChanges(values, changes)
      refreshRevision += 1
      set({ groups: decodeBookmarkGroups({ ...values, ...changes }, await cachedGroupFallback(get().groups)), error: false })
      await cacheGroups(get().groups)
    })
  },
  remove: async (id) => {
    await withGroupLock(async () => {
      const values = await chrome.storage.sync.get(null)
      const key = groupManifestKey(id)
      const keys = Object.keys(values).filter(item => item === key || item.startsWith(`${key}:`))
      await chrome.storage.sync.remove(keys)
      for (const item of keys)
        delete values[item]
      refreshRevision += 1
      set({ groups: decodeBookmarkGroups(values, await cachedGroupFallback(get().groups)), error: false })
      await cacheGroups(get().groups)
    })
  },
  reconcileSources: async () => {
    if (!chrome.bookmarks?.getTree || !chrome.storage.local)
      return
    await withGroupLock(async () => {
      const [tree, stored, values] = await Promise.all([
        chrome.bookmarks.getTree(),
        chrome.storage.local.get([bookmarkGroupSourcesKey, pendingUrlsKey]),
        chrome.storage.sync.get(null),
      ])
      const sources: Record<string, string> = {}
      const visit = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
        for (const node of nodes) {
          const url = normalizeBookmarkUrl(node.url ?? '')
          if (url)
            sources[node.id] = url
          if (node.children)
            visit(node.children)
        }
      }
      visit(tree)
      const available = new Set(Object.values(sources))
      const pending = stringValues(stored[pendingUrlsKey])
      // A newly saved bookmark reusing an old URL starts a new source lifetime.
      for (const url of available)
        delete pending[url]
      for (const [id, oldUrl] of Object.entries(stringValues(stored[bookmarkGroupSourcesKey]))) {
        if (typeof oldUrl === 'string' && sources[id] && oldUrl !== sources[id] && !available.has(oldUrl))
          pending[oldUrl] = sources[id]
      }
      // Persist before advancing the native snapshot: failed/partial sync writes
      // can be retried on the next event or on reopening the home page.
      await chrome.storage.local.set({ [bookmarkGroupSourcesKey]: sources, [pendingUrlsKey]: pending })
      const changes: Record<string, unknown> = {}
      for (const group of decodeBookmarkGroups(values)) {
        let changed = false
        const bookmarks = group.bookmarks.map((member) => {
          let url = member.url
          const seen = new Set<string>()
          while (!available.has(url) && typeof pending[url] === 'string' && !seen.has(url)) {
            seen.add(url)
            url = pending[url]
          }
          if (url !== member.url && available.has(url)) {
            changed = true
            return { ...member, url }
          }
          return member
        })
        if (!changed)
          continue
        const next = parseBookmarkGroup({ ...group, bookmarks })!
        Object.assign(changes, encodeBookmarkGroup(next, crypto.randomUUID()))
      }
      if (!Object.keys(changes).length)
        return
      await writeGroupChanges(values, changes)
      refreshRevision += 1
      set({ groups: decodeBookmarkGroups({ ...values, ...changes }, await cachedGroupFallback(get().groups)), error: false })
      await cacheGroups(get().groups)
    })
  },
  migrateUrl: async (oldUrl, newUrl) => {
    if (!oldUrl || oldUrl === newUrl)
      return
    // The same migration may be observed by multiple open home pages.
    await withGroupLock(async () => {
      const values = await chrome.storage.sync.get(null)
      if (chrome.storage.local) {
        const stored = await chrome.storage.local.get(pendingUrlsKey)
        await chrome.storage.local.set({ [pendingUrlsKey]: { ...stringValues(stored[pendingUrlsKey]), [oldUrl]: newUrl } })
      }
      const groups = decodeBookmarkGroups(values)
      const changes: Record<string, unknown> = {}
      for (const group of groups) {
        if (!group.bookmarks.some(member => member.url === oldUrl))
          continue
        const next = parseBookmarkGroup({
          ...group,
          bookmarks: group.bookmarks.map(member => member.url === oldUrl ? { ...member, url: newUrl } : member),
        })
        if (next) {
          Object.assign(changes, encodeBookmarkGroup(next, crypto.randomUUID()))
        }
      }
      if (!Object.keys(changes).length)
        return
      await writeGroupChanges(values, changes)
      refreshRevision += 1
      set({ groups: decodeBookmarkGroups({ ...values, ...changes }, await cachedGroupFallback(get().groups)), error: false })
      await cacheGroups(get().groups)
    })
  },
}))
