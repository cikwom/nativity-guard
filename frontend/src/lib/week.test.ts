import { describe, expect, it } from 'vitest'
import {
  groupByIsoWeek,
  isoWeekKey,
  isoWeekParts,
  startOfIsoWeek,
  weeksAgo,
  weekLabel,
} from './week'

/**
 * ISO-week grouping underpins the Weekly updates interface, so the boundaries
 * (week start, year rollover) are pinned here rather than discovered in the UI.
 */

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h)

describe('startOfIsoWeek', () => {
  it('returns Monday 00:00 for any day in the week', () => {
    // 2026-01-01 is a Thursday.
    const monday = startOfIsoWeek(at(2026, 1, 1))
    expect(monday.getDay()).toBe(1)
    expect(monday.getDate()).toBe(29)
    expect(monday.getMonth()).toBe(11) // December
    expect(monday.getFullYear()).toBe(2025)
    expect(monday.getHours()).toBe(0)
    expect(monday.getMinutes()).toBe(0)
  })

  it('treats Sunday as the last day of the week, not the first', () => {
    // 2026-01-04 is a Sunday — it belongs to the week starting 2025-12-29.
    expect(isoWeekKey(at(2026, 1, 4))).toBe('2026-W01')
    expect(isoWeekKey(at(2026, 1, 5))).toBe('2026-W02') // Monday
  })
})

describe('isoWeekKey', () => {
  it('numbers the week by the year of its Thursday', () => {
    // A week straddling New Year belongs to the year it mostly sits in.
    expect(isoWeekKey(at(2025, 12, 29))).toBe('2026-W01')
    expect(isoWeekKey(at(2026, 1, 1))).toBe('2026-W01')
    expect(isoWeekKey(at(2026, 1, 5))).toBe('2026-W02')
  })

  it('zero-pads the week number', () => {
    expect(isoWeekParts(at(2026, 1, 5)).week).toBe(2)
    expect(isoWeekKey(at(2026, 1, 5))).toBe('2026-W02')
  })
})

describe('weekLabel', () => {
  const now = at(2026, 1, 7) // Wednesday of 2026-W02

  it('names the current and previous weeks in plain language', () => {
    expect(weekLabel(at(2026, 1, 6), now)).toBe('This week')
    expect(weekLabel(at(2026, 1, 1), now)).toBe('Last week')
  })

  it('falls back to a dated label for older weeks', () => {
    const label = weekLabel(at(2025, 12, 22), now)
    expect(label.startsWith('Week of')).toBe(true)
    expect(label).toContain('2025')
  })

  it('counts weeks back from the current week', () => {
    expect(weeksAgo(at(2026, 1, 6), now)).toBe(0)
    expect(weeksAgo(at(2025, 12, 29), now)).toBe(-1)
    expect(weeksAgo(at(2025, 12, 22), now)).toBe(-2)
  })
})

describe('groupByIsoWeek', () => {
  const now = at(2026, 1, 7)

  const items = [
    { id: 'a', createdAt: at(2026, 1, 5, 9).toISOString() },
    { id: 'b', createdAt: at(2026, 1, 1, 8).toISOString() },
    { id: 'c', createdAt: at(2025, 12, 22, 7).toISOString() },
    { id: 'd', createdAt: at(2026, 1, 6, 10).toISOString() },
  ]

  it('buckets by ISO week, newest week first', () => {
    const weeks = groupByIsoWeek(items, now)
    expect(weeks.map((w) => w.key)).toEqual(['2026-W02', '2026-W01', '2025-W52'])
  })

  it('orders items newest first within a week', () => {
    const [current] = groupByIsoWeek(items, now)
    expect(current.items.map((i) => i.id)).toEqual(['d', 'a'])
    expect(current.isCurrent).toBe(true)
    expect(current.label).toBe('This week')
  })

  it('exposes the week start and end', () => {
    const [, lastWeek] = groupByIsoWeek(items, now)
    expect(lastWeek.start.getDay()).toBe(1)
    expect(lastWeek.end.getDay()).toBe(0)
    expect(lastWeek.end.getTime()).toBeGreaterThan(lastWeek.start.getTime())
  })

  it('skips unparseable timestamps instead of throwing', () => {
    const weeks = groupByIsoWeek([...items, { id: 'bad', createdAt: 'not-a-date' }], now)
    expect(weeks.flatMap((w) => w.items).map((i) => i.id)).not.toContain('bad')
  })

  it('returns nothing for an empty list', () => {
    expect(groupByIsoWeek([], now)).toEqual([])
  })
})
