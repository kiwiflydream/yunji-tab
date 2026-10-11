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
  categoryPathField: PreparedField
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
  return {
    bookmark,
    categoryPathLabel,
    categoryPathField: prepareField(categoryPathLabel, 100),
    tags,
    primaryHost,
    alternateHosts,
    fields,
  }
}

export type CompiledBookmarkSearchToken
  = | { kind: 'token', token: string, compact: string }
    | { kind: 'tag', token: string, compact: string }
    | { kind: 'site', token: string, compact: string }
    | { kind: 'folder', token: string, compact: string }

export interface CompiledBookmarkSearchQuery {
  query: string
  tokens: CompiledBookmarkSearchToken[]
}

const MAX_COMPILED_QUERY_CACHE_ENTRIES = 64
const compiledQueryCache = new Map<string, CompiledBookmarkSearchQuery>()

/**
 * 解析查询并按 token 预计算归一化/紧凑形态，供同一查询在大量 entry 上复用，
 * 避免在每个 entry、每个字段里重复做 normalize/compact。
 */
export function compileBookmarkSearchQuery(
  query: string,
): CompiledBookmarkSearchQuery {
  const cached = compiledQueryCache.get(query)
  if (cached)
    return cached

  const tokens: CompiledBookmarkSearchToken[] = []
  for (const rawToken of rawTokensFor(query)) {
    if (rawToken.startsWith('tag:')) {
      const subject = rawToken.slice(4)
      tokens.push({
        kind: 'tag',
        token: normalizeText(subject),
        compact: compactText(subject),
      })
      continue
    }
    if (rawToken.startsWith('site:')) {
      const subject = rawToken.slice(5)
      tokens.push({
        kind: 'site',
        token: normalizeText(subject),
        compact: compactText(subject),
      })
      continue
    }
    if (rawToken.startsWith('folder:')) {
      const subject = rawToken.slice(7)
      tokens.push({
        kind: 'folder',
        token: normalizeText(subject),
        compact: compactText(subject),
      })
      continue
    }
    tokens.push({
      kind: 'token',
      token: normalizeText(rawToken),
      compact: compactText(rawToken),
    })
  }

  const compiled: CompiledBookmarkSearchQuery = { query, tokens }
  if (compiledQueryCache.size >= MAX_COMPILED_QUERY_CACHE_ENTRIES) {
    const oldest = compiledQueryCache.keys().next().value
    if (oldest !== undefined)
      compiledQueryCache.delete(oldest)
  }
  compiledQueryCache.set(query, compiled)
  return compiled
}

export function bookmarkSearchEntryScore(
  entry: BookmarkSearchEntry,
  query: string,
): number {
  return bookmarkSearchEntryScoreCompiled(
    entry,
    compileBookmarkSearchQuery(query),
  )
}

export function bookmarkSearchEntryScoreCompiled(
  entry: BookmarkSearchEntry,
  compiled: CompiledBookmarkSearchQuery,
): number {
  const { tokens } = compiled
  if (tokens.length === 0)
    return 0
  let total = 0
  for (const token of tokens) {
    // 与旧实现保持一致：归一化后为空的 token 直接跳过。
    if (!token.token && token.kind === 'token')
      continue
    if (token.kind === 'tag') {
      const best = Math.max(
        ...entry.tags.map(tag => preparedFieldScoreCompiled(tag, token)),
        0,
      )
      if (best === 0)
        return -1
      total += best + 100
      continue
    }
    if (token.kind === 'site') {
      const best = Math.max(
        preparedFieldScoreCompiled(entry.primaryHost, token),
        ...entry.alternateHosts.map(host =>
          preparedFieldScoreCompiled(host, token)),
      )
      if (best === 0)
        return -1
      total += best + 80
      continue
    }
    if (token.kind === 'folder') {
      const best = preparedFieldScoreCompiled(entry.categoryPathField, token)
      if (best === 0)
        return -1
      total += best + 60
      continue
    }
    const best = Math.max(
      ...entry.fields.map(field => preparedFieldScoreCompiled(field, token)),
    )
    if (best === 0)
      return -1
    total += best
  }
  return total
}

/**
 * 统计命中的 entry 数量。第一遍编译查询，随后在整组 entry 上复用，
 * 供导航里的 savedSearch 计数在 stable derive 上缓存复用。
 */
export function countMatchingSearchEntries(
  entries: readonly BookmarkSearchEntry[],
  query: string,
): number {
  const compiled = compileBookmarkSearchQuery(query)
  let count = 0
  for (const entry of entries) {
    if (bookmarkSearchEntryScoreCompiled(entry, compiled) >= 0)
      count += 1
  }
  return count
}

function preparedFieldScoreCompiled(
  field: PreparedField,
  token: CompiledBookmarkSearchToken,
): number {
  const { token: text, compact: compactToken } = token
  if (field.text === text)
    return field.weight * 4
  if (field.text.startsWith(text))
    return field.weight * 3
  if (field.text.includes(text))
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
  return fuzzyMatchNormalized(field.text, text) ? field.weight : 0
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
