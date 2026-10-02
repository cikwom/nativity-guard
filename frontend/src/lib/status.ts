import { CASE_STATUS, type CaseStatus } from '@/types/api'

/* Case lifecycle metadata — the single source of truth for how a status is
 * labelled, coloured, and ordered. Colours come from the Tailwind v4 tokens in
 * index.css (--color-status-*). Keep class strings literal so Tailwind can see
 * them.
 *
 * The lifecycle is NOT a straight line. Five field states run one way, and then
 * a review phase loops: an administrator can send a case back for more work, and
 * an officer can resubmit. `FIELD_LIFECYCLE` and `REVIEW_PHASE` below are the two
 * shapes; never render them as one rail (see frontagent.md §2). */

/** The one-way field lifecycle. A case only ever moves forward through these. */
export const FIELD_LIFECYCLE: CaseStatus[] = [
  CASE_STATUS.pending,
  CASE_STATUS.assigned,
  CASE_STATUS.dispatched,
  CASE_STATUS.onScene,
  CASE_STATUS.investigating,
]

/**
 * The review phase. Deliberately ordered as a *cycle*:
 * `pending_admin_review` → (request changes) → `admin_changes_requested` →
 * (resubmit) → `pending_admin_review`, or (approve) → `closed`.
 */
export const REVIEW_PHASE: CaseStatus[] = [
  CASE_STATUS.pendingAdminReview,
  CASE_STATUS.adminChangesRequested,
  CASE_STATUS.closed,
]

/** Every state, canonical order. Used for filters and lookups, not for a rail. */
export const CASE_STATUS_ORDER: CaseStatus[] = [...FIELD_LIFECYCLE, ...REVIEW_PHASE]

export interface StatusMeta {
  label: string
  /** Plain-language meaning, shown to explain a state to citizens/officers. */
  description: string
  dot: string
  text: string
  bg: string
  ring: string
  /** False for a state this build does not recognise. */
  known: boolean
}

export const CASE_STATUS_META: Record<CaseStatus, StatusMeta> = {
  pending: {
    label: 'Pending',
    description: 'Reported and awaiting triage or assignment.',
    dot: 'bg-status-pending',
    text: 'text-status-pending',
    bg: 'bg-status-pending/10',
    ring: 'ring-status-pending/30',
    known: true,
  },
  assigned: {
    label: 'Assigned',
    description: 'An officer has been assigned and will be dispatched.',
    dot: 'bg-status-assigned',
    text: 'text-status-assigned',
    bg: 'bg-status-assigned/10',
    ring: 'ring-status-assigned/30',
    known: true,
  },
  dispatched: {
    label: 'Dispatched',
    description: 'The assigned officer is en route.',
    dot: 'bg-status-dispatched',
    text: 'text-status-dispatched',
    bg: 'bg-status-dispatched/10',
    ring: 'ring-status-dispatched/30',
    known: true,
  },
  on_scene: {
    label: 'On scene',
    description: 'The officer has arrived and is working the case.',
    dot: 'bg-status-onscene',
    text: 'text-status-onscene',
    bg: 'bg-status-onscene/10',
    ring: 'ring-status-onscene/30',
    known: true,
  },
  investigating: {
    label: 'Investigating',
    description: 'The officer is investigating. A final report is required before review.',
    dot: 'bg-status-investigating',
    text: 'text-status-investigating',
    bg: 'bg-status-investigating/10',
    ring: 'ring-status-investigating/30',
    known: true,
  },
  pending_admin_review: {
    label: 'Awaiting review',
    description: 'Submitted for closure. An administrator must approve it or request changes.',
    dot: 'bg-status-adminreview',
    text: 'text-status-adminreview',
    bg: 'bg-status-adminreview/10',
    ring: 'ring-status-adminreview/30',
    known: true,
  },
  admin_changes_requested: {
    label: 'Changes requested',
    description: 'An administrator asked for more work. The officer can resubmit.',
    dot: 'bg-status-changes',
    text: 'text-status-changes',
    bg: 'bg-status-changes/10',
    ring: 'ring-status-changes/30',
    known: true,
  },
  closed: {
    label: 'Closed',
    description: 'Closure was approved. The final report is the permanent record.',
    dot: 'bg-status-closed',
    text: 'text-status-closed',
    bg: 'bg-status-closed/10',
    ring: 'ring-status-closed/30',
    known: true,
  },
}

/**
 * A state this build does not recognise.
 *
 * This exists so an unknown status is *visible* rather than quietly relabelled.
 * The old fallback returned `pending`, which rendered a case under investigation
 * as "Pending — awaiting triage": a confident wrong answer, which is worse than
 * an honest "I don't know" in software people make decisions with.
 */
const UNKNOWN_STATUS: StatusMeta = {
  label: 'Unrecognised state',
  description:
    'This build does not recognise the current state of this case. The case log shows what is on record.',
  dot: 'bg-ink-faint',
  text: 'text-ink-muted',
  bg: 'bg-surface-hi',
  ring: 'ring-border-hi',
  known: false,
}

export function statusMeta(status: string | undefined | null): StatusMeta {
  if (!status) return UNKNOWN_STATUS
  return CASE_STATUS_META[status as CaseStatus] ?? UNKNOWN_STATUS
}

/** Index in `CASE_STATUS_ORDER`, or **-1** when the state is not recognised. */
export function statusIndex(status: string | undefined | null): number {
  if (!status) return -1
  return CASE_STATUS_ORDER.indexOf(status as CaseStatus)
}

