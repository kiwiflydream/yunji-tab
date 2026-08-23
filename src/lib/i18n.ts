import type { Language } from './types'
import { activityMessages } from './i18n-activity'
import { aiMessages } from './i18n-ai'
import { appearanceMessages } from './i18n-appearance'
import { autoOrganizeMessages } from './i18n-auto-organize'
import { bookmarkHealthMessages } from './i18n-bookmark-health'
import { bookmarkManagementMessages } from './i18n-bookmark-management'
import { commandPaletteMessages } from './i18n-command-palette'
import { dragDropMessages } from './i18n-drag-drop'
import { extraLocaleMessages } from './i18n-extra-locales'
import { keyboardShortcutMessages } from './i18n-keyboard-shortcuts'
import { runtimeMessages } from './i18n-runtime'
import { searchEngineMessages } from './i18n-search-engine'
import { settingsDataMessages } from './i18n-settings-data'
import { settingsSyncMessages } from './i18n-settings-sync'
import { tabSessionsMessages } from './i18n-tab-sessions'

export {
  getBrowserLanguage,
  isLanguage,
  loadPreferredLanguage,
  resolveBrowserLanguage,
} from './language'

const zhCN = {
  ...aiMessages['zh-CN'],
  brandName: '云吉 Tab',
  language: '语言',
  languageDescription: '选择云吉 Tab 的界面语言，修改后立即生效。',
  chinese: '中文',
  english: 'English',
  settings: '设置',
  openSettings: '打开设置',
  settingsDescription: '调整主页体验、搜索、内容补全与数据管理。',
  close: '关闭',
  general: '常规',
  appearance: '外观',
  search: '搜索',
  contentEnhancement: '内容补全',
  dataAndPrivacy: '数据与隐私',
  about: '关于',
  aboutDescription: '云吉 Tab 是由 kiwi 构建的免费开源项目。',
  projectRepository: '查看项目源码',
  followKiwi: '在 X 上关注 kiwi',
  settingsCategories: '设置分类',
  defaultFolder: '默认目录',
  defaultFolderDescription: '打开主页时默认展示的书签目录。',
  navigationAndCategories: '导航与分类',
  navigationAndCategoriesDescription:
    '调整分类入口的位置和主页中需要显示的导航内容。',
  sidebar: '左侧分类栏',
  topbar: '顶部分类栏',
  categoryBarPosition: '分类栏位置',
  showCounts: '显示数量',
  smartCategories: '智能分类',
  savedFilters: '保存筛选',
  categoryTree: '树状目录',
  categoryTreeHint: '树状目录仅在左侧分类栏生效，子目录可展开或折叠。',
  singleHomeTab: '只保留一个云吉 Tab 主页',
  singleHomeTabDescription:
    '开启后，再次打开主页会切换到已有标签；关闭时允许同时打开多个主页。',
  autoOrganizeRules: '高级：自动整理规则',
  bookmarkCount: '{count} 个书签',
  addBookmark: '添加书签',
  moreActions: '更多操作',
  managementTools: '管理工具',
  bookmarkHealth: '书签健康检查',
  openBookmarkHealth: '打开书签健康检查',
  trashAndHistory: '垃圾桶与历史',
  openTrashAndHistory: '打开垃圾桶与历史',
  taskCenter: '任务中心',
  openTaskCenter: '打开任务中心',
  tabSessions: '标签页会话',
  manageTabSessions: '管理标签页会话',
  preferences: '偏好设置',
  searchOrEnterUrl: '搜索或输入网址',
  searchScope: '搜索范围',
  bookmarks: '书签',
  web: '网页',
  searchBookmarks: '搜索书签',
  searchWeb: '搜索网页',
  selectSearchEngine: '选择网页搜索引擎',
  searchBookmarksAndFolders: '搜索书签和目录',
  searchWebOrEnterUrl: '搜索网页或输入网址',
  enterUrlOrKeyword: '输入网址或 {keyword} 关键词',
  clearSearch: '清空搜索内容',
  openCommandPalette: '打开命令面板',
  openFirstBookmarkResult: '打开首个书签结果',
  openFirstResult: '打开首个结果',
  searchWithEngine: '使用 {engine} 搜索',
  all: '全部',
  inbox: '收件箱',
  pinned: '置顶',
  frequent: '常用',
  recent: '最近',
  untagged: '无标签',
  undescribed: '无描述',
  allBookmarks: '全部书签',
  searchResults: '“{query}”的搜索结果',
  itemCount: '{count} 个项目',
  bookmarkSort: '书签排序',
  nativeOrder: '原生顺序',
  byName: '按名称',
  recentlyAdded: '最近添加',
  byFrequency: '按常用',
  bookmarkView: '书签视图',
  cardView: '卡片视图',
  compactView: '紧凑视图',
  bulkManage: '批量管理',
  emptyCatLibrary: '喵～书签架还是空的',
  noMatches: '没有匹配的内容',
  smartViewEmptyCat: '打开书签后，猫咪会帮你记在这里',
  categoryEmptyCat: '这只猫还没找到内容',
  emptyLibrary: '浏览器书签为空',
  smartViewEmpty: '打开书签后会在这里留下记录',
  categoryEmpty: '该分类下没有内容',
  emptyLibraryCatDescription:
    '添加第一个书签，开始建立你的个人导航空间。猫咪已经准备好了。',
  emptyLibraryDescription: '添加第一个书签，开始建立你的个人导航空间。',
  noMatchesDescription: '试试更短的关键词，或者切换到其他目录。',
  quietCatDescription: '这里暂时很安静，换个分类看看吧。',
  quietDescription: '这里暂时很安静，稍后再回来看看。',
  meow: '喵',
  quickSave: '快速收藏',
  openHome: '打开云吉 Tab 主页',
  pageCannotBeSaved: '当前页面不能保存为书签',
  pageSaved: '已收藏当前页面',
  viewOnHome: '前往主页查看',
  pageAlreadySaved: '这个页面已经收藏',
  urlAlreadySaved: '这个网址已经收藏',
  locatedIn: '位于',
  existingFolder: '现有目录',
  openYunjiTab: '打开云吉 Tab',
  name: '名称',
  folder: '目录',
  optionalTags: '标签（可选）',
  tagsPlaceholder: '工作, 稍后阅读',
  saveCurrentPage: '收藏当前页面',
  cannotReadCurrentPage: '无法读取当前页面',
  saveFailed: '收藏失败，请确认书签权限可用',
  editBookmark: '编辑书签',
  editBookmarkDescription: '修改书签信息',
  addBookmarkDescription: '收藏一个常用网址到导航页',
  url: '网址',
  fetchSiteMetadata: '获取网站名称、描述和图标',
  fetchSiteInfo: '获取网站信息',
  mergeExistingBookmark: '合并到已有书签',
  namePlaceholder: '如：GitHub',
  category: '分类',
  typeOrSelect: '输入或选择',
  moreOptions: '更多选项',
  completedFieldCount: '{count} 项已填写',
  optionalAlternateUrls: '备用 URL（可选）',
  optionalDescription: '描述（可选）',
  descriptionPlaceholder: '一句话简介',
  optionalIcon: '图标（可选）',
  iconPlaceholder: '🐙 或图标 URL',
  cancel: '取消',
  save: '保存',
  addAnyway: '仍然添加',
  add: '添加',
  enterUrlFirst: '请先填写网址',
  sitePermissionRequired: '需要授权访问网站后才能获取网站信息',
  noSiteMetadata: '该网页没有可识别的名称、描述或图标',
  unknownError: '未知错误',
  fetchSiteMetadataFailed: '获取网站信息失败：{message}',
  enterNameAndUrl: '请填写名称和网址',
  duplicateNeedsChoice: '这个网址已经存在，请选择合并或仍然添加',
  invalidAlternateUrl: '备用 URL 仅支持 http:// 或 https://',
  openFolder: '打开目录 {name}',
  dragFolder: '拖动目录',
  dragNamedFolder: '拖动目录 {name}',
  editFolder: '编辑目录',
  editNamedFolder: '编辑目录 {name}',
  expandFolder: '展开目录 {name}',
  collapseFolder: '折叠目录 {name}',
  bookmarkCategories: '书签分类',
  folderBookmarkCount: '{count} 个书签',
  subfolderCount: '{count} 个子目录',
  deleteFailed: '删除失败',
  selectNamed: '选择 {name}',
  deselectNamed: '取消选择 {name}',
  locateIn: '定位到 {path}',
  pinNamed: '置顶 {name}',
  unpinNamed: '取消置顶 {name}',
  pinBookmark: '置顶书签',
  unpin: '取消置顶',
  dragToReorderOrMove: '拖动排序或移动目录',
  dragToFolder: '拖动到目录',
  dragBookmark: '拖动书签 {name}',
  moreActionsFor: '更多操作 {name}',
  editBookmarkAction: '编辑书签',
  deleteBookmark: '删除书签',
  ...activityMessages['zh-CN'],
  ...appearanceMessages['zh-CN'],
  ...autoOrganizeMessages['zh-CN'],
  ...bookmarkHealthMessages['zh-CN'],
  ...bookmarkManagementMessages['zh-CN'],
  ...commandPaletteMessages['zh-CN'],
  ...dragDropMessages['zh-CN'],
  ...keyboardShortcutMessages['zh-CN'],
  ...runtimeMessages['zh-CN'],
  ...searchEngineMessages['zh-CN'],
  ...settingsDataMessages['zh-CN'],
  ...settingsSyncMessages['zh-CN'],
  ...tabSessionsMessages['zh-CN'],
} as const

