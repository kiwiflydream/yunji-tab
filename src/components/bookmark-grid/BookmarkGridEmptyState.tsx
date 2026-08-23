import { Bookmark, FolderOpen, Plus, SearchX } from 'lucide-react'
import { CatFace } from '~/components/CatDoodles'
import { Button } from '~/components/ui/button'
import { useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

interface BookmarkGridEmptyStateProps {
  emptyLibrary?: boolean
  isSmartView?: boolean
  searching?: boolean
  onAdd?: () => void
}

export function BookmarkGridEmptyState({
  emptyLibrary = false,
  isSmartView = false,
  searching = false,
  onAdd,
}: BookmarkGridEmptyStateProps) {
  const { t } = useI18n()
  const catDecorations = useNavStore(
    state => state.settings.appearance.catDecorations,
  )
  const Icon = emptyLibrary ? Bookmark : searching ? SearchX : FolderOpen
  return (
    <div className="surface-panel flex min-h-72 flex-col items-center justify-center px-6 py-16 text-center">
      {catDecorations
        ? (
            <div className="relative mb-5">
              <CatFace className="size-20" />
              <span className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground shadow-sm">
                <Icon className="size-4" aria-hidden="true" />
              </span>
            </div>
          )
        : (
            <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
              <Icon className="size-5" aria-hidden="true" />
            </div>
          )}
      <p className="text-base font-semibold">
        {catDecorations
          ? emptyLibrary
            ? t('emptyCatLibrary')
            : searching
              ? t('noMatches')
              : isSmartView
                ? t('smartViewEmptyCat')
                : t('categoryEmptyCat')
          : emptyLibrary
            ? t('emptyLibrary')
            : searching
              ? t('noMatches')
              : isSmartView
                ? t('smartViewEmpty')
                : t('categoryEmpty')}
      </p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
        {catDecorations
          ? emptyLibrary
            ? t('emptyLibraryCatDescription')
            : searching
              ? t('noMatchesDescription')
              : t('quietCatDescription')
          : emptyLibrary
            ? t('emptyLibraryDescription')
            : searching
              ? t('noMatchesDescription')
              : t('quietDescription')}
      </p>
      {emptyLibrary && onAdd
        ? (
            <Button type="button" onClick={onAdd} className="mt-5">
              <Plus data-icon="inline-start" />
              {t('addBookmark')}
            </Button>
          )
        : null}
    </div>
  )
}
