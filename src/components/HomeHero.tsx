import type { MouseEvent } from 'react'
import type { Bookmark } from '~/lib/types'
import { useMemo } from 'react'
import { BookmarkIcon } from '~/components/BookmarkIcon'
import { HeaderWidget } from '~/components/HeaderWidget'
import { SearchBar } from '~/components/SearchBar'
import { openBookmarkUrl } from '~/lib/bookmark-urls'
import { pinnedCardRank } from '~/lib/card-order'
import { useBookmarks, useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

const MAX_PINNED_SHORTCUTS = 10

interface HomeHeroProps {
  onOpenCommand: () => void
}

function PinnedShortcut({ bookmark }: { bookmark: Bookmark }) {
  const appearance = useNavStore(state => state.settings.appearance)
  const recordBookmarkOpen = useNavStore(state => state.recordBookmarkOpen)
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    void recordBookmarkOpen(bookmark.url).catch(() => undefined)
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    event.preventDefault()
    void openBookmarkUrl(bookmark)
  }

  return (
    <li>
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        title={bookmark.name}
        onClick={open}
        className="group flex w-[4.5rem] flex-col items-center gap-2 rounded-xl py-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <BookmarkIcon
          icon={bookmark.icon}
          url={bookmark.url}
          name={bookmark.name}
          appearance={{ ...appearance, iconSize: 'md' }}
          className="rounded-2xl bg-card bg-none shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md group-active:scale-95 motion-reduce:transform-none"
        />
        <span className="w-full truncate text-xs text-muted-foreground transition-colors group-hover:text-foreground">
          {bookmark.name}
        </span>
      </a>
    </li>
  )
}

export function HomeHero({ onOpenCommand }: HomeHeroProps) {
  const { t } = useI18n()
  const bookmarks = useBookmarks()
  const searching = useNavStore(state => state.bookmarkSearchQuery.trim().length > 0)
  const widget = useNavStore(state => state.settings.headerWidget)
  const pinned = useMemo(() => {
    const seen = new Set<string>()
    return bookmarks
      .filter(bookmark => bookmark.pinnedAt)
      .sort((left, right) => pinnedCardRank({ pinnedAt: left.pinnedAt!, pinnedOrder: left.pinnedOrder }) - pinnedCardRank({ pinnedAt: right.pinnedAt!, pinnedOrder: right.pinnedOrder }))
      .filter((bookmark) => {
        if (seen.has(bookmark.url))
          return false
        seen.add(bookmark.url)
        return true
      })
      .slice(0, MAX_PINNED_SHORTCUTS)
  }, [bookmarks])

  return (
    <section data-home-hero className="flex flex-col items-center gap-6 pb-10 pt-6 sm:pt-10">
      {widget.clockEnabled || widget.weatherEnabled ? <HeaderWidget variant="hero" /> : null}
      <div className="flex w-full justify-center">
        <SearchBar onOpenCommand={onOpenCommand} variant="hero" />
      </div>
      {!searching && pinned.length > 0
        ? (
            <nav aria-label={t('pinnedShortcuts')} className="w-full">
              <ul className="flex flex-wrap justify-center gap-x-3 gap-y-4">
                {pinned.map(bookmark => <PinnedShortcut key={bookmark.id} bookmark={bookmark} />)}
              </ul>
            </nav>
          )
        : null}
    </section>
  )
}
