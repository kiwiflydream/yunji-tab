import { describe, expect, it } from 'vitest'
import {
  globalPaletteSessionKey,
  isGlobalPaletteSessionValid,
} from './global-command-palette'

describe('global command palette sessions', () => {
  it('namespaces session tokens', () => {
    expect(globalPaletteSessionKey('token')).toBe(
      'yunji-tab:global-palette-session:token',
    )
  })

  it('accepts a live session for the expected tab', () => {
    expect(
      isGlobalPaletteSessionValid({ tabId: 7, expiresAt: 2_000 }, 7, 1_000),
    ).toBe(true)
  })

  it('rejects expired and cross-tab sessions', () => {
    expect(
      isGlobalPaletteSessionValid({ tabId: 7, expiresAt: 1_000 }, 7, 1_000),
    ).toBe(false)
    expect(
      isGlobalPaletteSessionValid({ tabId: 7, expiresAt: 2_000 }, 8, 1_000),
    ).toBe(false)
  })
})
