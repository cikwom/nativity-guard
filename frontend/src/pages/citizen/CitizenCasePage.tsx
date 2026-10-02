import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Building2, CalendarClock, Hash, MapPin, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { BackLink } from '@/components/ui/BackLink'
import { Card } from '@/components/ui/Card'
import { PriorityChip, StatusChip } from '@/components/ui/Chips'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { CaseLog } from '@/components/case/CaseLog'
import { CitizenFeedback } from '@/components/case/CitizenFeedback'
import { CaseStatusStepper } from '@/components/case/CaseStatusStepper'
import { ReviewHistory, ReviewNextStep } from '@/components/case/CaseReviewTrail'
import { WeeklyUpdates } from '@/components/case/WeeklyUpdates'
import { finalReportHeading } from '@/components/case/CaseHeader'
import { useCaseDetail } from '@/hooks/useCases'
import { useCaseReview } from '@/hooks/useCaseReview'
import { useUnits } from '@/hooks/useUnits'
import { ApiError } from '@/lib/apiClient'
import { formatDateTime } from '@/lib/format'

/**
 * The reporter's view of one of their own reports.
 *
 * This is a **curated record**, not a copy of the officer's screen, and the
 * curating is done by omission. It calls three endpoints — the case, its review
 * history, and its weekly narratives — and never fetches the progress feed or the
 * evidence list. `WeeklyUpdates` is given no `progress`/`timeline`, so its
 * "Activity by week" section is *absent* rather than hidden; there is no code
 * path here that could render a progress note.
 *
 * What the reporter reads: where the case has got to, the final report, the
 * closure decisions and the comments on them, the weekly narratives an officer
 * chose to share, and a log of status changes with names and internal notes
 * stripped (see `CaseLog`).
 *
 * **This is presentation, not a privacy boundary.** `GET /cases/:id` already
 * returns the reporter the progress feed, the evidence list and timeline
 * descriptions that name officers and administrators; the mock's `canSeeCase`
 * permits it. Not fetching the first two and not rendering the third is a
 * deliberate choice about what a reporter should have to read, not a control on
 * what they can obtain — the data is one `curl` away with the same token. If the
 * boundary must be real, the backend has to stop sending it. Flagged in
 * frontReadme.md as an open question.
 */
export function CitizenCasePage() {
  const { id } = useParams<{ id: string }>()
  const detail = useCaseDetail(id)
  const review = useCaseReview(id)
  const units = useUnits()

  const caseItem = detail.data?.case

  /**
   * The unit that owns the case, by **name only**.
   *
   * `SecurityUnit` also carries `contactPerson`, `contactPhone` and
   * `contactEmail`; the reporter needs the unit, not the person who runs it, so
   * nothing but `name` is read. `undefined` while the list loads — the row reads
   * "Not recorded" rather than guessing a unit from anything else.
   */
  const unitName = useMemo(
    () => units.data?.find((unit) => unit.id === caseItem?.unitId)?.name,
    [units.data, caseItem?.unitId],
  )

  if (detail.isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full rounded-panel" />
      </div>
    )
  }

  if (detail.isError || !caseItem) {
    const offline = ApiError.isNetwork(detail.error)
    return (
      <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
        <BackLink to="/" label="Back to my reports" />
        <Card className="mt-4">
          <ErrorState
            title={offline ? 'You are offline' : 'Report unavailable'}
            description={
              offline
                ? 'Reconnect to load this report.'
                : 'This report does not exist, or it was filed by someone else.'
            }
            offline={offline}
            onRetry={() => void detail.refetch()}
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <BackLink to="/" label="Back to my reports" />

      <div className="mt-3 flex flex-col gap-4">
        <Card>
          <div className="flex flex-col gap-4 p-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={caseItem.status} />
                <PriorityChip level={caseItem.priorityLevel} />
              </div>
              <h1 className="mt-2 text-lg font-semibold leading-tight text-ink">
                {caseItem.title}
              </h1>
              <p className="mt-1 whitespace-pre-line text-sm text-ink-muted">
                {caseItem.description}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4">
              <Detail icon={<Hash className="size-3.5" />} label="Tracking ID">
                <span className="tabular-nums">{caseItem.trackingId}</span>
              </Detail>
              <Detail icon={<MapPin className="size-3.5" />} label="Where">
                {caseItem.location || 'Location recorded'}
              </Detail>
              <Detail icon={<CalendarClock className="size-3.5" />} label="Reported">
                {formatDateTime(caseItem.createdAt)}
              </Detail>
              <Detail icon={<Building2 className="size-3.5" />} label="Responding unit">
                {unitName ?? 'Not recorded'}
              </Detail>
              {caseItem.closedAt ? (
                <Detail icon={<ShieldCheck className="size-3.5" />} label="Closed">
                  {formatDateTime(caseItem.closedAt)}
                </Detail>
              ) : null}
            </dl>

            {/* No "time to dispatch" here, unlike the staff header: that is a
                measure of the unit's performance, and a case file is the wrong
                place to show someone their own service metric. The stepper below
                still carries the real timestamps for anyone who wants them. */}
            <CaseStatusStepper
              status={caseItem.status}
              times={{
                pending: caseItem.createdAt,
                assigned: caseItem.assignedAt,
                dispatched: caseItem.dispatchedAt,
                on_scene: caseItem.arrivedAt,
                closed: caseItem.closedAt,
              }}
            />
          </div>
        </Card>

        {caseItem.finalReport ? (
          <Card>
            <div className="p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {finalReportHeading(caseItem.status)}
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm text-ink">{caseItem.finalReport}</p>
            </div>
          </Card>
        ) : null}

        <Card>
          <div className="p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Closure review
            </h2>
            <div className="mt-2">
              <ReviewNextStep status={caseItem.status} />
            </div>
            {review.isError ? (
              <p className="mt-2 text-xs text-ink-muted">
                The review history did not load. It may be a connection problem.
              </p>
            ) : (
              <ReviewHistory
                reviews={review.data?.reviews ?? []}
                status={caseItem.status}
                isLoading={review.isLoading}
                className="mt-3"
              />
            )}
          </div>
        </Card>

        <Card>
          {/* `canFile` false: filing is the assigned officer's action and the
              endpoint is gated to it. `restrictedFeed` true: the server has
              already filtered this feed to what the reporter may read, so an
              empty list must not be described as "nothing was filed".
              No `progress`/`timeline` props — the derived activity section is
              absent, because this page does not fetch either. */}
          <WeeklyUpdates caseId={id} restrictedFeed />
        </Card>

        <Card>
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Case log
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Status changes on this report, oldest first.
            </p>
          </div>
          <CaseLog
            entries={detail.data?.timeline ?? []}
            caseItem={caseItem}
            isLoading={detail.isLoading}
          />
        </Card>
        <CitizenFeedback caseId={caseItem.id} closed={caseItem.status === 'closed'} feedback={detail.data?.feedback ?? []} />
      </div>
    </div>
  )
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-faint">
        <span aria-hidden>{icon}</span>
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm text-ink">{children}</dd>
    </div>
  )
}
