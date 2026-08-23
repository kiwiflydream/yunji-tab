import type { LucideIcon } from 'lucide-react'
import type { BookmarkSearchEntry } from '~/lib/bookmark-search'
import type { Bookmark, Category } from '~/lib/types'
import {
  BookmarkPlus,
  FolderOpen,
  HeartPulse,
  Moon,
  Search,
  Sun,
  Trash2,
} from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  bookmarkSearchEntryScore,
  categorySearchScore,
} from '~/lib/bookmark-search'
import { openBookmarkUrl } from '~/lib/bookmark-urls'
import { getNavigationDerivedData } from '~/lib/navigation-derived'
import { useBookmarks, useCategories, useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'
import { cn } from '~/lib/utils'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddBookmark: () => void
  onOpenHealth: () => void
}

interface CommandItem {
  id: string
  title: string
  subtitle?: string
  group: string
  Icon: LucideIcon
  keywords: string
  bookmark?: Bookmark
  bookmarkSearchEntry?: BookmarkSearchEntry
  category?: Category
  categoryPath?: string[]
  run: () => void | Promise<void>
}

const RECENT_COMMANDS_KEY = 'yunji-tab:recent-commands:v1'
const LEGACY_RECENT_COMMANDS_KEY = 'yunji-tab:recent-commands'
const MAX_RECENT_COMMANDS = 8

function buildBookmarkKeywords(bookmark: Bookmark, path: string): string {
  return [bookmark.name, bookmark.url, bookmark.description, path]
    .filter(Boolean)
    .join(' ')
}

function buildCategoryKeywords(category: Category, path: string): string {
  return [category.name, path].filter(Boolean).join(' ')
}

