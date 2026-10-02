/**
 * Frontend safety boundary for responder locations.
 *
 * The Go backend must still enforce authorization and must not publish an
 * officer's exact coordinates to callers who are not allowed to see them.
 * This helper provides a second client-side guard once responder data is
 * supplied to the map.
 */
export const RESPONDER_LOCATION_MAX_AGE_MS = 2 * 60 * 1000

export type ResponderLocation = {
  officerId: string
  latitude: number
  longitude: number
  recordedAt: string
}

export type SafeResponderLocation = ResponderLocation & {
  exact: boolean
}

export function isResponderLocationFresh(
  recordedAt: string,
  nowMs = Date.now(),
): boolean {
  const timestamp = Date.parse(recordedAt)
  if (!Number.isFinite(timestamp)) return false
  const age = nowMs - timestamp
  return age >= 0 && age <= RESPONDER_LOCATION_MAX_AGE_MS
}

/**
 * Round a coordinate for privacy-safe display. Three decimal places is roughly
 * 100 m at the equator and intentionally avoids rendering the officer's exact
 * GPS fix to an unauthorized viewer.
 */
export function roundResponderCoordinate(value: number, decimals = 3): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function toSafeResponderLocation(
  location: ResponderLocation,
  options: { nowMs?: number; canViewExact?: boolean } = {},
): SafeResponderLocation | null {
  if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return null
  if (!isResponderLocationFresh(location.recordedAt, options.nowMs)) return null

  if (options.canViewExact) {
    return { ...location, exact: true }
  }

  return {
    ...location,
    latitude: roundResponderCoordinate(location.latitude),
    longitude: roundResponderCoordinate(location.longitude),
    exact: false,
  }
}
