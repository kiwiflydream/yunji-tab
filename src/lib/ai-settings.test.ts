import type { Language } from './types'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AI_BATCH_SIZE,
  getDefaultAiClassificationPrompt,
  getDefaultAiSettings,
  localizeDefaultAiClassificationPrompt,
  normalizeAiBatchSize,
} from './ai-settings'

const languages: Language[] = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr']

describe('ai settings', () => {
  it('normalizes the configurable batch size', () => {
    expect(normalizeAiBatchSize(undefined)).toBe(DEFAULT_AI_BATCH_SIZE)
    expect(normalizeAiBatchSize('40')).toBe(40)
    expect(normalizeAiBatchSize(0)).toBe(1)
    expect(normalizeAiBatchSize(999)).toBe(200)
  })

  it('provides a distinct localized default prompt for every language', () => {
    const prompts = languages.map(getDefaultAiClassificationPrompt)

    expect(new Set(prompts)).toHaveLength(languages.length)
    for (const language of languages) {
      expect(getDefaultAiSettings(language).prompt).toBe(
        getDefaultAiClassificationPrompt(language),
      )
    }
  })

  it('localizes known defaults without overwriting a custom prompt', () => {
    const oldChineseDefault = getDefaultAiClassificationPrompt('zh-CN')

    expect(localizeDefaultAiClassificationPrompt('', 'fr')).toBe(
      getDefaultAiClassificationPrompt('fr'),
    )
    expect(localizeDefaultAiClassificationPrompt(oldChineseDefault, 'ja')).toBe(
      getDefaultAiClassificationPrompt('ja'),
    )
    expect(
      localizeDefaultAiClassificationPrompt('My custom prompt', 'ko'),
    ).toBe('My custom prompt')
  })
})
