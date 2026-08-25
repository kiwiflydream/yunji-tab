import type { Category, SearchEngine } from './types'

export const DEFAULT_CATEGORY_EMOJI = '📁'

// 虚拟分类：代表"全部书签"，由 UI 层固定渲染，不存入数据层
export const ALL_CATEGORY: Category = {
  id: 'all',
  name: '全部',
  emoji: '🌐',
  parentId: 'all',
  modifiable: false,
}

export const FREQUENT_CATEGORY: Category = {
  id: 'frequent',
  name: '常用',
  emoji: '⭐',
  parentId: 'all',
  modifiable: false,
}

export const RECENT_CATEGORY: Category = {
  id: 'recent',
  name: '最近',
  emoji: '🕘',
  parentId: 'all',
  modifiable: false,
}

export const INBOX_CATEGORY: Category = {
  id: 'inbox',
  name: '收件箱',
  emoji: '📥',
  parentId: 'all',
  modifiable: false,
}

export const PINNED_CATEGORY: Category = {
  id: 'pinned',
  name: '置顶',
  emoji: '📌',
  parentId: 'all',
  modifiable: false,
}

export const UNTAGGED_CATEGORY: Category = {
  id: 'untagged',
  name: '无标签',
  emoji: '🏷️',
  parentId: 'all',
  modifiable: false,
}

export const UNDESCRIBED_CATEGORY: Category = {
  id: 'undescribed',
  name: '无描述',
  emoji: '📝',
  parentId: 'all',
  modifiable: false,
}

export const VIRTUAL_CATEGORIES = [
  ALL_CATEGORY,
  INBOX_CATEGORY,
  PINNED_CATEGORY,
  FREQUENT_CATEGORY,
  RECENT_CATEGORY,
  UNTAGGED_CATEGORY,
  UNDESCRIBED_CATEGORY,
] as const

export function isVirtualCategoryId(id: string): boolean {
  return VIRTUAL_CATEGORIES.some(category => category.id === id)
}

// 内置搜索引擎列表
export const searchEngines: SearchEngine[] = [
  {
    id: 'google',
    name: 'Google',
    url: 'https://www.google.com/search?q=%s',
    emoji: '🔍',
    keyword: 'g',
  },
  {
    id: 'bing',
    name: 'Bing',
    url: 'https://www.bing.com/search?q=%s',
    emoji: '🅱️',
    keyword: 'b',
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    url: 'https://duckduckgo.com/?q=%s',
    emoji: '🦆',
    keyword: 'ddg',
  },
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://github.com/search?q=%s',
    emoji: '🐙',
    keyword: 'gh',
  },
]
