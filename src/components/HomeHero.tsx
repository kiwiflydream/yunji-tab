import type { MouseEvent, PointerEvent } from 'react'
import type { BookmarkGroup } from '~/lib/bookmark-groups'
import type { Bookmark } from '~/lib/types'
import { useDndContext } from '@dnd-kit/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BookmarkGroupMenu } from '~/components/BookmarkGroupMenu'
import { BookmarkIcon } from '~/components/BookmarkIcon'
import { GroupStackGraphic } from '~/components/GroupStackGraphic'
import { HeaderWidget } from '~/components/HeaderWidget'
import { SearchBar } from '~/components/SearchBar'
import { useBookmarkGroupMenu } from '~/components/useBookmarkGroupMenu'
import { useBookmarkGroupsStore } from '~/lib/bookmark-groups-store'
import { openBookmarkUrl } from '~/lib/bookmark-urls'
import { bookmarkCardKey, getPinnedCards, groupCardKey } from '~/lib/card-order'
import { contentMotionAllowed } from '~/lib/motion'
import { useBookmarks, useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'
import { cn } from '~/lib/utils'

const MAX_PINNED_SHORTCUTS = 10

// The entrance plays once per new tab, not again when the layout is switched back to centered.
let heroEntered = false
// Long enough for the last child's delay plus its rise; afterwards remounted children (pinned row after a search) just appear.
const ENTRANCE_WINDOW_MS = 700

interface HomeHeroProps {
  onOpenCommand: () => void
  onDockedChange: (docked: boolean) => void
}

type PinnedEntry = { key: string } & ({ bookmark: Bookmark, group?: never } | { group: BookmarkGroup, bookmark?: never })

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
          className="rounded-2xl bg-card bg-none shadow-sm transition-transform duration-200 motion-safe:group-hover:-translate-y-0.5 group-hover:shadow-md motion-safe:group-active:scale-95"
        />
        <span className="w-full truncate text-xs text-muted-foreground transition-colors group-hover:text-foreground">
          {bookmark.name}
        </span>
      </a>
    </li>
  )
}

interface PinnedGroupShortcutProps {
  group: BookmarkGroup
  expanded: boolean
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void
  onHover: (event: PointerEvent<HTMLButtonElement>) => void
  onLeave: () => void
}

function PinnedGroupShortcut({ group, expanded, onOpen, onHover, onLeave }: PinnedGroupShortcutProps) {
  const appearance = useNavStore(state => state.settings.appearance)
  const iconAppearance = { ...appearance, iconSize: 'md' as const }
  return (
    <li>
      <button
        type="button"
        data-group-shortcut={group.id}
        title={group.title}
        aria-haspopup="menu"
        aria-expanded={expanded}
        aria-controls={expanded ? `bookmark-group-menu-${group.id}` : undefined}
        onClick={onOpen}
        onPointerEnter={onHover}
        onPointerMove={onHover}
        onPointerLeave={onLeave}
        className="group flex w-[4.5rem] flex-col items-center gap-2 rounded-xl py-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <div className="transition-transform duration-200 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-focus-visible:-translate-y-0.5 motion-safe:group-active:scale-95">
          {group.icon
            ? <BookmarkIcon icon={group.icon} name={group.title} appearance={iconAppearance} className="rounded-2xl bg-card bg-none shadow-sm group-hover:shadow-md group-focus-visible:shadow-md" />
            : <GroupStackGraphic appearance={iconAppearance} compact={false} members={group.bookmarks} />}
        </div>
        <span className="w-full truncate text-xs text-muted-foreground transition-colors group-hover:text-foreground">{group.title}</span>
      </button>
    </li>
  )
}

