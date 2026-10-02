import { Star } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatCoord, formatDateTime, relativeTime } from '@/lib/format'
import { MapView } from '@/components/map/MapView'
import { useNearbyUnits } from '@/hooks/useUnits'
import { humanizeAction } from './activity'
import type { Case, CaseFeedback, CaseTimelineEntry } from '@/types/api'

/**
 * The factual record of a case: the report itself, its metadata, where it
 * happened and which units are in range, the system log, and any feedback the
 * reporter left.
 *
 * Shared deliberately by the officer workspace and the admin review so both
 * roles read the same facts from one implementation — an administrator
 * reviewing a decision must not be looking at a different rendering of it.
 */
export function CaseFacts({
  caseItem,
  timeline,
  feedback,
  className,
}: {
  caseItem: Case
  timeline: CaseTimelineEntry[]
  feedback: CaseFeedback[]
  className?: string
}) {
  const nearby = useNearbyUnits(
    Number.isFinite(caseItem.latitude) ? caseItem.latitude : undefined,
    Number.isFinite(caseItem.longitude) ? caseItem.longitude : undefined,
    25,
  )

  return (
    <div className={cn('flex flex-col gap-5 p-4', className)}>
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Report</h3>
        <p className="mt-1.5 whitespace-pre-line text-sm text-ink">{caseItem.description}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <Meta label="Incident date" value={formatDateTime(caseItem.incidentDate)} />
          <Meta
            label="Coordinates"
            value={formatCoord(caseItem.latitude, caseItem.longitude)}
          />
          <Meta label="Reported by" value={shortId(caseItem.reportedBy)} />
          <Meta label="Unit" value={shortId(caseItem.unitId)} />
          {caseItem.transferDetails ? (
            <Meta label="Transfer" value={caseItem.transferDetails} />
          ) : null}
        </dl>
      </section>

      {Number.isFinite(caseItem.latitude) && Number.isFinite(caseItem.longitude) ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Location &amp; responding units
          </h3>
          <MapView
            mode="view"
            cases={[caseItem]}
            units={nearby.data ?? []}
            center={[caseItem.latitude, caseItem.longitude]}
            zoom={14}
            height="18rem"
            selectedCaseId={caseItem.id}
            label={`Map showing ${caseItem.title} and nearby security units`}
          />
        </section>
      ) : null}

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Case log</h3>
        <SystemTimeline timeline={timeline} />
      </section>

      {feedback.length > 0 ? (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Feedback</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {feedback.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-border bg-surface-hi p-3">
                <div className="flex items-center gap-1" aria-label={`${entry.rating} out of 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={cn('size-3.5', n <= entry.rating ? 'text-warn' : 'text-ink-faint')}
                      aria-hidden
                    />
                  ))}
                </div>
                {entry.comment ? (
                  <p className="mt-1.5 text-sm text-ink">{entry.comment}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-ink-faint">{relativeTime(entry.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="truncate text-ink">{value}</dd>
    </div>
  )
}

function shortId(id: string | undefined | null): string {
  if (!id) return '—'
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}

export function SystemTimeline({
  timeline,
}: {
  timeline: { id: string; action: string; description?: string; createdAt: string }[]
}) {
  if (timeline.length === 0) {
    return (
      <p className="mt-2 text-xs text-ink-muted">No system events recorded on this case yet.</p>
    )
  }

  const ordered = [...timeline].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return (
    <ul className="mt-2 flex flex-col gap-2">
      {ordered.map((entry) => (
        <li key={entry.id} className="flex items-start gap-2.5">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-border-hi" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm text-ink">{humanizeAction(entry.action)}</p>
              <time
                dateTime={entry.createdAt}
                title={formatDateTime(entry.createdAt)}
                className="text-[11px] text-ink-faint"
              >
                {relativeTime(entry.createdAt)}
              </time>
            </div>
            {entry.description ? (
              <p className="text-xs text-ink-muted">{entry.description}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
