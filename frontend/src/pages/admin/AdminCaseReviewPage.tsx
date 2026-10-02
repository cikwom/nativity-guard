import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  CalendarRange,
  CheckCircle2,
  FileText,
  Gavel,
  Image as ImageIcon,
  Info,
  MessageSquare,
  NotebookPen,
  TriangleAlert,
  UserPlus,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { BackLink } from '@/components/ui/BackLink'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Chips'
import { Field, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { TabPanel, Tabs } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { ErrorState, OfflineBanner, Skeleton } from '@/components/ui/States'
import { CaseHeader } from '@/components/case/CaseHeader'
import { CaseFacts } from '@/components/case/CaseFacts'
import { ProgressTimeline } from '@/components/case/ProgressTimeline'
import { WeeklyUpdates } from '@/components/case/WeeklyUpdates'
import { EvidenceGallery } from '@/components/case/EvidenceGallery'
import { ReviewHistory, ReviewNextStep, ReviewNotice } from '@/components/case/CaseReviewTrail'
import { AssignOfficerDialog } from '@/components/admin/AssignOfficerDialog'
import { useCaseDetail } from '@/hooks/useCases'
import { useCaseReview, useReviewDecision } from '@/hooks/useCaseReview'
import { useCaseProgress } from '@/hooks/useProgress'
import { useCaseEvidence, useVerifyEvidence } from '@/hooks/useEvidence'
import { useAssignOfficer, useCaseAssignments, useUnitOfficers } from '@/hooks/useOfficers'
import { useAuth } from '@/auth/AuthContext'
import { ApiError } from '@/lib/apiClient'
import { roleLabel } from '@/lib/assignment'
import { relativeTime } from '@/lib/format'
import {
  blockedBySelfApproval,
  canApproveClosure,
  isAwaitingAdminReview,
  statusMeta,
} from '@/lib/status'

type TabId = 'overview' | 'review' | 'progress' | 'weekly' | 'evidence'

/**
 * The administrator's view of a single case.
 *
 * Built for a decision, not for a browse: who is on this case, is anyone at all,
 * and does the record support what was done. It reads the same case facts as the
 * officer workspace (one shared component).
 *
 * It owns two lifecycle actions: **assignment** (the transition officers cannot
 * perform for themselves) and **the closure decision** — approve or request
 * changes. The decision is the admin's half of the accountability loop, so it is
 * surfaced *above the tabs* rather than filed away inside one: an administrator
 * opening a case that is waiting on them should not have to go looking for the
 * thing they came to do.
 */
export function AdminCaseReviewPage() {
  const { id } = useParams<{ id: string }>()
  const { notify } = useToast()
  const { user } = useAuth()

  const detail = useCaseDetail(id)
  const progressQuery = useCaseProgress(id)
  const evidenceQuery = useCaseEvidence(id)
  const assignmentsQuery = useCaseAssignments(id)
  const reviewQuery = useCaseReview(id)
  const assign = useAssignOfficer(id)
  const verifyEvidence = useVerifyEvidence(id)
  const { requestChanges, approve } = useReviewDecision(id)

  const caseItem = detail.data?.case
  const directory = useUnitOfficers(caseItem?.unitId)
  // Stable identity while the roster loads — see AdminCaseQueuePage.
  const officers = useMemo(() => directory.data ?? [], [directory.data])

  const [tab, setTab] = useState<TabId>('overview')
  const [assignOpen, setAssignOpen] = useState(false)
  const [decision, setDecision] = useState<'approve' | 'request_changes' | null>(null)
  const [comment, setComment] = useState('')

  const progress = progressQuery.data ?? []
  const evidence = evidenceQuery.data ?? []
  const assignments = assignmentsQuery.data ?? []
  const reviews = reviewQuery.data?.reviews ?? []

  // A refusal the UI did not anticipate — a case that moved while this screen was
  // open. Kept as state so it survives the modal closing, the same way the officer
  // page surfaces a submit conflict.
  const [decisionError, setDecisionError] = useState<string | null>(null)

  const officerById = useMemo(() => new Map(officers.map((o) => [o.id, o])), [officers])

  const assignedOfficerName = useMemo(() => {
    if (!caseItem?.assignedTo) return undefined
    const officer = officerById.get(caseItem.assignedTo)
    if (officer) return `${officer.rank} ${officer.name}`
    const entry = detail.data?.timeline.find((t) => t.user && t.user.id === caseItem.assignedTo)
    if (entry?.user) return `${entry.user.firstName} ${entry.user.lastName}`.trim()
    return undefined
  }, [caseItem, officerById, detail.data])

  const networkIssue = ApiError.isNetwork(detail.error)

  /* The closure decision, and whether this administrator may make it.
   *
   * `selfAssigned` is deliberately computed from the *current user's* id rather
   * than from the assignment list: the assignment list is a separate endpoint that
   * may 404 on this API build, and the guard must not silently disappear when it
   * does. `case.assignedTo` is on the case itself, so the rule holds either way. */
  const selfAssigned = Boolean(caseItem?.assignedTo && user?.id && caseItem.assignedTo === user.id)
  const awaitingDecision = isAwaitingAdminReview(caseItem?.status)
  const canApprove = canApproveClosure(caseItem?.status, selfAssigned)
  const selfApprovalBlocked = blockedBySelfApproval(caseItem?.status, selfAssigned)

  const tabs = useMemo(
    () => [
      { id: 'overview', label: 'Overview', icon: <FileText className="size-4" aria-hidden /> },
      {
        id: 'review',
        label: 'Review',
        count: reviews.length,
        icon: <Gavel className="size-4" aria-hidden />,
      },
      {
        id: 'progress',
        label: 'Progress',
        count: progress.length,
        icon: <NotebookPen className="size-4" aria-hidden />,
      },
      { id: 'weekly', label: 'Weekly', icon: <CalendarRange className="size-4" aria-hidden /> },
      {
        id: 'evidence',
        label: 'Evidence',
        count: evidence.length,
        icon: <ImageIcon className="size-4" aria-hidden />,
      },
    ],
    [progress.length, evidence.length, reviews.length],
  )

  if (detail.isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full rounded-panel" />
      </div>
    )
  }

  if (detail.isError || !caseItem) {
    return (
      <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
        <BackLink to="/admin/cases" label="Back to case review" />
        <Card className="mt-4">
          <ErrorState
            title={networkIssue ? 'You are offline' : 'Case unavailable'}
            description={
              networkIssue
                ? 'Reconnect to load this case.'
                : 'This case does not exist, or your unit does not have access to it.'
            }
            offline={networkIssue}
            onRetry={() => void detail.refetch()}
          />
        </Card>
      </div>
    )
  }

  const unassigned = !caseItem.assignedTo && caseItem.status !== 'closed'

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <BackLink to="/admin/cases" label="Back to case review" />

      {networkIssue ? (
        <div className="mb-3">
          <OfflineBanner />
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-4">
        <CaseHeader
          caseItem={caseItem}
          assignedOfficerName={assignedOfficerName}
          actions={
            <Button
              variant={unassigned ? 'primary' : 'secondary'}
              icon={<UserPlus className="size-4" aria-hidden />}
              onClick={() => setAssignOpen(true)}
            >
              {unassigned ? 'Assign officer' : 'Reassign'}
            </Button>
          }
        />

        {/* The decision, above everything else, because it is the only thing an
            administrator can do to a case in this state — and the one thing
            nobody else can do for them. */}
        {awaitingDecision ? (
          <ClosureDecisionPanel
            submitting={approve.isPending || requestChanges.isPending}
            canApprove={canApprove}
            selfApprovalBlocked={selfApprovalBlocked}
            assignedOfficerName={assignedOfficerName}
            onApprove={() => {
              setComment('')
              setDecision('approve')
            }}
            onRequestChanges={() => {
              setComment('')
              setDecision('request_changes')
            }}
          />
        ) : null}

        {decisionError ? (
          <div className="flex items-start justify-between gap-3 rounded-panel border border-warn/40 bg-warn/10 p-3">
            <p className="flex items-start gap-2 text-sm text-warn">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {decisionError}
            </p>
            <Button size="sm" variant="ghost" onClick={() => setDecisionError(null)}>
              Dismiss
            </Button>
          </div>
        ) : null}

        {/* After the decision is made, the admin sees the same instruction the
            officer sees when a case is sent back — so the record and the
            conversation agree. Suppressed while the decision is still open, since
            the panel above is already saying it. */}
        {awaitingDecision ? null : (
          <ReviewNotice status={caseItem.status} reviews={reviews} />
        )}

        {unassigned ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-warn/40 bg-warn/10 p-3">
            <p className="flex items-start gap-2 text-sm text-warn">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              This case has no officer assigned, so no one can dispatch it. Assigning an officer
              moves it from <span className="font-medium">pending</span> to{' '}
              <span className="font-medium">assigned</span>.
            </p>
            <Button
              size="sm"
              variant="primary"
              icon={<UserPlus className="size-4" aria-hidden />}
              onClick={() => setAssignOpen(true)}
            >
              Assign officer
            </Button>
          </div>
        ) : null}

        <AssignmentPanel
          assignments={assignments}
          state={
            assignmentsQuery.isLoading
              ? 'loading'
              : assignmentsQuery.isError
                ? assignmentsQuery.error instanceof ApiError &&
                  assignmentsQuery.error.status === 404
                  ? 'missing'
                  : 'failed'
                : 'ready'
          }
          officerName={(officerId) => {
            const officer = officerById.get(officerId)
            return officer ? `${officer.rank} ${officer.name} · ${officer.badgeNumber}` : undefined
          }}
          onAssign={() => setAssignOpen(true)}
        />

        <Card>
          <Tabs items={tabs} activeId={tab} onChange={(next) => setTab(next as TabId)} />

          {tab === 'overview' ? (
            <TabPanel id="overview">
              <CaseFacts
                caseItem={caseItem}
                timeline={detail.data?.timeline ?? []}
                feedback={detail.data?.feedback ?? []}
              />
            </TabPanel>
          ) : null}

          {tab === 'review' ? (
            <TabPanel id="review">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-ink">Closure review</h3>
                  <ReviewNextStep status={caseItem.status} />
                  {awaitingDecision ? (
                    <p className="flex items-start gap-2 text-xs text-ink-muted">
                      <Info className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
                      The final report is at the top of this page. Read it before deciding — the
                      approval records your name against the closure.
                    </p>
                  ) : null}
                </div>

                {reviewQuery.isError ? (
                  <ErrorState
                    title="Could not load the review history"
                    description="The decisions recorded on this case did not load."
                    onRetry={() => void reviewQuery.refetch()}
                  />
                ) : (
                  <ReviewHistory
                    reviews={reviews}
                    status={caseItem.status}
                    isLoading={reviewQuery.isLoading}
                  />
                )}

                {awaitingDecision ? (
                  <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                    <Button
                      variant="secondary"
                      icon={<MessageSquare className="size-4" aria-hidden />}
                      disabled={approve.isPending || requestChanges.isPending}
                      onClick={() => {
                        setComment('')
                        setDecision('request_changes')
                      }}
                    >
                      Request changes
                    </Button>
                    <Button
                      variant="primary"
                      icon={<CheckCircle2 className="size-4" aria-hidden />}
                      disabled={!canApprove || approve.isPending || requestChanges.isPending}
                      onClick={() => {
                        setComment('')
                        setDecision('approve')
                      }}
                    >
                      Approve closure
                    </Button>
                    {selfApprovalBlocked ? (
                      <p className="w-full text-xs text-ink-muted">
                        You are the assigned officer on this case, so a second administrator must
                        approve its closure. You can still request changes.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </TabPanel>
          ) : null}

          {tab === 'progress' ? (
            <TabPanel id="progress">
              {progressQuery.isLoading ? (
                <ProgressTimeline progress={[]} isLoading />
              ) : progressQuery.isError ? (
                <ErrorState
                  title="Could not load progress"
                  description="The updates for this case did not load."
                  onRetry={() => void progressQuery.refetch()}
                />
              ) : (
                <ProgressTimeline progress={progress} />
              )}
            </TabPanel>
          ) : null}

          {tab === 'weekly' ? (
            <TabPanel id="weekly">
              {/* `canFile` is false: filing the weekly narrative is the responding
                  officer's job and the endpoint is gated to it. An administrator
                  reads these to judge a closure, and edits none of them. */}
              <WeeklyUpdates
                caseId={id}
                currentUserId={user?.id}
                progress={progress}
                timeline={detail.data?.timeline ?? []}
                showCitizenVisibility
              />
            </TabPanel>
          ) : null}

          {tab === 'evidence' ? (
            <TabPanel id="evidence">
              {evidenceQuery.isLoading ? (
                <EvidenceGallery evidence={[]} isLoading />
              ) : evidenceQuery.isError ? (
                <ErrorState
                  title="Could not load evidence"
                  description="The evidence for this case did not load."
                  onRetry={() => void evidenceQuery.refetch()}
                />
              ) : (
                <EvidenceGallery
                  evidence={evidence}
                  canVerify={caseItem.status !== 'closed'}
                  verifyingId={verifyEvidence.isPending ? verifyEvidence.variables : null}
                  onVerify={(evidenceId) =>
                    verifyEvidence.mutate(evidenceId, {
                      onSuccess: () => notify('Evidence verified.', 'success'),
                      onError: (cause) =>
                        notify(
                          cause instanceof ApiError
                            ? cause.message
                            : 'Could not verify that item.',
                          'error',
                        ),
                    })
                  }
                />
              )}
            </TabPanel>
          ) : null}
        </Card>
      </div>

      {assignOpen ? (
        <AssignOfficerDialog
          caseItem={caseItem}
          assignments={assignments}
          submitting={assign.isPending}
          onClose={() => setAssignOpen(false)}
          onSubmit={({ officerId, role }) =>
            assign.mutate(
              { officerId, role },
              {
                onSuccess: () => {
                  setAssignOpen(false)
                  notify('Officer assigned.', 'success')
                },
                onError: (cause) =>
                  notify(
                    ApiError.isNetwork(cause)
                      ? 'No connection — the assignment was not saved.'
                      : cause instanceof ApiError
                        ? cause.message
                        : 'Could not assign that officer.',
                    'error',
                  ),
              },
            )
          }
        />
      ) : null}

      {/* The decision modal. Both outcomes require a comment — the contract refuses
          a bare click — so the primary action stays disabled and says why. */}
      {decision ? (
        <Modal
          open
          onClose={() => setDecision(null)}
          title={decision === 'approve' ? 'Approve this closure' : 'Request changes'}
          description={
            decision === 'approve'
              ? 'Approving closes the case and records your name against it. This is the permanent outcome — it cannot be undone from this screen.'
              : 'The case goes back to the assigned officer, who can revise and resubmit it. They will see your comment as their next instruction.'
          }
          footer={
            <>
              <Button variant="ghost" onClick={() => setDecision(null)}>
                Cancel
              </Button>
              <Button
                variant={decision === 'approve' ? 'primary' : 'secondary'}
                icon={
                  decision === 'approve' ? (
                    <CheckCircle2 className="size-4" aria-hidden />
                  ) : (
                    <MessageSquare className="size-4" aria-hidden />
                  )
                }
                loading={decision === 'approve' ? approve.isPending : requestChanges.isPending}
                disabled={!comment.trim()}
                onClick={() => {
                  const trimmed = comment.trim()
                  const mutation = decision === 'approve' ? approve : requestChanges
                  mutation.mutate(trimmed, {
                    onSuccess: () => {
                      setDecision(null)
                      setComment('')
                      setDecisionError(null)
                      notify(
                        decision === 'approve' ? 'Closure approved.' : 'Changes requested.',
                        'success',
                      )
                    },
                    onError: (cause) => {
                      setDecision(null)
                      setDecisionError(decisionErrorMessage(cause, decision))
                    },
                  })
                }}
              >
                {decision === 'approve' ? 'Approve and close' : 'Send back for changes'}
              </Button>
            </>
          }
        >
          <Field
            label={decision === 'approve' ? 'Reason for approving' : 'What needs to change'}
            required
            hint={
              decision === 'approve'
                ? 'Recorded with your name in the case history, and readable by the reporting citizen.'
                : 'Be specific — this comment is the officer’s brief for the next round of work.'
            }
          >
            {(props) => (
              <Textarea
                {...props}
                rows={6}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder={
                  decision === 'approve'
                    ? 'The investigation is complete and the report accounts for the evidence…'
                    : 'The final report does not explain how the stolen property was recovered…'
                }
              />
            )}
          </Field>

          {!comment.trim() ? (
            <p className="mt-2 flex items-start gap-2 text-xs text-ink-muted">
              <Info className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
              A comment is required. The decision record is what makes this closure accountable, so
              it is not accepted without one.
            </p>
          ) : null}

          {decision === 'approve' ? (
            <p className="mt-2 flex items-start gap-2 text-xs text-ink-muted">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
              Closing is a one-way step. If more work turns out to be needed, the case cannot be
              reopened from this screen.
            </p>
          ) : null}
        </Modal>
      ) : null}
    </div>
  )
}

/**
 * The decision, and the one rule that can take it away from this administrator.
 *
 * The self-approval refusal is rendered as a **disabled action with its reason
 * written out**, never a silent grey-out (frontagent.md §3 law 5). The reason
 * names the rule and the way forward, because "you cannot do this" without a "so
 * do this instead" leaves an administrator stuck on the one case only they can
 * move. It is also shown *before* the click rather than as a 403 afterwards — the
 * server would refuse, but a refusal the UI could have predicted is not an
 * explanation, it is a bug report.
 */
function ClosureDecisionPanel({
  submitting,
  canApprove,
  selfApprovalBlocked,
  assignedOfficerName,
  onApprove,
  onRequestChanges,
}: {
  submitting: boolean
  canApprove: boolean
  selfApprovalBlocked: boolean
  assignedOfficerName?: string
  onApprove: () => void
  onRequestChanges: () => void
}) {
  return (
    <div className="rounded-panel border border-status-adminreview/40 bg-status-adminreview/10 p-4">
      <div className="flex items-start gap-2.5">
        <Gavel className="mt-0.5 size-4 shrink-0 text-status-adminreview" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">This case is waiting on your decision</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            The assigned officer submitted it for closure. Read the final report at the top of this
            page, then either approve the closure or send the case back with what still needs doing.
            Either way a comment is required — it is the record of why this case ended.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-status-adminreview/30 pt-3">
        <Button
          variant="primary"
          icon={<CheckCircle2 className="size-4" aria-hidden />}
          disabled={!canApprove || submitting}
          onClick={onApprove}
        >
          Approve closure
        </Button>
        <Button
          variant="secondary"
          icon={<MessageSquare className="size-4" aria-hidden />}
          disabled={submitting}
          onClick={onRequestChanges}
        >
          Request changes
        </Button>
      </div>

      {selfApprovalBlocked ? (
        <p className="mt-2.5 flex items-start gap-2 text-xs text-ink-muted">
          <Info className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
          <span>
            <span className="font-medium text-ink">You are the assigned officer on this case</span>
            {assignedOfficerName ? ` (${assignedOfficerName})` : null}, so a second administrator must
            approve its closure — nobody signs off the investigation they ran. You can still request
            changes.
          </span>
        </p>
      ) : null}
    </div>
  )
}

/**
 * Turn a failed decision into something the administrator can act on.
 *
 * The 409 matters most: it means the case moved while this screen was open, so the
 * message names the state the case is *actually* in rather than reporting a
 * conflict — the same treatment the officer's submit flow gives it. The 403 is
 * kept as a fallback for the case where the server and this UI disagree about who
 * the assigned officer is; the UI aims to never let it be reached.
 */
function decisionErrorMessage(cause: unknown, decision: 'approve' | 'request_changes'): string {
  if (ApiError.isNetwork(cause)) {
    return 'No connection — the decision was not recorded. The case is still waiting on you.'
  }
  if (cause instanceof ApiError) {
    if (cause.status === 403) {
      return 'You are the assigned officer on this case, so a second administrator has to approve its closure.'
    }
    if (cause.status === 409) {
      const moved = (cause.body as { status?: string } | undefined)?.status
      const label = moved ? statusMeta(moved).label.toLowerCase() : 'a different state'
      return `This case has already moved — it is now ${label}, so this decision no longer applies. The page has been refreshed with its current state.`
    }
    if (cause.status === 400) {
      return `The decision was rejected: ${cause.message} A comment is required for both outcomes.`
    }
    return cause.message
  }
  return decision === 'approve'
    ? 'Could not record that approval.'
    : 'Could not send the case back for changes.'
}

/**
 * Who is on the case.
 *
 * `missing` is distinct from `failed` on purpose: the assignments route is part
 * of the API, so a 404 means this build genuinely does not expose it, whereas a
 * network failure is temporary. Conflating the two would let a dropped
 * connection read as "nobody is assigned".
 */
function AssignmentPanel({
  assignments,
  state,
  officerName,
  onAssign,
}: {
  assignments: { id: string; officerId: string; role: string; createdAt?: string }[]
  state: 'loading' | 'ready' | 'missing' | 'failed'
  officerName: (officerId: string) => string | undefined
  onAssign: () => void
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Users className="size-4 text-ink-muted" aria-hidden />
          Assigned officers
        </h2>
        <Button size="sm" variant="secondary" onClick={onAssign}>
          Manage
        </Button>
      </div>

      <div className="p-4">
        {state === 'loading' ? (
          <div className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : state === 'missing' ? (
          <p className="flex items-start gap-2 text-xs text-ink-muted">
            <Info className="mt-0.5 size-3.5 shrink-0 text-signal" aria-hidden />
            This API build does not expose a case-assignment list, so the officers attached to this
            case cannot be listed here. The case log below records each assignment as it happened.
          </p>
        ) : state === 'failed' ? (
          <p className="flex items-start gap-2 text-xs text-warn">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            The assignment list could not be loaded. This does not mean the case is unassigned — use
            the case log below to see what is on record.
          </p>
        ) : assignments.length === 0 ? (
          <p className="text-xs text-ink-muted">
            No officer is attached to this case yet. Assigning one is what moves it out of pending.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {assignments.map((assignment) => (
              <li
                key={assignment.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-hi px-3 py-2"
              >
                <span className="min-w-0 text-sm text-ink">
                  {officerName(assignment.officerId) ?? shortId(assignment.officerId)}
                </span>
                <span className="flex items-center gap-2">
                  {assignment.createdAt ? (
                    <span className="text-[11px] text-ink-faint">
                      since {relativeTime(assignment.createdAt)}
                    </span>
                  ) : null}
                  <Badge tone={assignment.role === 'primary' ? 'signal' : 'neutral'}>
                    {roleLabel(assignment.role)}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

function shortId(id: string | undefined | null): string {
  if (!id) return '—'
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}
