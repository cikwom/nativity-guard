import type { CaseTimelineEntry, Progress } from '@/types/api'

/**
 * A single dated thing that happened on a case, normalised from either the
 * progress feed (`/cases/:id/progress`, written by officers) or the audit
 * timeline (`/cases/:id/timeline`, written by the system).
 */
export interface ActivityItem {
  id: string
  createdAt: string
  action: string
  description?: string
  status?: string
  source: 'progress' | 'timeline'
}

export function progressToActivity(items: Progress[]): ActivityItem[] {
  return items.map((p) => ({
    id: `progress-${p.id}`,
    createdAt: p.createdAt,
    action: p.action,
    description: p.description,
    source: 'progress',
  }))
}

export function timelineToActivity(items: CaseTimelineEntry[]): ActivityItem[] {
  return items.map((t) => ({
    id: `timeline-${t.id}`,
    createdAt: t.createdAt,
    action: t.action,
    description: t.description,
    status: t.status,
    source: 'timeline',
  }))
}

/** Both feeds merged, newest first. */
export function mergeActivity(
  progress: Progress[],
  timeline: CaseTimelineEntry[],
): ActivityItem[] {
  return [...progressToActivity(progress), ...timelineToActivity(timeline)].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

const ACTION_LABELS: Record<string, string> = {
  case_created: 'Case reported',
  case_assigned: 'Officer assigned',
  officer_assigned: 'Officer assigned',
  dispatched: 'Officer dispatched',
  arrived: 'Officer on scene',
  on_scene: 'Officer on scene',
  investigating: 'Investigation opened',
  submitted_for_review: 'Submitted for review',
  changes_requested: 'Closure not approved',
  closure_approved: 'Closure approved',
  closed: 'Case closed',
  status_updated: 'Status updated',
  evidence_added: 'Evidence added',
  evidence_uploaded: 'Evidence added',
  evidence_verified: 'Evidence verified',
  note: 'Note',
  update: 'Update',
  progress: 'Progress update',
}

/*
 * There is deliberately no `weekly_summary` action here any more.
 *
 * A filed weekly narrative is `models.CaseWeeklyUpdate` and is read through
 * `GET /cases/:id/weekly-updates` — not a progress entry with an invented action.
 * The old code wrote one and then rendered it twice on the same screen. Any legacy
 * rows still carrying that action fall through to the Title Case fallback in
 * `humanizeAction` and read as "Weekly summary", which is the right answer anyway.
 */

const DECISION_LABELS: Record<string, string> = {
  approve: 'Closure approved',
  request_changes: 'Changes requested',
  // The backend defines this decision (`CaseReviewDecisionDeescalate`), but nothing
  // in this frontend sets it and no route that does has been found — so it is
  // labelled, not designed for. An unrecognised decision falls through to Title Case.
  deescalate: 'De-escalated',
}

/** `request_changes` → "Changes requested"; unknown codes fall back to Title Case. */
export function humanizeDecision(decision: string | undefined): string {
  if (!decision) return 'Decision recorded'
  return DECISION_LABELS[decision] ?? humanizeAction(decision)
}

/** `on_scene` → "Officer on scene"; unknown codes fall back to Title Case. */
export function humanizeAction(action: string | undefined): string {
  if (!action) return 'Update'
  const known = ACTION_LABELS[action]
  if (known) return known
  return action
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase())
}
