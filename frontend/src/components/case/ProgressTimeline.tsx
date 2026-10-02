import { NotebookPen } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDateTime, relativeTime } from '@/lib/format'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { humanizeAction, progressToActivity } from './activity'
import type { Progress } from '@/types/api'

/**
 * The officer-written progress feed, newest first. This is the narrative
 * record of a case; system events live in the Weekly view.
 */
export function ProgressTimeline({
  progress,
  isLoading = false,
  className,
}: {
  progress: Progress[]
  isLoading?: boolean
  className?: string
}) {
  if (isLoading) {
    return (
      <div className={cn('space-y-3 p-4', className)}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // The API returns progress oldest-first (`ORDER BY created_at ASC`); the feed
  // reads better newest-first, so sort here rather than trusting the order.
  const items = progressToActivity(progress).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<NotebookPen className="size-5" aria-hidden />}
        title="No progress updates yet"
        description="Progress updates written by the responding officer will appear here, newest first."
      />
    )
  }

  return (
    <ol className={cn('p-4', className)}>
      {items.map((item, index) => {
        const last = index === items.length - 1
        return (
          <li key={item.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className="mt-1.5 grid size-6 shrink-0 place-items-center rounded-full bg-signal/10 ring-1 ring-signal/30"
                aria-hidden
              >
                <span className="size-1.5 rounded-full bg-signal" />
              </span>
              {!last ? <span className="my-1 w-px flex-1 bg-border-hi" aria-hidden /> : null}
            </div>

            <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-4')}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-medium text-ink">{humanizeAction(item.action)}</p>
                <time
                  dateTime={item.createdAt}
                  title={formatDateTime(item.createdAt)}
                  className="text-[11px] text-ink-faint"
                >
                  {relativeTime(item.createdAt)}
                </time>
              </div>
              {item.description ? (
                <p className="mt-1 whitespace-pre-line text-sm text-ink-muted">{item.description}</p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
