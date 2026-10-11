import { describe, expect, it } from 'vitest'
import { normalizeAppearanceSettings } from './appearance'

describe('appearance settings', () => {
  it('enables category tree and smart categories by default while preserving explicit choices', () => {
    const defaults = normalizeAppearanceSettings()
    const explicitChoices = normalizeAppearanceSettings({
      navItems: { categoryTree: false, smartCategories: false },
    })

    expect(defaults.navItems.smartCategories).toBe(true)
    expect(defaults.navItems.categoryTree).toBe(true)
    expect(explicitChoices.navItems.smartCategories).toBe(false)
    expect(explicitChoices.navItems.categoryTree).toBe(false)
  })

  it('shows icons for older settings and preserves explicit hidden choices', () => {
    const defaults = normalizeAppearanceSettings({ cardFields: { tags: false }, navItems: { counts: false } })
    expect(defaults.cardFields.websiteIcon).toBe(true)
    expect(defaults.navItems.icons).toBe(true)
    const hidden = normalizeAppearanceSettings({ cardFields: { websiteIcon: false }, navItems: { icons: false } })
    expect(hidden.cardFields.websiteIcon).toBe(false)
    expect(hidden.navItems.icons).toBe(false)
  })

  it('keeps cat decorations off by default while preserving an explicit choice', () => {
    expect(normalizeAppearanceSettings().catDecorations).toBe(false)
    expect(
      normalizeAppearanceSettings({ catDecorations: true }).catDecorations,
    ).toBe(true)
  })
})