export function CommandPalette({
  open,
  onOpenChange,
  onAddBookmark,
  onOpenHealth,
}: CommandPaletteProps) {
  const { categoryName, t } = useI18n()
  const bookmarks = useBookmarks()
  const categories = useCategories()
  const theme = useNavStore(state => state.settings.theme)
  const setTheme = useNavStore(state => state.setTheme)
  const setActiveCategory = useNavStore(state => state.setActiveCategory)
  const setBookmarkSearchQuery = useNavStore(
    state => state.setBookmarkSearchQuery,
  )
  const recordBookmarkOpen = useNavStore(state => state.recordBookmarkOpen)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem(RECENT_COMMANDS_KEY)
        ?? localStorage.getItem(LEGACY_RECENT_COMMANDS_KEY)
        ?? '[]',
      ) as string[]
    }
    catch {
      return []
    }
  })
  const inputRef = useRef<HTMLInputElement>(null)
  const derived = useMemo(
    () => getNavigationDerivedData(bookmarks, categories),
    [bookmarks, categories],
  )
  const categoryPathMap = derived.categoryPathMap
  const trimmedQuery = query.trim()

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery('')
      setActiveIndex(0)
    }
    onOpenChange(nextOpen)
  }, [onOpenChange])

  const commands = useMemo<CommandItem[]>(() => {
    const close = () => handleOpenChange(false)
    const bookmarkItems: CommandItem[] = bookmarks.map((bookmark) => {
      const path = categoryPathMap.get(bookmark.categoryId)?.join(' / ') ?? ''
      return {
        id: `bookmark:${bookmark.id}`,
        title: bookmark.name,
        subtitle: path || bookmark.url,
        group: t('commandGroupBookmarks'),
        Icon: Search,
        keywords: buildBookmarkKeywords(bookmark, path),
        bookmark,
        bookmarkSearchEntry: derived.searchEntryByBookmarkId.get(bookmark.id),
        categoryPath: categoryPathMap.get(bookmark.categoryId) ?? [],
        run: async () => {
          close()
          void recordBookmarkOpen(bookmark.url).catch(() => undefined)
          await openBookmarkUrl(bookmark)
        },
      }
    })
    const categoryItems: CommandItem[] = categories.map((category) => {
      const path = categoryPathMap.get(category.id)?.join(' / ') ?? ''
      return {
        id: `category:${category.id}`,
        title: categoryName(category),
        subtitle: path,
        group: t('commandGroupFolders'),
        Icon: FolderOpen,
        keywords: buildCategoryKeywords(category, path),
        category,
        categoryPath: categoryPathMap.get(category.id) ?? [],
        run: () => {
          setActiveCategory(category.id)
          setBookmarkSearchQuery('')
          close()
        },
      }
    })
    const actionItems: CommandItem[] = [
      {
        id: 'action:add-bookmark',
        title: t('addBookmark'),
        group: t('commandGroupActions'),
        Icon: BookmarkPlus,
        keywords: t('commandAddBookmarkKeywords'),
        run: () => {
          close()
          onAddBookmark()
        },
      },
      {
        id: 'action:health',
        title: t('bookmarkHealth'),
        group: t('commandGroupActions'),
        Icon: HeartPulse,
        keywords: t('commandHealthKeywords'),
        run: () => {
          close()
          onOpenHealth()
        },
      },
      {
        id: 'action:clear-search',
        title: t('clearCurrentSearch'),
        group: t('commandGroupActions'),
        Icon: Trash2,
        keywords: t('commandClearSearchKeywords'),
        run: () => {
          setBookmarkSearchQuery('')
          close()
        },
      },
      {
        id: 'theme:light',
        title: t('switchToLightTheme'),
        subtitle: theme === 'light' ? t('currentTheme') : undefined,
        group: t('commandGroupTheme'),
        Icon: Sun,
        keywords: t('commandLightThemeKeywords'),
        run: () => {
          void setTheme('light')
          close()
        },
      },
      {
        id: 'theme:dark',
        title: t('switchToDarkTheme'),
        subtitle: theme === 'dark' ? t('currentTheme') : undefined,
        group: t('commandGroupTheme'),
        Icon: Moon,
        keywords: t('commandDarkThemeKeywords'),
        run: () => {
          void setTheme('dark')
          close()
        },
      },
      {
        id: 'theme:system',
        title: t('followSystemTheme'),
        subtitle: theme === 'system' ? t('currentTheme') : undefined,
        group: t('commandGroupTheme'),
        Icon: Sun,
        keywords: t('commandSystemThemeKeywords'),
        run: () => {
          void setTheme('system')
          close()
        },
      },
    ]

    return [...actionItems, ...bookmarkItems, ...categoryItems]
  }, [
    bookmarks,
    categories,
    categoryName,
    categoryPathMap,
    derived.searchEntryByBookmarkId,
    onAddBookmark,
    handleOpenChange,
    onOpenHealth,
    recordBookmarkOpen,
    setActiveCategory,
    setBookmarkSearchQuery,
    setTheme,
    theme,
    t,
  ])

  const visibleItems = useMemo(() => {
    if (!trimmedQuery) {
      const recentRank = new Map(
        recentCommandIds.map((id, index) => [id, index]),
      )
      return commands
        .toSorted((left, right) => {
          const leftRank = recentRank.get(left.id) ?? Number.POSITIVE_INFINITY
          const rightRank = recentRank.get(right.id) ?? Number.POSITIVE_INFINITY
          return leftRank - rightRank
        })
        .slice(0, 12)
    }
    const scoredItems = commands.reduce<Array<{ item: CommandItem, score: number }>>((results, item) => {
      const score
        = item.bookmarkSearchEntry
          ? bookmarkSearchEntryScore(item.bookmarkSearchEntry, trimmedQuery)
          : item.category
            ? categorySearchScore(
                item.category,
                trimmedQuery,
                item.categoryPath ?? [],
              )
            : categorySearchScore(
                {
                  id: item.id,
                  name: item.title,
                  emoji: '',
                  parentId: '',
                  modifiable: false,
                },
                trimmedQuery,
                item.keywords.split(' '),
              )
      if (score >= 0)
        results.push({ item, score })
      return results
    }, [])
    return scoredItems
      .sort((left, right) => right.score - left.score)
      .slice(0, 20)
      .map(result => result.item)
  }, [commands, recentCommandIds, trimmedQuery])

  const activeItem = visibleItems[activeIndex]
  const runActive = () => {
    if (!activeItem)
      return
    const nextRecentIds = [
      activeItem.id,
      ...recentCommandIds.filter(id => id !== activeItem.id),
    ].slice(0, MAX_RECENT_COMMANDS)
    setRecentCommandIds(nextRecentIds)
    localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(nextRecentIds))
    void activeItem.run()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="top-[18vh] max-h-[min(36rem,calc(100dvh-2rem))] max-w-2xl translate-y-0 overflow-hidden p-0 sm:rounded-xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <DialogTitle className="sr-only">{t('commandPalette')}</DialogTitle>
        <DialogDescription className="sr-only">
          {t('commandPaletteDescription')}
        </DialogDescription>
        <div className="flex h-12 items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveIndex(index =>
                  visibleItems.length
                    ? (index + 1) % visibleItems.length
                    : 0,
                )
              }
              else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveIndex(index =>
                  visibleItems.length
                    ? (index - 1 + visibleItems.length) % visibleItems.length
                    : 0,
                )
              }
              else if (event.key === 'Enter') {
                event.preventDefault()
                runActive()
              }
            }}
            placeholder={t('commandPalettePlaceholder')}
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="max-h-[calc(min(36rem,100dvh-2rem)-3rem)] overflow-y-auto p-2">
          {visibleItems.length > 0
            ? (
                <div className="space-y-1">
                  {visibleItems.map((item, index) => {
                    const active = index === activeIndex
                    const { Icon } = item
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => {
                          const nextRecentIds = [
                            item.id,
                            ...recentCommandIds.filter(id => id !== item.id),
                          ].slice(0, MAX_RECENT_COMMANDS)
                          setRecentCommandIds(nextRecentIds)
                          localStorage.setItem(
                            RECENT_COMMANDS_KEY,
                            JSON.stringify(nextRecentIds),
                          )
                          void item.run()
                        }}
                        className={cn(
                          'flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                          active
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-accent',
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border/70">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {item.title}
                          </span>
                          {item.subtitle
                            ? (
                                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                  {item.subtitle}
                                </span>
                              )
                            : null}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {item.group}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            : (
                <div className="flex h-28 items-center justify-center text-sm text-muted-foreground">
                  {t('noMatchingCommands')}
                </div>
              )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
