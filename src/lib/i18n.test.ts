import { describe, expect, it } from 'vitest'
import {
  isLanguage,
  languageOptions,
  languageTag,
  loadPreferredLanguage,
  localizedMessage,
  messageKeys,
  resolveBrowserLanguage,
  translate,
  translateCategoryName,
  translateText,
} from './i18n'
import { aiMessages } from './i18n-ai'

describe('i18n', () => {
  it('translates messages and interpolates values', () => {
    expect(translate('zh-CN', 'bookmarkCount', { count: 3 })).toBe('3 个书签')
    expect(translate('zh-TW', 'bookmarkCount', { count: 3 })).toBe('3 個書籤')
    expect(translate('zh-CN', 'brandName')).toBe('云吉 Tab')
    expect(translate('zh-TW', 'brandName')).toBe('雲吉 Tab')
    expect(translate('en', 'bookmarkCount', { count: 3 })).toBe('3 bookmarks')
    expect(translate('ja', 'settings')).toBe('設定')
    expect(translate('ko', 'settings')).toBe('설정')
    expect(translate('es', 'settings')).toBe('Configuración')
    expect(translate('fr', 'settings')).toBe('Paramètres')
  })

  it('localizes the complete appearance surface', () => {
    expect(translate('en', 'appearanceLightDarkMode')).toBe('Light and dark mode')
    expect(translate('en', 'themeLight')).toBe('Light')
    expect(translate('zh-TW', 'appearanceOverallStyle')).toBe('整體風格')
    expect(translate('ja', 'appearanceAdvancedCustomization')).toBe('詳細設定')
    expect(translate('ko', 'appearanceCatDecorations')).toBe('고양이 장식')
    expect(translate('es', 'appearanceCardDetails')).toBe('Detalles de las tarjetas')
    expect(translate('fr', 'appearanceLineCount', { count: 2 })).toBe('2 lignes')
  })

  it('localizes built-in categories without changing user folder names', () => {
    expect(translateCategoryName('en', { id: 'inbox', name: '收件箱' }))
      .toBe('Inbox')
    expect(translateCategoryName('en', { id: 'cat-1', name: '工作' }))
      .toBe('工作')
    expect(translateCategoryName('en', { id: 'cat-2', name: '' }))
      .toBe('Folder')
  })

  it('renders persisted message descriptors in the current language', () => {
    const message = localizedMessage('runtimeBookmarkCountLabel', { count: 2 })
    expect(translateText('en', message)).toBe('2 bookmarks')
    expect(translateText('fr', message)).toBe('2 favoris')
    expect(translateText('ja', 'User-provided label')).toBe('User-provided label')
  })

  it('returns valid document language tags', () => {
    for (const language of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr'] as const)
      expect(languageTag(language)).toBe(language)
  })

  it('matches supported browser languages and falls back to English', () => {
    expect(resolveBrowserLanguage('zh-CN')).toBe('zh-CN')
    expect(resolveBrowserLanguage('zh-Hant')).toBe('zh-TW')
    expect(resolveBrowserLanguage('zh-HK')).toBe('zh-TW')
    expect(resolveBrowserLanguage('zh-TW')).toBe('zh-TW')
    expect(resolveBrowserLanguage('en-GB')).toBe('en')
    expect(resolveBrowserLanguage('ja-JP')).toBe('ja')
    expect(resolveBrowserLanguage('ko-KR')).toBe('ko')
    expect(resolveBrowserLanguage('es-MX')).toBe('es')
    expect(resolveBrowserLanguage('fr-CA')).toBe('fr')
    expect(resolveBrowserLanguage('de-DE')).toBe('en')
    expect(resolveBrowserLanguage()).toBe('en')
  })

  it('validates supported language values', () => {
    expect(isLanguage('zh-TW')).toBe(true)
    expect(isLanguage('fr')).toBe(true)
    expect(isLanguage('de')).toBe(false)
    expect(isLanguage(undefined)).toBe(false)
  })

  it('falls back when persisted language settings cannot be read', async () => {
    await expect(loadPreferredLanguage(
      async () => Promise.reject(new Error('storage unavailable')),
      'fr',
    )).resolves.toBe('fr')
    await expect(loadPreferredLanguage(
      async () => ({ language: 'ja' }),
      'fr',
    )).resolves.toBe('ja')
  })

  it('keeps placeholders consistent across every supported language', () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()

    for (const key of messageKeys) {
      const expected = placeholders(translate('zh-CN', key))
      for (const { value: language } of languageOptions) {
        expect(
          placeholders(translate(language, key)),
          `${language}.${key}`,
        ).toEqual(expected)
      }
    }
  })

  it('uses localized AI copy instead of whole-locale English fallbacks', () => {
    for (const language of [
      'zh-CN',
      'zh-TW',
      'ja',
      'ko',
      'es',
      'fr',
    ] as const) {
      const localizedCount = Object.keys(aiMessages.en).filter((key) => {
        const messageKey = key as keyof typeof aiMessages.en
        return aiMessages[language][messageKey] !== aiMessages.en[messageKey]
      }).length

      expect(localizedCount, language).toBeGreaterThan(55)
    }
  })
})
