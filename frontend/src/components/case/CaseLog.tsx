import { History } from 'lucide-react'
import { cn } from '@/lib/cn'
import { actorLabel, statusChangeEntries } from '@/lib/caseLog'
import { formatDateTime, relativeTime } from '@/lib/format'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { StatusChip } from '@/components/ui/Chips'
import { humanizeAction } from './activity'
import type { Case, CaseTimelineEntry } from '@/types/api'

/**
 * The case log, **redacted for the reporter**.
 *
 * Two fields are never rendered, and the omissions are the whole component:
 *
 * 1. **`description`**, whose strings are written for an internal reader and name
 *    people — see the note in `@/lib/caseLog`.
 * 2. **`entry.user.name`**, so who acted is answered by role instead.
 *
 * The rules themselves live in `@/lib/caseLog` with the tests; this file is the
 * rendering. The responding unit is named once, in the page header, not on each
 * row: the timeline says which user acted, never which unit, so stamping the
 * case's own unit onto every entry would turn a guess into a claim.
 */
export function CaseLog({
  entries,
  caseItem,
  isLoading = false,
  className,
}: {
  entries: CaseTimelineEntry[]
  /** Supplies `reportedBy` / `assignedTo`, the only ids the actor label needs. */
  caseItem: Case
  isLoading?: boolean
  className?: string
}) {
  if (isLoading) {
    return (
      <div className={cn('flex flex-col gap-3 p-4', className)}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Oldest first: a log tells a story from the report forward, which is the
  // opposite of the officer's progress feed. Progress notes are a separate feed
  // and are not fetched on this path at all.
  const items = statusChangeEntries(entries)

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<History className="size-5" aria-hidden />}
        title="No status changes recorded"
        description="Every change to this report's status will be listed here, oldest first."
      />
    )
  }

  return (
    <ol className={cn('p-4', className)} aria-label="Case log">
      {items.map((entry, index) => {
        const last = index === items.length - 1
        return (
          <li key={entry.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className="mt-1.5 grid size-6 shrink-0 place-items-center rounded-full bg-surface-hi ring-1 ring-border-hi"
                aria-hidden
              >
                <span className="size-1.5 rounded-full bg-ink-muted" />
              </span>
              {!last ? <span className="my-1 w-px flex-1 bg-border-hi" aria-hidden /> : null}
            </div>

            <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-4')}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-medium text-ink">{humanizeAction(entry.action)}</p>
                <time
                  dateTime={entry.createdAt}
                  title={formatDateTime(entry.createdAt)}
                  className="text-[11px] text-ink-faint"
                >
                  {relativeTime(entry.createdAt)}
                </time>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusChip status={entry.status} className="px-2 py-0.5 text-[10px]" />
                <span className="text-[11px] text-ink-faint">{actorLabel(entry, caseItem)}</span>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
