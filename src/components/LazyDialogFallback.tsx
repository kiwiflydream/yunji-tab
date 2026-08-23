import { Skeleton } from '~/components/ui/skeleton'

interface LazyDialogFallbackProps {
  label: string
}

export function LazyDialogFallback({ label }: LazyDialogFallbackProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 px-4"
      role="status"
      aria-label={label}
    >
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-6 shadow-[0_10px_28px_-12px_hsl(var(--foreground)/0.22)]">
        <p className="text-lg font-semibold tracking-tight">{label}</p>
        <div className="mt-5 flex flex-col gap-3" aria-hidden="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      </div>
    </div>
  )
}
