import { AlignCenter, PanelTop, Plus } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import logoUrl from 'url:~assets/brand-mark.png'
import { HeaderMoreMenu } from '~/components/HeaderMoreMenu'
import { HeaderWidget } from '~/components/HeaderWidget'
import { SearchBar } from '~/components/SearchBar'
import { Button } from '~/components/ui/button'
import { runHomeLayoutTransition } from '~/lib/home-layout-transition'
import { formatShortcut } from '~/lib/keyboard-shortcuts'
import { useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'
import { cn } from '~/lib/utils'

interface HeaderProps {
  onAdd: () => void
  onOpenCommand: () => void
  healthOpen: boolean
  onHealthOpenChange: (open: boolean) => void
  /** The centered hero's search has scrolled under the header. */
  searchDocked?: boolean
}

export function Header({
  onAdd,
  onOpenCommand,
  healthOpen,
  onHealthOpenChange,
  searchDocked = false,
}: HeaderProps) {
  const { t } = useI18n()
  const addBookmarkShortcut = useNavStore(
    state => state.settings.keyboardShortcuts.addBookmark,
  )
  // The centered home layout moves search and time into the page hero.
  const centered = useNavStore(
    state => state.settings.appearance.homeLayout === 'centered',
  )
  const setAppearance = useNavStore(state => state.setAppearance)
  const headerRef = useRef<HTMLElement>(null)
  // The top category bar sticks right below the header, whose height changes with layout, docking and wrapping.
  useLayoutEffect(() => {
    const header = headerRef.current
    if (!header)
      return
    const root = document.documentElement
    const observer = new ResizeObserver(() => root.style.setProperty('--header-height', `${header.offsetHeight}px`))
    observer.observe(header)
    return () => observer.disconnect()
  }, [])
  const docked = centered && searchDocked
  const dockedMotion = 'animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none'
  const toggleLayout = () => runHomeLayoutTransition(() => {
    void setAppearance({ homeLayout: centered ? 'workspace' : 'centered' })
  })

  return (
    <header ref={headerRef} className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md transition-colors">
      <div className="grid min-h-[4.5rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-5 lg:flex lg:flex-nowrap lg:gap-3 lg:px-5 lg:py-0">
        <div className="flex min-w-0 shrink-0 items-center lg:w-[13.25rem]">
          <div className="flex items-center gap-2.5">
            <img src={logoUrl} alt="" className="size-9 shrink-0 object-contain drop-shadow-xs" />
            <h1 className="whitespace-nowrap text-[15px] font-semibold leading-5 tracking-[-0.01em]">
              {t('brandName')}
            </h1>
          </div>
        </div>

        {centered && !docked
          ? <div className="hidden lg:block lg:flex-1" />
          : (
              <div className={cn('col-span-2 row-start-2 flex w-full min-w-0 justify-center lg:order-none lg:col-auto lg:row-auto lg:flex-1', docked && dockedMotion)}>
                <SearchBar onOpenCommand={onOpenCommand} docked={docked} />
              </div>
            )}

        <div className="col-start-2 row-start-1 ml-auto flex shrink-0 items-center gap-2 lg:col-auto lg:row-auto">
          {centered && !docked ? null : <span className={cn('contents', docked && '[&>*]:animate-in [&>*]:fade-in-0 [&>*]:slide-in-from-top-1 [&>*]:duration-200 motion-reduce:[&>*]:animate-none')}><HeaderWidget docked={docked} /></span>}
          <Button
            type="button"
            onClick={onAdd}
            aria-label={t('addBookmark')}
            title={`${t('addBookmark')} (${formatShortcut(addBookmarkShortcut)})`}
            size="sm"
            variant={centered ? 'outline' : 'default'}
            className="shrink-0"
          >
            <Plus data-icon="inline-start" className={cn(centered && 'text-primary')} />
            <span className="hidden xl:inline">{t('addBookmark')}</span>
          </Button>
          <button
            type="button"
            onClick={toggleLayout}
            aria-label={t(centered ? 'switchToWorkspaceLayout' : 'switchToCenteredLayout')}
            title={t(centered ? 'switchToWorkspaceLayout' : 'switchToCenteredLayout')}
            className="hidden size-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-card text-muted-foreground shadow-sm transition-[color,background-color,transform] sm:flex hover:bg-accent hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
          >
            {centered ? <PanelTop className="size-[18px]" strokeWidth={1.75} /> : <AlignCenter className="size-[18px]" strokeWidth={1.75} />}
          </button>
          <HeaderMoreMenu open={healthOpen} onOpenChange={onHealthOpenChange} />
        </div>
      </div>
    </header>
  )
}
