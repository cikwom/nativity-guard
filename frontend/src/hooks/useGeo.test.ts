/**
 * The geography hooks, tested through their option builders.
 *
 * `vite.config.ts` runs vitest in a `node` environment and this repo has no
 * `@testing-library/react`, so `renderHook` is not available and no DOM
 * environment can be added without a new dependency. Instead the builders in
 * `useGeo.ts` are the seam: the real `queryFn` is invoked against a stubbed
 * `fetch`, so these assertions still cover the request path and the response
 * shape the hooks hand to a form.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GEO_STATES_STALE_MS,
  geoKeys,
  lgasPath,
  lgasQueryOptions,
  statesQueryOptions,
} from './useGeo'

/** Minimal stand-in: `apiClient` reads `status`, `ok` and `text()`. */
function stubResponse(body: unknown) {
  return {
    status: 200,
    ok: true,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response
}

function stubFetchOnce(body: unknown) {
  // The parameter is declared so `mock.calls[0][0]` is typed as the URL
  // `apiClient` actually passes to `fetch`.
  const fetchMock = vi.fn((_url: string) => Promise.resolve(stubResponse(body)))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useGeoStates', () => {
  it('returns the states array on success', async () => {
    const body = {
      states: [
        { name: 'Benue', capital: 'Makurdi', zone: 'North Central', lgaCount: 23 },
        { name: 'Lagos', capital: 'Ikeja', zone: 'South West', lgaCount: 20 },
      ],
    }
    const fetchMock = stubFetchOnce(body)

    const result = await statesQueryOptions().queryFn()
    const select = statesQueryOptions().select as (d: typeof body) => typeof body.states

    expect(select(result)).toEqual(body.states)
    expect(select(result)[0]).toMatchObject({ name: 'Benue', capital: 'Makurdi', lgaCount: 23 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('/geo/states')
  })

  it('caches the static dataset for a day', () => {
    expect(GEO_STATES_STALE_MS).toBe(24 * 60 * 60 * 1000)
    expect(statesQueryOptions().staleTime).toBe(GEO_STATES_STALE_MS)
    expect(statesQueryOptions().queryKey).toEqual(['geo', 'states'])
  })
})

describe('useGeoLgas', () => {
  it('does not request anything and yields an empty list when state is null', () => {
    const fetchMock = stubFetchOnce({ state: '', lgas: [] })

    const options = lgasQueryOptions(null)

    expect(options.enabled).toBe(false)
    expect(options.placeholderData).toEqual([])
    expect(lgasPath(null)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is disabled for an empty state string as well', () => {
    expect(lgasQueryOptions('').enabled).toBe(false)
    expect(lgasPath('')).toBeNull()
  })

  it('returns the lgas array for a named state', async () => {
    const body = { state: 'Benue', lgas: ['Ado', 'Agatu', 'Akoko Kogi'] }
    const fetchMock = stubFetchOnce(body)

    const options = lgasQueryOptions('Benue')
    const result = await options.queryFn()

    expect(options.enabled).toBe(true)
    expect(result).toEqual(body.lgas)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('/geo/lgas?state=Benue')
  })

  it('keys the cache by state so switching states does not reuse a list', () => {
    expect(lgasQueryOptions('Benue').queryKey).toEqual(geoKeys.lgas('Benue'))
    expect(lgasQueryOptions('Lagos').queryKey).toEqual(['geo', 'lgas', 'Lagos'])
    expect(geoKeys.lgas('Benue')).not.toEqual(geoKeys.lgas('Lagos'))
  })

  it('escapes a state name instead of pasting it into the query string', () => {
    expect(lgasPath('Cross River')).toBe('/geo/lgas?state=Cross%20River')
    expect(lgasPath('Rivers & Co')).toBe('/geo/lgas?state=Rivers%20%26%20Co')
  })
})
