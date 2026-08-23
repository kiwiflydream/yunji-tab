import type { Language } from './types'

const supportedLanguages = new Set<Language>([
  'zh-CN',
  'zh-TW',
  'en',
  'ja',
  'ko',
  'es',
  'fr',
])

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string'
    && supportedLanguages.has(value as Language)
}

export function resolveBrowserLanguage(browserLanguage?: string): Language {
  const normalized = browserLanguage?.trim().toLowerCase() ?? ''
  if (
    normalized === 'zh-tw'
    || normalized.startsWith('zh-tw-')
    || normalized === 'zh-hk'
    || normalized.startsWith('zh-hk-')
    || normalized === 'zh-mo'
    || normalized.startsWith('zh-mo-')
    || normalized === 'zh-hant'
    || normalized.startsWith('zh-hant-')
  ) {
    return 'zh-TW'
  }
  if (normalized === 'zh' || normalized.startsWith('zh-'))
    return 'zh-CN'
  for (const language of ['en', 'ja', 'ko', 'es', 'fr'] as const) {
    if (normalized === language || normalized.startsWith(`${language}-`))
      return language
  }
  return 'en'
}

export function getBrowserLanguage(): Language {
  if (typeof navigator !== 'undefined')
    return resolveBrowserLanguage(navigator.language)
  if (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage)
    return resolveBrowserLanguage(chrome.i18n.getUILanguage())
  return 'en'
}

export async function loadPreferredLanguage(
  readSettings: () => Promise<unknown>,
  fallback: Language = getBrowserLanguage(),
): Promise<Language> {
  try {
    const settings = await readSettings()
    if (typeof settings === 'object' && settings !== null) {
      const language = (settings as { language?: unknown }).language
      if (isLanguage(language))
        return language
    }
  }
  catch {
    // A failed settings read must not block background safety operations.
  }
  return fallback
}
