import type { BookmarkUsage } from './types'

export type BookmarkUsageMap = Record<string, BookmarkUsage>

export function mergeBookmarkUsageMaps(
  ...maps: Array<BookmarkUsageMap | null | undefined>
): BookmarkUsageMap {
  const merged: BookmarkUsageMap = {}
  for (const map of maps) {
    for (const [url, usage] of Object.entries(map ?? {})) {
      const current = merged[url]
      merged[url] = current
        ? {
            openCount: Math.max(current.openCount, usage.openCount),
            lastOpenedAt: Math.max(
              current.lastOpenedAt,
              usage.lastOpenedAt,
            ),
          }
        : { ...usage }
    }
  }
  return merged
}

function addUsageDeltas(base: BookmarkUsageMap, deltas: BookmarkUsageMap): BookmarkUsageMap {
  const usage = { ...base }
  for (const [url, delta] of Object.entries(deltas)) {
    usage[url] = {
      openCount: (usage[url]?.openCount ?? 0) + delta.openCount,
      lastOpenedAt: Math.max(usage[url]?.lastOpenedAt ?? 0, delta.lastOpenedAt),
    }
  }
  return usage
}

interface UsagePersistenceOptions {
  read: () => Promise<BookmarkUsageMap | undefined>
  write: (usage: BookmarkUsageMap) => Promise<void>
  withLock: <T>(commit: () => Promise<T>) => Promise<T>
  onChange: (usage: BookmarkUsageMap) => void
}

// Each page owns only its uncommitted increments. A shared lock protects the
// read/add/write transaction, including two pages opening the same URL.
export function createBookmarkUsagePersistence(options: UsagePersistenceOptions) {
  let pending: BookmarkUsageMap = {}
  let pendingMigrations: Array<[string, string]> = []
  const hasPending = () => Object.keys(pending).length > 0 || pendingMigrations.length > 0
  const migrate = (usage: BookmarkUsageMap, migrations: Array<[string, string]>) => {
    const next = { ...usage }
    for (const [from, to] of migrations) {
      if (from === to || !next[from])
        continue
      next[to] = {
        openCount: (next[to]?.openCount ?? 0) + next[from].openCount,
        lastOpenedAt: Math.max(next[to]?.lastOpenedAt ?? 0, next[from].lastOpenedAt),
      }
      delete next[from]
    }
    return next
  }
  const commit = (
    update: (usage: BookmarkUsageMap) => BookmarkUsageMap,
    onlyPending = false,
  ) =>
    options.withLock(async () => {
      if (onlyPending && !hasPending())
        return
      const batch = pending
      const migrations = pendingMigrations
      pending = {}
      pendingMigrations = []
      let usage: BookmarkUsageMap
      try {
        usage = update(migrate(addUsageDeltas(await options.read() ?? {}, batch), migrations))
        await options.write(usage)
      }
      catch (cause) {
        pending = addUsageDeltas(pending, batch)
        pendingMigrations = [...migrations, ...pendingMigrations]
        throw cause
      }
      // Opens recorded during the write belong to the next batch.
      pending = migrate(pending, migrations)
      options.onChange(addUsageDeltas(usage, pending))
    })
  return {
    hasPending,
    record(url: string, openedAt: number) {
      pending = addUsageDeltas(pending, { [url]: { openCount: 1, lastOpenedAt: openedAt } })
    },
    flush: () => commit(usage => usage, true),
    update: (update: (usage: BookmarkUsageMap) => BookmarkUsageMap) => commit(update),
    migrate(from: string, to: string) {
      pendingMigrations.push([from, to])
      return commit(usage => usage)
    },
    refresh: () => options.withLock(async () => {
      options.onChange(migrate(addUsageDeltas(await options.read() ?? {}, pending), pendingMigrations))
    }),
  }
}
