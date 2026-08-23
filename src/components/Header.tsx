import { PawPrint, Plus } from 'lucide-react'
import logoUrl from 'url:~assets/brand-mark.png'
import { HeaderMoreMenu } from '~/components/HeaderMoreMenu'
import { SearchBar } from '~/components/SearchBar'
import { Button } from '~/components/ui/button'
import { formatShortcut } from '~/lib/keyboard-shortcuts'
import { useBookmarks, useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'
import { cn } from '~/lib/utils'

interface HeaderProps {
  onAdd: () => void
  onOpenCommand: () => void
  healthOpen: boolean
  onHealthOpenChange: (open: boolean) => void
}

export function Header({
  onAdd,
  onOpenCommand,
  healthOpen,
  onHealthOpenChange,
}: HeaderProps) {
  const { t } = useI18n()
  const count = useBookmarks().length
  const catDecorations = useNavStore(
    state => state.settings.appearance.catDecorations,
  )
  const addBookmarkShortcut = useNavStore(
    state => state.settings.keyboardShortcuts.addBookmark,
  )

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md transition-colors">
      <div className="grid min-h-[4.5rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-5 lg:flex lg:flex-nowrap lg:gap-3 lg:px-5 lg:py-0">
        <div className="flex min-w-0 shrink-0 items-center lg:w-[13.25rem]">
          <div
            className={cn(
              'flex items-center gap-2.5',
              catDecorations && 'group',
            )}
          >
            <div className="relative shrink-0">
              <img
                src={logoUrl}
                alt=""
                className={cn(
                  'size-9 object-contain drop-shadow-xs',
                  catDecorations
                  && 'transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105',
                )}
              />
              {catDecorations
                ? (
                    <span className="absolute -right-3 -top-2 rounded-full border border-border/70 bg-card px-1.5 py-0.5 text-[9px] font-semibold leading-none text-muted-foreground opacity-0 shadow-xs transition-[opacity,transform] duration-200 group-hover:-translate-y-0.5 group-hover:opacity-100">
                      {t('meow')}
                    </span>
                  )
                : null}
            </div>
            <div>
              <h1 className="flex items-center gap-1.5 text-[15px] font-semibold leading-5 tracking-[-0.01em]">
                <span>{t('brandName')}</span>
                {catDecorations
                  ? (
                      <PawPrint
                        aria-hidden="true"
                        className="size-3 text-muted-foreground/55"
                      />
                    )
                  : null}
              </h1>
              <p className="text-[11px] font-mono tabular-nums text-muted-foreground">
                {t('bookmarkCount', { count })}
              </p>
            </div>
          </div>
        </div>

        <div className="col-span-2 row-start-2 flex w-full min-w-0 justify-center lg:order-none lg:col-auto lg:row-auto lg:flex-1">
          <SearchBar onOpenCommand={onOpenCommand} />
        </div>

        <div className="col-start-2 row-start-1 ml-auto flex shrink-0 items-center gap-2 lg:col-auto lg:row-auto">
          <Button
            type="button"
            onClick={onAdd}
            aria-label={t('addBookmark')}
            title={`${t('addBookmark')} (${formatShortcut(addBookmarkShortcut)})`}
            size="sm"
            className="shrink-0"
          >
            <Plus data-icon="inline-start" />
            <span className="hidden xl:inline">{t('addBookmark')}</span>
          </Button>
          <HeaderMoreMenu open={healthOpen} onOpenChange={onHealthOpenChange} />
        </div>
      </div>
    </header>
  )
}
