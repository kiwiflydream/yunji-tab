import type { Language } from './types'
import { Storage } from '@plasmohq/storage'
import { aiClassificationPrompts } from './i18n-ai'

export function getDefaultAiClassificationPrompt(language: Language): string {
  return aiClassificationPrompts[language]
}

const defaultAiClassificationPrompts = new Set(
  Object.values(aiClassificationPrompts),
)

export function localizeDefaultAiClassificationPrompt(
  prompt: string | undefined,
  language: Language,
): string {
  const normalized = prompt?.trim() ?? ''
  return !normalized || defaultAiClassificationPrompts.has(normalized)
    ? getDefaultAiClassificationPrompt(language)
    : normalized
}

export interface AiSettings {
  baseUrl: string
  model: string
  prompt: string
  batchSize: number
  rememberToken: boolean
}

export const DEFAULT_AI_BATCH_SIZE = 80
export const MIN_AI_BATCH_SIZE = 1
export const MAX_AI_BATCH_SIZE = 200

export function normalizeAiBatchSize(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed))
    return DEFAULT_AI_BATCH_SIZE
  return Math.min(
    MAX_AI_BATCH_SIZE,
    Math.max(MIN_AI_BATCH_SIZE, Math.floor(parsed)),
  )
}

const aiLocalStorage = new Storage({ area: 'local' })
const aiSessionStorage = new Storage({ area: 'session' })
const SETTINGS_KEY = 'yunji-tab:ai-settings'
const LOCAL_TOKEN_KEY = 'yunji-tab:ai-token'
const SESSION_TOKEN_KEY = 'yunji-tab:ai-session-token'

export function getDefaultAiSettings(language: Language): AiSettings {
  return {
    baseUrl: 'https://api.openai.com/v1',
    model: '',
    prompt: getDefaultAiClassificationPrompt(language),
    batchSize: DEFAULT_AI_BATCH_SIZE,
    rememberToken: false,
  }
}

export async function loadAiSettings(language: Language): Promise<AiSettings> {
  const stored = await aiLocalStorage.get<Partial<AiSettings>>(SETTINGS_KEY)
  const defaults = getDefaultAiSettings(language)
  return {
    baseUrl: stored?.baseUrl?.trim() || defaults.baseUrl,
    model: stored?.model?.trim() || '',
    prompt: localizeDefaultAiClassificationPrompt(stored?.prompt, language),
    batchSize: normalizeAiBatchSize(stored?.batchSize),
    rememberToken: stored?.rememberToken === true,
  }
}

export async function loadAiToken(rememberToken: boolean): Promise<string> {
  if (rememberToken)
    return (await aiLocalStorage.get<string>(LOCAL_TOKEN_KEY)) ?? ''
  return (await aiSessionStorage.get<string>(SESSION_TOKEN_KEY)) ?? ''
}

export async function saveAiSettings(
  settings: AiSettings,
  token: string,
  language: Language,
): Promise<void> {
  const normalized: AiSettings = {
    baseUrl: settings.baseUrl.trim().replace(/\/+$/, ''),
    model: settings.model.trim(),
    prompt:
      settings.prompt.trim() || getDefaultAiClassificationPrompt(language),
    batchSize: normalizeAiBatchSize(settings.batchSize),
    rememberToken: settings.rememberToken,
  }
  await aiLocalStorage.set(SETTINGS_KEY, normalized)
  if (normalized.rememberToken) {
    await aiLocalStorage.set(LOCAL_TOKEN_KEY, token.trim())
    await aiSessionStorage.remove(SESSION_TOKEN_KEY)
  }
  else {
    await aiSessionStorage.set(SESSION_TOKEN_KEY, token.trim())
    await aiLocalStorage.remove(LOCAL_TOKEN_KEY)
  }
}

export async function clearAiToken(): Promise<void> {
  await Promise.all([
    aiLocalStorage.remove(LOCAL_TOKEN_KEY),
    aiSessionStorage.remove(SESSION_TOKEN_KEY),
  ])
}
