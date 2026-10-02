import { describe, expect, it } from 'vitest'
import {
  CASE_STATUS_META,
  CASE_STATUS_ORDER,
  FIELD_LIFECYCLE,
  REVIEW_PHASE,
  blockedBySelfApproval,
  canAddProgress,
  canApproveClosure,
  canSubmitForReview,
  fieldStageIndex,
  isAwaitingAdminReview,
  isAwaitingDispatch,
  isInReviewPhase,
  isKnownStatus,
  priorityMeta,
  statusIndex,
  statusMeta,
} from './status'
import { CASE_STATUS } from '@/types/api'

/**
 * The status vocabulary is the frontend's most load-bearing contract: every case
 * screen, filter and guard reads from it, and it drifted silently once already
 * (the review workflow shipped three new states and the UI relabelled them
 * "Pending"). These tests pin the vocabulary, the literal strings the backend
 * stores, and the two rules that make the lifecycle representable at all — a
 * field rail that ends, and a review phase that loops.
 */

describe('the status vocabulary', () => {
  it('pins the literal strings the backend stores', () => {
    expect(CASE_STATUS).toEqual({
      pending: 'pending',
      assigned: 'assigned',
      dispatched: 'dispatched',
      onScene: 'on_scene',
      investigating: 'investigating',
      pendingAdminReview: 'pending_admin_review',
      adminChangesRequested: 'admin_changes_requested',
      closed: 'closed',
    })
  })

  it('partitions the lifecycle into a field rail and a review phase', () => {
    expect(CASE_STATUS_ORDER).toEqual([...FIELD_LIFECYCLE, ...REVIEW_PHASE])
    expect(FIELD_LIFECYCLE).toHaveLength(5)
    expect(REVIEW_PHASE).toHaveLength(3)
    expect(CASE_STATUS_ORDER).toHaveLength(8)
    // Every state appears exactly once, and every state has metadata.
    expect(new Set(CASE_STATUS_ORDER).size).toBe(8)
    for (const state of CASE_STATUS_ORDER) {
      expect(CASE_STATUS_META[state]).toBeDefined()
    }
  })
})

describe('statusMeta', () => {
  it('labels the states the review workflow added', () => {
    expect(statusMeta(CASE_STATUS.investigating).label).toBe('Investigating')
    expect(statusMeta(CASE_STATUS.pendingAdminReview).label).toBe('Awaiting review')
    expect(statusMeta(CASE_STATUS.adminChangesRequested).label).toBe('Changes requested')
  })

  it('reports an unrecognised state as unrecognised, never as pending', () => {
    // The regression this guards: the old fallback returned `pending`, so a case
    // under a new backend state rendered as "Pending — awaiting triage".
    const meta = statusMeta('some_future_state')
    expect(meta.known).toBe(false)
    expect(meta.label).toBe('Unrecognised state')
    expect(meta.label).not.toBe(CASE_STATUS_META.pending.label)
  })

  it('treats a missing status as unknown rather than guessing', () => {
    expect(statusMeta(undefined).known).toBe(false)
    expect(statusMeta(null).known).toBe(false)
    expect(statusMeta('').known).toBe(false)
  })

  it('marks every known state as known', () => {
    for (const state of CASE_STATUS_ORDER) {
      expect(statusMeta(state).known).toBe(true)
    }
  })
})

describe('statusIndex / isKnownStatus', () => {
  it('indexes the vocabulary in canonical order', () => {
    expect(statusIndex(CASE_STATUS.pending)).toBe(0)
    expect(statusIndex(CASE_STATUS.investigating)).toBe(4)
    expect(statusIndex(CASE_STATUS.closed)).toBe(7)
  })

  it('returns -1 for anything it does not recognise, not 0', () => {
    // -1 rather than 0: clamping to zero is what made an unknown state look like
    // the first step of the rail.
    expect(statusIndex('some_future_state')).toBe(-1)
    expect(statusIndex(undefined)).toBe(-1)
    expect(isKnownStatus('some_future_state')).toBe(false)
    expect(isKnownStatus(CASE_STATUS.onScene)).toBe(true)
  })
})

describe('fieldStageIndex', () => {
  it('walks the field rail in order', () => {
    expect(fieldStageIndex(CASE_STATUS.pending)).toBe(0)
    expect(fieldStageIndex(CASE_STATUS.assigned)).toBe(1)
    expect(fieldStageIndex(CASE_STATUS.dispatched)).toBe(2)
    expect(fieldStageIndex(CASE_STATUS.onScene)).toBe(3)
    expect(fieldStageIndex(CASE_STATUS.investigating)).toBe(4)
  })

  it('reports every review state as past the end of the rail', () => {
    // The rail is one-way, so a case in review has finished the field work. It is
    // not a sixth step: the review phase is drawn as its own instrument.
    for (const state of REVIEW_PHASE) {
      expect(fieldStageIndex(state)).toBe(FIELD_LIFECYCLE.length)
    }
  })

  it('returns -1 for an unrecognised state so callers cannot clamp it', () => {
    expect(fieldStageIndex('some_future_state')).toBe(-1)
    expect(fieldStageIndex(undefined)).toBe(-1)
  })
})

