import { describe, expect, it } from 'vitest'
import {
  RESPONDER_LOCATION_MAX_AGE_MS,
  isResponderLocationFresh,
  toSafeResponderLocation,
} from '@/lib/responderLocation'

const NOW = Date.parse('2026-10-02T12:00:00.000Z')

const location = {
  officerId: 'officer-1',
  latitude: 6.524437,
  longitude: 3.379284,
  recordedAt: new Date(NOW - 30_000).toISOString(),
}

describe('responder location safety', () => {
  it('accepts locations no older than two minutes', () => {
    expect(isResponderLocationFresh(location.recordedAt, NOW)).toBe(true)
    expect(isResponderLocationFresh(new Date(NOW - RESPONDER_LOCATION_MAX_AGE_MS - 1).toISOString(), NOW)).toBe(false)
  })

  it('rejects future, invalid, and stale timestamps', () => {
    expect(isResponderLocationFresh('not-a-date', NOW)).toBe(false)
    expect(isResponderLocationFresh(new Date(NOW + 1).toISOString(), NOW)).toBe(false)
  })

  it('rounds coordinates for privacy-safe viewers', () => {
    const safe = toSafeResponderLocation(location, { nowMs: NOW, canViewExact: false })
    expect(safe).toEqual({ ...location, latitude: 6.524, longitude: 3.379, exact: false })
  })

  it('keeps exact coordinates only for an explicitly authorized viewer', () => {
    const exact = toSafeResponderLocation(location, { nowMs: NOW, canViewExact: true })
    expect(exact).toEqual({ ...location, exact: true })
  })

  it('hides stale responder locations instead of showing an old position', () => {
    const stale = toSafeResponderLocation(
      { ...location, recordedAt: new Date(NOW - RESPONDER_LOCATION_MAX_AGE_MS - 1).toISOString() },
      { nowMs: NOW },
    )
    expect(stale).toBeNull()
  })
})
