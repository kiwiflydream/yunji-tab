import { describe, expect, it } from 'vitest'
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  formatShortcut,
  normalizeKeyboardShortcuts,
  shortcutFromKeyboardEvent,
  shortcutMatchesEvent,
  validateShortcut,
} from './keyboard-shortcuts'

function event(key: string, modifiers: Partial<{
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}> = {}) {
  return {
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...modifiers,
  }
}

describe('keyboard shortcuts', () => {
  it('matches Primary against Ctrl and Command', () => {
    const shortcut = DEFAULT_KEYBOARD_SHORTCUTS.openCommandPalette

    expect(shortcutMatchesEvent(shortcut, event('K', { ctrlKey: true }))).toBe(
      true,
    )
    expect(shortcutMatchesEvent(shortcut, event('k', { metaKey: true }))).toBe(
      true,
    )
    expect(shortcutMatchesEvent(shortcut, event('k'))).toBe(false)
  })

  it('captures a platform-neutral shortcut from a keyboard event', () => {
    expect(
      shortcutFromKeyboardEvent(event('P', { metaKey: true, shiftKey: true })),
    ).toEqual({
      key: 'p',
      primary: true,
      alt: false,
      shift: true,
    })
  })

  it('keeps navigation and browser-reserved shortcuts unavailable', () => {
    expect(
      validateShortcut({
        key: 'ArrowDown',
        primary: false,
        alt: false,
        shift: false,
      }),
    ).toBe('reserved')
    expect(
      validateShortcut({
        key: 'l',
        primary: true,
        alt: false,
        shift: false,
      }),
    ).toBe('reserved')
  })

  it('falls back to defaults for missing or conflicting persisted values', () => {
    expect(normalizeKeyboardShortcuts(undefined)).toEqual(
      DEFAULT_KEYBOARD_SHORTCUTS,
    )
    expect(
      normalizeKeyboardShortcuts({
        focusSearch: DEFAULT_KEYBOARD_SHORTCUTS.openCommandPalette,
        openCommandPalette: DEFAULT_KEYBOARD_SHORTCUTS.openCommandPalette,
        addBookmark: DEFAULT_KEYBOARD_SHORTCUTS.addBookmark,
      }),
    ).toEqual(DEFAULT_KEYBOARD_SHORTCUTS)
  })

  it('formats shortcuts for macOS and other platforms', () => {
    const shortcut = DEFAULT_KEYBOARD_SHORTCUTS.openCommandPalette

    expect(formatShortcut(shortcut, true)).toBe('⌘ K')
    expect(formatShortcut(shortcut, false)).toBe('Ctrl + K')
  })
})
