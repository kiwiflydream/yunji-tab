import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { useI18n } from '~/lib/use-i18n'

interface SettingsResetControlProps {
  description: string
  onReset: () => Promise<void>
}

export function SettingsResetControl({ description, onReset }: SettingsResetControlProps) {
  const { t } = useI18n()
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)

  const reset = async () => {
    setPending(true)
    setResult(null)
    try {
      await onReset()
      setResult('success')
    }
    catch {
      setResult('error')
    }
    finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1 basis-64 text-xs leading-5 text-muted-foreground">
        <p>{description}</p>
        {result
          ? <p role={result === 'error' ? 'alert' : 'status'} className={result === 'error' ? 'text-destructive' : undefined}>{t(result === 'error' ? 'settingsResetFailed' : 'settingsResetDone')}</p>
          : null}
      </div>
      <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={pending} onClick={() => void reset()}>
        <RotateCcw data-icon="inline-start" />
        {t(pending ? 'settingsResetPending' : 'settingsResetDefault')}
      </Button>
    </div>
  )
}
