import type { FormEvent } from 'react'
import {
  BookOpen,
  ChevronDown,
  Command,
  Globe2,
  Search,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group'
import { formatShortcut } from '~/lib/keyboard-shortcuts'
import {
  getAvailableSearchEngines,
  resolveSearchIntent,
} from '~/lib/search-engines'
import { useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

// 简单判断输入是否为网址（形如 example.com/path）
function looksLikeUrl(s: string): boolean {
  return /^[\w-]+(?:\.[\w-]+)+(?:\/\S*)?$/.test(s) && !s.includes(' ')
}

interface SearchBarProps {
  onOpenCommand: () => void
}

type SearchMode = 'bookmarks' | 'web'
const BROWSER_DEFAULT_ENGINE_ID = 'browser-default'

export function SearchBar({ onOpenCommand }: SearchBarProps) {
  const { t } = useI18n()
  const settings = useNavStore(s => s.settings)
  const query = useNavStore(s => s.bookmarkSearchQuery)
  const setBookmarkSearchQuery = useNavStore(s => s.setBookmarkSearchQuery)

  const [menuOpen, setMenuOpen] = useState(false)
  const [mode, setMode] = useState<SearchMode>('bookmarks')
  const [webQuery, setWebQuery] = useState('')
  const [engineId, setEngineId] = useState(BROWSER_DEFAULT_ENGINE_ID)
  const savedBookmarkQueryRef = useRef('')
  const inputRef = useRef<HTMLInputElement>(null)

  const engines = getAvailableSearchEngines(settings.customSearchEngines)
  const engine = engines.find(item => item.id === engineId)
  const selectedEngineId = engine?.id ?? BROWSER_DEFAULT_ENGINE_ID
  const engineName = engine?.name ?? t('browserDefaultSearchEngine')
  const activeQuery = mode === 'bookmarks' ? query : webQuery
  const commandShortcut = formatShortcut(
    settings.keyboardShortcuts.openCommandPalette,
  )

  // 进入主页自动聚焦搜索框
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'bookmarks') {
      if (!query.trim())
        return
      const firstVisibleItem = Array.from(
        document.querySelectorAll<HTMLElement>('[data-nav-item]'),
      ).find(item => item.offsetParent !== null)
      firstVisibleItem?.click()
      return
    }

    const q = webQuery.trim()
    if (!q)
      return
    if (looksLikeUrl(q)) {
      window.location.href = q.startsWith('http') ? q : `https://${q}`
      return
    }
    const intent = resolveSearchIntent(q, engines, selectedEngineId)
    if (!intent.engine) {
      void chrome.search.query({
        text: intent.query,
        disposition: chrome.search.Disposition.CURRENT_TAB,
      })
      return
    }
    window.location.href = intent.engine.url.replace(
      '%s',
      encodeURIComponent(intent.query),
    )
  }

  const changeMode = (nextMode: SearchMode) => {
    if (nextMode === mode)
      return
    if (nextMode === 'web') {
      savedBookmarkQueryRef.current = query
      setWebQuery(query)
      setBookmarkSearchQuery('')
    }
    else {
      setBookmarkSearchQuery(savedBookmarkQueryRef.current)
    }
    setMode(nextMode)
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const clearQuery = () => {
    if (mode === 'bookmarks')
      setBookmarkSearchQuery('')
    else setWebQuery('')
    inputRef.current?.focus()
  }

  return (
    <form onSubmit={onSubmit} className="relative w-full max-w-[42rem]">
      <label htmlFor="yunji-tab-search" className="sr-only">
        {t('searchOrEnterUrl')}
      </label>
      <div className="flex h-11 items-center rounded-xl border border-border/70 bg-card/90 backdrop-blur-xs shadow-xs transition-all duration-200 focus-within:border-ring/40 focus-within:shadow-md focus-within:ring-2 focus-within:ring-ring/10">
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(value) => {
            if (value)
              changeMode(value as SearchMode)
          }}
          aria-label={t('searchScope')}
          size="sm"
          className="ml-1 shrink-0 rounded-lg bg-secondary/60 p-0.5"
        >
          <ToggleGroupItem
            value="bookmarks"
            aria-label={t('searchBookmarks')}
            title={t('searchBookmarks')}
            className="rounded-md px-2 py-1 text-xs"
          >
            <BookOpen className="size-3.5" />
            <span className="hidden sm:inline">{t('bookmarks')}</span>
          </ToggleGroupItem>
          <ToggleGroupItem
            value="web"
            aria-label={t('searchWeb')}
            title={t('searchWeb')}
            className="rounded-md px-2 py-1 text-xs"
          >
            <Globe2 className="size-3.5" />
            <span className="hidden sm:inline">{t('web')}</span>
          </ToggleGroupItem>
        </ToggleGroup>

        {/* 搜索引擎切换 */}
        {mode === 'web'
          ? (
              <DropdownMenu
                modal={false}
                open={menuOpen}
                onOpenChange={setMenuOpen}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={t('selectSearchEngine')}
                    className="flex h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-[color,background-color] hover:bg-accent/70 hover:text-foreground active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                  >
                    <span className="text-sm">{engine?.emoji ?? '🌐'}</span>
                    <span className="hidden sm:inline">{engineName}</span>
                    <ChevronDown className="size-3 text-muted-foreground/70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={8}
                  className="w-52 shadow-md"
                  onCloseAutoFocus={(event) => {
                    event.preventDefault()
                    inputRef.current?.focus()
                  }}
                >
                  <DropdownMenuRadioGroup
                    value={selectedEngineId}
                    onValueChange={setEngineId}
                  >
                    <DropdownMenuRadioItem value={BROWSER_DEFAULT_ENGINE_ID}>
                      <span aria-hidden="true">🌐</span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {t('browserDefaultSearchEngine')}
                      </span>
                    </DropdownMenuRadioItem>
                    {engines.map(item => (
                      <DropdownMenuRadioItem key={item.id} value={item.id}>
                        <span aria-hidden="true">{item.emoji}</span>
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {item.name}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {item.keyword}
                        </span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          : null}

        <div className="h-4 w-px bg-border/70" />

        {/* 搜索输入 */}
        <input
          id="yunji-tab-search"
          ref={inputRef}
          value={activeQuery}
          onChange={(event) => {
            if (mode === 'bookmarks')
              setBookmarkSearchQuery(event.target.value)
            else setWebQuery(event.target.value)
          }}
          aria-label={
            mode === 'bookmarks'
              ? t('searchBookmarksAndFolders')
              : t('searchWebOrEnterUrl')
          }
          placeholder={
            mode === 'bookmarks'
              ? t('searchBookmarksAndFolders')
              : engine
                ? t('enterUrlOrKeyword', { keyword: engine.keyword })
                : t('searchWebOrEnterUrl')
          }
          className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
        />

        {activeQuery.length > 0
          ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={clearQuery}
                aria-label={t('clearSearch')}
                title={t('clearSearch')}
                className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X data-icon="inline-start" className="size-3.5" />
              </Button>
            )
          : null}

        <button
          type="button"
          onClick={onOpenCommand}
          aria-label={t('openCommandPalette')}
          title={`${t('openCommandPalette')} (${commandShortcut})`}
          className="mr-1 hidden h-6 shrink-0 items-center gap-1 rounded-[6px] border border-border/70 bg-muted/50 px-1.5 text-[10.5px] font-mono font-medium text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 sm:flex"
        >
          <Command className="h-3 w-3" />
          <span className="hidden md:inline">{commandShortcut}</span>
        </button>

        {/* 提交按钮 */}
        <button
          type="submit"
          aria-label={
            mode === 'bookmarks' ? t('openFirstBookmarkResult') : t('searchWeb')
          }
          title={
            mode === 'bookmarks'
              ? t('openFirstResult')
              : t('searchWithEngine', { engine: engineName })
          }
          className="flex h-11 w-10 items-center justify-center rounded-r-xl text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>
    </form>
  )
}
