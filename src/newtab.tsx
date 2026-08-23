import type { Bookmark, BookmarkUsage, Category } from '~/lib/types'

import { lazy, Suspense, useEffect, useState } from 'react'

import { BookmarkDragDropProvider } from '~/components/BookmarkDragDropProvider'
import { BookmarkGrid } from '~/components/BookmarkGrid'
import { CatDoodles } from '~/components/CatDoodles'
import { CategoryTabs } from '~/components/CategoryTabs'
import { Header } from '~/components/Header'
import { LazyDialogFallback } from '~/components/LazyDialogFallback'
import { UndoDeletionToast } from '~/components/UndoDeletionToast'
import {
  historyStorageKey,
  metadataSyncRecoveryStorageKey,
  pruneHistory,
  pruneMetadataSyncRecovery,
  pruneTrash,
  trashStorageKey,
} from '~/lib/activity'
import {
  accentColorVars,
  backgroundStyleClass,
  colorThemeVariableNames,
  colorThemeVars,
  contentWidthClass,
} from '~/lib/appearance'
import { mergeBookmarkUsageMaps } from '~/lib/bookmark-usage'
import { globalPaletteHomeHash } from '~/lib/global-command-palette'
import { homeTabReadyMessage } from '~/lib/home-tabs'
import { languageTag, translate } from '~/lib/i18n'
import {
  canTriggerShortcutWhileEditing,
  shortcutMatchesEvent,
} from '~/lib/keyboard-shortcuts'
import { metadataSyncManifestKey } from '~/lib/metadata-sync'
import { flushUsagePersistence, useNavStore } from '~/lib/store'
import { metaStorage, STORAGE_KEYS } from '~/lib/store-persistence'
import { cn } from '~/lib/utils'
import '~main.css'

const loadBookmarkDialog = () => import('~/components/BookmarkDialog')
const loadCategoryDialog = () => import('~/components/CategoryDialog')
const loadCommandPalette = () => import('~/components/CommandPalette')

const BookmarkDialog = lazy(() =>
  loadBookmarkDialog().then(module => ({
    default: module.BookmarkDialog,
  })),
)
const CategoryDialog = lazy(() =>
  loadCategoryDialog().then(module => ({
    default: module.CategoryDialog,
  })),
)
const CommandPalette = lazy(() =>
  loadCommandPalette().then(module => ({
    default: module.CommandPalette,
  })),
)

