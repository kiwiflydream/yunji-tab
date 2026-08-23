import {
  Ellipsis,
  FolderClock,
  HeartPulse,
  History,
  ListTodo,
  Settings,
} from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { LazyDialogFallback } from '~/components/LazyDialogFallback'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

const loadActivityDialog = () => import('~/components/ActivityDialog')
function loadBookmarkHealthDialog() {
  return import('~/components/BookmarkHealthDialog')
}
const loadSettingsDialog = () => import('~/components/SettingsDialog')
const loadTabSessionsDialog = () => import('~/components/TabSessionsDialog')
const loadTaskCenterDialog = () => import('~/components/TaskCenterDialog')

const ActivityDialog = lazy(() =>
  loadActivityDialog().then(module => ({
    default: module.ActivityDialog,
  })),
)
const BookmarkHealthDialog = lazy(() =>
  loadBookmarkHealthDialog().then(module => ({
    default: module.BookmarkHealthDialog,
  })),
)
const SettingsDialog = lazy(() =>
  loadSettingsDialog().then(module => ({
    default: module.SettingsDialog,
  })),
)
const TabSessionsDialog = lazy(() =>
  loadTabSessionsDialog().then(module => ({
    default: module.TabSessionsDialog,
  })),
)
const TaskCenterDialog = lazy(() =>
  loadTaskCenterDialog().then(module => ({
    default: module.TaskCenterDialog,
  })),
)

interface HeaderMoreMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type HeaderTool = 'health' | 'activity' | 'tasks' | 'sessions' | 'settings'

export function HeaderMoreMenu({ open, onOpenChange }: HeaderMoreMenuProps) {
  const { t } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeTool, setActiveTool] = useState<HeaderTool | null>(null)
  const tasks = useNavStore(state => state.tasks)
  const runningCount = tasks.filter(task => task.state === 'running').length
  const errorCount = tasks.filter(task => task.state === 'error').length
  const attentionCount = runningCount + errorCount

  useEffect(() => {
    setActiveTool(current =>
      open ? 'health' : current === 'health' ? null : current,
    )
  }, [open])

  const preloadDialogs = useCallback(() => {
    void Promise.all([
      loadActivityDialog(),
      loadBookmarkHealthDialog(),
      loadSettingsDialog(),
      loadTabSessionsDialog(),
      loadTaskCenterDialog(),
    ]).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (open)
      preloadDialogs()
  }, [open, preloadDialogs])

  const openTool = (tool: HeaderTool) => {
    setMenuOpen(false)
    setActiveTool(tool)
    if (tool === 'health')
      onOpenChange(true)
  }

  const handleToolOpenChange = (tool: HeaderTool, nextOpen: boolean) => {
    if (!nextOpen)
      setActiveTool(current => (current === tool ? null : current))
    if (tool === 'health')
      onOpenChange(nextOpen)
  }

  const activeToolLabel
    = activeTool === 'health'
      ? t('bookmarkHealth')
      : activeTool === 'activity'
        ? t('trashAndHistory')
        : activeTool === 'tasks'
          ? t('taskCenter')
          : activeTool === 'sessions'
            ? t('tabSessions')
            : t('settings')

  return (
    <div className="relative">
      <DropdownMenu
        modal={false}
        open={menuOpen}
        onOpenChange={(next) => {
          if (next)
            preloadDialogs()
          setMenuOpen(next)
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('moreActions')}
            onMouseEnter={preloadDialogs}
            onFocus={preloadDialogs}
            className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-card text-muted-foreground shadow-sm transition-[color,background-color,border-color,box-shadow,transform] hover:bg-accent hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
          >
            <Ellipsis className="size-5" />
            {attentionCount > 0
              ? (
                  <span
                    className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${errorCount > 0 ? 'bg-destructive' : 'bg-foreground'}`}
                  >
                    {attentionCount}
                  </span>
                )
              : null}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-56">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            {t('managementTools')}
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem
              aria-label={t('openBookmarkHealth')}
              onSelect={() => openTool('health')}
            >
              <HeartPulse />
              <span>{t('bookmarkHealth')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              aria-label={t('openTrashAndHistory')}
              onSelect={() => openTool('activity')}
            >
              <History />
              <span>{t('trashAndHistory')}</span>
            </DropdownMenuItem>
            {attentionCount > 0
              ? (
                  <DropdownMenuItem
                    aria-label={t('openTaskCenter')}
                    onSelect={() => openTool('tasks')}
                  >
                    <ListTodo />
                    <span>{t('taskCenter')}</span>
                  </DropdownMenuItem>
                )
              : null}
            <DropdownMenuItem
              aria-label={t('manageTabSessions')}
              onSelect={() => openTool('sessions')}
            >
              <FolderClock />
              <span>{t('tabSessions')}</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            {t('preferences')}
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem
              aria-label={t('openSettings')}
              onSelect={() => openTool('settings')}
            >
              <Settings />
              <span>{t('settings')}</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Suspense fallback={<LazyDialogFallback label={activeToolLabel} />}>
        {activeTool === 'health'
          ? (
              <BookmarkHealthDialog
                open
                onOpenChange={nextOpen =>
                  handleToolOpenChange('health', nextOpen)}
              />
            )
          : null}
        {activeTool === 'activity'
          ? (
              <ActivityDialog
                open
                onOpenChange={nextOpen =>
                  handleToolOpenChange('activity', nextOpen)}
              />
            )
          : null}
        {activeTool === 'tasks'
          ? (
              <TaskCenterDialog
                open
                onOpenChange={nextOpen => handleToolOpenChange('tasks', nextOpen)}
              />
            )
          : null}
        {activeTool === 'sessions'
          ? (
              <TabSessionsDialog
                open
                onOpenChange={nextOpen =>
                  handleToolOpenChange('sessions', nextOpen)}
              />
            )
          : null}
        {activeTool === 'settings'
          ? (
              <SettingsDialog
                open
                onOpenChange={nextOpen =>
                  handleToolOpenChange('settings', nextOpen)}
              />
            )
          : null}
      </Suspense>
    </div>
  )
}
