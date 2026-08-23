import type { Bookmark, Category } from './types'

const zhPinyinCollator
  = typeof Intl !== 'undefined' && Intl.Collator
    ? new Intl.Collator('zh-Hans-CN-u-co-pinyin')
    : null

const PINYIN_BOUNDARIES = [
  ['阿', 'a'],
  ['芭', 'b'],
  ['擦', 'c'],
  ['搭', 'd'],
  ['蛾', 'e'],
  ['发', 'f'],
  ['噶', 'g'],
  ['哈', 'h'],
  ['击', 'j'],
  ['喀', 'k'],
  ['垃', 'l'],
  ['妈', 'm'],
  ['拿', 'n'],
  ['哦', 'o'],
  ['啪', 'p'],
  ['期', 'q'],
  ['然', 'r'],
  ['撒', 's'],
  ['塌', 't'],
  ['挖', 'w'],
  ['昔', 'x'],
  ['压', 'y'],
  ['匝', 'z'],
] as const

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[_./:#?=&+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactText(value: string): string {
  return normalizeText(value).replace(/\s+/g, '')
}

const pinyinCharCache = new Map<string, string>()

function pinyinInitial(char: string): string {
  if (/^[a-z\d]$/i.test(char))
    return char.toLowerCase()
  if (!zhPinyinCollator || !/[\u4E00-\u9FFF]/.test(char))
    return ''

  const cached = pinyinCharCache.get(char)
  if (cached !== undefined)
    return cached

  let initial = ''
  for (const [boundary, value] of PINYIN_BOUNDARIES) {
    if (zhPinyinCollator.compare(char, boundary) >= 0) {
      initial = value
    }
    else {
      break
    }
  }
  pinyinCharCache.set(char, initial)
  return initial
}

function pinyinInitials(value: string): string {
  return Array.from(value).map(pinyinInitial).join('')
}

function hostFor(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  }
  catch {
    try {
      return new URL(`https://${value}`).hostname.replace(/^www\./, '')
    }
    catch {
      return ''
    }
  }
}

function fuzzyMatch(value: string, token: string): boolean {
  const text = normalizeText(value)
  return fuzzyMatchNormalized(text, token)
}

function fuzzyMatchNormalized(text: string, token: string): boolean {
  if (text.includes(token))
    return true

  let index = 0
  for (const char of text) {
    if (char === token[index])
      index += 1
    if (index === token.length)
      return true
  }
  return false
}

interface PreparedField {
  text: string
  compact: string
  initials: string
  weight: number
}

export interface BookmarkSearchEntry {
  bookmark: Bookmark
  categoryPathLabel: string
  tags: PreparedField[]
  primaryHost: PreparedField
  alternateHosts: PreparedField[]
  fields: PreparedField[]
}

function prepareField(value: string, weight: number): PreparedField {
  return {
    text: normalizeText(value),
    compact: compactText(value),
    initials: pinyinInitials(value),
    weight,
  }
}

function preparedFieldScore(field: PreparedField, token: string): number {
  const compactToken = compactText(token)
  if (field.text === token)
    return field.weight * 4
  if (field.text.startsWith(token))
    return field.weight * 3
  if (field.text.includes(token))
    return field.weight * 2
  if (field.compact && field.compact === compactToken)
    return field.weight * 3.5
  if (field.compact && field.compact.startsWith(compactToken))
    return field.weight * 2.8
  if (field.compact && field.compact.includes(compactToken))
    return field.weight * 1.8
  if (field.initials && field.initials === compactToken)
    return field.weight * 3.2
  if (field.initials && field.initials.startsWith(compactToken))
    return field.weight * 2.6
  if (field.initials && fuzzyMatchNormalized(field.initials, compactToken))
    return field.weight * 1.4
  return fuzzyMatchNormalized(field.text, token) ? field.weight : 0
}

