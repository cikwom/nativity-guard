import { Clock, Info, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/cn'
import { humanizeDecision } from './activity'
import { formatDateTime, relativeTime } from '@/lib/format'
import type { CaseReview, CaseStatus } from '@/types/api'

/**
 * The closure-review surfaces, shared by the officer workspace and the admin
 * review screen so both roles read the same decision from one implementation —
 * the same reason `CaseFacts` is shared.
 *
 * `ReviewNotice` is the *instruction*: what the officer should do next. It is not
 * an error banner. A refusal from an administrator is a normal step in the
 * workflow, so it is styled as guidance (amber = needs attention, never red =
 * emergency) and it names the actual comment rather than reporting "rejected".
 *
 * `ReviewHistory` is the *audit trail*, oldest first, complete comments.
 */

/** The most recent `request_changes` decision, if there is one. */
export function latestRequestChanges(reviews: CaseReview[]): CaseReview | undefined {
  return [...reviews].reverse().find((r) => r.decision === 'request_changes')
}

export function ReviewNotice({
  status,
  reviews,
  className,
}: {
  status: CaseStatus
  reviews: CaseReview[]
  className?: string
}) {
  if (status !== 'pending_admin_review' && status !== 'admin_changes_requested') return null

  if (status === 'pending_admin_review') {
    return (
      <div
        className={cn(
          'flex items-start gap-2.5 rounded-panel border border-border bg-surface p-3',
          className,
        )}
      >
        <Clock className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">Submitted for closure review</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            An administrator will either approve the closure or send it back with a comment. The
            case is locked while it waits — no further progress can be filed until they decide.
          </p>
        </div>
      </div>
    )
  }

  const request = latestRequestChanges(reviews)

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-panel border border-warn/30 bg-warn/5 p-3',
        className,
      )}
    >
      <MessageSquare className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">
          An administrator asked for more work on this case
        </p>
        {request ? (
          <>
            <p className="mt-1.5 whitespace-pre-line border-l-2 border-warn/40 pl-2.5 text-sm text-ink">
              {request.comment}
            </p>
            <p className="mt-1.5 text-[11px] text-ink-faint">
              {humanizeDecision(request.decision)} · {relativeTime(request.createdAt)}
            </p>
          </>
        ) : (
          <p className="mt-0.5 text-xs text-ink-muted">
            The comment is missing from the review record, so there is nothing to quote here. Open
            the case log to see what was recorded.
          </p>
        )}
        <p className="mt-1.5 text-xs text-ink-muted">
          Revise the final report to answer the comment, then submit the case for closure review
          again.
        </p>
      </div>
    </div>
  )
}

export function ReviewHistory({
  reviews,
  status,
  isLoading = false,
  className,
}: {
  reviews: CaseReview[]
  /**
   * The case's current status, used for one sentence of the empty state only.
   * Optional so a caller without it still compiles, but pass it: a closed case
   * with no recorded decision is a *different* fact from a case that has not been
   * decided yet, and "have been recorded … yet" is a promise about the future
   * that a closed case cannot keep.
   */
  status?: CaseStatus
  isLoading?: boolean
  className?: string
}) {
  if (isLoading) {
    return (
      <p className={cn('text-xs text-ink-muted', className)} aria-live="polite">
        Loading the review history…
      </p>
    )
  }

  if (reviews.length === 0) {
    const closed = status === 'closed'
    return (
      <p className={cn('text-xs text-ink-muted', className)}>
        {closed
          ? 'This case is closed but no closure decision is on record — it was closed before the review workflow existed, or the record was lost.'
          : 'No closure decisions have been recorded on this case yet.'}
      </p>
    )
  }

  return (
    <ol className={cn('flex flex-col gap-2', className)} aria-label="Closure review history">
      {reviews.map((review) => (
        <li
          key={review.id}
          className="rounded-lg border border-border bg-surface-hi px-3 py-2.5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="text-sm font-medium text-ink">{humanizeDecision(review.decision)}</p>
            <time
              dateTime={review.createdAt}
              title={formatDateTime(review.createdAt)}
              className="text-[11px] text-ink-faint"
            >
              {relativeTime(review.createdAt)}
            </time>
          </div>
          <p className="mt-1 whitespace-pre-line text-xs text-ink-muted">{review.comment}</p>
        </li>
      ))}
    </ol>
  )
}

/** The one-line explanation of what happens next, for the review tab. */
export function ReviewNextStep({ status }: { status: CaseStatus }) {
  const copy =
    status === 'pending_admin_review'
      ? 'Waiting on an administrator. This case cannot move until they decide.'
      : status === 'admin_changes_requested'
        ? 'Sent back to the assigned officer, who can revise and resubmit.'
        : 'No decision is pending on this case.'

  return (
    <p className="flex items-start gap-2 text-xs text-ink-muted">
      <Info className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
      {copy}
    </p>
  )
}
