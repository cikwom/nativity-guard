import { describe, expect, it } from 'vitest'
import {
  assignmentBlocker,
  inferAdminUnitId,
  matchesOfficerQuery,
  officerBelongsToUnit,
  roleLabel,
  sortOfficers,
} from './assignment'
import type { UnitOfficer } from '@/types/api'

/**
 * Assignment is the transition that moves a case out of `pending`, so its
 * guardrails are pinned here: the backend rejects officers from another unit,
 * and the UI must say so before the request rather than after the 400.
 */

function officer(overrides: Partial<UnitOfficer> = {}): UnitOfficer {
  return {
    id: 'off-1',
    unitId: 'unit-a',
    name: 'Tunde Balogun',
    rank: 'Sergeant',
    badgeNumber: 'CS-1042',
    role: 'patrol',
    status: 'active',
    ...overrides,
  }
}

describe('officerBelongsToUnit', () => {
  it('accepts an officer from the case unit', () => {
    expect(officerBelongsToUnit(officer(), 'unit-a')).toBe(true)
  })

  it('rejects an officer from another unit', () => {
    expect(officerBelongsToUnit(officer({ unitId: 'unit-b' }), 'unit-a')).toBe(false)
  })

  it('rejects when the case unit is unknown', () => {
    expect(officerBelongsToUnit(officer(), undefined)).toBe(false)
  })
})

describe('assignmentBlocker', () => {
  it('has no blocker for an active officer in the right unit', () => {
    expect(assignmentBlocker(officer(), 'unit-a')).toBeNull()
  })

  it('asks for a selection when nothing is chosen', () => {
    expect(assignmentBlocker(undefined, 'unit-a')).toBe('Choose an officer first.')
  })

  it('refuses an officer who is not active', () => {
    const reason = assignmentBlocker(officer({ status: 'leave' }), 'unit-a')
    expect(reason).toMatch(/leave/)
  })

  it('explains the cross-unit refusal by name', () => {
    const reason = assignmentBlocker(officer({ unitId: 'unit-b' }), 'unit-a')
    expect(reason).toMatch(/Tunde Balogun/)
    expect(reason).toMatch(/different unit/)
  })

  it('checks status before unit, so the message names the real reason', () => {
    const reason = assignmentBlocker(officer({ unitId: 'unit-b', status: 'suspended' }), 'unit-a')
    expect(reason).toMatch(/suspended/)
  })
})

describe('sortOfficers', () => {
  it('puts active officers first, then sorts by rank and name', () => {
    const sorted = sortOfficers([
      officer({ id: '1', name: 'Zara', rank: 'Constable' }),
      officer({ id: '2', name: 'Ada', rank: 'Inspector' }),
      officer({ id: '3', name: 'Ben', rank: 'Constable', status: 'leave' }),
    ])
    expect(sorted.map((o) => o.id)).toEqual(['1', '2', '3'])
  })

  it('does not mutate its input', () => {
    const input = [officer({ id: '1', name: 'Zara' }), officer({ id: '2', name: 'Ada' })]
    const before = input.map((o) => o.id)
    sortOfficers(input)
    expect(input.map((o) => o.id)).toEqual(before)
  })
})

describe('matchesOfficerQuery', () => {
  it('matches on name, badge, rank and duty role', () => {
    const subject = officer()
    expect(matchesOfficerQuery(subject, 'tunde')).toBe(true)
    expect(matchesOfficerQuery(subject, 'CS-10')).toBe(true)
    expect(matchesOfficerQuery(subject, 'sergeant')).toBe(true)
    expect(matchesOfficerQuery(subject, 'patrol')).toBe(true)
  })

  it('matches everything for an empty query', () => {
    expect(matchesOfficerQuery(officer(), '   ')).toBe(true)
  })

  it('does not match an unrelated query', () => {
    expect(matchesOfficerQuery(officer(), 'helicopter')).toBe(false)
  })
})

describe('roleLabel', () => {
  it('labels the three backend roles', () => {
    expect(roleLabel('primary')).toBe('Primary')
    expect(roleLabel('investigator')).toBe('Investigator')
    expect(roleLabel('support')).toBe('Support')
  })

  it('falls back for an unknown role rather than showing a raw code', () => {
    expect(roleLabel('wat')).toBe('Support')
    expect(roleLabel(undefined)).toBe('Support')
  })
})

describe('inferAdminUnitId', () => {
  it('returns the single unit when every case shares one', () => {
    expect(inferAdminUnitId([{ unitId: 'unit-a' }, { unitId: 'unit-a' }])).toBe('unit-a')
  })

  it('returns undefined when cases span units — no roster can be assumed', () => {
    expect(inferAdminUnitId([{ unitId: 'unit-a' }, { unitId: 'unit-b' }])).toBeUndefined()
  })

  it('returns undefined for an empty list', () => {
    expect(inferAdminUnitId([])).toBeUndefined()
  })
})