export function createBookmarkSearchEntry(
  bookmark: Bookmark,
  categoryPath: string[],
): BookmarkSearchEntry {
  const categoryPathLabel = categoryPath.join(' / ')
  const tags = (bookmark.tags ?? []).map(tag => prepareField(tag, 100))
  const primaryHost = prepareField(hostFor(bookmark.url), 100)
  const alternateHosts = (bookmark.alternateUrls ?? []).map(url =>
    prepareField(hostFor(url), 80))
  const fields = [
    prepareField(bookmark.name, 100),
    prepareField(hostFor(bookmark.url), 80),
    prepareField(bookmark.url, 55),
    ...(bookmark.alternateUrls ?? []).flatMap(value => [
      prepareField(hostFor(value), 60),
      prepareField(value, 45),
    ]),
    prepareField(categoryPathLabel, 50),
    prepareField((bookmark.tags ?? []).join(' '), 70),
    prepareField(bookmark.description ?? '', 20),
  ]
  return { bookmark, categoryPathLabel, tags, primaryHost, alternateHosts, fields }
}

export function bookmarkSearchEntryScore(entry: BookmarkSearchEntry, query: string): number {
  const rawTokens = rawTokensFor(query)
  if (rawTokens.length === 0)
    return 0
  let total = 0
  for (const rawToken of rawTokens) {
    const token = normalizeText(rawToken)
    if (!token)
      continue
    if (rawToken.startsWith('tag:')) {
      const tagToken = normalizeText(rawToken.slice(4))
      const best = Math.max(...entry.tags.map(tag => preparedFieldScore(tag, tagToken)), 0)
      if (best === 0)
        return -1
      total += best + 100
      continue
    }
    if (rawToken.startsWith('site:')) {
      const siteToken = normalizeText(rawToken.slice(5))
      const best = Math.max(
        preparedFieldScore(entry.primaryHost, siteToken),
        ...entry.alternateHosts.map(host => preparedFieldScore(host, siteToken)),
      )
      if (best === 0)
        return -1
      total += best + 80
      continue
    }
    if (rawToken.startsWith('folder:')) {
      const best = preparedFieldScore(
        prepareField(entry.categoryPathLabel, 100),
        normalizeText(rawToken.slice(7)),
      )
      if (best === 0)
        return -1
      total += best + 60
      continue
    }
    const best = Math.max(...entry.fields.map(field => preparedFieldScore(field, token)))
    if (best === 0)
      return -1
    total += best
  }
  return total
}

function fieldScore(value: string, token: string, weight: number): number {
  const text = normalizeText(value)
  const compact = compactText(value)
  const initials = pinyinInitials(value)
  const compactToken = compactText(token)

  if (text === token)
    return weight * 4
  if (text.startsWith(token))
    return weight * 3
  if (text.includes(token))
    return weight * 2
  if (compact && compact === compactToken)
    return weight * 3.5
  if (compact && compact.startsWith(compactToken))
    return weight * 2.8
  if (compact && compact.includes(compactToken))
    return weight * 1.8
  if (initials && initials === compactToken)
    return weight * 3.2
  if (initials && initials.startsWith(compactToken))
    return weight * 2.6
  if (initials && fuzzyMatch(initials, compactToken))
    return weight * 1.4
  return fuzzyMatch(text, token) ? weight : 0
}

function rawTokensFor(query: string): string[] {
  return query.toLowerCase().trim().split(/\s+/).filter(Boolean)
}

export function bookmarkSearchScore(
  bookmark: Bookmark,
  query: string,
  categoryPath: string[],
): number {
  return bookmarkSearchEntryScore(
    createBookmarkSearchEntry(bookmark, categoryPath),
    query,
  )
}

export function categorySearchScore(
  category: Category,
  query: string,
  categoryPath: string[],
): number {
  const rawTokens = rawTokensFor(query)
  if (rawTokens.length === 0)
    return 0
  const parentPath = categoryPath.slice(0, -1).join(' / ')
  let total = 0
  for (const rawToken of rawTokens) {
    const token = normalizeText(rawToken)
    if (!token)
      continue
    if (rawToken.startsWith('tag:') || rawToken.startsWith('site:')) {
      return -1
    }
    if (rawToken.startsWith('folder:')) {
      const best = fieldScore(categoryPath.join(' / '), rawToken.slice(7), 100)
      if (best === 0)
        return -1
      total += best
      continue
    }
    const best = Math.max(
      fieldScore(category.name, token, 100),
      fieldScore(parentPath, token, 40),
    )
    if (best === 0)
      return -1
    total += best
  }
  return total
}
