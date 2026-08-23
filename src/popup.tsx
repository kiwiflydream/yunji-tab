import type { CurrentPage } from '~/lib/quick-save'
import type { Bookmark, Category, Language, Settings } from '~/lib/types'
import { Check, ExternalLink, Loader2, Save } from 'lucide-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import logoUrl from 'url:~assets/brand-mark.png'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { openHomeTabMessage } from '~/lib/home-tabs'
import {
  getBrowserLanguage,
  isLanguage,
  languageTag,
  translate,
} from '~/lib/i18n'
import {
  currentPageFromTab,
  getDuplicateBookmark,
  loadQuickSaveData,
  quickSaveCategoryKey,
  saveQuickBookmark,
} from '~/lib/quick-save'
import { settingsStorage, STORAGE_KEYS } from '~/lib/store-persistence'
import '~main.css'

function parseTags(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,，#]+/)
        .map(tag => tag.trim())
        .filter(Boolean),
    ),
  ].slice(0, 12)
}

interface PopupState {
  bookmarks: Bookmark[]
  categories: Category[]
  categoryId: string
  error: string
  loading: boolean
  page: CurrentPage | null
  saved: boolean
  saving: boolean
  tags: string
  title: string
}

const initialPopupState: PopupState = {
  bookmarks: [],
  categories: [],
  categoryId: '',
  error: '',
  loading: true,
  page: null,
  saved: false,
  saving: false,
  tags: '',
  title: '',
}

function popupReducer(
  state: PopupState,
  patch: Partial<PopupState>,
): PopupState {
  return { ...state, ...patch }
}

async function openHome(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: openHomeTabMessage,
    })
    if (!response?.ok)
      throw new Error('Unable to open Yunji Tab home tab')
  }
  catch {
    await chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html') })
  }
  finally {
    window.close()
  }
}

function IndexPopup() {
  const [language, setLanguage] = useState<Language>(getBrowserLanguage)
  const t = (
    key: Parameters<typeof translate>[1],
    params?: Parameters<typeof translate>[2],
  ) => translate(language, key, params)
  const [state, dispatch] = useReducer(popupReducer, initialPopupState)
  const {
    bookmarks,
    categories,
    categoryId,
    error,
    loading,
    page,
    saved,
    saving,
    tags,
    title,
  } = state

  useEffect(() => {
    document.documentElement.lang = languageTag(language)
    document.title = translate(language, 'brandName')
  }, [language])

  useEffect(() => {
    void (async () => {
      try {
        const persistedSettings = await settingsStorage.get<Partial<Settings>>(
          STORAGE_KEYS.settings,
        )
        const selectedLanguage = isLanguage(persistedSettings?.language)
          ? persistedSettings.language
          : getBrowserLanguage()
        setLanguage(selectedLanguage)
        const [[tab], stored, data] = await Promise.all([
          chrome.tabs.query({ active: true, currentWindow: true }),
          chrome.storage.local.get(quickSaveCategoryKey),
          loadQuickSaveData(),
        ])
        const currentPage = currentPageFromTab(tab)
        const remembered = stored[quickSaveCategoryKey]
        dispatch({
          bookmarks: data.bookmarks,
          categories: data.categories,
          categoryId:
            typeof remembered === 'string'
            && data.categories.some(category => category.id === remembered)
              ? remembered
              : (data.categories[0]?.id ?? ''),
          page: currentPage,
          title: currentPage?.title ?? '',
        })
      }
      catch {
        dispatch({ error: translate(language, 'cannotReadCurrentPage') })
      }
      finally {
        dispatch({ loading: false })
      }
    })()
  }, [])

  const duplicate = useMemo(
    () => (page ? getDuplicateBookmark(bookmarks, page.url) : undefined),
    [bookmarks, page],
  )
  const duplicateCategory = duplicate
    ? categories.find(category => category.id === duplicate.categoryId)
    : undefined

  const save = async () => {
    if (!page || !title.trim() || !categoryId)
      return
    dispatch({ error: '', saving: true })
    try {
      await saveQuickBookmark({
        name: title.trim(),
        url: page.url,
        categoryId,
        tags: parseTags(tags),
        inboxAt: Date.now(),
      })
      await chrome.storage.local.set({ [quickSaveCategoryKey]: categoryId })
      dispatch({ saved: true })
    }
    catch {
      dispatch({ error: t('saveFailed') })
    }
    finally {
      dispatch({ saving: false })
    }
  }

  return (
    <main className="w-80 bg-background p-4 text-foreground">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src={logoUrl}
            alt=""
            className="size-8 shrink-0 object-contain"
          />
          <div>
            <h1 className="text-sm font-semibold">{t('brandName')}</h1>
            <p className="text-[11px] text-muted-foreground">
              {t('quickSave')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void openHome()}
          title={t('openHome')}
          aria-label={t('openHome')}
          className="icon-button size-8"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      </header>

      {loading
        ? (
            <div className="flex h-36 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )
        : !page
            ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {t('pageCannotBeSaved')}
                </div>
              )
            : saved
              ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background">
                      <Check className="h-5 w-5" />
                    </span>
                    <p className="mt-3 text-sm font-semibold">{t('pageSaved')}</p>
                    <button
                      type="button"
                      onClick={() => void openHome()}
                      className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {t('viewOnHome')}
                    </button>
                  </div>
                )
              : duplicate
                ? (
                    <section className="surface-panel p-3.5">
                      <p className="text-sm font-semibold">{t('pageAlreadySaved')}</p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {duplicate.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('locatedIn')}
                        {' '}
                        {duplicateCategory?.name ?? t('existingFolder')}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-4 w-full"
                        onClick={() => void openHome()}
                      >
                        <ExternalLink data-icon="inline-start" />
                        {t('openYunjiTab')}
                      </Button>
                    </section>
                  )
                : (
                    <section className="grid gap-3">
                      <div className="grid gap-1.5">
                        <label htmlFor="quick-save-title" className="text-xs font-medium">
                          {t('name')}
                        </label>
                        <Input
                          id="quick-save-title"
                          value={title}
                          onChange={event => dispatch({ title: event.target.value })}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <label
                          htmlFor="quick-save-category"
                          className="text-xs font-medium"
                        >
                          {t('folder')}
                        </label>
                        <select
                          id="quick-save-category"
                          value={categoryId}
                          onChange={event => dispatch({ categoryId: event.target.value })}
                          className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
                        >
                          {categories.map(category => (
                            <option key={category.id} value={category.id}>
                              {category.emoji}
                              {' '}
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-1.5">
                        <label htmlFor="quick-save-tags" className="text-xs font-medium">
                          {t('optionalTags')}
                        </label>
                        <Input
                          id="quick-save-tags"
                          value={tags}
                          onChange={event => dispatch({ tags: event.target.value })}
                          placeholder={t('tagsPlaceholder')}
                        />
                      </div>
                      <p
                        className="truncate text-xs text-muted-foreground"
                        title={page.url}
                      >
                        {page.url}
                      </p>
                      {error ? <p className="text-xs text-destructive">{error}</p> : null}
                      <Button
                        type="button"
                        onClick={() => void save()}
                        disabled={saving || !categoryId || !title.trim()}
                      >
                        {saving
                          ? (
                              <Loader2 className="animate-spin" data-icon="inline-start" />
                            )
                          : (
                              <Save data-icon="inline-start" />
                            )}
                        {t('saveCurrentPage')}
                      </Button>
                    </section>
                  )}
    </main>
  )
}

export default IndexPopup
