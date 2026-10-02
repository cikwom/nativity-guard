import { useMemo, useState } from 'react'
import { CalendarRange, ChevronDown, FileSignature, Info, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDateTime, relativeTime } from '@/lib/format'
import { groupByIsoWeek, startOfIsoWeek, startOfIsoWeekUtc, weekLabel } from '@/lib/week'
import { Badge } from '@/components/ui/Chips'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import {
  conflictingWeeklyUpdate,
  isClosedCaseRefusal,
  useFileWeeklyUpdate,
  useWeeklyUpdates,
} from '@/hooks/useWeeklyUpdates'
import { ApiError } from '@/lib/apiClient'
import { humanizeAction, type ActivityItem } from './activity'
import type { CaseTimelineEntry, CaseWeeklyUpdate, Progress } from '@/types/api'

/**
 * Weekly updates — two different things that used to be one screen.
 *
 * **Officer narratives** are a real entity: `models.CaseWeeklyUpdate`, seven fields,
 * a week computed server-side from Monday 00:00 UTC, deduplicated per officer per
 * week, and carrying a flag that decides whether the case's reporter may read it.
 *
 * **Activity by week** is not an entity at all. It is a *reading aid*: the case's
 * progress notes and status events grouped into ISO weeks, so a wall of updates can
 * be scanned a week at a time.
 *
 * The previous implementation collapsed the two, storing a filed narrative as a
 * progress entry with an invented `weekly_summary` action. That entry then appeared
 * **twice on this screen** — in the week's timeline listing and again as the week's
 * summary panel — while the real record went unread. Keeping the sections separate
 * is the fix; the second section is labelled as assembled precisely so nobody
 * mistakes it for something a person filed.
 */
