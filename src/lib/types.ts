// 书签 —— 一个快捷网址入口
export interface Bookmark {
  id: string
  name: string
  url: string
  description?: string
  categoryId: string
  /** 可选自定义 emoji 或图片 URL；为空时自动使用站点 favicon */
  icon?: string
  /** 额外访问地址，打开时会和主 URL 一起探测并选择最快响应的地址 */
  alternateUrls?: string[]
  /** 本地置顶时间；浏览器原生书签不包含此字段 */
  pinnedAt?: number
  /** 本地标签；不改变浏览器原生目录结构 */
  tags?: string[]
  /** Added through a quick-capture flow and not organized yet. */
  inboxAt?: number
  dateAdded?: number
  index?: number
}

// 分类 —— 书签的分组维度
export interface Category {
  id: string
  name: string
  emoji: string
  parentId: string
  modifiable: boolean
}

// 浏览器目录没有图标字段，使用本地元数据补充
export interface CategoryMeta {
  emoji?: string
}

// 书签元数据：为浏览器书签（无描述/图标字段）补充的扩展信息，按 url 索引
export interface BookmarkMeta {
  description?: string
  icon?: string
  alternateUrls?: string[]
  pinnedAt?: number
  tags?: string[]
  inboxAt?: number
}

export interface BookmarkUsage {
  openCount: number
  lastOpenedAt: number
}

// 主题模式
export type ThemeMode = 'light' | 'dark' | 'system'
export type Language = 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko' | 'es' | 'fr'
export type BookmarkSortMode = 'manual' | 'name' | 'recentlyAdded' | 'frequent'
export type BookmarkViewMode = 'grid' | 'compact'
export type NavLayout = 'sidebar' | 'top'
export type ContentWidth = 'standard' | 'wide' | 'full'
export type GridDensity = 'comfortable' | 'dense'
export type CardStyle = 'soft' | 'outline' | 'plain'
export type AppearanceSize = 'sm' | 'md' | 'lg'
export type AccentColor = 'neutral' | 'blue' | 'green' | 'orange' | 'rose'
export type ColorTheme
  = 'default' | 'graphite' | 'meadow' | 'dawn' | 'berry' | 'kami'
export type ActionVisibility = 'hover' | 'always'
export type BackgroundStyle = 'flat' | 'subtle' | 'panel'
export type TitleLineCount = 1 | 2
export type DescriptionLineCount = 1 | 2 | 3
export type ShortcutAction
  = 'focusSearch' | 'openCommandPalette' | 'addBookmark'

export interface KeyboardShortcut {
  key: string
  primary: boolean
  alt: boolean
  shift: boolean
}

export type KeyboardShortcuts = Record<ShortcutAction, KeyboardShortcut>

export interface CardFieldSettings {
  description: boolean
  tags: boolean
  categoryPath: boolean
  categoryCards: boolean
  actions: ActionVisibility
  titleLines: TitleLineCount
  descriptionLines: DescriptionLineCount
  maxVisibleTags: number
}

export interface NavItemSettings {
  counts: boolean
  smartCategories: boolean
  savedSearches: boolean
  categoryTree: boolean
}

export interface AppearanceSettings {
  navLayout: NavLayout
  catDecorations: boolean
  contentWidth: ContentWidth
  gridDensity: GridDensity
  cardStyle: CardStyle
  iconSize: AppearanceSize
  radius: AppearanceSize
  accentColor: AccentColor
  colorTheme: ColorTheme
  backgroundStyle: BackgroundStyle
  navItems: NavItemSettings
  cardFields: CardFieldSettings
}

// 搜索引擎
export interface SearchEngine {
  id: string
  name: string
  /** 搜索 URL 模板，%s 为查询占位符 */
  url: string
  emoji: string
  /** 输入框中用于直接指定引擎的短关键字 */
  keyword: string
}

export interface SavedSearch {
  id: string
  name: string
  query: string
}

export interface MetadataSyncScope {
  description: boolean
  icon: boolean
  alternateUrls: boolean
  pinnedAt: boolean
  tags: boolean
  inboxAt: boolean
  categoryIcons: boolean
}

export type AutoOrganizeField
  = 'name' | 'url' | 'domain' | 'description' | 'tag'
export type AutoOrganizeOperator = 'contains' | 'equals' | 'startsWith'

export interface AutoOrganizeRule {
  id: string
  name: string
  enabled: boolean
  field: AutoOrganizeField
  operator: AutoOrganizeOperator
  value: string
  targetCategoryId?: string
  addTags: string[]
  clearInbox: boolean
}

// 用户设置
export interface Settings {
  /** 界面语言 */
  language: Language
  searchEngineId: string
  theme: ThemeMode
  /** 打开主页时默认展示的分类目录 */
  defaultCategoryId: string
  /** 是否复用已打开的 Yunji Tab 主页标签 */
  singleHomeTab: boolean
  /** 是否允许浏览器全局命令在任意页面打开书签搜索 */
  globalCommandPaletteEnabled: boolean
  /** 手动同步描述时禁止访问的域名，包含其所有子域名 */
  descriptionIgnoredDomains: string[]
  /** 用户自定义搜索引擎，随设置同步 */
  customSearchEngines: SearchEngine[]
  /** 是否隐藏首次整理入口 */
  onboardingDismissed?: boolean
  bookmarkSortMode: BookmarkSortMode
  bookmarkViewMode: BookmarkViewMode
  appearance: AppearanceSettings
  savedSearches: SavedSearch[]
  metadataSyncScope: MetadataSyncScope
  metadataSyncEncryptionEnabled: boolean
  autoOrganizeRules: AutoOrganizeRule[]
  keyboardShortcuts: KeyboardShortcuts
}
