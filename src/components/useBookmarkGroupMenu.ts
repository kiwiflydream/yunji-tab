import type { MouseEvent, PointerEvent } from 'react'
import type { BookmarkGroupMenuAnchor } from '~/components/BookmarkGroupMenu'
import type { BookmarkGroup } from '~/lib/bookmark-groups'
import { useEffect, useRef, useState } from 'react'

const HOVER_OPEN_DELAY = 100

/** Shared hover, click and dismissal behavior for group cards and pinned shortcuts. */
export function useBookmarkGroupMenu(hoverDisabled = false) {
  const [menu, setMenu] = useState<BookmarkGroupMenuAnchor | null>(null)
  const menuRef = useRef(menu)
  menuRef.current = menu
  const disabledRef = useRef(hoverDisabled)
  disabledRef.current = hoverDisabled
  const dismissedTriggerRef = useRef<HTMLButtonElement | null>(null)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingHoverRef = useRef<BookmarkGroupMenuAnchor | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimers = () => {
    if (openTimerRef.current !== null)
      clearTimeout(openTimerRef.current)
    if (closeTimerRef.current !== null)
      clearTimeout(closeTimerRef.current)
    openTimerRef.current = null
    pendingHoverRef.current = null
    closeTimerRef.current = null
  }
  useEffect(() => clearTimers, [])
  const closeMenu = () => {
    // An old member-opening promise must not dismiss a newly opened menu.
    if (menuRef.current !== menu)
      return
    dismissedTriggerRef.current = menu?.trigger ?? null
    clearTimers()
    setMenu(current => current === menu ? null : current)
  }
  const keepMenuOpen = () => clearTimers()
  const leaveGroup = (groupId?: string) => {
    const dismissed = dismissedTriggerRef.current
    if (groupId && (dismissed?.dataset.groupShortcut === groupId
      || dismissed?.closest('[data-bookmark-group-id]')?.getAttribute('data-bookmark-group-id') === groupId)) {
      dismissedTriggerRef.current = null
    }
    clearTimers()
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null
      setMenu(current => current?.hover && !document.getElementById(`bookmark-group-menu-${current.id}`)?.contains(document.activeElement) ? null : current)
    }, 200)
  }
  const openGroup = (group: Pick<BookmarkGroup, 'id'>, event: MouseEvent<HTMLButtonElement>) => {
    clearTimers()
    const trigger = event.currentTarget
    if (menu?.id === group.id && !menu.hover)
      dismissedTriggerRef.current = trigger
    const keyboard = event.detail === 0
    const bounds = trigger.getBoundingClientRect()
    setMenu((current) => {
      if (current?.id === group.id && !current.hover)
        return null
      // Promote the existing hover menu without changing its DOM or anchor.
      if (current?.id === group.id)
        return { ...current, trigger, keyboard, hover: false }
      return {
        id: group.id,
        x: keyboard ? bounds.left : event.clientX,
        y: keyboard ? bounds.bottom : event.clientY,
        trigger,
        keyboard,
        hover: false,
      }
    })
  }
  const hoverGroup = (group: Pick<BookmarkGroup, 'id'>, event: PointerEvent<HTMLButtonElement>) => {
    if (hoverDisabled || event.pointerType !== 'mouse' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches)
      return
    if (dismissedTriggerRef.current === event.currentTarget) {
      if (event.type === 'pointerenter' && event.relatedTarget instanceof Element && !event.relatedTarget.closest('.bookmark-group-menu'))
        dismissedTriggerRef.current = null
      else
        return
    }
    // Pointer movement updates the anchor without restarting the dwell timer.
    if (openTimerRef.current !== null && pendingHoverRef.current?.trigger === event.currentTarget) {
      pendingHoverRef.current.x = event.clientX
      pendingHoverRef.current.y = event.clientY
      return
    }
    clearTimers()
    if (menu?.id === group.id)
      return
    const trigger = event.currentTarget
    const { clientX: x, clientY: y } = event
    pendingHoverRef.current = { id: group.id, x, y, trigger, keyboard: false, hover: true }
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null
      const pending = pendingHoverRef.current
      pendingHoverRef.current = null
      if (pending && !disabledRef.current && trigger.isConnected && trigger.matches(':hover'))
        setMenu(pending)
    }, HOVER_OPEN_DELAY)
  }
  return { menu, setMenu, clearTimers, closeMenu, keepMenuOpen, leaveGroup, openGroup, hoverGroup }
}
