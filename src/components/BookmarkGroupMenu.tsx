import type { BookmarkGroup, BookmarkGroupMember } from '~/lib/bookmark-groups'
import type { AppearanceSettings } from '~/lib/types'
import * as Popover from '@radix-ui/react-popover'
import { useEffect, useMemo, useRef, useState } from 'react'
import { radiusClass } from '~/lib/appearance'
import { resolveGroupBookmark } from '~/lib/bookmark-groups'
import { openBookmarkUrl } from '~/lib/bookmark-urls'
import { useBookmarks, useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'
import { cn } from '~/lib/utils'

export interface BookmarkGroupMenuAnchor {
  id: string
  x: number
  y: number
  hover: boolean
  keyboard: boolean
  trigger: HTMLButtonElement
}

interface BookmarkGroupMenuProps {
  group: BookmarkGroup
  anchor: BookmarkGroupMenuAnchor
  appearance: AppearanceSettings
  onPointerEnter: () => void
  onPointerLeave: () => void
  onClose: () => void
}

export function BookmarkGroupMenu({ group, anchor, appearance, onPointerEnter, onPointerLeave, onClose }: BookmarkGroupMenuProps) {
  const { t } = useI18n()
  const contentRef = useRef<HTMLDivElement>(null)
  const interactedOutsideRef = useRef(false)
  const focusWasInsideRef = useRef(false)
  const typeaheadRef = useRef({ text: '', time: 0 })
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const inFlightRef = useRef(false)
  const [opening, setOpening] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const bookmarks = useBookmarks()
  const availableUrls = useMemo(() => new Set(bookmarks.map(bookmark => bookmark.url)), [bookmarks])

  useEffect(() => {
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && contentRef.current?.contains(event.target))
        return
      onClose()
    }
    window.addEventListener('resize', dismiss)
    return () => {
      window.removeEventListener('resize', dismiss)
    }
  }, [onClose])

  const openMember = async (member: BookmarkGroupMember) => {
    const bookmark = resolveGroupBookmark(member, useNavStore.getState().bookmarks)
    if (!bookmark || inFlightRef.current)
      return
    inFlightRef.current = true
    setOpening(member.url)
    setError(false)
    try {
      await openBookmarkUrl(bookmark)
      await useNavStore.getState().recordBookmarkOpen(bookmark.url)
      onClose()
    }
    catch {
      setError(true)
    }
    finally {
      inFlightRef.current = false
      setOpening(null)
    }
  }

  return (
    <Popover.Root open modal={false} onOpenChange={open => !open && onClose()}>
      {/* A point anchor keeps the list near the pointer without moving the card layout. */}
      <Popover.Anchor asChild>
        <span aria-hidden="true" tabIndex={-1} className="pointer-events-none fixed size-px" style={{ left: anchor.x, top: anchor.y, margin: 0 }} />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          role="menu"
          aria-orientation="vertical"
          ref={contentRef}
          id={`bookmark-group-menu-${group.id}`}
          aria-labelledby={undefined}
          aria-label={t('viewNamedGroup', { name: group.title })}
          aria-busy={opening !== null}
          tabIndex={0}
          align="start"
          alignOffset={8}
          sideOffset={8}
          collisionPadding={8}
          sticky="always"
          data-keyboard={anchor.keyboard ? 'true' : undefined}
          className={cn('bookmark-group-menu z-50 w-60 max-w-[calc(100vw-16px)] overflow-y-auto overflow-x-hidden overscroll-contain border border-border/70 bg-popover p-1.5 text-sm text-popover-foreground shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 origin-[--radix-popover-content-transform-origin]', radiusClass[appearance.radius])}
          style={{ maxHeight: 'min(276px, var(--radix-popover-content-available-height))' }}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          onFocus={() => {
            focusWasInsideRef.current = true
            onPointerEnter()
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            if (anchor.hover)
              return
            const firstItem = contentRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')
            const initialFocus = anchor.keyboard ? firstItem ?? contentRef.current : contentRef.current
            initialFocus?.focus({ preventScroll: true })
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const anotherSurfaceOpen = Array.from(document.querySelectorAll('[role="menu"], [role="dialog"], [role="alertdialog"]'))
              .some(surface => surface.id !== `bookmark-group-menu-${group.id}` && surface.getAttribute('data-state') !== 'closed')
            if ((!anchor.hover || focusWasInsideRef.current) && !interactedOutsideRef.current && !anotherSurfaceOpen && anchor.trigger.isConnected)
              anchor.trigger.focus({ preventScroll: true })
          }}
          onInteractOutside={(event) => {
            // Keep the same-card click available to toggle the menu instead of reopening it.
            const target = event.detail.originalEvent.target
            if (target instanceof Node && anchor.trigger.contains(target))
              event.preventDefault()
            else
              interactedOutsideRef.current = true
          }}
          onKeyDown={(event) => {
            // The page also handles arrows to navigate cards; menu keys stay inside the menu.
            event.stopPropagation()
            if (event.key === 'Tab') {
              event.preventDefault()
              onClose()
              return
            }
            const items = Array.from(contentRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])
            const index = items.indexOf(document.activeElement as HTMLButtonElement)
            let next: HTMLButtonElement | undefined
            if (event.key === 'ArrowDown') {
              next = items[Math.min(index + 1, items.length - 1)]
            }
            else if (event.key === 'ArrowUp') {
              next = items[index < 0 ? items.length - 1 : Math.max(index - 1, 0)]
            }
            else if (event.key === 'Home') {
              next = items[0]
            }
            else if (event.key === 'End') {
              next = items.at(-1)
            }
            else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== ' ') {
              const now = Date.now()
              const previous = typeaheadRef.current
              const text = (now - previous.time < 700 ? previous.text : '') + event.key.toLocaleLowerCase()
              typeaheadRef.current = { text, time: now }
              const candidates = [...items.slice(index + 1), ...items.slice(0, index + 1)]
              next = candidates.find(item => item.textContent?.trim().toLocaleLowerCase().startsWith(text))
            }
            if (next) {
              event.preventDefault()
              next.focus({ preventScroll: true })
              next.scrollIntoView({ block: 'nearest' })
            }
          }}
        >
          {group.bookmarks.map((member) => {
            const available = availableUrls.has(member.url)
            return (
              <button
                key={member.id}
                role="menuitem"
                tabIndex={-1}
                data-highlighted={highlighted === member.id ? '' : undefined}
                onFocus={() => setHighlighted(member.id)}
                onPointerMove={(event) => {
                  if (event.pointerType === 'mouse' && available)
                    setHighlighted(member.id)
                }}
                onPointerLeave={() => setHighlighted(null)}
                onClick={() => void openMember(member)}
                type="button"
                disabled={!available || opening !== null}
                aria-label={t('openGroupBookmark', { name: member.title })}
                title={available ? member.title : t('groupBookmarkMissing')}
                className="flex min-h-11 w-full cursor-pointer select-none items-center rounded-sm px-3 py-2.5 text-left leading-5 outline-none transition-[color,background-color,transform] active:scale-[0.99] data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 touch-manipulation"
              >
                <span className="line-clamp-2 break-words">{member.title}</span>
              </button>
            )
          })}
          {error ? <p role="alert" className="px-3 py-2 text-xs text-destructive">{t('groupOpenFailed')}</p> : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