const en: Record<keyof typeof zhCN, string> = {
  ...aiMessages.en,
  brandName: 'Yunji Tab',
  language: 'Language',
  languageDescription:
    'Choose the Yunji Tab interface language. Changes apply immediately.',
  chinese: '中文',
  english: 'English',
  settings: 'Settings',
  openSettings: 'Open settings',
  settingsDescription:
    'Customize the home page, search, content enhancement, and data management.',
  close: 'Close',
  general: 'General',
  appearance: 'Appearance',
  search: 'Search',
  contentEnhancement: 'Content',
  dataAndPrivacy: 'Data & Privacy',
  about: 'About',
  aboutDescription:
    'Yunji Tab is a free and open-source project built by kiwi.',
  projectRepository: 'View source code',
  followKiwi: 'Follow kiwi on X',
  settingsCategories: 'Settings categories',
  defaultFolder: 'Default folder',
  defaultFolderDescription:
    'The bookmark folder shown when you open the home page.',
  navigationAndCategories: 'Navigation & categories',
  navigationAndCategoriesDescription:
    'Choose where categories appear and what navigation items are shown.',
  sidebar: 'Sidebar',
  topbar: 'Top bar',
  categoryBarPosition: 'Category bar position',
  showCounts: 'Show counts',
  smartCategories: 'Smart categories',
  savedFilters: 'Saved filters',
  categoryTree: 'Folder tree',
  categoryTreeHint:
    'The folder tree is available in the sidebar. Subfolders can be expanded or collapsed.',
  singleHomeTab: 'Keep one Yunji Tab home tab',
  singleHomeTabDescription:
    'When enabled, opening Yunji Tab again focuses the existing tab. Disable it to allow multiple home tabs.',
  autoOrganizeRules: 'Advanced: auto-organize rules',
  bookmarkCount: '{count} bookmarks',
  addBookmark: 'Add bookmark',
  moreActions: 'More actions',
  managementTools: 'Management tools',
  bookmarkHealth: 'Bookmark health',
  openBookmarkHealth: 'Open bookmark health',
  trashAndHistory: 'Trash & history',
  openTrashAndHistory: 'Open trash and history',
  taskCenter: 'Task center',
  openTaskCenter: 'Open task center',
  tabSessions: 'Tab sessions',
  manageTabSessions: 'Manage tab sessions',
  preferences: 'Preferences',
  searchOrEnterUrl: 'Search or enter an address',
  searchScope: 'Search scope',
  bookmarks: 'Bookmarks',
  web: 'Web',
  searchBookmarks: 'Search bookmarks',
  searchWeb: 'Search the web',
  selectSearchEngine: 'Choose a web search engine',
  searchBookmarksAndFolders: 'Search bookmarks and folders',
  searchWebOrEnterUrl: 'Search the web or enter an address',
  enterUrlOrKeyword: 'Enter an address or {keyword} keywords',
  clearSearch: 'Clear search',
  openCommandPalette: 'Open command palette',
  openFirstBookmarkResult: 'Open the first bookmark result',
  openFirstResult: 'Open the first result',
  searchWithEngine: 'Search with {engine}',
  all: 'All',
  inbox: 'Inbox',
  pinned: 'Pinned',
  frequent: 'Frequent',
  recent: 'Recent',
  untagged: 'Untagged',
  undescribed: 'No description',
  allBookmarks: 'All bookmarks',
  searchResults: 'Results for “{query}”',
  itemCount: '{count} items',
  bookmarkSort: 'Bookmark sorting',
  nativeOrder: 'Browser order',
  byName: 'Name',
  recentlyAdded: 'Recently added',
  byFrequency: 'Most used',
  bookmarkView: 'Bookmark view',
  cardView: 'Card view',
  compactView: 'Compact view',
  bulkManage: 'Bulk manage',
  emptyCatLibrary: 'The bookmark shelf is empty',
  noMatches: 'No matches found',
  smartViewEmptyCat: 'Open bookmarks and the cat will remember them here',
  categoryEmptyCat: 'This cat has not found anything yet',
  emptyLibrary: 'Your browser bookmarks are empty',
  smartViewEmpty: 'Opened bookmarks will appear here',
  categoryEmpty: 'There is nothing in this category',
  emptyLibraryCatDescription:
    'Add your first bookmark to start building a personal home page. The cat is ready.',
  emptyLibraryDescription:
    'Add your first bookmark to start building your personal home page.',
  noMatchesDescription: 'Try a shorter keyword or switch to another folder.',
  quietCatDescription: 'It is quiet here. Try another category.',
  quietDescription: 'It is quiet here. Check back later.',
  meow: 'Meow',
  quickSave: 'Quick save',
  openHome: 'Open Yunji Tab home',
  pageCannotBeSaved: 'This page cannot be saved as a bookmark',
  pageSaved: 'Page saved',
  viewOnHome: 'View on home page',
  pageAlreadySaved: 'This page is already saved',
  urlAlreadySaved: 'This URL is already saved',
  locatedIn: 'In',
  existingFolder: 'Existing folder',
  openYunjiTab: 'Open Yunji Tab',
  name: 'Name',
  folder: 'Folder',
  optionalTags: 'Tags (optional)',
  tagsPlaceholder: 'work, read later',
  saveCurrentPage: 'Save current page',
  cannotReadCurrentPage: 'Unable to read the current page',
  saveFailed: 'Could not save the page. Check the bookmark permission.',
  editBookmark: 'Edit bookmark',
  editBookmarkDescription: 'Update bookmark details.',
  addBookmarkDescription: 'Save a frequently used site to your home page.',
  url: 'URL',
  fetchSiteMetadata: 'Fetch the site name, description, and icon',
  fetchSiteInfo: 'Fetch site information',
  mergeExistingBookmark: 'Merge into existing bookmark',
  namePlaceholder: 'e.g. GitHub',
  category: 'Category',
  typeOrSelect: 'Type or select',
  moreOptions: 'More options',
  completedFieldCount: '{count} completed',
  optionalAlternateUrls: 'Alternate URLs (optional)',
  optionalDescription: 'Description (optional)',
  descriptionPlaceholder: 'A short description',
  optionalIcon: 'Icon (optional)',
  iconPlaceholder: '🐙 or an icon URL',
  cancel: 'Cancel',
  save: 'Save',
  addAnyway: 'Add anyway',
  add: 'Add',
  enterUrlFirst: 'Enter a URL first.',
  sitePermissionRequired: 'Allow site access to fetch site information.',
  noSiteMetadata: 'No recognizable name, description, or icon was found.',
  unknownError: 'Unknown error',
  fetchSiteMetadataFailed: 'Could not fetch site information: {message}',
  enterNameAndUrl: 'Enter a name and URL.',
  duplicateNeedsChoice:
    'This URL already exists. Merge it or add another copy.',
  invalidAlternateUrl: 'Alternate URLs must use http:// or https://.',
  openFolder: 'Open folder {name}',
  dragFolder: 'Drag folder',
  dragNamedFolder: 'Drag folder {name}',
  editFolder: 'Edit folder',
  editNamedFolder: 'Edit folder {name}',
  expandFolder: 'Expand folder {name}',
  collapseFolder: 'Collapse folder {name}',
  bookmarkCategories: 'Bookmark categories',
  folderBookmarkCount: '{count} bookmarks',
  subfolderCount: '{count} subfolders',
  deleteFailed: 'Delete failed',
  selectNamed: 'Select {name}',
  deselectNamed: 'Deselect {name}',
  locateIn: 'Go to {path}',
  pinNamed: 'Pin {name}',
  unpinNamed: 'Unpin {name}',
  pinBookmark: 'Pin bookmark',
  unpin: 'Unpin',
  dragToReorderOrMove: 'Drag to reorder or move to a folder',
  dragToFolder: 'Drag to a folder',
  dragBookmark: 'Drag bookmark {name}',
  moreActionsFor: 'More actions for {name}',
  editBookmarkAction: 'Edit bookmark',
  deleteBookmark: 'Delete bookmark',
  ...activityMessages.en,
  ...appearanceMessages.en,
  ...autoOrganizeMessages.en,
  ...bookmarkHealthMessages.en,
  ...bookmarkManagementMessages.en,
  ...commandPaletteMessages.en,
  ...dragDropMessages.en,
  ...keyboardShortcutMessages.en,
  ...runtimeMessages.en,
  ...searchEngineMessages.en,
  ...settingsDataMessages.en,
  ...settingsSyncMessages.en,
  ...tabSessionsMessages.en,
}