export function WeeklyUpdates({
  caseId,
  canFile = false,
  currentUserId,
  progress,
  timeline,
  showCitizenVisibility = false,
  restrictedFeed = false,
  className,
}: {
  caseId: string | undefined
  /** True only for the case's assigned officer on a case that still accepts updates. */
  canFile?: boolean
  /** Used to detect "you have already filed this week" before the click. */
  currentUserId?: string
  /**
   * Progress notes and case events, used **only** to assemble the "Activity by
   * week" reading aid below. Both are optional, and when a caller omits them the
   * section is *absent* rather than empty — which is what the citizen view wants.
   * "Absent, not hidden" is the point: the citizen page must never fetch the
   * progress feed at all, so there is nothing to hide. A caller that passes `[]`
   * has the data and it is genuinely empty, so it still gets the empty state.
   */
  progress?: Progress[]
  timeline?: CaseTimelineEntry[]
  /** Admins and the filing officer see which updates reach the reporter. */
  showCitizenVisibility?: boolean
  /**
   * True when the server has already filtered this feed down to what the reporter
   * may read. It changes one sentence and nothing else — but it has to change it,
   * because on a filtered feed an empty list does **not** mean nothing was filed,
   * and telling the reporter that it does would be a lie the screen cannot check.
   */
  restrictedFeed?: boolean
  className?: string
}) {
  const query = useWeeklyUpdates(caseId)
  const fileUpdate = useFileWeeklyUpdate(caseId)

  const [composerOpen, setComposerOpen] = useState(false)
  const [draft, setDraft] = useState({
    summary: '',
    investigation: '',
    actionsTaken: '',
    findings: '',
    evidenceSummary: '',
    outstandingActions: '',
    nextSteps: '',
  })
  // A refusal the *client* did not anticipate — the week rolled over while the form
  // was open, or another tab filed first. The pre-check below catches the ordinary
  // case, so this is the race, not the rule.
  const [refused, setRefused] = useState<CaseWeeklyUpdate | null>(null)
  const [refusalMessage, setRefusalMessage] = useState<string | null>(null)

  const updates = useMemo(() => query.data ?? [], [query.data])

  /** The current reporting week, as the server computes it. */
  const currentWeekStart = useMemo(() => startOfIsoWeekUtc(new Date()).getTime(), [])

  const filedThisWeek = useMemo(
    () =>
      updates.find(
        (u) =>
          currentUserId !== undefined &&
          u.officerId === currentUserId &&
          new Date(u.weekStart).getTime() === currentWeekStart,
      ),
    [updates, currentUserId, currentWeekStart],
  )

  // A closed case refuses updates with a 409 too, so the form must be absent rather
  // than present-and-doomed. The caller's `canFile` covers this; this is the belt.
  const alreadyFiled = refused ?? filedThisWeek ?? null

  const requiredMissing = !draft.summary.trim() || !draft.investigation.trim()

  function closeComposer() {
    setComposerOpen(false)
    setRefusalMessage(null)
  }

  function submit() {
    fileUpdate.mutate(
      {
        summary: draft.summary.trim(),
        investigation: draft.investigation.trim(),
        actionsTaken: draft.actionsTaken.trim() || undefined,
        findings: draft.findings.trim() || undefined,
        evidenceSummary: draft.evidenceSummary.trim() || undefined,
        outstandingActions: draft.outstandingActions.trim() || undefined,
        nextSteps: draft.nextSteps.trim() || undefined,
      },
      {
        onSuccess: () => {
          closeComposer()
          setDraft({
            summary: '',
            investigation: '',
            actionsTaken: '',
            findings: '',
            evidenceSummary: '',
            outstandingActions: '',
            nextSteps: '',
          })
        },
        onError: (cause) => {
          const existing = conflictingWeeklyUpdate(cause)
          if (existing) {
            setRefused(existing)
            closeComposer()
            return
          }
          if (isClosedCaseRefusal(cause)) {
            setRefusalMessage('This case is closed, so it no longer accepts weekly updates.')
            closeComposer()
            return
          }
          setRefusalMessage(
            ApiError.isNetwork(cause)
              ? 'No connection — the update was not filed.'
              : cause instanceof ApiError
                ? cause.message
                : 'Could not file that update.',
          )
          closeComposer()
        },
      },
    )
  }

  return (
    <div className={cn('flex flex-col gap-5 p-4', className)}>
      {refusalMessage ? (
        <p className="flex items-start gap-2 rounded-panel border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {refusalMessage}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <FileSignature className="size-4 text-ink-muted" aria-hidden />
              Officer narratives
            </h3>
            <p className="mt-0.5 text-xs text-ink-muted">
              The weekly account filed against this case — one per officer per reporting week.
            </p>
          </div>

          {canFile && !alreadyFiled && !query.isLoading ? (
            <Button
              variant="primary"
              size="sm"
              icon={<FileSignature className="size-4" aria-hidden />}
              onClick={() => setComposerOpen(true)}
            >
              File this week's update
            </Button>
          ) : null}
        </div>

        {/* The week is the server's, so "you have already filed" is answerable here
            rather than only after a refused submission. Same principle as the
            self-approval guard: say it before the click. */}
        {alreadyFiled ? (
          <div className="flex items-start gap-2.5 rounded-panel border border-signal/25 bg-signal/5 p-3">
            <Info className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">
                This week's update is already filed
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                One narrative per officer per reporting week — the next one becomes available on{' '}
                {formatDateTime(new Date(currentWeekStart + 7 * 86_400_000))}.
              </p>
              <p className="mt-1.5 whitespace-pre-line border-l-2 border-signal/40 pl-2.5 text-xs text-ink-muted">
                {alreadyFiled.summary}
              </p>
            </div>
          </div>
        ) : null}

        {query.isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-panel" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState
            title="Could not load the weekly updates"
            description="The weekly narratives for this case did not load."
            onRetry={() => void query.refetch()}
          />
        ) : updates.length === 0 ? (
          <EmptyState
            icon={<FileSignature className="size-5" aria-hidden />}
            title="No weekly narrative filed yet"
            description={
              canFile
                ? 'File a short account of this week: what was done, what was found, and what happens next.'
                : restrictedFeed
                  ? 'Nothing has been shared with you yet. Narratives are filed weekly, and sharing one with the reporter is a decision the officer makes.'
                  : 'The assigned officer has not filed a weekly account for this case yet.'
            }
          />
        ) : (
          <ol className="flex flex-col gap-3">
            {updates.map((update) => (
              <WeeklyUpdateCard
                key={update.id}
                update={update}
                showCitizenVisibility={showCitizenVisibility}
              />
            ))}
          </ol>
        )}
      </section>

      {progress !== undefined || timeline !== undefined ? (
        <WeeklyActivity progress={progress ?? []} timeline={timeline ?? []} />
      ) : null}

      {composerOpen ? (
        <Modal
          open
          onClose={closeComposer}
          size="lg"
          title="File this week's update"
          description="One narrative per officer per reporting week. Once filed it becomes part of the case record — and if it is shared with the reporter, they can read it too."
          footer={
            <>
              <Button variant="ghost" onClick={closeComposer}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={fileUpdate.isPending}
                disabled={requiredMissing}
                onClick={submit}
              >
                File update
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <Field
              label="Summary"
              required
              hint="One or two lines: what this week amounted to."
            >
              {(props) => (
                <Textarea
                  {...props}
                  rows={2}
                  value={draft.summary}
                  onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
                  placeholder="e.g. Observation closed out; report resubmitted for approval."
                />
              )}
            </Field>

            <Field
              label="Investigation"
              required
              hint="What was actually done — the account the reviewing administrator will judge."
            >
              {(props) => (
                <Textarea
                  {...props}
                  rows={4}
                  value={draft.investigation}
                  onChange={(e) => setDraft((d) => ({ ...d, investigation: e.target.value }))}
                  placeholder="e.g. Four nights of observation from the building opposite…"
                />
              )}
            </Field>

            <details className="rounded-panel border border-border">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-ink-muted">
                Add detail (optional)
              </summary>
              <div className="flex flex-col gap-3 border-t border-border p-3">
                <Field label="Actions taken">
                  {(props) => (
                    <Textarea
                      {...props}
                      rows={2}
                      value={draft.actionsTaken}
                      onChange={(e) => setDraft((d) => ({ ...d, actionsTaken: e.target.value }))}
                    />
                  )}
                </Field>
                <Field label="Findings">
                  {(props) => (
                    <Textarea
                      {...props}
                      rows={2}
                      value={draft.findings}
                      onChange={(e) => setDraft((d) => ({ ...d, findings: e.target.value }))}
                    />
                  )}
                </Field>
                <Field label="Evidence">
                  {(props) => (
                    <Textarea
                      {...props}
                      rows={2}
                      value={draft.evidenceSummary}
                      onChange={(e) => setDraft((d) => ({ ...d, evidenceSummary: e.target.value }))}
                    />
                  )}
                </Field>
                <Field label="Outstanding actions">
                  {(props) => (
                    <Textarea
                      {...props}
                      rows={2}
                      value={draft.outstandingActions}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, outstandingActions: e.target.value }))
                      }
                    />
                  )}
                </Field>
                <Field label="Next steps">
                  {(props) => (
                    <Textarea
                      {...props}
                      rows={2}
                      value={draft.nextSteps}
                      onChange={(e) => setDraft((d) => ({ ...d, nextSteps: e.target.value }))}
                    />
                  )}
                </Field>
              </div>
            </details>

            {requiredMissing ? (
              <p className="flex items-start gap-2 text-xs text-ink-muted">
                <Info className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
                A summary and an account of the investigation are both required. They are what the
                reviewing administrator reads.
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

/** One filed narrative, oldest field order preserved: what was done, then what it found. */
function WeeklyUpdateCard({
  update,
  showCitizenVisibility,
}: {
  update: CaseWeeklyUpdate
  showCitizenVisibility: boolean
}) {
  const start = new Date(update.weekStart)
  const fields: { label: string; value?: string }[] = [
    { label: 'Investigation', value: update.investigation },
    { label: 'Actions taken', value: update.actionsTaken },
    { label: 'Findings', value: update.findings },
    { label: 'Evidence', value: update.evidenceSummary },
    { label: 'Outstanding', value: update.outstandingActions },
    { label: 'Next steps', value: update.nextSteps },
  ]

  return (
    <li className="overflow-hidden rounded-panel border border-border">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 bg-surface px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{weekLabel(start)}</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">
            {start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} –{' '}
            {new Date(update.weekEnd).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}{' '}
            · filed {relativeTime(update.createdAt)}
          </p>
        </div>
        {showCitizenVisibility && update.citizenVisible ? (
          <Badge tone="neutral">Shared with the reporter</Badge>
        ) : null}
      </div>

      <div className="border-t border-border bg-base px-3 py-3">
        <p className="text-sm font-medium text-ink">{update.summary}</p>
        <dl className="mt-2 flex flex-col gap-2">
          {fields
            .filter((f) => f.value)
            .map((field) => (
              <div key={field.label}>
                <dt className="text-[10px] uppercase tracking-wide text-ink-faint">{field.label}</dt>
                <dd className="mt-0.5 whitespace-pre-line text-xs text-ink-muted">{field.value}</dd>
              </div>
            ))}
        </dl>
      </div>
    </li>
  )
}

/**
 * The derived reading aid.
 *
 * Everything here is assembled from other records, so the heading says so. If this
 * section ever starts looking like the section above it, someone will file a
 * narrative expecting it to appear here — and it will not, because it is a different
 * kind of thing.
 */
function WeeklyActivity({
  progress,
  timeline,
}: {
  progress: Progress[]
  timeline: CaseTimelineEntry[]
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const activity = useMemo<ActivityItem[]>(() => {
    const merged: ActivityItem[] = [
      ...progress.map((p) => ({
        id: `progress-${p.id}`,
        createdAt: p.createdAt,
        action: p.action,
        description: p.description,
        source: 'progress' as const,
      })),
      ...timeline.map((t) => ({
        id: `timeline-${t.id}`,
        createdAt: t.createdAt,
        action: t.action,
        description: t.description,
        status: t.status,
        source: 'timeline' as const,
      })),
    ]
    return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [progress, timeline])

  const weeks = useMemo(() => groupByIsoWeek(activity), [activity])

  if (weeks.length === 0) {
    return (
      <EmptyState
        icon={<CalendarRange className="size-5" aria-hidden />}
        title="Nothing recorded on this case yet"
        description="Once officers add progress updates or the case changes status, the activity will be grouped here by week."
      />
    )
  }

  const currentBucket = weeks.find((w) => w.isCurrent)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <CalendarRange className="size-4 text-ink-muted" aria-hidden />
          Activity by week
        </h3>
        <p className="flex items-start gap-2 text-xs text-ink-muted">
          <Info className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
          Assembled from progress updates and case events, grouped Monday–Sunday. This is a reading
          aid, not a record anyone filed — the filed accounts are the narratives above.
        </p>
      </div>

      <section className="rounded-panel border border-border bg-surface-hi p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-signal" aria-hidden />
          <h4 className="text-sm font-semibold text-ink">This week at a glance</h4>
        </div>
        <dl className="mt-2 grid grid-cols-3 gap-3">
          <Stat label="Updates logged" value={String(currentBucket?.items.length ?? 0)} />
          <Stat label="Weeks on record" value={String(weeks.length)} />
          <Stat
            label="Latest activity"
            value={currentBucket?.items[0] ? relativeTime(currentBucket.items[0].createdAt) : '—'}
          />
        </dl>
      </section>

      <div className="flex flex-col gap-3">
        {weeks.map((week) => {
          const isOpen = expanded[week.key] ?? week.isCurrent
          const statusChanges = [
            ...new Set(week.items.map((i) => i.status).filter(Boolean) as string[]),
          ]

          return (
            <section key={week.key} className="overflow-hidden rounded-panel border border-border">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setExpanded((prev) => ({ ...prev, [week.key]: !isOpen }))}
                className="flex w-full items-center justify-between gap-3 bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-hi"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-ink">
                    {week.label}
                    {week.isCurrent ? <Badge tone="signal">Current</Badge> : null}
                    <span className="text-[11px] font-normal text-ink-faint">{week.key}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {week.items.length} update{week.items.length === 1 ? '' : 's'}
                    {statusChanges.length > 0 ? ` · status: ${statusChanges.join(' → ')}` : ''}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    'size-4 shrink-0 text-ink-muted transition-transform',
                    isOpen && 'rotate-180',
                  )}
                  aria-hidden
                />
              </button>

              {isOpen ? (
                <ul className="divide-y divide-border border-t border-border bg-base">
                  {week.items.map((item) => (
                    <li key={item.id} className="flex gap-3 px-3 py-2.5">
                      <span
                        className={cn(
                          'mt-1.5 size-1.5 shrink-0 rounded-full',
                          item.source === 'progress' ? 'bg-signal' : 'bg-border-hi',
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <p className="text-sm text-ink">
                            {humanizeAction(item.action)}
                            <span className="ml-2 text-[10px] uppercase tracking-wide text-ink-faint">
                              {item.source === 'progress' ? 'officer note' : 'system'}
                            </span>
                          </p>
                          <time
                            dateTime={item.createdAt}
                            title={formatDateTime(item.createdAt)}
                            className="text-[11px] text-ink-faint"
                          >
                            {relativeTime(item.createdAt)}
                          </time>
                        </div>
                        {item.description ? (
                          <p className="mt-0.5 text-xs text-ink-muted">{item.description}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          )
        })}
      </div>

      <p className="text-[11px] text-ink-faint">
        Weeks run Monday–Sunday (ISO 8601), in local time for display; the current week starts{' '}
        {formatDateTime(startOfIsoWeek(new Date()))}.
      </p>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  )
}
