import type { Bookmark } from '~/lib/types'
import { ChevronDown, RefreshCw } from 'lucide-react'

import { useEffect, useRef, useState } from 'react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import {
  normalizeAlternateBookmarkUrls,
  normalizeBookmarkUrl,
} from '~/lib/bookmark-urls'
import { localizeError } from '~/lib/localized-error'
import { getDuplicateBookmark } from '~/lib/quick-save'
import { fetchSiteMetadata } from '~/lib/site-metadata'
import { ensureSitePermissions } from '~/lib/site-permissions'
import {
  mergeAlternateUrlsForDuplicate,
  useBookmarks,
  useCategories,
  useNavStore,
} from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'
import { cn } from '~/lib/utils'

interface BookmarkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 传入则为编辑模式，否则为新增 */
  bookmark?: Bookmark | null
}

interface FormState {
  name: string
  url: string
  alternateUrls: string
  description: string
  tags: string
  // 分类以名称输入：可从已有分类选择，也可输入新名称（提交时自动创建）
  categoryName: string
  icon: string
}

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

// 补全网址协议
function normalizeUrl(url: string): string {
  return normalizeBookmarkUrl(url)
}

function parseAlternateUrls(value: string): {
  rawUrls: string[]
  normalizedUrls: string[]
} {
  const rawUrls = value
    .split(/[\n,]+/)
    .map(item => item.trim())
    .filter(Boolean)

  return {
    rawUrls,
    normalizedUrls: rawUrls.map(normalizeBookmarkUrl),
  }
}

