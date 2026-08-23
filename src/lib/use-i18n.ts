import type { LocalizedText, MessageKey, TranslationParams } from './i18n'
import { useCallback } from 'react'
import {
  languageTag,
  translate,
  translateCategoryName,
  translateText,
} from './i18n'
import { useNavStore } from './store'

export function useI18n() {
  const language = useNavStore(state => state.settings.language)
  const t = useCallback(
    (key: MessageKey, params?: TranslationParams) =>
      translate(language, key, params),
    [language],
  )
  const categoryName = useCallback(
    (category: { id: string, name: string }) =>
      translateCategoryName(language, category),
    [language],
  )
  const text = useCallback(
    (value: LocalizedText) => translateText(language, value),
    [language],
  )

  return {
    categoryName,
    language,
    languageTag: languageTag(language),
    t,
    text,
  }
}
