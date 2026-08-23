import type {
  KeyboardShortcut,
  KeyboardShortcuts,
  ShortcutAction,
} from './types'

export const SHORTCUT_ACTIONS = [
  'focusSearch',
  'openCommandPalette',
  'addBookmark',
] as const satisfies readonly ShortcutAction[]

export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcuts = {
  focusSearch: {
    key: '/',
    primary: false,
    alt: false,
    shift: false,
  },
  openCommandPalette: {
    key: 'k',
    primary: true,
    alt: false,
    shift: false,
  },
  addBookmark: {
    key: 'n',
    primary: false,
    alt: false,
    shift: false,
  },
}

export type ShortcutValidationIssue = 'reserved' | 'unsupported'

type ShortcutEvent = Pick<
  KeyboardEvent,
  'altKey' | 'ctrlKey' | 'key' | 'metaKey' | 'shiftKey'
>

const MODIFIER_KEYS = new Set(['alt', 'altgraph', 'control', 'meta', 'shift'])

const RESERVED_NAVIGATION_KEYS = new Set([
  'arrowdown',
  'arrowleft',
  'arrowright',
  'arrowup',
  'backspace',
  'delete',
  'end',
  'enter',
  'escape',
  'home',
  'pagedown',
  'pageup',
  'tab',
])

const RESERVED_PRIMARY_KEYS = new Set(['l', 'r', 't', 'w'])
const RESERVED_PRIMARY_SHIFT_KEYS = new Set(['n', 't', 'w'])

function normalizeKey(key: string): string {
  if (key === ' ')
    return 'space'
  return key.trim().toLowerCase()
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function shortcutSignature(shortcut: KeyboardShortcut): string {
  return [
    shortcut.primary ? 'primary' : '',
    shortcut.alt ? 'alt' : '',
    shortcut.shift ? 'shift' : '',
    normalizeKey(shortcut.key),
  ].join('+')
}

export function shortcutsEqual(
  left: KeyboardShortcut,
  right: KeyboardShortcut,
): boolean {
  return shortcutSignature(left) === shortcutSignature(right)
}

export function validateShortcut(
  shortcut: KeyboardShortcut,
): ShortcutValidationIssue | undefined {
  const key = normalizeKey(shortcut.key)
  if (
    !key
    || MODIFIER_KEYS.has(key)
    || key === 'dead'
    || key === 'unidentified'
  ) {
    return 'unsupported'
  }
  if (RESERVED_NAVIGATION_KEYS.has(key))
    return 'reserved'
  if (
    shortcut.primary
    && !shortcut.alt
    && !shortcut.shift
    && RESERVED_PRIMARY_KEYS.has(key)
  ) {
    return 'reserved'
  }
  if (
    shortcut.primary
    && !shortcut.alt
    && shortcut.shift
    && RESERVED_PRIMARY_SHIFT_KEYS.has(key)
  ) {
    return 'reserved'
  }
  if (shortcut.alt && key === 'f4')
    return 'reserved'
  return undefined
}

export function shortcutFromKeyboardEvent(
  event: ShortcutEvent,
): KeyboardShortcut | undefined {
  const shortcut: KeyboardShortcut = {
    key: normalizeKey(event.key),
    primary: event.metaKey || event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
  }
  return validateShortcut(shortcut) === 'unsupported' ? undefined : shortcut
}

export function shortcutMatchesEvent(
  shortcut: KeyboardShortcut,
  event: ShortcutEvent,
): boolean {
  return (
    normalizeKey(shortcut.key) === normalizeKey(event.key)
    && shortcut.primary === (event.metaKey || event.ctrlKey)
    && shortcut.alt === event.altKey
    && shortcut.shift === event.shiftKey
  )
}

export function canTriggerShortcutWhileEditing(
  shortcut: KeyboardShortcut,
): boolean {
  return shortcut.primary || shortcut.alt
}

function normalizeShortcut(value: unknown): KeyboardShortcut | undefined {
  if (!isObject(value) || typeof value.key !== 'string')
    return undefined
  const shortcut: KeyboardShortcut = {
    key: normalizeKey(value.key),
    primary: value.primary === true,
    alt: value.alt === true,
    shift: value.shift === true,
  }
  return validateShortcut(shortcut) ? undefined : shortcut
}

export function normalizeKeyboardShortcuts(value: unknown): KeyboardShortcuts {
  if (!isObject(value))
    return structuredClone(DEFAULT_KEYBOARD_SHORTCUTS)

  const normalized = Object.fromEntries(
    SHORTCUT_ACTIONS.map(action => [
      action,
      normalizeShortcut(value[action]) ?? DEFAULT_KEYBOARD_SHORTCUTS[action],
    ]),
  ) as KeyboardShortcuts
  const signatures = SHORTCUT_ACTIONS.map(action =>
    shortcutSignature(normalized[action]),
  )
  if (new Set(signatures).size !== signatures.length)
    return structuredClone(DEFAULT_KEYBOARD_SHORTCUTS)
  return normalized
}

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined')
    return false
  return /mac|iphone|ipad/i.test(navigator.platform)
}

const KEY_LABELS: Record<string, string> = {
  ',': ',',
  '.': '.',
  '/': '/',
  'space': 'Space',
}

export function formatShortcutParts(
  shortcut: KeyboardShortcut,
  mac = isMacPlatform(),
): string[] {
  const parts: string[] = []
  if (shortcut.primary)
    parts.push(mac ? '⌘' : 'Ctrl')
  if (shortcut.alt)
    parts.push(mac ? '⌥' : 'Alt')
  if (shortcut.shift)
    parts.push(mac ? '⇧' : 'Shift')
  const key = normalizeKey(shortcut.key)
  parts.push(KEY_LABELS[key] ?? key.toUpperCase())
  return parts
}

export function formatShortcut(
  shortcut: KeyboardShortcut,
  mac = isMacPlatform(),
): string {
  const parts = formatShortcutParts(shortcut, mac)
  return parts.join(mac ? ' ' : ' + ')
}

export function formatChromeShortcutParts(
  shortcut: string,
  mac = isMacPlatform(),
): string[] {
  const aliases: Record<string, string> = {
    alt: mac ? '⌥' : 'Alt',
    command: mac ? '⌘' : 'Command',
    ctrl: mac ? '⌃' : 'Ctrl',
    control: mac ? '⌃' : 'Ctrl',
    macctrl: '⌃',
    shift: mac ? '⇧' : 'Shift',
  }
  return shortcut
    .split('+')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => aliases[part.toLowerCase()] ?? part.toUpperCase())
}
