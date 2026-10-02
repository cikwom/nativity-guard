import { describe, expect, it } from 'vitest'
import { actorLabel, statusChangeEntries } from './caseLog'
import type { Case, CaseTimelineEntry, User } from '@/types/api'

/**
 * The reporter's case log is where the two audiences for one API response are
 * most likely to be confused, so the disclosure rules are pinned here: which
 * entries are shown, and the fact that a name can never appear in the label,
 * even though the payload always carries one.
 */

const REPORTER = 'citizen-1'
const CURRENT_OFFICER = 'officer-1'
const OTHER_STAFF = 'admin-1'
const FORMER_OFFICER = 'officer-9'

function person(id: string, firstName: string, lastName: string, role: User['role']): User {
  return { id, email: `${id}@shield.ng`, firstName, lastName, role }
}

function caseItem(overrides: Partial<Case> = {}): Case {
  return {
    id: 'case-1',
    unitId: 'unit-a',
    reportedBy: REPORTER,
    assignedTo: CURRENT_OFFICER,
    title: 'Armed robbery reported at a filling station',
    description: 'Two men on a motorcycle.',
    latitude: 6.5001,
    longitude: 3.3543,
    status: 'on_scene',
    priorityLevel: 'P1',
    trackingId: 'CS-2026-0004',
    gisLatitude: 6.5001,
    gisLongitude: 3.3543,
    isPublic: true,
    createdAt: '2026-09-14T08:00:00.000Z',
    updatedAt: '2026-09-14T09:00:00.000Z',
    ...overrides,
  }
}

function entry(overrides: Partial<CaseTimelineEntry> = {}): CaseTimelineEntry {
  return {
    id: 'tl-1',
    caseId: 'case-1',
    userId: CURRENT_OFFICER,
    action: 'dispatched',
    createdAt: '2026-09-14T09:00:00.000Z',
    ...overrides,
  }
}

describe('statusChangeEntries', () => {
  it('keeps only entries that moved the case to a state', () => {
    const entries = [
      entry({ id: 'a', status: 'pending', action: 'case_created' }),
      entry({ id: 'b', action: 'evidence_added' }),
      entry({ id: 'c', status: 'on_scene', action: 'arrived' }),
    ]

    expect(statusChangeEntries(entries).map((e) => e.id)).toEqual(['a', 'c'])
  })

  it('orders oldest first, so the log reads from the report forward', () => {
    const entries = [
      entry({ id: 'newest', status: 'closed', createdAt: '2026-09-14T12:00:00.000Z' }),
      entry({ id: 'oldest', status: 'pending', createdAt: '2026-09-14T08:00:00.000Z' }),
      entry({ id: 'middle', status: 'dispatched', createdAt: '2026-09-14T10:00:00.000Z' }),
    ]

    expect(statusChangeEntries(entries).map((e) => e.id)).toEqual(['oldest', 'middle', 'newest'])
  })

  it('does not reorder the caller’s array', () => {
    const entries = [
      entry({ id: 'newest', status: 'closed', createdAt: '2026-09-14T12:00:00.000Z' }),
      entry({ id: 'oldest', status: 'pending', createdAt: '2026-09-14T08:00:00.000Z' }),
    ]
    const before = entries.map((e) => e.id)

    statusChangeEntries(entries)

    expect(entries.map((e) => e.id)).toEqual(before)
  })

  it('returns nothing for a case with only non-status entries', () => {
    expect(statusChangeEntries([entry({ action: 'evidence_verified' })])).toEqual([])
  })
})

describe('actorLabel', () => {
  it('labels the reporter as You', () => {
    expect(actorLabel(entry({ userId: REPORTER }), caseItem())).toBe('You')
  })

  it('labels the case’s current assignee as an officer', () => {
    expect(actorLabel(entry({ userId: CURRENT_OFFICER }), caseItem())).toBe('Assigned officer')
  })

  it('labels everyone else as unit staff', () => {
    expect(actorLabel(entry({ userId: OTHER_STAFF }), caseItem())).toBe('Unit staff')
    expect(actorLabel(entry({ userId: FORMER_OFFICER }), caseItem())).toBe('Unit staff')
  })

  it('never leaks a name, even when the entry carries one', () => {
    // The payload always has `user`; the label must be derived from ids only.
    const named = entry({
      userId: OTHER_STAFF,
      user: person(OTHER_STAFF, 'Ngozi', 'Eze', 'unit_admin'),
    })

    const label = actorLabel(named, caseItem())

    expect(label).toBe('Unit staff')
    expect(label).not.toContain('Ngozi')
    expect(label).not.toContain('Eze')
  })

  it('treats an unassigned case as having no officer to attribute to', () => {
    const unassigned = caseItem({ assignedTo: null })

    expect(actorLabel(entry({ userId: CURRENT_OFFICER }), unassigned)).toBe('Unit staff')
    // The reporter is still themselves on a case nobody has picked up.
    expect(actorLabel(entry({ userId: REPORTER }), unassigned)).toBe('You')
  })
})
