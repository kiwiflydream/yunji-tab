import type {
  LocalizedMessage,
  MessageKey,
  TranslationParams,
} from './i18n'

export class LocalizedError extends Error {
  constructor(
    readonly messageKey: MessageKey,
    readonly params?: TranslationParams,
  ) {
    super(messageKey)
    this.name = 'LocalizedError'
  }
}

export function localizeError(
  cause: unknown,
  translate: (key: MessageKey, params?: TranslationParams) => string,
  fallbackKey: MessageKey = 'unknownError',
): string {
  return cause instanceof LocalizedError
    ? translate(cause.messageKey, cause.params)
    : translate(fallbackKey)
}

export function localizedErrorMessage(
  cause: unknown,
  fallbackKey: MessageKey,
): LocalizedMessage {
  return cause instanceof LocalizedError
    ? { key: cause.messageKey, params: cause.params }
    : { key: fallbackKey }
}
