import type { ReactNode } from 'react'
import { CalendarClock, Hash, MapPin, ShieldCheck, Timer, UserRound } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PriorityChip, StatusChip } from '@/components/ui/Chips'
import { durationBetween, formatCoord, formatDateTime } from '@/lib/format'
import { CaseStatusStepper } from './CaseStatusStepper'
import type { Case, CaseStatus } from '@/types/api'

/**
 * Case identity block: what it is, how urgent, where, who owns it, and how far
 * through the lifecycle it is. Every value is a real field from `GET /cases/:id`
 * — nothing here is inferred or embellished.
 */
export function CaseHeader({
  caseItem,
  assignedOfficerName,
  actions,
}: {
  caseItem: Case
  /** Resolved from the case timeline/assignments when available. */
  assignedOfficerName?: string
  actions?: ReactNode
}) {
  const responseTime = durationBetween(
    caseItem.createdAt,
    caseItem.dispatchedAt ?? caseItem.arrivedAt ?? undefined,
  )

  return (
    <Card>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={caseItem.status} />
              <PriorityChip level={caseItem.priorityLevel} />
              {caseItem.isPublic ? (
                <span className="rounded-full bg-surface-hi px-2 py-0.5 text-[11px] text-ink-muted">
                  Public
                </span>
              ) : null}
            </div>
            <h1 className="mt-2 text-lg font-semibold leading-tight text-ink">
              {caseItem.title}
            </h1>
            <p className="mt-1 max-w-2xl whitespace-pre-line text-sm text-ink-muted">
              {caseItem.description}
            </p>
          </div>

          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 lg:grid-cols-4">
          <Detail icon={<Hash className="size-3.5" />} label="Tracking ID">
            <span className="tabular-nums">{caseItem.trackingId}</span>
          </Detail>
          <Detail icon={<MapPin className="size-3.5" />} label="Location">
            {caseItem.location || formatCoord(caseItem.latitude, caseItem.longitude)}
          </Detail>
          <Detail icon={<CalendarClock className="size-3.5" />} label="Reported">
            {formatDateTime(caseItem.createdAt)}
          </Detail>
          <Detail icon={<UserRound className="size-3.5" />} label="Assigned officer">
            {assignedOfficerName ?? (caseItem.assignedTo ? 'Assigned' : 'Unassigned')}
          </Detail>
          <Detail icon={<Timer className="size-3.5" />} label="Time to dispatch">
            {caseItem.dispatchedAt ? responseTime : '—'}
          </Detail>
          <Detail icon={<ShieldCheck className="size-3.5" />} label="Closed">
            {caseItem.closedAt ? formatDateTime(caseItem.closedAt) : '—'}
          </Detail>
        </dl>

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

        {caseItem.finalReport ? (
          <div className="rounded-lg border border-border bg-surface-hi p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {finalReportHeading(caseItem.status)}
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink">{caseItem.finalReport}</p>
          </div>
        ) : null}
      </div>
    </Card>
  )
}

/**
 * The final report matters *before* closure, not only after it: it is the artefact
 * a reviewing administrator judges, and what an officer who was sent back has to
 * revise. Heading it by state is what stops a submitted report from reading as a
 * finished one.
 *
 * Exported because the citizen's view of the case shows the same reports, and a
 * reporter and the officer must not read different headings for the same state.
 */
export function finalReportHeading(status: CaseStatus): string {
  switch (status) {
    case 'pending_admin_review':
      return 'Final report — submitted for review'
    case 'admin_changes_requested':
      return 'Final report — changes requested'
    case 'closed':
      return 'Final report'
    default:
      return 'Final report — draft'
  }
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
