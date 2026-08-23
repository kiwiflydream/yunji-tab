import type {
  AutoOrganizeField,
  AutoOrganizeOperator,
  AutoOrganizeRule,
  Bookmark,
  Category,
} from './types'

export const AUTO_ORGANIZE_FIELDS: AutoOrganizeField[] = [
  'name',
  'url',
  'domain',
  'description',
  'tag',
]

export const AUTO_ORGANIZE_OPERATORS: AutoOrganizeOperator[] = [
  'contains',
  'equals',
  'startsWith',
]

export interface AutoOrganizePatch {
  categoryId?: string
  tags?: string[]
  inboxAt?: number
}

export interface AutoOrganizePreviewItem {
  bookmark: Bookmark
  rule: AutoOrganizeRule
  patch: AutoOrganizePatch
}

function parseTags(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.flatMap((tag) => {
        const normalized = `${tag}`.trim()
        return normalized ? [normalized] : []
      }))].slice(0, 12)
    : []
}

export function normalizeAutoOrganizeRules(value: unknown): AutoOrganizeRule[] {
  if (!Array.isArray(value))
    return []
  return value.flatMap((candidate) => {
    if (typeof candidate !== 'object' || candidate === null)
      return []
    const item = candidate as Partial<AutoOrganizeRule>
    const field = AUTO_ORGANIZE_FIELDS.includes(item.field as AutoOrganizeField)
      ? item.field as AutoOrganizeField
      : 'url'
    const operator = AUTO_ORGANIZE_OPERATORS.includes(item.operator as AutoOrganizeOperator)
      ? item.operator as AutoOrganizeOperator
      : 'contains'
    const value = item.value?.trim()
    if (!value)
      return []
    return [{
      id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
      name: item.name?.trim() || value,
      enabled: item.enabled !== false,
      field,
      operator,
      value,
      targetCategoryId: item.targetCategoryId?.trim() || undefined,
      addTags: parseTags(item.addTags),
      clearInbox: item.clearInbox === true,
    }]
  }).slice(0, 50)
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  }
  catch {
    return ''
  }
}

function valuesForField(bookmark: Bookmark, field: AutoOrganizeField): string[] {
  switch (field) {
    case 'name':
      return [bookmark.name]
    case 'url':
      return [bookmark.url]
    case 'domain':
      return [getDomain(bookmark.url)]
    case 'description':
      return [bookmark.description ?? '']
    case 'tag':
      return bookmark.tags ?? []
    default:
      return []
  }
}

function matchesValue(source: string, operator: AutoOrganizeOperator, expected: string): boolean {
  const normalizedSource = source.trim().toLowerCase()
  const normalizedExpected = expected.trim().toLowerCase()
  if (!normalizedSource || !normalizedExpected)
    return false
  if (operator === 'equals')
    return normalizedSource === normalizedExpected
  if (operator === 'startsWith')
    return normalizedSource.startsWith(normalizedExpected)
  return normalizedSource.includes(normalizedExpected)
}

export function autoOrganizeRuleMatches(bookmark: Bookmark, rule: AutoOrganizeRule): boolean {
  if (!rule.enabled)
    return false
  return valuesForField(bookmark, rule.field)
    .some(value => matchesValue(value, rule.operator, rule.value))
}

export function createAutoOrganizePatch(
  bookmark: Bookmark,
  rule: AutoOrganizeRule,
  categories: Category[],
): AutoOrganizePatch {
  const patch: AutoOrganizePatch = {}
  if (rule.targetCategoryId && categories.some(category => category.id === rule.targetCategoryId))
    patch.categoryId = rule.targetCategoryId
  if (rule.addTags.length > 0) {
    const tags = [...new Set([...(bookmark.tags ?? []), ...rule.addTags])]
    if (tags.join('\n') !== (bookmark.tags ?? []).join('\n'))
      patch.tags = tags
  }
  if (rule.clearInbox && bookmark.inboxAt)
    patch.inboxAt = 0
  return patch
}

export function previewAutoOrganizeRules(
  bookmarks: Bookmark[],
  rules: AutoOrganizeRule[],
  categories: Category[],
): AutoOrganizePreviewItem[] {
  const normalizedRules = normalizeAutoOrganizeRules(rules).filter(rule => rule.enabled)
  return bookmarks.flatMap((bookmark) => {
    const patch: AutoOrganizePatch = {}
    let matchedRule: AutoOrganizeRule | undefined
    for (const rule of normalizedRules) {
      if (!autoOrganizeRuleMatches(bookmark, rule))
        continue
      matchedRule ??= rule
      Object.assign(patch, createAutoOrganizePatch(
        { ...bookmark, ...patch },
        rule,
        categories,
      ))
    }
    return matchedRule && Object.keys(patch).length > 0
      ? [{ bookmark, rule: matchedRule, patch }]
      : []
  })
}
