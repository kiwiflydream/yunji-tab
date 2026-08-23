import type { SearchEngine } from './types'
import { searchEngines } from './default-data'

export interface SearchIntent {
  engine: SearchEngine
  query: string
  usedKeyword: boolean
}

export function normalizeSearchKeyword(value: string): string {
  return value.trim().toLowerCase()
}

function isValidTemplate(value: string): boolean {
  if ((value.match(/%s/g) ?? []).length !== 1)
    return false
  try {
    const url = new URL(value.replace('%s', 'test'))
    return url.protocol === 'http:' || url.protocol === 'https:'
  }
  catch {
    return false
  }
}

export function validateCustomSearchEngine(
  input: Omit<SearchEngine, 'id'>,
  existing: SearchEngine[],
  editingId?: string,
): Omit<SearchEngine, 'id'> {
  const name = input.name.trim()
  const keyword = normalizeSearchKeyword(input.keyword)
  const url = input.url.trim()
  const emoji = input.emoji.trim() || '🔎'
  if (!name)
    throw new Error('search_engine.name_required')
  if (name.length > 40)
    throw new Error('search_engine.name_too_long')
  if (!/^[a-z0-9_-]{1,16}$/.test(keyword)) {
    throw new Error('search_engine.invalid_keyword')
  }
  if (!isValidTemplate(url)) {
    throw new Error('search_engine.invalid_url_template')
  }
  if (url.length > 2_000)
    throw new Error('search_engine.url_too_long')
  if (emoji.length > 8)
    throw new Error('search_engine.icon_too_long')
  const keywordTaken = [...searchEngines, ...existing].some(
    engine =>
      engine.id !== editingId
      && normalizeSearchKeyword(engine.keyword) === keyword,
  )
  if (keywordTaken)
    throw new Error('search_engine.keyword_conflict')
  return { name, keyword, url, emoji }
}

export function normalizeCustomSearchEngines(values: unknown): SearchEngine[] {
  if (!Array.isArray(values))
    return []
  const normalized: SearchEngine[] = []
  for (const candidate of values) {
    if (!candidate || typeof candidate !== 'object')
      continue
    const value = candidate as Partial<SearchEngine>
    if (typeof value.id !== 'string' || !value.id.startsWith('custom-')) {
      continue
    }
    try {
      const engine = validateCustomSearchEngine(
        {
          name: typeof value.name === 'string' ? value.name : '',
          keyword: typeof value.keyword === 'string' ? value.keyword : '',
          url: typeof value.url === 'string' ? value.url : '',
          emoji: typeof value.emoji === 'string' ? value.emoji : '',
        },
        normalized,
        value.id,
      )
      normalized.push({ id: value.id, ...engine })
    }
    catch {
      // 跳过损坏或冲突的同步配置，避免阻塞设置初始化。
    }
  }
  return normalized
}

export function getAvailableSearchEngines(
  customSearchEngines: SearchEngine[],
): SearchEngine[] {
  return [...searchEngines, ...customSearchEngines]
}

export function resolveSearchIntent(
  value: string,
  engines: SearchEngine[],
  defaultEngineId: string,
): SearchIntent {
  const trimmed = value.trim()
  const [prefix, ...rest] = trimmed.split(/\s+/)
  const keywordEngine
    = rest.length > 0
      ? engines.find(
          engine =>
            normalizeSearchKeyword(engine.keyword)
            === normalizeSearchKeyword(prefix),
        )
      : undefined
  const defaultEngine
    = engines.find(engine => engine.id === defaultEngineId) ?? engines[0]
  return {
    engine: keywordEngine ?? defaultEngine,
    query: keywordEngine ? rest.join(' ') : trimmed,
    usedKeyword: Boolean(keywordEngine),
  }
}
