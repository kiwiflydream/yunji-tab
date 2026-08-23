import type { AiClassificationSuggestion } from '~/lib/ai-bookmark-classification'
import type { Bookmark, Category } from '~/lib/types'
import { ArrowRight, Folder, Sparkles } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { buildCategoryPathMap } from '~/lib/category-path'
import { useI18n } from '~/lib/use-i18n'

interface AiClassificationPreviewDialogProps {
  open: boolean
  suggestions: AiClassificationSuggestion[]
  selectedIds: Set<string>
  bookmarks: Bookmark[]
  categories: Category[]
  applying: boolean
  onOpenChange: (open: boolean) => void
  onSelectedIdsChange: (selectedIds: Set<string>) => void
  onApply: () => void
}

export function AiClassificationPreviewDialog({
  open,
  suggestions,
  selectedIds,
  bookmarks,
  categories,
  applying,
  onOpenChange,
  onSelectedIdsChange,
  onApply,
}: AiClassificationPreviewDialogProps) {
  const { t } = useI18n()
  const bookmarksById = new Map(bookmarks.map(bookmark => [bookmark.id, bookmark]))
  const categoryPaths = buildCategoryPathMap(categories)
  const toggleSuggestion = (bookmarkId: string, checked: boolean) => {
    const next = new Set(selectedIds)
    if (checked)
      next.add(bookmarkId)
    else next.delete(bookmarkId)
    onSelectedIdsChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={next => !applying && onOpenChange(next)}>
      <DialogContent
        overlayClassName="z-[60]"
        className="z-[60] max-h-[calc(100dvh-2rem)] max-w-3xl grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden p-0 sm:p-0"
      >
        <div className="border-b border-border/70 px-5 py-4 sm:px-6 sm:py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <Sparkles className="size-5 text-primary" aria-hidden="true" />
              {t('aiPreviewTitle')}
            </DialogTitle>
            <DialogDescription>{t('aiPreviewDescription')}</DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-secondary/25 px-5 py-3 sm:px-6">
          <span className="text-sm font-medium tabular-nums">
            {t('aiSelectedCount', { count: selectedIds.size })}
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onSelectedIdsChange(new Set(suggestions.map(item => item.bookmarkId)))}
            >
              {t('aiSelectAll')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onSelectedIdsChange(new Set())}
            >
              {t('aiSelectNone')}
            </Button>
          </div>
        </div>

        <div className="overscroll-contain overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-2">
            {suggestions.map((suggestion) => {
              const bookmark = bookmarksById.get(suggestion.bookmarkId)
              if (!bookmark)
                return null
              const sourcePath = categoryPaths.get(suggestion.sourceCategoryId)?.join(' / ') ?? ''
              const targetPath = categoryPaths.get(suggestion.targetCategoryId)?.join(' / ') ?? ''
              const checked = selectedIds.has(suggestion.bookmarkId)
              return (
                <label
                  key={suggestion.bookmarkId}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-sm transition-colors hover:bg-accent/35"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={value => toggleSuggestion(suggestion.bookmarkId, value === true)}
                    aria-label={bookmark.name}
                    className="mt-1"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{bookmark.name}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Folder className="size-3.5" aria-hidden="true" />
                      <span>{sourcePath}</span>
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                      <span className="font-medium text-foreground">{targetPath}</span>
                    </span>
                    <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">
                      {suggestion.reason}
                      {' · '}
                      {t('aiConfidence', { count: Math.round(suggestion.confidence * 100) })}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <DialogFooter className="border-t border-border/70 bg-secondary/25 px-5 py-3 sm:px-6">
          <Button
            type="button"
            variant="outline"
            disabled={applying}
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            disabled={applying || selectedIds.size === 0}
            onClick={onApply}
          >
            {applying ? t('aiApplying') : t('aiApplySelected')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
