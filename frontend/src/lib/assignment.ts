import type { UnitOfficer } from '@/types/api'

/**
 * Case-assignment rules.
 *
 * `POST /cases/:id/assign` takes an id from the `officers` table — not a user id
 * — and the backend refuses an officer whose `unitId` differs from the case's
 * unit. Encoding those two rules here lets the UI explain a rejection *before*
 * the request, instead of surfacing a 400 after it.
 *
 * These are pure functions precisely so they can be pinned by tests; the
 * authoritative check is still the server's.
 */

/** The three roles the backend accepts (`role` defaults to `primary`). */
export const ASSIGNMENT_ROLES = [
  {
    value: 'primary',
    label: 'Primary',
    hint: 'Owns the case and appears as its assigned officer.',
  },
  {
    value: 'investigator',
    label: 'Investigator',
    hint: 'Works the case alongside the primary officer.',
  },
  {
    value: 'support',
    label: 'Support',
    hint: 'Backup — patrol, logistics or specialist support.',
  },
] as const

export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number]['value']

export const DEFAULT_ASSIGNMENT_ROLE: AssignmentRole = 'primary'

export function roleLabel(role: string | undefined): string {
  return ASSIGNMENT_ROLES.find((r) => r.value === role)?.label ?? 'Support'
}

/** True when the officer may legally take a case belonging to `caseUnitId`. */
export function officerBelongsToUnit(
  officer: UnitOfficer,
  caseUnitId: string | undefined,
): boolean {
  if (!caseUnitId) return false
  return officer.unitId === caseUnitId
}

/**
 * Mirrors the backend's guard. Returns a plain-language reason the assignment
 * would be rejected, or `null` when it is allowed.
 */
export function assignmentBlocker(
  officer: UnitOfficer | undefined,
  caseUnitId: string | undefined,
): string | null {
  if (!officer) return 'Choose an officer first.'
  if (officer.status && officer.status !== 'active') {
    return `${officer.name} is marked “${officer.status}” and cannot take new cases.`
  }
  if (!officerBelongsToUnit(officer, caseUnitId)) {
    return `${officer.name} belongs to a different unit — the API only accepts officers from the case's own unit.`
  }
  return null
}

/** Active officers first, then by rank, then alphabetically. */
export function sortOfficers(officers: UnitOfficer[]): UnitOfficer[] {
  return [...officers].sort((a, b) => {
    const byStatus = (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1)
    if (byStatus !== 0) return byStatus
    const byRank = (a.rank ?? '').localeCompare(b.rank ?? '')
    if (byRank !== 0) return byRank
    return a.name.localeCompare(b.name)
  })
}

/** Name / badge / rank / duty-role search used by the officer picker. */
export function matchesOfficerQuery(officer: UnitOfficer, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [officer.name, officer.badgeNumber, officer.rank, officer.role]
    .filter((field): field is string => Boolean(field))
    .some((field) => field.toLowerCase().includes(q))
}

/**
 * The unit a staff member administers.
 *
 * `GET /auth/profile` carries no `unitId` (a documented contract gap), so for a
 * unit administrator we infer it from the cases the API already scoped to them:
 * the unit they most often see is the unit they run. Returns `undefined` when
 * the case list is empty or genuinely spans units, in which case callers must
 * not assume a roster is available.
 */
export function inferAdminUnitId(cases: { unitId?: string }[]): string | undefined {
  const counts = new Map<string, number>()
  for (const item of cases) {
    if (!item.unitId) continue
    counts.set(item.unitId, (counts.get(item.unitId) ?? 0) + 1)
  }
  if (counts.size !== 1) return undefined
  return [...counts.keys()][0]
}