export type MessageKey = keyof typeof zhCN
export type TranslationParams = Record<string, number | string>
export interface LocalizedMessage {
  key: MessageKey
  params?: TranslationParams
}
export type LocalizedText = LocalizedMessage | string
export const messageKeys = Object.keys(zhCN) as MessageKey[]
const messageKeySet = new Set<string>(messageKeys)

export function localizedMessage(
  key: MessageKey,
  params?: TranslationParams,
): LocalizedMessage {
  return params ? { key, params } : { key }
}

export function isLocalizedMessage(value: unknown): value is LocalizedMessage {
  if (typeof value !== 'object' || value === null)
    return false
  const candidate = value as Partial<LocalizedMessage>
  if (typeof candidate.key !== 'string' || !messageKeySet.has(candidate.key))
    return false
  return (
    candidate.params === undefined
    || (typeof candidate.params === 'object'
      && candidate.params !== null
      && Object.values(candidate.params).every(
        param => typeof param === 'string' || typeof param === 'number',
      ))
  )
}

export function isLocalizedText(value: unknown): value is LocalizedText {
  return typeof value === 'string' || isLocalizedMessage(value)
}

export const languageOptions: ReadonlyArray<{
  value: Language
  label: string
}> = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
]

export function translate(
  language: Language,
  key: MessageKey,
  params: TranslationParams = {},
): string {
  const template
    = language === 'zh-CN'
      ? zhCN[key]
      : language === 'en'
        ? en[key]
        : extraLocaleMessages[language][key]
  if (typeof template !== 'string')
    return ''
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name]))
}

export function translateText(
  language: Language,
  value: LocalizedText,
): string {
  return typeof value === 'string'
    ? value
    : translate(language, value.key, value.params)
}

export function languageTag(language: Language): string {
  return language
}

const virtualCategoryKeys: Record<string, MessageKey> = {
  all: 'all',
  inbox: 'inbox',
  pinned: 'pinned',
  frequent: 'frequent',
  recent: 'recent',
  untagged: 'untagged',
  undescribed: 'undescribed',
}

export function translateCategoryName(
  language: Language,
  category: { id: string, name: string },
): string {
  const key = virtualCategoryKeys[category.id]
  if (key)
    return translate(language, key)
  return category.name || translate(language, 'runtimeUnnamedFolder')
}