export function HomeHero({ onOpenCommand, onDockedChange }: HomeHeroProps) {
  const searchRef = useRef<HTMLDivElement>(null)
  const [entrance, setEntrance] = useState(() => !heroEntered && contentMotionAllowed())
  const { t } = useI18n()
  const bookmarks = useBookmarks()
  const groups = useBookmarkGroupsStore(state => state.groups)
  const groupsEnabled = useNavStore(state => state.settings.bookmarkGroupsEnabled)
  const searching = useNavStore(state => state.bookmarkSearchQuery.trim().length > 0)
  const appearance = useNavStore(state => state.settings.appearance)
  const dragging = Boolean(useDndContext().active)
  const { menu, setMenu, closeMenu, keepMenuOpen, leaveGroup, openGroup, hoverGroup } = useBookmarkGroupMenu(dragging || searching)
  const widget = useNavStore(state => state.settings.headerWidget)
  const pinned = useMemo(() => {
    const entries = new Map<string, PinnedEntry>()
    for (const bookmark of bookmarks) {
      const key = bookmarkCardKey(bookmark.url)
      if (!entries.has(key))
        entries.set(key, { key, bookmark })
    }
    const visibleGroups = groupsEnabled ? groups : []
    for (const group of visibleGroups) {
      const key = groupCardKey(group.id)
      entries.set(key, { key, group })
    }
    return getPinnedCards(bookmarks, visibleGroups)
      .slice(0, MAX_PINNED_SHORTCUTS)
      .map(card => entries.get(card.key)!)
  }, [bookmarks, groups, groupsEnabled])
  const menuGroup = searching ? undefined : pinned.find(entry => entry.group?.id === menu?.id)?.group
  if (menu && (!menuGroup || dragging))
    setMenu(null)

  useEffect(() => {
    heroEntered = true
    const timer = window.setTimeout(setEntrance, ENTRANCE_WINDOW_MS, false)
    return () => window.clearTimeout(timer)
  }, [])

  // Once the search box slides under the sticky header, the header borrows search and time until it comes back.
  useEffect(() => {
    let frame = 0
    let docked = false
    const measure = () => {
      frame = 0
      const search = searchRef.current?.getBoundingClientRect()
      const header = document.querySelector('header')?.getBoundingClientRect()
      const next = Boolean(search && header && search.bottom <= header.bottom)
      if (next !== docked) {
        docked = next
        onDockedChange(next)
      }
    }
    const schedule = () => {
      if (!frame)
        frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      onDockedChange(false)
    }
  }, [onDockedChange])

  return (
    <>
      <section data-home-hero className={cn('flex flex-col items-center gap-6 pb-10 pt-6 sm:pt-10', entrance && 'home-hero-entrance')}>
        {widget.clockEnabled || widget.weatherEnabled ? <HeaderWidget variant="hero" /> : null}
        <div ref={searchRef} className="flex w-full justify-center">
          <SearchBar onOpenCommand={onOpenCommand} variant="hero" />
        </div>
        {!searching && pinned.length > 0
          ? (
              <nav aria-label={t('pinnedShortcuts')} className="w-full">
                <ul className="flex flex-wrap justify-center gap-x-3 gap-y-4">
                  {pinned.map(entry => entry.group
                    ? (
                        <PinnedGroupShortcut
                          key={entry.key}
                          group={entry.group}
                          expanded={menuGroup?.id === entry.group.id}
                          onOpen={event => openGroup(entry.group, event)}
                          onHover={event => hoverGroup(entry.group, event)}
                          onLeave={() => leaveGroup(entry.group.id)}
                        />
                      )
                    : <PinnedShortcut key={entry.key} bookmark={entry.bookmark} />)}
                </ul>
              </nav>
            )
          : null}
      </section>
      {menu && menuGroup
        ? (
            <BookmarkGroupMenu
              key={menu.id}
              group={menuGroup}
              anchor={menu}
              appearance={appearance}
              onPointerEnter={keepMenuOpen}
              onPointerLeave={() => leaveGroup()}
              onClose={closeMenu}
            />
          )
        : null}
    </>
  )
}
