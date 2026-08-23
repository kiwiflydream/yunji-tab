import { Loader2, RotateCcw } from 'lucide-react'
import { useState } from 'react'

import { Button } from '~/components/ui/button'
import { useNavStore } from '~/lib/store'
import { useI18n } from '~/lib/use-i18n'

export function UndoDeletionToast() {
  const { t, text } = useI18n()
  const pending = useNavStore(state => state.pendingDeletion)
  const undoLastDeletion = useNavStore(state => state.undoLastDeletion)
  const [error, setError] = useState('')

  if (!pending)
    return null

  const undo = async () => {
    setError('')
    try {
      await undoLastDeletion()
    }
    catch {
      setError(t('undoRestoreFailed'))
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-[70] flex items-center gap-3 rounded-xl border border-border/70 bg-popover px-4 py-3 text-popover-foreground shadow-xl sm:left-auto sm:w-auto sm:max-w-md"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {t('deletedNamed', { name: text(pending.label) })}
        </p>
        {error
          ? (
              <p className="mt-0.5 text-xs text-destructive">{error}</p>
            )
          : (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('movedToTrashDescription')}
              </p>
            )}
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => void undo()}
        disabled={pending.restoring || pending.restoreFailed}
        className="shrink-0"
      >
        {pending.restoring
          ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            )
          : (
              <RotateCcw data-icon="inline-start" />
            )}
        {pending.restoring ? t('restoring') : t('undo')}
      </Button>
    </div>
  )
}
