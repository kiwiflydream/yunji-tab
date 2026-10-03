import type { Bookmark } from './types'
import { normalizeBookmarkUrl } from './bookmark-urls'

export interface BookmarkGroupMember {
  id?: string
  url: string
  title: string
}

export interface BookmarkGroup {
  id: string
  title: string
  description: string
  pinnedAt?: number
  bookmarks: BookmarkGroupMember[]
}

export const bookmarkGroupsKeyPrefix = 'yunji-tab:bookmark-group:'
const partBytes = 6000

export function parseBookmarkGroup(value: unknown): BookmarkGroup | undefined {
  if (!value || typeof value !== 'object')
    return undefined
  const candidate = value as Partial<BookmarkGroup>
  if (typeof candidate.id !== 'string' || !/^[\w-]{1,64}$/.test(candidate.id)
    || typeof candidate.title !== 'string' || !candidate.title.trim()
    || typeof candidate.description !== 'string' || !Array.isArray(candidate.bookmarks)) {
    return undefined
  }
  const bookmarks: BookmarkGroupMember[] = []
  const seen = new Set<string>()
  const memberIds = new Set<string>()
  for (const item of candidate.bookmarks) {
    if (!item || typeof item.url !== 'string' || typeof item.title !== 'string')
      return undefined
    const url = normalizeBookmarkUrl(item.url)
    if (!url || !item.title.trim())
      return undefined
    if (!seen.has(url)) {
      const memberId = typeof item.id === 'string' && item.id ? item.id : url
      if (memberIds.has(memberId))
        return undefined
      memberIds.add(memberId)
      bookmarks.push({ id: memberId, url, title: item.title.trim() })
      seen.add(url)
    }
  }
  if (!bookmarks.length)
    return undefined
  return {
    id: candidate.id,
    title: candidate.title.trim(),
    description: candidate.description.trim(),
    ...(Number.isSafeInteger(candidate.pinnedAt) && candidate.pinnedAt! > 0 ? { pinnedAt: candidate.pinnedAt } : {}),
    bookmarks,
  }
}

export function groupManifestKey(id: string): string {
  return `${bookmarkGroupsKeyPrefix}${id}`
}

// Versioned part keys keep incomplete incoming sync generations from replacing
// a complete group. Each part stays below Chrome's 8 KB per-item limit in UTF-8.
export function encodeBookmarkGroup(group: BookmarkGroup, generation: string): Record<string, unknown> {
  const parts: string[] = []
  let part = ''
  let bytes = 0
  const encoder = new TextEncoder()
  for (const character of JSON.stringify(group)) {
    const size = encoder.encode(JSON.stringify(character).slice(1, -1)).length
    if (bytes + size > partBytes) {
      parts.push(part)
      part = ''
      bytes = 0
    }
    part += character
    bytes += size
  }
  parts.push(part)
  const key = groupManifestKey(group.id)
  return {
    ...Object.fromEntries(parts.map((value, index) => [`${key}:${generation}:${index}`, value])),
    [key]: { version: 1, generation, partCount: parts.length },
  }
}

export function decodeBookmarkGroups(
  values: Record<string, unknown>,
  previous: BookmarkGroup[] = [],
): BookmarkGroup[] {
  const groups: BookmarkGroup[] = []
  for (const [key, value] of Object.entries(values)) {
    if (!key.startsWith(bookmarkGroupsKeyPrefix) || key.slice(bookmarkGroupsKeyPrefix.length).includes(':'))
      continue
    const id = key.slice(bookmarkGroupsKeyPrefix.length)
    const manifest = value as { version?: number, generation?: string, partCount?: number } | null
    let group: BookmarkGroup | undefined
    if (manifest?.version === 1 && typeof manifest.generation === 'string'
      && /^[\w-]{1,64}$/.test(manifest.generation)
      && Number.isInteger(manifest.partCount) && manifest.partCount! > 0 && manifest.partCount! <= 512) {
      const parts = Array.from({ length: manifest.partCount! }, (_, index) =>
        values[`${key}:${manifest.generation}:${index}`])
      if (parts.every(part => typeof part === 'string')) {
        try {
          group = parseBookmarkGroup(JSON.parse(parts.join('')))
        }
        catch { /* Keep the last complete group while sync parts arrive. */ }
      }
    }
    const complete = group?.id === id ? group : previous.find(item => item.id === id)
    if (complete)
      groups.push(complete)
  }
  return groups.sort((a, b) => a.title.localeCompare(b.title))
}

export function resolveGroupBookmark(member: BookmarkGroupMember, bookmarks: Bookmark[]): Bookmark | undefined {
  return bookmarks.find(bookmark => normalizeBookmarkUrl(bookmark.url) === member.url)
}

export class BookmarkGroupCapacityError extends Error {}

// Reserve room for one replacement generation of every group, so a successful
// create does not immediately leave its next edit unable to fit in sync storage.
export function assertBookmarkGroupCapacity(values: Record<string, unknown>, changes: Record<string, unknown>): void {
  const ids = Object.keys(changes).filter(key => key.startsWith(bookmarkGroupsKeyPrefix) && !key.slice(bookmarkGroupsKeyPrefix.length).includes(':'))
  const steady = Object.fromEntries(Object.entries(values).filter(([key]) => !ids.some(id => key.startsWith(`${id}:`))))
  Object.assign(steady, changes)
  const encoder = new TextEncoder()
  let totalBytes = 0
  let groupBytes = 0
  let groupKeys = 0
  for (const [key, value] of Object.entries(steady)) {
    const bytes = encoder.encode(key + JSON.stringify(value)).length
    totalBytes += bytes
    if (key.startsWith(bookmarkGroupsKeyPrefix)) {
      groupBytes += bytes
      groupKeys += 1
    }
  }
  if (totalBytes + groupBytes > 102400 || Object.keys(steady).length + groupKeys > 512)
    throw new BookmarkGroupCapacityError('sync capacity reserved for editable groups')
}

export function mergeGroupMembers(latest: BookmarkGroupMember[], submitted: BookmarkGroupMember[], baseline?: BookmarkGroupMember[]): BookmarkGroupMember[] {
  if (!baseline)
    return submitted.map(member => ({ ...member, url: latest.find(item => item.id === member.id)?.url ?? member.url }))
  const before = new Map(baseline.map(member => [member.id, member]))
  const after = new Map(submitted.map(member => [member.id, member]))
  const retained = latest.filter(member => !before.has(member.id) || after.has(member.id)).map((member) => {
    const original = before.get(member.id)
    const edit = after.get(member.id)
    return original && edit && edit.title !== original.title ? { ...member, title: edit.title } : member
  })
  const additions = submitted.filter(member => !before.has(member.id))
  const commonBefore = baseline.filter(member => after.has(member.id)).map(member => member.id)
  const commonAfter = submitted.filter(member => before.has(member.id)).map(member => member.id)
  if (JSON.stringify(commonBefore) !== JSON.stringify(commonAfter)) {
    const byId = new Map([...retained, ...additions].map(member => [member.id, member]))
    const ordered = submitted.flatMap(member => byId.has(member.id) ? [byId.get(member.id)!] : [])
    return [...ordered, ...retained.filter(member => !after.has(member.id))]
  }
  return [...retained, ...additions]
}
