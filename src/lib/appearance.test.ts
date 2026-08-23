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

  it('keeps cat decorations off by default while preserving an explicit choice', () => {
    expect(normalizeAppearanceSettings().catDecorations).toBe(false)
    expect(
      normalizeAppearanceSettings({ catDecorations: true }).catDecorations,
    ).toBe(true)
  })
})