export function isKnownStatus(status: string | undefined | null): boolean {
  return statusIndex(status) >= 0
}

/**
 * How far through the *one-way field lifecycle* a case is.
 *
 * Returns `FIELD_LIFECYCLE.length` for every review-phase state, so the field rail
 * can show all its stages complete without pretending the review loop is a sixth
 * step on a straight line. Returns -1 for something unrecognised, which callers
 * must handle rather than clamp to zero.
 */
export function fieldStageIndex(status: string | undefined | null): number {
  if (!status) return -1
  if (REVIEW_PHASE.includes(status as CaseStatus)) return FIELD_LIFECYCLE.length
  const i = FIELD_LIFECYCLE.indexOf(status as CaseStatus)
  return i < 0 ? -1 : i
}

/** True once the case has left the field and entered (or passed through) review. */
export function isInReviewPhase(status: string | undefined | null): boolean {
  return status === CASE_STATUS.pendingAdminReview || status === CASE_STATUS.adminChangesRequested
}

/* The transitions the backend's guards actually permit, mirrored here so the UI
 * can explain a refusal instead of offering an action that will fail. */

/** `pending` or `assigned` — the states that mean nobody has gone yet. */
export function isAwaitingDispatch(status: string | undefined | null): boolean {
  return status === CASE_STATUS.pending || status === CASE_STATUS.assigned
}

/**
 * Whether progress may be added from this status.
 *
 * `investigating` is included because the review workflow requires a final report
 * written during investigation, and a case being investigated with no record of
 * the work would leave the reviewing administrator judging an empty file. ASSUMED
 * to match the backend guard — see frontReadme.md F7 for the open question.
 *
 * `admin_changes_requested` is deliberately **excluded**. It reads like it belongs
 * — the case is back with the officer, so let them work — but every progress write
 * goes through `POST /cases/:id/progress`, and the mock's guard accepts only the
 * three states above. Including it offered the officer a form that answers 409.
 * The revision path for that state is the final report, not progress: revise it to
 * answer the comment and resubmit. If the real backend turns out to accept progress
 * there, widen this *and* the mock guard together, in one change.
 */
export function canAddProgress(status: string | undefined | null): boolean {
  return (
    status === CASE_STATUS.dispatched ||
    status === CASE_STATUS.onScene ||
    status === CASE_STATUS.investigating
  )
}

/** Mirrors `SubmitCaseForReview`: `investigating` or `admin_changes_requested`. */
export function canSubmitForReview(status: string | undefined | null): boolean {
  return status === CASE_STATUS.investigating || status === CASE_STATUS.adminChangesRequested
}

/** Mirrors `ApproveCaseClosure` / `RequestCaseChanges`: `pending_admin_review` only. */
export function isAwaitingAdminReview(status: string | undefined | null): boolean {
  return status === CASE_STATUS.pendingAdminReview
}

/**
 * The self-approval rule: an administrator who is also the case's assigned officer
 * cannot approve its closure (the backend answers 403). Mirrored so the UI can
 * explain the rule before the click rather than surface a server error after it.
 */
export function canApproveClosure(
  status: string | undefined | null,
  isAssignedOfficer: boolean,
): boolean {
  return isAwaitingAdminReview(status) && !isAssignedOfficer
}

/** Whether closure is blocked *specifically* by the self-approval rule. */
export function blockedBySelfApproval(
  status: string | undefined | null,
  isAssignedOfficer: boolean,
): boolean {
  return isAwaitingAdminReview(status) && isAssignedOfficer
}

/* ---------------------------------------------------------------- actions */

/**
 * The officer lifecycle actions, and the endpoint each one hits.
 *
 * `close` is still listed because components written before the review workflow
 * may still reference it — but the route is **gone** from the backend router
 * (`POST /cases/:id/close` is not registered), so it is a dead action and the M4.5
 * closure work removes it in favour of `submitReview`. Do not build a UI on it.
 */
export type CaseAction = 'assign' | 'dispatch' | 'arrive' | 'close' | 'submitReview'

export const CASE_ACTION_META: Record<CaseAction, { label: string; path: string }> = {
  assign: { label: 'Assign officer', path: '/cases/:id/assign' },
  dispatch: { label: 'Dispatch', path: '/cases/:id/dispatch' },
  arrive: { label: 'Mark on scene', path: '/cases/:id/arrive' },
  // Dead: no longer registered in backend/routes/routes.go.
  close: { label: 'Close case', path: '/cases/:id/close' },
  submitReview: { label: 'Submit for review', path: '/cases/:id/submit-review' },
}

/* Priority bands (backend PriorityLevel: P1 critical, P2 high, P3 routine). */

export interface PriorityMeta {
  label: string
  text: string
  bg: string
  ring: string
}

export const PRIORITY_META: Record<string, PriorityMeta> = {
  P1: {
    label: 'P1 · Critical',
    text: 'text-emergency',
    bg: 'bg-emergency/10',
    ring: 'ring-emergency/40',
  },
  P2: { label: 'P2 · High', text: 'text-warn', bg: 'bg-warn/10', ring: 'ring-warn/40' },
  P3: {
    label: 'P3 · Routine',
    text: 'text-ink-muted',
    bg: 'bg-ink-muted/10',
    ring: 'ring-border-hi',
  },
}

export function priorityMeta(level: string | undefined): PriorityMeta {
  return PRIORITY_META[level ?? 'P3'] ?? PRIORITY_META.P3
}
