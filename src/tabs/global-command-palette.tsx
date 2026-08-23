import type { GlobalPaletteData } from '~/lib/global-command-palette'
import type { Bookmark } from '~/lib/types'
import {
  BookmarkCheck,
  BookmarkPlus,
  CornerDownLeft,
  ExternalLink,
  Home,
  Search,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '~/components/ui/button'
import { Kbd } from '~/components/ui/kbd'
import { bookmarkSearchEntryScore } from '~/lib/bookmark-search'
import {
  globalPaletteCloseMessage,
  globalPaletteOpenBookmarkMessage,
  globalPaletteOpenHomeMessage,
  globalPaletteSavePageMessage,
  globalPaletteValidateMessage,
} from '~/lib/global-command-palette'
import { languageTag, translate } from '~/lib/i18n'
import { getNavigationDerivedData } from '~/lib/navigation-derived'
import { getBrowserFaviconUrl } from '~/lib/utils'
import '~main.css'

type LoadState
  = | { state: 'loading' }
    | { state: 'ready', data: GlobalPaletteData }
    | { state: 'error' }

type SaveState
  = 'duplicate' | 'failed' | 'idle' | 'invalid' | 'saved' | 'saving'

const token = decodeURIComponent(window.location.hash.slice(1))

function dismiss() {
  void chrome.runtime
    .sendMessage({
      type: globalPaletteCloseMessage,
      token,
    })
    .catch(() => undefined)
  window.parent.postMessage(
    {
      type: 'yunji-tab:global-palette-dismiss',
    },
    '*',
  )
}

function bookmarkSubtitle(bookmark: Bookmark, path: string[]): string {
  if (path.length > 0)
    return path.join(' / ')
  try {
    return new URL(bookmark.url).hostname.replace(/^www\./, '')
  }
  catch {
    return bookmark.url
  }
}

export default function GlobalCommandPalette() {
  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' })
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const inputRef = useRef<HTMLInputElement>(null)
  const language
    = loadState.state === 'ready' ? loadState.data.language : 'zh-CN'
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key)

  useEffect(() => {
    document.body.style.background = 'transparent'
    document.documentElement.lang = languageTag(language)
  }, [language])

  useEffect(() => {
    const documentOverflow = document.documentElement.style.overflow
    const bodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = documentOverflow
      document.body.style.overflow = bodyOverflow
    }
  }, [])

  useEffect(() => {
    const dismissOnFocusLoss = () => dismiss()
    window.addEventListener('blur', dismissOnFocusLoss)
    return () => window.removeEventListener('blur', dismissOnFocusLoss)
  }, [])

  useEffect(() => {
    let active = true
    void chrome.runtime
      .sendMessage({
        type: globalPaletteValidateMessage,
        token,
      })
      .then((response) => {
        if (!active)
          return
        setLoadState(
          response?.ok && response.data
            ? { state: 'ready', data: response.data }
            : { state: 'error' },
        )
      })
      .catch(() => {
        if (active)
          setLoadState({ state: 'error' })
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (loadState.state !== 'ready')
      return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const dark
        = loadState.data.theme === 'dark'
          || (loadState.data.theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    applyTheme()
    media.addEventListener('change', applyTheme)
    inputRef.current?.focus()
    return () => media.removeEventListener('change', applyTheme)
  }, [loadState])

  const derived = useMemo(
    () =>
      loadState.state === 'ready'
        ? getNavigationDerivedData(
            loadState.data.bookmarks,
            loadState.data.categories,
          )
        : undefined,
    [loadState],
  )

  const visibleBookmarks = useMemo(() => {
    if (loadState.state !== 'ready' || !derived)
      return []
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      return loadState.data.bookmarks
        .toSorted(
          (left, right) =>
            (right.pinnedAt ?? right.dateAdded ?? 0)
            - (left.pinnedAt ?? left.dateAdded ?? 0),
        )
        .slice(0, 10)
    }
    return derived.searchEntries
      .map(entry => ({
        bookmark: entry.bookmark,
        score: bookmarkSearchEntryScore(entry, trimmedQuery),
      }))
      .filter(result => result.score >= 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 16)
      .map(result => result.bookmark)
  }, [derived, loadState, query])

  useEffect(() => {
    if (activeIndex >= visibleBookmarks.length)
      setActiveIndex(0)
  }, [activeIndex, visibleBookmarks.length])

  const openBookmark = (bookmark: Bookmark) => {
    void chrome.runtime
      .sendMessage({
        type: globalPaletteOpenBookmarkMessage,
        token,
        bookmarkId: bookmark.id,
      })
      .then((response) => {
        if (response?.ok)
          dismiss()
      })
  }

  const saveCurrentPage = () => {
    if (saveState === 'saving')
      return
    setSaveState('saving')
    void chrome.runtime
      .sendMessage({
        type: globalPaletteSavePageMessage,
        token,
      })
      .then((response) => {
        setSaveState(response?.ok ? response.result : 'failed')
      })
      .catch(() => setSaveState('failed'))
  }

  const openHome = () => {
    void chrome.runtime
      .sendMessage({
        type: globalPaletteOpenHomeMessage,
        token,
      })
      .then((response) => {
        if (response?.ok)
          dismiss()
      })
  }

  const saveLabel
    = saveState === 'saved'
      ? t('pageSaved')
      : saveState === 'duplicate'
        ? t('pageAlreadySaved')
        : saveState === 'invalid'
          ? t('pageCannotBeSaved')
          : saveState === 'failed'
            ? t('saveFailed')
            : t('saveCurrentPage')

  if (loadState.state === 'loading') {
    return (
      <main className="mx-auto mt-1 max-w-2xl overflow-hidden rounded-xl border border-border/80 bg-card p-5 text-card-foreground shadow-2xl">
        <div className="h-12 animate-pulse rounded-lg bg-muted" />
        <div className="mt-3 h-64 animate-pulse rounded-lg bg-muted/70" />
      </main>
    )
  }

  if (loadState.state === 'error') {
    return (
      <main className="mx-auto mt-1 flex max-w-2xl items-center justify-between gap-4 rounded-xl border border-border/80 bg-card p-5 text-card-foreground shadow-2xl">
        <p className="text-sm text-muted-foreground">{t('unknownError')}</p>
        <Button type="button" variant="outline" size="sm" onClick={dismiss}>
          {t('close')}
        </Button>
      </main>
    )
  }

  return (
    <main
      className="mx-auto mt-1 flex max-h-[min(600px,calc(100dvh-8px))] max-w-2xl flex-col overflow-hidden rounded-xl border border-border/80 bg-card text-card-foreground shadow-2xl"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          dismiss()
        }
      }}
    >
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" />
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
                visibleBookmarks.length
                  ? (index + 1) % visibleBookmarks.length
                  : 0,
              )
            }
            else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActiveIndex(index =>
                visibleBookmarks.length
                  ? (index - 1 + visibleBookmarks.length)
                  % visibleBookmarks.length
                  : 0,
              )
            }
            else if (event.key === 'Enter' && visibleBookmarks[activeIndex]) {
              event.preventDefault()
              openBookmark(visibleBookmarks[activeIndex])
            }
          }}
          placeholder={t('searchBookmarks')}
          aria-label={t('searchBookmarks')}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('close')}
          className="icon-button size-8"
        >
          <X className="size-4" />
        </button>
      </header>

      <section
        className="min-h-0 flex-1 overflow-y-auto p-2"
        aria-label={t('commandGroupBookmarks')}
      >
        {visibleBookmarks.length > 0
          ? (
              <div className="space-y-1">
                {visibleBookmarks.map((bookmark, index) => {
                  const active = index === activeIndex
                  const categoryPath
                    = derived?.categoryPathMap.get(bookmark.categoryId) ?? []
                  const favicon = getBrowserFaviconUrl(bookmark.url)
                  return (
                    <button
                      key={bookmark.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => openBookmark(bookmark)}
                      className={`flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/70'}`}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-background ring-1 ring-border/70">
                        {favicon
                          ? (
                              <img
                                src={favicon}
                                alt=""
                                className="size-5 object-contain"
                              />
                            )
                          : (
                              <span className="text-sm font-semibold">
                                {bookmark.name.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {bookmark.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {bookmarkSubtitle(bookmark, categoryPath)}
                        </span>
                      </span>
                      {active
                        ? (
                            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                              <Kbd>
                                <CornerDownLeft className="size-3" />
                              </Kbd>
                            </span>
                          )
                        : (
                            <ExternalLink className="size-3.5 shrink-0 text-muted-foreground/60" />
                          )}
                    </button>
                  )
                })}
              </div>
            )
          : (
              <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">
                {t('noMatchingCommands')}
              </div>
            )}
      </section>

      <footer className="flex shrink-0 flex-col gap-2 border-t border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden items-center gap-1 sm:flex">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
          </span>
          <span className="hidden sm:inline">{t('searchBookmarks')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-w-0 flex-1 sm:flex-none"
            disabled={saveState === 'saving'}
            onClick={saveCurrentPage}
          >
            {saveState === 'saved' || saveState === 'duplicate'
              ? (
                  <BookmarkCheck data-icon="inline-start" />
                )
              : (
                  <BookmarkPlus data-icon="inline-start" />
                )}
            <span className="truncate">{saveLabel}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            className="min-w-0 flex-1 sm:flex-none"
            onClick={openHome}
          >
            <Home data-icon="inline-start" />
            <span className="truncate">{t('openHome')}</span>
          </Button>
        </div>
      </footer>
    </main>
  )
}