export function BookmarkDialog({ open, onOpenChange, bookmark }: BookmarkDialogProps) {
  const { t } = useI18n()
  const categories = useCategories()
  const bookmarks = useBookmarks()
  const activeCategoryId = useNavStore(s => s.activeCategoryId)
  const addCategory = useNavStore(s => s.addCategory)
  const addBookmark = useNavStore(s => s.addBookmark)
  const updateBookmark = useNavStore(s => s.updateBookmark)

  const [form, setForm] = useState<FormState>({
    name: '',
    url: '',
    alternateUrls: '',
    description: '',
    tags: '',
    categoryName: '',
    icon: '',
  })
  const [error, setError] = useState('')
  const [fetching, setFetching] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const formSessionRef = useRef<string | null>(null)
  const normalizedFormUrl = normalizeUrl(form.url)
  const duplicate = bookmark
    ? undefined
    : getDuplicateBookmark(bookmarks, normalizedFormUrl)
  const duplicateCategory = duplicate
    ? categories.find(category => category.id === duplicate.categoryId)
    : undefined

  // 弹窗打开时，根据是否为编辑重置表单
  useEffect(() => {
    if (!open) {
      formSessionRef.current = null
      return
    }
    const formSession = bookmark ? `edit:${bookmark.id}` : 'new'
    if (formSessionRef.current === formSession)
      return
    formSessionRef.current = formSession
    if (bookmark) {
      const cat = categories.find(c => c.id === bookmark.categoryId)
      setForm({
        name: bookmark.name,
        url: bookmark.url,
        alternateUrls: bookmark.alternateUrls?.join('\n') ?? '',
        description: bookmark.description ?? '',
        tags: bookmark.tags?.join(', ') ?? '',
        categoryName: cat?.name ?? '',
        icon: bookmark.icon ?? '',
      })
      setAdvancedOpen(Boolean(
        bookmark.alternateUrls?.length
        || bookmark.description
        || bookmark.tags?.length
        || bookmark.icon,
      ))
    }
    else {
      const activeCategory = categories.find(c => c.id === activeCategoryId)
        ?? categories[0]
      setForm({
        name: '',
        url: '',
        alternateUrls: '',
        description: '',
        tags: '',
        categoryName: activeCategory?.name ?? '',
        icon: '',
      })
      setAdvancedOpen(false)
    }
    setError('')
  }, [open, bookmark, categories, activeCategoryId])

  const update = (key: keyof FormState, value: string) =>
    setForm(f => ({ ...f, [key]: value }))
  const advancedFieldCount = [
    form.alternateUrls,
    form.description,
    form.tags,
    form.icon,
  ].filter(value => value.trim()).length

  const fetchMetadata = async () => {
    const url = normalizeUrl(form.url)
    if (!url) {
      setError(t('enterUrlFirst'))
      return
    }

    setFetching(true)
    setError('')
    try {
      if (!(await ensureSitePermissions())) {
        setError(t('sitePermissionRequired'))
        return
      }
      const metadata = await fetchSiteMetadata(url)
      if (!metadata.name && !metadata.description && !metadata.icon) {
        setError(t('noSiteMetadata'))
        return
      }
      setForm(current => ({
        ...current,
        url,
        name: metadata.name ?? current.name,
        description: metadata.description ?? current.description,
        icon: metadata.icon ?? current.icon,
      }))
    }
    catch (cause) {
      const message = localizeError(cause, t)
      setError(t('fetchSiteMetadataFailed', { message }))
    }
    finally {
      setFetching(false)
    }
  }

  const submit = async (allowDuplicate = false) => {
    const name = form.name.trim()
    const url = normalizeUrl(form.url)
    if (!name || !url) {
      setError(t('enterNameAndUrl'))
      return
    }
    if (!bookmark && duplicate && !allowDuplicate) {
      setError(t('duplicateNeedsChoice'))
      return
    }
    const { rawUrls, normalizedUrls } = parseAlternateUrls(form.alternateUrls)
    if (normalizedUrls.some(candidate => !candidate)) {
      setAdvancedOpen(true)
      setError(t('invalidAlternateUrl'))
      return
    }
    const alternateUrls = normalizeAlternateBookmarkUrls(normalizedUrls, url)
    // 确保分类存在（输入新名称时自动创建），拿到其 id
    const categoryId = await addCategory(form.categoryName)
    const payload = {
      name,
      url,
      alternateUrls: rawUrls.length > 0 ? alternateUrls : undefined,
      description: form.description.trim() || undefined,
      tags: parseTags(form.tags),
      categoryId,
      icon: form.icon.trim() || undefined,
    }
    if (bookmark) {
      await updateBookmark(bookmark.id, payload)
    }
    else {
      await addBookmark(payload)
    }
    onOpenChange(false)
  }

  const mergeIntoExisting = async () => {
    if (!duplicate)
      return
    const { rawUrls, normalizedUrls } = parseAlternateUrls(form.alternateUrls)
    const mergedAlternateUrls = mergeAlternateUrlsForDuplicate(
      duplicate.alternateUrls,
      normalizedUrls,
      duplicate.url,
    )
    if (normalizedUrls.some(candidate => !candidate)) {
      setAdvancedOpen(true)
      setError(t('invalidAlternateUrl'))
      return
    }
    const categoryId = await addCategory(form.categoryName)
    await updateBookmark(duplicate.id, {
      categoryId,
      description: duplicate.description || form.description.trim() || undefined,
      tags: [...new Set([...(duplicate.tags ?? []), ...parseTags(form.tags)])],
      ...(rawUrls.length > 0
        ? { alternateUrls: mergedAlternateUrls }
        : {}),
      icon: duplicate.icon || form.icon.trim() || undefined,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{bookmark ? t('editBookmark') : t('addBookmark')}</DialogTitle>
          <DialogDescription>
            {bookmark ? t('editBookmarkDescription') : t('addBookmarkDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <label htmlFor="bookmark-url" className="text-sm font-medium">{t('url')}</label>
            <div className="flex gap-2">
              <Input
                id="bookmark-url"
                value={form.url}
                onChange={e => update('url', e.target.value)}
                placeholder="github.com"
                aria-describedby={error ? 'bookmark-form-error' : undefined}
                aria-invalid={Boolean(error && !normalizeUrl(form.url))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void fetchMetadata()
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void fetchMetadata()}
                disabled={fetching}
                title={t('fetchSiteMetadata')}
                aria-label={t('fetchSiteInfo')}
                className="shrink-0"
              >
                <RefreshCw className={cn(fetching && 'animate-spin')} />
              </Button>
            </div>
          </div>
          {duplicate
            ? (
                <div className="rounded-md border border-border bg-muted/45 p-3 text-sm">
                  <p className="font-semibold">{t('urlAlreadySaved')}</p>
                  <p className="mt-1 text-muted-foreground">
                    {duplicate.name}
                    {' · '}
                    {duplicateCategory?.name ?? t('existingFolder')}
                  </p>
                  <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void mergeIntoExisting()}>
                    {t('mergeExistingBookmark')}
                  </Button>
                </div>
              )
            : null}
          <div className="grid gap-1.5">
            <label htmlFor="bookmark-name" className="text-sm font-medium">{t('name')}</label>
            <Input
              id="bookmark-name"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder={t('namePlaceholder')}
              aria-describedby={error ? 'bookmark-form-error' : undefined}
              aria-invalid={Boolean(error && !form.name.trim())}
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="bookmark-category" className="text-sm font-medium">{t('category')}</label>
            <Input
              id="bookmark-category"
              list="flash-category-list"
              value={form.categoryName}
              onChange={e => update('categoryName', e.target.value)}
              placeholder={t('typeOrSelect')}
            />
            <datalist id="flash-category-list">
              {categories.map(c => (
                <option key={c.id} value={c.name}>
                  {c.emoji}
                  {' '}
                  {c.name}
                </option>
              ))}
            </datalist>
          </div>

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="group w-full justify-between"
              >
                <span className="flex items-center gap-2">
                  {t('moreOptions')}
                  {advancedFieldCount > 0
                    ? (
                        <Badge variant="secondary">
                          {t('completedFieldCount', { count: advancedFieldCount })}
                        </Badge>
                      )
                    : null}
                </span>
                <ChevronDown
                  data-icon="inline-end"
                  className="transition-transform group-data-[state=open]:rotate-180"
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="grid gap-3 rounded-xl border border-border/70 bg-secondary/25 p-3">
                <div className="grid gap-1.5">
                  <label htmlFor="bookmark-alternate-urls" className="text-sm font-medium">{t('optionalAlternateUrls')}</label>
                  <textarea
                    id="bookmark-alternate-urls"
                    value={form.alternateUrls}
                    onChange={e => update('alternateUrls', e.target.value)}
                    placeholder={'https://service.tailnet.ts.net\nhttps://example.com'}
                    aria-describedby={error ? 'bookmark-form-error' : undefined}
                    className="min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="bookmark-description" className="text-sm font-medium">{t('optionalDescription')}</label>
                  <Input
                    id="bookmark-description"
                    value={form.description}
                    onChange={e => update('description', e.target.value)}
                    placeholder={t('descriptionPlaceholder')}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="bookmark-tags" className="text-sm font-medium">{t('optionalTags')}</label>
                  <Input
                    id="bookmark-tags"
                    value={form.tags}
                    onChange={e => update('tags', e.target.value)}
                    placeholder={t('tagsPlaceholder')}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="bookmark-icon" className="text-sm font-medium">{t('optionalIcon')}</label>
                  <Input
                    id="bookmark-icon"
                    value={form.icon}
                    onChange={e => update('icon', e.target.value)}
                    placeholder={t('iconPlaceholder')}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
          {error && <p id="bookmark-form-error" role="alert" className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={() => void submit(Boolean(duplicate))}>
            {bookmark ? t('save') : duplicate ? t('addAnyway') : t('add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
