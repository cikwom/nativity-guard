import { useMemo, useState } from 'react'
import { BadgeCheck, Info, Search, TriangleAlert, UserRound } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/Chips'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { ApiError } from '@/lib/apiClient'
import { useUnitOfficers } from '@/hooks/useOfficers'
import {
  ASSIGNMENT_ROLES,
  DEFAULT_ASSIGNMENT_ROLE,
  assignmentBlocker,
  matchesOfficerQuery,
  roleLabel,
  sortOfficers,
  type AssignmentRole,
} from '@/lib/assignment'
import type { Case, CaseOfficer } from '@/types/api'

/**
 * Assign (or reassign) an officer to a case.
 *
 * This dialog is mounted only while it is open — the parent keys it by case —
 * so its initial selection is derived once per opening rather than reset by an
 * effect.
 *
 * The awkward part is the officer list. `POST /cases/:id/assign` wants an id
 * from the backend's `officers` table. `GET /units/:id/officers` is what lists
 * them, and it was routed on 2026-09-26 after a long spell of being implemented
 * but unregistered — so a current deployment serves the picker by name. So:
 *
 *  - when the roster is available, the admin picks a person by name;
 *  - when it 404s (an older deployment, whose router lacks the route), we say so
 *    plainly and fall back to entering the officer id, instead of pretending the
 *    list is empty or showing a generic error.
 *
 * The fallback is kept deliberately, not left behind. `rosterMissing` is false
 * whenever the route exists, so it costs nothing on a current deployment — and it
 * is the difference between a usable screen and a dead end on one that predates
 * the route. Frontend code cannot know which build it is talking to.
 */
export function AssignOfficerDialog({
  caseItem,
  assignments = [],
  submitting = false,
  onClose,
  onSubmit,
}: {
  caseItem: Case
  assignments?: CaseOfficer[]
  submitting?: boolean
  onClose: () => void
  onSubmit: (input: { officerId: string; role: AssignmentRole }) => void
}) {
  const directory = useUnitOfficers(caseItem.unitId)

  const [role, setRole] = useState<AssignmentRole>(DEFAULT_ASSIGNMENT_ROLE)
  const [query, setQuery] = useState('')
  const [manualId, setManualId] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(
    assignments.find((a) => a.role === 'primary')?.officerId ?? caseItem.assignedTo ?? null,
  )

  const officers = useMemo(() => directory.data ?? [], [directory.data])
  const ordered = useMemo(() => sortOfficers(officers), [officers])
  const visible = useMemo(
    () => ordered.filter((officer) => matchesOfficerQuery(officer, query)),
    [ordered, query],
  )

  const selected = officers.find((officer) => officer.id === selectedId)

  // A 404 means the roster route is not registered — a contract gap, not a
  // transient failure — so it gets its own UI rather than an error state.
  const rosterMissing =
    directory.isError &&
    directory.error instanceof ApiError &&
    directory.error.status === 404

  const blocker = rosterMissing ? null : assignmentBlocker(selected, caseItem.unitId)
  const canSubmit = rosterMissing
    ? manualId.trim().length > 0 && !submitting
    : Boolean(selected) && !blocker && !submitting

  function submit() {
    const officerId = rosterMissing ? manualId.trim() : selectedId
    if (!officerId) return
    onSubmit({ officerId, role })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Assign an officer"
      description={`${caseItem.trackingId} — ${caseItem.title}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={submitting} disabled={!canSubmit} onClick={submit}>
            {caseItem.assignedTo ? 'Reassign' : 'Assign officer'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {assignments.length > 0 ? (
          <section className="rounded-lg border border-border bg-surface-hi p-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Already on this case
            </h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {assignments.map((assignment) => {
                const officer = officers.find((o) => o.id === assignment.officerId)
                return (
                  <li
                    key={assignment.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <span className="flex items-center gap-1.5 text-ink">
                      <UserRound className="size-3.5 text-ink-faint" aria-hidden />
                      {officer ? `${officer.rank} ${officer.name}` : shortId(assignment.officerId)}
                      {officer ? (
                        <span className="text-ink-faint">· {officer.badgeNumber}</span>
                      ) : null}
                    </span>
                    <Badge tone={assignment.role === 'primary' ? 'signal' : 'neutral'}>
                      {roleLabel(assignment.role)}
                    </Badge>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        <Field
          label="Assignment role"
          hint={ASSIGNMENT_ROLES.find((r) => r.value === role)?.hint}
        >
          {(props) => (
            <Select
              {...props}
              value={role}
              onChange={(event) => setRole(event.target.value as AssignmentRole)}
            >
              {ASSIGNMENT_ROLES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {rosterMissing ? (
          <section className="flex flex-col gap-3">
            <p className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                The API does not expose a unit officer directory yet — the handler exists on the
                backend but its route was never registered, so the picker cannot list names. Enter
                the officer&rsquo;s ID instead; the server still validates that they belong to this
                case&rsquo;s unit.
              </span>
            </p>
            <Field
              label="Officer ID"
              required
              hint="The id from the unit roster, not the officer's login id."
            >
              {(props) => (
                <Input
                  {...props}
                  value={manualId}
                  onChange={(event) => setManualId(event.target.value)}
                  placeholder="e.g. 0f0f0f0f-0000-4000-8000-000000000002"
                  spellCheck={false}
                />
              )}
            </Field>
          </section>
        ) : directory.isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : directory.isError ? (
          <ErrorState
            title="Could not load the unit roster"
            description="The officer directory did not load. You can still retry."
            offline={ApiError.isNetwork(directory.error)}
            onRetry={() => void directory.refetch()}
          />
        ) : officers.length === 0 ? (
          <EmptyState
            icon={<UserRound className="size-5" aria-hidden />}
            title="No officers on this unit's roster"
            description="The unit has no officer records yet. Add officers to the roster before assigning work."
          />
        ) : (
          <section className="flex flex-col gap-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, badge or rank"
                aria-label="Search unit officers"
                className="pl-9"
              />
            </div>

            {visible.length === 0 ? (
              <p className="py-6 text-center text-xs text-ink-muted">
                No officer matches “{query}”.
              </p>
            ) : (
              <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
                {visible.map((officer) => {
                  const disabled = officer.status !== 'active'
                  const isSelected = officer.id === selectedId
                  return (
                    <li key={officer.id}>
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        disabled={disabled}
                        onClick={() => setSelectedId(officer.id)}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                          isSelected
                            ? 'border-signal/50 bg-signal/10'
                            : 'border-border bg-surface hover:border-border-hi hover:bg-surface-hi',
                          disabled && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm text-ink">
                            {officer.name}
                            {officer.id === caseItem.assignedTo ? (
                              <BadgeCheck className="size-3.5 text-ok" aria-label="Currently assigned" />
                            ) : null}
                          </span>
                          <span className="block text-[11px] text-ink-muted">
                            {officer.rank} · {officer.badgeNumber} · {officer.role}
                          </span>
                        </span>
                        {officer.status !== 'active' ? (
                          <Badge tone="warn">{officer.status}</Badge>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {blocker && selected ? (
              <p className="flex items-start gap-2 text-xs text-warn">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {blocker}
              </p>
            ) : null}
          </section>
        )}

        {caseItem.status === 'closed' ? (
          <p className="flex items-start gap-2 text-xs text-ink-muted">
            <Info className="mt-0.5 size-3.5 shrink-0 text-signal" aria-hidden />
            This case is closed. Changing its assignment will not reopen it.
          </p>
        ) : null}
      </div>
    </Modal>
  )
}

function shortId(id: string | undefined | null): string {
  if (!id) return '—'
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}