export default function NewTab() {
  const init = useNavStore(s => s.init)
  const theme = useNavStore(s => s.settings.theme)
  const appearance = useNavStore(s => s.settings.appearance)
  const language = useNavStore(s => s.settings.language)
  const keyboardShortcuts = useNavStore(s => s.settings.keyboardShortcuts)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(
    () => window.location.hash === globalPaletteHomeHash,
  )
  const [healthOpen, setHealthOpen] = useState(false)
  const [bookmarksReady, setBookmarksReady] = useState(false)
  const [editing, setEditing] = useState<Bookmark | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  useEffect(() => {
    document.documentElement.lang = languageTag(language)
    document.title = translate(language, 'brandName')
  }, [language])

  useEffect(() => {
    void chrome.runtime
      .sendMessage({ type: homeTabReadyMessage })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const openPaletteFromHash = () => {
      if (window.location.hash !== globalPaletteHomeHash)
        return
      setCommandOpen(true)
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}`,
      )
    }
    openPaletteFromHash()
    window.addEventListener('hashchange', openPaletteFromHash)
    return () => window.removeEventListener('hashchange', openPaletteFromHash)
  }, [])

  useEffect(() => {
    const flushUsage = () => void flushUsagePersistence()
    window.addEventListener('pagehide', flushUsage)
    return () => window.removeEventListener('pagehide', flushUsage)
  }, [])

  // 先恢复设置和补充元数据，再加载浏览器书签，避免初始化竞态。
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        await init()
        await useNavStore.getState().loadBookmarks()
        await useNavStore.getState().syncMetadataNow()
        useNavStore.getState().applyDefaultCategory()
      }
      finally {
        if (active)
          setBookmarksReady(true)
      }
    })()
    return () => {
      active = false
    }
  }, [init])

  // 实时反映浏览器侧的书签变化。
  // Every Chrome listener and the debounce timer are released in the teardown.
  // react-doctor-disable-next-line react-doctor/effect-needs-cleanup
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.bookmarks)
      return
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      if (refreshTimer)
        clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        refreshTimer = undefined
        void useNavStore.getState().loadBookmarks()
      }, 75)
    }
    const refreshChanged = (
      id: string,
      changeInfo: { url?: string },
    ) => {
      if (changeInfo.url) {
        void useNavStore.getState().reconcileBookmarkUrlChange(
          id,
          changeInfo.url,
        )
      }
      refresh()
    }
    chrome.bookmarks.onCreated.addListener(refresh)
    chrome.bookmarks.onChanged.addListener(refreshChanged)
    chrome.bookmarks.onMoved.addListener(refresh)
    chrome.bookmarks.onRemoved.addListener(refresh)
    chrome.bookmarks.onChildrenReordered.addListener(refresh)
    return () => {
      if (refreshTimer)
        clearTimeout(refreshTimer)
      chrome.bookmarks.onCreated.removeListener(refresh)
      chrome.bookmarks.onChanged.removeListener(refreshChanged)
      chrome.bookmarks.onMoved.removeListener(refresh)
      chrome.bookmarks.onRemoved.removeListener(refresh)
      chrome.bookmarks.onChildrenReordered.removeListener(refresh)
    }
  }, [])

  // The Chrome storage listener is removed with the same callback reference.
  // react-doctor-disable-next-line react-doctor/effect-needs-cleanup
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged)
      return
    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName === 'sync' && changes[metadataSyncManifestKey])
        void useNavStore.getState().syncMetadataNow()
      if (areaName === 'local' && changes[trashStorageKey]) {
        useNavStore.setState({
          trash: pruneTrash(changes[trashStorageKey].newValue),
        })
      }
      if (areaName === 'local' && changes[historyStorageKey]) {
        useNavStore.setState({
          history: pruneHistory(changes[historyStorageKey].newValue),
        })
      }
      if (areaName === 'local' && changes[metadataSyncRecoveryStorageKey]) {
        useNavStore.setState({
          metadataSyncRecovery: pruneMetadataSyncRecovery(
            changes[metadataSyncRecoveryStorageKey].newValue,
          ),
        })
      }
      if (areaName === 'local' && changes[STORAGE_KEYS.usage]) {
        void metaStorage
          .get<Record<string, BookmarkUsage>>(STORAGE_KEYS.usage)
          .then((persistedUsage) => {
            useNavStore.setState(state => ({
              usage: mergeBookmarkUsageMaps(state.usage, persistedUsage),
            }))
          })
      }
    }
    const storageChanges = chrome.storage.onChanged
    storageChanges.addListener(onStorageChanged)
    return () => storageChanges.removeListener(onStorageChanged)
  }, [])

  // 应用主题：light / dark / 跟随系统，以及成套配色变量。
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const root = document.documentElement
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      const strictKami = appearance.colorTheme === 'kami'
      root.classList.toggle('dark', strictKami ? false : dark)
      root.classList.toggle('theme-kami', strictKami)

      const radius = strictKami
        ? '0.25rem'
        : {
            sm: '0.5rem',
            md: '0.75rem',
            lg: '1rem',
          }[appearance.radius]
      root.style.setProperty('--radius', radius)

      if (appearance.colorTheme === 'default') {
        colorThemeVariableNames.forEach(key =>
          root.style.removeProperty(key),
        )
      }
      else {
        const themeVars
          = colorThemeVars[appearance.colorTheme][
            strictKami ? 'light' : dark ? 'dark' : 'light'
          ]
        Object.entries(themeVars).forEach(([key, value]) =>
          root.style.setProperty(key, value),
        )
      }

      if (strictKami || appearance.accentColor === 'neutral')
        return

      const colorVars = accentColorVars[appearance.accentColor]
      for (const key of ['--primary', '--primary-foreground', '--ring']) {
        root.style.removeProperty(key)
        root.style.setProperty(key, colorVars[key])
      }
    }
    apply()
    if (theme === 'system') {
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [appearance.accentColor, appearance.colorTheme, appearance.radius, theme])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const editingText
        = target instanceof HTMLInputElement
          || target instanceof HTMLTextAreaElement
          || target?.isContentEditable
      const searchInput = document.getElementById('yunji-tab-search')
      if (document.querySelector('[role="dialog"]'))
        return

      const canRun = (shortcut: typeof keyboardShortcuts.focusSearch) =>
        !editingText || canTriggerShortcutWhileEditing(shortcut)

      if (
        shortcutMatchesEvent(keyboardShortcuts.openCommandPalette, event)
        && canRun(keyboardShortcuts.openCommandPalette)
      ) {
        event.preventDefault()
        setCommandOpen(true)
        return
      }
      if (
        shortcutMatchesEvent(keyboardShortcuts.focusSearch, event)
        && canRun(keyboardShortcuts.focusSearch)
      ) {
        event.preventDefault()
        searchInput?.focus()
        return
      }
      if (
        shortcutMatchesEvent(keyboardShortcuts.addBookmark, event)
        && canRun(keyboardShortcuts.addBookmark)
      ) {
        event.preventDefault()
        setEditing(null)
        setDialogOpen(true)
        return
      }
      if (event.key === 'Escape') {
        const query = useNavStore.getState().bookmarkSearchQuery
        if (query) {
          event.preventDefault()
          useNavStore.getState().setBookmarkSearchQuery('')
          searchInput?.focus()
        }
        return
      }
      if (
        !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(
          event.key,
        )
        || (editingText && !['ArrowDown', 'ArrowUp'].includes(event.key))
      ) {
        return
      }

      const items = Array.from(
        document.querySelectorAll<HTMLElement>('[data-nav-item]'),
      ).filter(item => item.offsetParent !== null)
      if (items.length === 0)
        return
      const currentIndex = items.indexOf(document.activeElement as HTMLElement)
      const backwards = event.key === 'ArrowUp' || event.key === 'ArrowLeft'
      const nextIndex
        = currentIndex < 0
          ? backwards
            ? items.length - 1
            : 0
          : (currentIndex + (backwards ? -1 : 1) + items.length) % items.length
      event.preventDefault()
      items[nextIndex]?.focus()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [keyboardShortcuts])

  const openAdd = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEdit = (bookmark: Bookmark) => {
    setEditing(bookmark)
    setDialogOpen(true)
  }

  return (
    <BookmarkDragDropProvider>
      <div
        className={cn(
          'min-h-dvh',
          backgroundStyleClass[appearance.backgroundStyle],
        )}
      >
        <Header
          onAdd={openAdd}
          onOpenCommand={() => setCommandOpen(true)}
          healthOpen={healthOpen}
          onHealthOpenChange={setHealthOpen}
        />

        <div
          className={
            appearance.navLayout === 'sidebar'
              ? appearance.navItems.categoryTree
                ? 'lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]'
                : 'lg:grid lg:grid-cols-[14.5rem_minmax(0,1fr)]'
              : 'flex flex-col'
          }
        >
          <aside
            className={
              appearance.navLayout === 'sidebar'
                ? 'border-b border-border/60 bg-background/45 px-3 py-2 lg:sticky lg:top-[4.5rem] lg:h-[calc(100dvh-4.5rem)] lg:border-b-0 lg:border-r lg:px-3 lg:py-5'
                : 'sticky top-[7.75rem] z-30 border-b border-border/60 bg-background/95 px-3 py-2 sm:px-5 lg:top-[4.5rem] lg:px-6'
            }
          >
            <CategoryTabs onEditCategory={setEditingCategory} />
          </aside>

          <main className="relative min-w-0 px-3 py-5 sm:px-5 sm:py-6 lg:px-7 lg:py-7 xl:px-10">
            {appearance.catDecorations ? <CatDoodles /> : null}
            <div
              className={cn(
                'relative',
                contentWidthClass[appearance.contentWidth],
              )}
            >
              <BookmarkGrid
                loading={!bookmarksReady}
                onEdit={openEdit}
                onEditCategory={setEditingCategory}
                onAdd={openAdd}
              />
            </div>
          </main>
        </div>

        <Suspense
          fallback={
            <LazyDialogFallback label={translate(language, 'brandName')} />
          }
        >
          {dialogOpen
            ? (
                <BookmarkDialog
                  open={dialogOpen}
                  onOpenChange={setDialogOpen}
                  bookmark={editing}
                />
              )
            : null}
          {editingCategory
            ? (
                <CategoryDialog
                  open
                  onOpenChange={(nextOpen) => {
                    if (!nextOpen)
                      setEditingCategory(null)
                  }}
                  category={editingCategory}
                />
              )
            : null}
          {commandOpen
            ? (
                <CommandPalette
                  open
                  onOpenChange={setCommandOpen}
                  onAddBookmark={openAdd}
                  onOpenHealth={() => setHealthOpen(true)}
                />
              )
            : null}
        </Suspense>
        <UndoDeletionToast />
      </div>
    </BookmarkDragDropProvider>
  )
}
