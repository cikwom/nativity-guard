import { Check, Dot, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { CASE_STATUS, type CaseStatus } from '@/types/api'
import { FIELD_LIFECYCLE, fieldStageIndex, statusMeta } from '@/lib/status'
import { formatDateTime, relativeTime } from '@/lib/format'

/**
 * Case progress — rendered as **two instruments, not one rail**.
 *
 * The field lifecycle (`pending → assigned → dispatched → on scene → investigating`)
 * is genuinely one-way, so it gets the rail. The review phase is a *loop*: an
 * administrator can send a case back and an officer can resubmit, more than once.
 * Drawing that as a sixth and seventh step on the same line would render a real
 * workflow as nonsense, so it gets its own block below the rail.
 *
 * A state this build does not recognise renders as an explicit unrecognised panel
 * that names the raw value — never clamped into the nearest known step.
 */
export function CaseStatusStepper({
  status,
  times = {},
  className,
}: {
  status: string | undefined
  /** Timestamp per status, e.g. `{ dispatched: caseItem.dispatchedAt }`. */
  times?: Partial<Record<CaseStatus, string | null | undefined>>
  className?: string
}) {
  const stage = fieldStageIndex(status)
  const meta = statusMeta(status)

  // Unknown: say so, and show the value we were actually given.
  if (stage < 0) {
    return (
      <div
        className={cn('rounded-panel border border-border-hi bg-surface-hi/50 p-3', className)}
        role="status"
      >
        <div className="flex items-start gap-2">
          <HelpCircle className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{meta.label}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{meta.description}</p>
            <p className="mt-1 text-[11px] text-ink-faint">
              Value on record: <span className="tabular">{status ?? 'missing'}</span>
            </p>
          </div>
        </div>
      </div>
    )
  }

  const leftField = stage >= FIELD_LIFECYCLE.length
  const isClosed = status === CASE_STATUS.closed

  return (
    <div className={className}>
      {/* Field rail — the one-way half of the lifecycle. */}
      <ol className="hidden sm:flex" aria-label="Field progress">
        {FIELD_LIFECYCLE.map((state, index) => {
          const stateMeta = statusMeta(state)
          const done = index < stage
          const isCurrent = index === stage
          const time = times[state]

          return (
            <li key={state} className="flex flex-1 flex-col gap-1.5">
              <div className="flex items-center">
                <span
                  aria-hidden
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-full ring-1',
                    done && 'bg-ok/15 text-ok ring-ok/40',
                    isCurrent && cn(stateMeta.bg, stateMeta.text, stateMeta.ring),
                    !done && !isCurrent && 'bg-surface-hi text-ink-faint ring-border-hi',
                  )}
                >
                  {done ? (
                    <Check className="size-3.5" />
                  ) : isCurrent ? (
                    <span className={cn('size-2 rounded-full', stateMeta.dot)} />
                  ) : (
                    <Dot className="size-3.5" />
                  )}
                </span>
                {index < FIELD_LIFECYCLE.length - 1 ? (
                  <span
                    aria-hidden
                    className={cn('mx-1 h-px flex-1', index < stage ? 'bg-ok/40' : 'bg-border-hi')}
                  />
                ) : null}
              </div>

              <div className="pr-2">
                <p
                  className={cn(
                    'text-xs font-medium',
                    isCurrent ? 'text-ink' : done ? 'text-ink-muted' : 'text-ink-faint',
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {stateMeta.label}
                </p>
                <p className="text-[10px] text-ink-faint">
                  {time ? relativeTime(time) : isCurrent ? 'in progress' : '—'}
                </p>
              </div>
            </li>
          )
        })}
      </ol>

      {/* Narrow: the rail collapses to a compact bar. */}
      <div className="sm:hidden">
        {!leftField ? (
          <>
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-ink" aria-current="step">
                {meta.label}
              </p>
              <p className="text-[11px] text-ink-muted tabular-nums">
                Step {stage + 1} of {FIELD_LIFECYCLE.length}
              </p>
            </div>
            <div className="mt-2 flex gap-1" aria-hidden>
              {FIELD_LIFECYCLE.map((state, index) => (
                <span
                  key={state}
                  className={cn(
                    'h-1.5 flex-1 rounded-full',
                    index <= stage ? statusMeta(state).dot : 'bg-surface-hi',
                  )}
                />
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ink-muted">{meta.description}</p>
            {times[FIELD_LIFECYCLE[stage]] ? (
              <p className="mt-0.5 text-[11px] text-ink-faint">
                Since {formatDateTime(times[FIELD_LIFECYCLE[stage]])}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      {/* Review phase — its own instrument, because it is a loop. */}
      {leftField ? (
        <div
          className={cn(
            'rounded-panel border p-3 sm:mt-3',
            isClosed ? 'border-border bg-surface-hi/40' : cn('border-transparent ring-1', meta.ring, meta.bg),
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-medium tracking-wide text-ink-faint uppercase">
              Review phase
            </p>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ring-1',
                meta.bg,
                meta.text,
                meta.ring,
              )}
              aria-current="step"
            >
              <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
              {meta.label}
            </span>
          </div>

          <p className="mt-1.5 text-xs text-ink-muted">{meta.description}</p>
          <p className="mt-1 text-[11px] text-ink-faint">
            {isClosed
              ? times.closed
                ? `Closed ${formatDateTime(times.closed)}`
                : 'Closure was approved.'
              : 'An administrator approves closure or sends it back. A case sent back returns to the officer, who can resubmit — this phase can repeat.'}
          </p>
        </div>
      ) : null}
    </div>
  )
}
