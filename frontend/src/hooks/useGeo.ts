/**
 * Canonical Nigerian geography, straight from the API's embedded dataset.
 *
 * `GET /geo/states` and `GET /geo/lgas?state=` are public and rate-limited
 * (`routes.go:161-162`), and the dataset is fixed — it will not change between
 * two page loads in a session. So both are cached hard: 24h `staleTime`, and
 * the LGA list is keyed by state so switching between two units on the same
 * form never refetches.
 *
 * The two option builders are exported pure functions, not inline object
 * literals, for the same reason `locationReducer` is (`useLocation.ts:50-56`):
 * this repo ships a `node` vitest environment with no DOM, so `renderHook` is
 * unavailable and the parts worth pinning are the keys, the paths, and the
 * `enabled` gate.
 */

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'

/** One row of `GET /geo/states`. */
export interface StateSummary {
  name: string
  capital: string
  zone: string
  lgaCount: number
}

interface StatesResponse {
  states: StateSummary[]
}

export interface LgasResponse {
  state: string
  lgas: string[]
}

export interface GeoStatesResult {
  data: StateSummary[] | undefined
  isLoading: boolean
  error: Error | null
}

export interface GeoLgasResult {
  data: string[] | undefined
  isLoading: boolean
  error: Error | null
}

/** 24 hours — the dataset is effectively static. */
export const GEO_STATES_STALE_MS = 24 * 60 * 60 * 1000

export const geoKeys = {
  states: ['geo', 'states'] as const,
  lgas: (state: string) => ['geo', 'lgas', state] as const,
}

/** `GET /geo/lgas` needs a state; without one the request is meaningless. */
export function lgasPath(state: string | null): string | null {
  if (!state) return null
  return `/geo/lgas?state=${encodeURIComponent(state)}`
}

/**
 * Options for the LGA query.
 *
 * `enabled` is false for a null/empty state, so no request is made — the form
 * shows no LGA options until a state is chosen. `placeholderData` keeps the
 * hook's `data` an array rather than `undefined` in that idle state, so a
 * `<select>` can map over it unconditionally.
 */
export function lgasQueryOptions(state: string | null) {
  const path = lgasPath(state)
  return {
    queryKey: geoKeys.lgas(state ?? ''),
    // Narrowed in the fetcher rather than a `select`, so `placeholderData`
    // and the query data share one type and an idle hook can hand a form a
    // plain `string[]`.
    queryFn: () => api.get<LgasResponse>(path!).then((data) => data.lgas),
    enabled: path !== null,
    placeholderData: [] as string[],
    staleTime: GEO_STATES_STALE_MS,
  }
}

export function statesQueryOptions() {
  return {
    queryKey: geoKeys.states,
    queryFn: () => api.get<StatesResponse>('/geo/states'),
    select: (data: StatesResponse) => data.states,
    staleTime: GEO_STATES_STALE_MS,
  }
}

/** Every Nigerian state, with its capital, zone and LGA count. */
export function useGeoStates(): GeoStatesResult {
  const query = useQuery(statesQueryOptions())
  return {
    data: query.data,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  }
}

/**
 * The LGAs of one state.
 *
 * Disabled while `state` is null so an untouched form never asks the server
 * for a state-less LGA list; `data` is `[]` until a state is supplied.
 */
export function useGeoLgas(state: string | null): GeoLgasResult {
  const query = useQuery(lgasQueryOptions(state))
  return {
    data: query.data,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  }
}
