import { Skeleton } from '~/components/ui/skeleton'

interface BookmarkGridLoadingStateProps {
  label: string
}

export function BookmarkGridLoadingState({
  label,
}: BookmarkGridLoadingStateProps) {
  return (
    <div data-testid="bookmark-grid-loading" role="status" aria-label={label}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex gap-2" aria-hidden="true">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="size-9" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="flex min-h-[108px] items-center gap-4 rounded-xl border border-border/55 bg-card/70 px-4"
            aria-hidden="true"
          >
            <Skeleton className="size-12 shrink-0 rounded-xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