describe('isAwaitingDispatch', () => {
  it('is true only before anyone has gone', () => {
    expect(isAwaitingDispatch(CASE_STATUS.pending)).toBe(true)
    expect(isAwaitingDispatch(CASE_STATUS.assigned)).toBe(true)
    expect(isAwaitingDispatch(CASE_STATUS.dispatched)).toBe(false)
  })

  it('is false for a case in review', () => {
    // Guards the queue's overdue badge. `statusIndex(status) <= 1` used to stand in
    // here, which was true for an unknown status (index 0) and would have flagged a
    // submitted case as "awaiting dispatch > 24h".
    expect(isAwaitingDispatch(CASE_STATUS.pendingAdminReview)).toBe(false)
    expect(isAwaitingDispatch(CASE_STATUS.adminChangesRequested)).toBe(false)
    expect(isAwaitingDispatch('some_future_state')).toBe(false)
  })
})

describe('isInReviewPhase', () => {
  it('covers the two states that are waiting on a decision', () => {
    expect(isInReviewPhase(CASE_STATUS.pendingAdminReview)).toBe(true)
    expect(isInReviewPhase(CASE_STATUS.adminChangesRequested)).toBe(true)
    expect(isInReviewPhase(CASE_STATUS.closed)).toBe(false)
    expect(isInReviewPhase(CASE_STATUS.investigating)).toBe(false)
  })
})

describe('transition guards mirror the backend', () => {
  it('allows a submission only from investigating or changes-requested', () => {
    expect(canSubmitForReview(CASE_STATUS.investigating)).toBe(true)
    expect(canSubmitForReview(CASE_STATUS.adminChangesRequested)).toBe(true)
    expect(canSubmitForReview(CASE_STATUS.onScene)).toBe(false)
    expect(canSubmitForReview(CASE_STATUS.pendingAdminReview)).toBe(false)
    expect(canSubmitForReview(CASE_STATUS.closed)).toBe(false)
  })

  it('allows a decision only while a case is awaiting review', () => {
    expect(isAwaitingAdminReview(CASE_STATUS.pendingAdminReview)).toBe(true)
    expect(isAwaitingAdminReview(CASE_STATUS.adminChangesRequested)).toBe(false)
    expect(isAwaitingAdminReview(CASE_STATUS.investigating)).toBe(false)
  })

  it('refuses a closure approval by the case’s own assigned officer', () => {
    // The backend answers 403 here; the UI must explain it before the click.
    expect(canApproveClosure(CASE_STATUS.pendingAdminReview, false)).toBe(true)
    expect(canApproveClosure(CASE_STATUS.pendingAdminReview, true)).toBe(false)
    expect(blockedBySelfApproval(CASE_STATUS.pendingAdminReview, true)).toBe(true)
    expect(blockedBySelfApproval(CASE_STATUS.pendingAdminReview, false)).toBe(false)
    // Not blocked by the self-approval rule when there is nothing to approve.
    expect(blockedBySelfApproval(CASE_STATUS.investigating, true)).toBe(false)
  })

  it('allows progress during field work and investigation, but not in review', () => {
    expect(canAddProgress(CASE_STATUS.dispatched)).toBe(true)
    expect(canAddProgress(CASE_STATUS.onScene)).toBe(true)
    expect(canAddProgress(CASE_STATUS.investigating)).toBe(true)
    expect(canAddProgress(CASE_STATUS.pendingAdminReview)).toBe(false)
    expect(canAddProgress(CASE_STATUS.closed)).toBe(false)
    expect(canAddProgress(CASE_STATUS.pending)).toBe(false)
    expect(canAddProgress(CASE_STATUS.assigned)).toBe(false)
  })

  it('refuses progress on a changes-requested case, because the write would 409', () => {
    // This one reads like an oversight and is not: `POST /cases/:id/progress` in
    // src/mocks/handlers.ts accepts exactly the three states asserted above. A
    // changes-requested case is revised through the final report and resubmitted,
    // so offering a progress form here would hand the officer a 409. If the real
    // backend turns out to accept progress in this state, widen both together.
    expect(canAddProgress(CASE_STATUS.adminChangesRequested)).toBe(false)
    // Resubmitting is still open to them — that is the intended path.
    expect(canSubmitForReview(CASE_STATUS.adminChangesRequested)).toBe(true)
  })

  it('does not contradict ReviewNotice: nothing is fileable while review is pending', () => {
    // Both gates are shut on a case awaiting a decision, so the notice must not
    // promise the officer work they cannot file. See ReviewNotice in
    // src/components/case/CaseReviewTrail.tsx.
    expect(canAddProgress(CASE_STATUS.pendingAdminReview)).toBe(false)
    expect(canSubmitForReview(CASE_STATUS.pendingAdminReview)).toBe(false)
  })
})

describe('priorityMeta', () => {
  it('bands P1/P2 and treats anything else as routine', () => {
    expect(priorityMeta('P1').label).toBe('P1 · Critical')
    expect(priorityMeta('P2').label).toBe('P2 · High')
    expect(priorityMeta('P3').label).toBe('P3 · Routine')
    expect(priorityMeta(undefined).label).toBe('P3 · Routine')
    // An unrecognised band must not invent urgency.
    expect(priorityMeta('P9')).toEqual(priorityMeta('P3'))
  })
})
