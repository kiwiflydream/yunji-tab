import { CheckCircle2, ListTodo, Loader2, Trash2, XCircle } from 'lucide-react'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

interface TaskCenterDialogProps {
  triggerClassName?: string
  triggerLabel?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function TaskCenterDialog({
  triggerClassName,
  triggerLabel,
  open,
  onOpenChange,
}: TaskCenterDialogProps) {
  const { t, text } = useI18n()
  const tasks = useNavStore(state => state.tasks)
  const clearFinishedTasks = useNavStore(state => state.clearFinishedTasks)
  const runningCount = tasks.filter(task => task.state === 'running').length
  const errorCount = tasks.filter(task => task.state === 'error').length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {triggerClassName
        ? (
            <DialogTrigger asChild>
              <button type="button" title={t('taskCenter')} aria-label={t('openTaskCenter')} className={`${triggerClassName} relative`}>
                <ListTodo className="h-4 w-4" />
                {triggerLabel ? <span>{triggerLabel}</span> : null}
                {!triggerLabel && runningCount + errorCount > 0
                  ? (
                      <span className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${errorCount > 0 ? 'bg-destructive' : 'bg-foreground'}`}>
                        {runningCount + errorCount}
                      </span>
                    )
                  : null}
              </button>
            </DialogTrigger>
          )
        : null}
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('taskCenter')}</DialogTitle>
          <DialogDescription>{t('taskCenterDescription')}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="ghost" disabled={!tasks.some(task => task.state !== 'running')} onClick={clearFinishedTasks}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {t('clearFinishedTasks')}
          </Button>
        </div>
        <div className="grid gap-2">
          {tasks.length === 0
            ? <p className="py-8 text-center text-sm text-muted-foreground">{t('noBackgroundTasks')}</p>
            : tasks.map((task) => {
                const progress = task.total && task.total > 0
                  ? Math.min(100, Math.round(task.completed / task.total * 100))
                  : undefined
                const Icon = task.state === 'running'
                  ? Loader2
                  : task.state === 'success' ? CheckCircle2 : XCircle
                return (
                  <article key={`${task.id}:${task.startedAt}`} className="rounded-md border border-border p-3">
                    <div className="flex items-start gap-3">
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${task.state === 'running' ? 'animate-spin' : task.state === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="truncate text-sm font-semibold">{text(task.label)}</h3>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {t(task.state === 'running'
                              ? 'taskRunning'
                              : task.state === 'success'
                                ? 'taskCompleted'
                                : 'taskFailed')}
                          </span>
                        </div>
                        {task.message ? <p className="mt-1 text-xs text-muted-foreground">{text(task.message)}</p> : null}
                        {progress !== undefined
                          ? (
                              <div className="mt-2">
                                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                  <div className="h-full bg-foreground transition-[width]" style={{ width: `${progress}%` }} />
                                </div>
                                <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
                                  {task.completed}
                                  /
                                  {task.total}
                                </p>
                              </div>
                            )
                          : null}
                      </div>
                    </div>
                  </article>
                )
              })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
