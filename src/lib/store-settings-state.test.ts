import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  resolveAvailableCategoryId,
} from './store-settings-state'

describe('store settings state', () => {
  it('normalizes invalid persisted values to safe defaults', () => {
    const settings = normalizeSettings({
      language: 'invalid' as never,
      theme: 'invalid' as never,
      bookmarkSortMode: 'invalid' as never,
      bookmarkViewMode: 'invalid' as never,
      defaultCategoryId: '  ',
      descriptionIgnoredDomains: [' Example.COM ', 'example.com'],
      savedSearches: [
        { id: 'valid', name: 'Valid', query: 'tag:work' },
        { id: '', name: 'Invalid', query: '' },
      ],
    })

    expect(settings.language).toBe(DEFAULT_SETTINGS.language)
    expect(settings.theme).toBe(DEFAULT_SETTINGS.theme)
    expect(settings.bookmarkSortMode).toBe('manual')
    expect(settings.bookmarkViewMode).toBe('grid')
    expect(settings.defaultCategoryId).toBe('all')
    expect(settings.globalCommandPaletteEnabled).toBe(false)
    expect(settings.descriptionIgnoredDomains).toEqual(['example.com'])
    expect(settings.savedSearches).toEqual([
      { id: 'valid', name: 'Valid', query: 'tag:work' },
    ])
    expect(settings.keyboardShortcuts).toEqual(
      DEFAULT_SETTINGS.keyboardShortcuts,
    )
  })

  it('only enables the global command palette for an explicit true value', () => {
    expect(normalizeSettings().globalCommandPaletteEnabled).toBe(false)
    expect(normalizeSettings({ globalCommandPaletteEnabled: false })
      .globalCommandPaletteEnabled).toBe(false)
    expect(normalizeSettings({ globalCommandPaletteEnabled: true })
      .globalCommandPaletteEnabled).toBe(true)
  })

  it('keeps supported interface languages', () => {
    for (const language of [
      'zh-CN',
      'zh-TW',
      'en',
      'ja',
      'ko',
      'es',
      'fr',
    ] as const)
      expect(normalizeSettings({ language }).language).toBe(language)
  })

  it('keeps virtual and existing categories while rejecting stale ids', () => {
    const categories = [
      {
        id: 'cat-10',
        name: 'Work',
        emoji: '💼',
        parentId: 'all',
        modifiable: true,
      },
    ]

    expect(resolveAvailableCategoryId('recent', categories)).toBe('recent')
    expect(resolveAvailableCategoryId('pinned', categories)).toBe('pinned')
    expect(resolveAvailableCategoryId('cat-10', categories)).toBe('cat-10')
    expect(resolveAvailableCategoryId('cat-missing', categories)).toBe('all')
  })
})
