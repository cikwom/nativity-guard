/**
 * The unit registry create path, tested through `createUnitRequest`.
 *
 * `vite.config.ts` runs vitest in a `node` environment and this repo has no
 * `@testing-library/react`, so `renderHook` is unavailable and no DOM environment
 * can be added without a new dependency. As in `useGeo.test.ts`, the exported
 * request function is the seam: the real `apiClient` runs against a stubbed
 * `fetch`, so these assertions still cover the URL the browser would hit and the
 * `ApiError` the form would have to render.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/apiClient'
import { CREATE_UNIT_PATH, createUnitRequest, type CreateUnitInput } from './useUnits'

/** Minimal stand-in: `apiClient` reads `status`, `ok`, `json()` and `text()`. */
function jsonResponse(body: unknown, init: { status?: number; statusText?: string } = {}) {
  const status = init.status ?? 200
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: init.statusText ?? '',
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as unknown as Response
}

function stubFetch(response: Response) {
  // Both parameters are declared so `mock.calls[0][0]` is typed as the URL and
  // `mock.calls[0][1]` as the init `apiClient` actually passes to `fetch`.
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(response))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const minimalUnit: CreateUnitInput = {
  name: 'Otukpo Community Unit',
  type: 'neighborhood_watch',
  state: 'Benue',
  lga: 'Otukpo',
}

describe('createUnitRequest', () => {
  it('posts to the versioned units collection', async () => {
    const fetchMock = stubFetch(
      jsonResponse({ message: 'unit created', unit: { id: 'u-1', name: 'Otukpo Community Unit' } }, { status: 201 }),
    )

    const result = await createUnitRequest(minimalUnit)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    // The `/api/v1` prefix is added by the client, so the contract's `/units`
    // resolves to `/api/v1/units` on the wire — not to a second, unprefixed host.
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/v1\/units$/)
    expect(CREATE_UNIT_PATH).toBe('/units')

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual(minimalUnit)
    expect(result.unit.id).toBe('u-1')
  })

  it('sends the whole payload, including the nested sections, as one body', async () => {
    const fetchMock = stubFetch(jsonResponse({ unit: { id: 'u-2' } }, { status: 201 }))

    await createUnitRequest({
      ...minimalUnit,
      ward: 'Ward 4',
      formationDate: '2026-01-15',
      commanderName: 'A. B. Danjuma',
      commanderNin: '12345678901',
      hasUniform: true,
      uniformDescription: 'Green vest, white armband',
      shiftPattern: 'night',
      permittedTools: '["batons","radios"]',
      kindredHeadName: 'H. I. Yakubu',
    })

    const sent = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)) as CreateUnitInput
    expect(sent.commanderNin).toBe('12345678901')
    expect(sent.permittedTools).toBe('["batons","radios"]')
    expect(sent.hasUniform).toBe(true)
  })

  it('surfaces a 403 as a readable error rather than a bare status', async () => {
    // The registry create is admin-only, so this is the refusal a non-admin gets.
    // The form shows the message verbatim, which is why it must survive the trip
    // through `apiClient` instead of collapsing to "Forbidden".
    stubFetch(
      jsonResponse(
        { error: 'Only admins can create units' },
        { status: 403, statusText: 'Forbidden' },
      ),
    )

    const error = (await createUnitRequest(minimalUnit).catch(
      (cause: unknown) => cause,
    )) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(403)
    expect(error.message).toBe('Only admins can create units')
  })

  it('keeps a 400 validation message intact for the form to show', async () => {
    stubFetch(
      jsonResponse(
        { error: 'invalid formationDate (expected YYYY-MM-DD)' },
        { status: 400, statusText: 'Bad Request' },
      ),
    )

    await expect(
      createUnitRequest({ ...minimalUnit, formationDate: '15/01/2026' }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'invalid formationDate (expected YYYY-MM-DD)',
    })
  })
})
