import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, tokenStore } from './apiClient'

/**
 * The API client is the seam between the UI and every backend call, so its
 * error normalisation and auth-header behaviour are pinned here.
 */

function jsonResponse(body: unknown, init: { status?: number; statusText?: string } = {}) {
  const status = init.status ?? 200
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: init.statusText ?? '',
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response
}

let store: Record<string, string>

beforeEach(() => {
  store = {}
  // tokenStore prefers localStorage; give it one so the token path is exercised.
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('api client', () => {
  it('requests the versioned API path and parses JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ cases: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.get<{ cases: unknown[] }>('/cases')

    expect(result).toEqual({ cases: [] })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/v1\/cases$/)
  })

  it('attaches the bearer token when a session exists', async () => {
    tokenStore.set('token-123')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ cases: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await api.get('/cases')

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-123')
  })

  it('omits the auth header for anonymous requests', async () => {
    tokenStore.set('token-123')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ token: 'x' }))
    vi.stubGlobal('fetch', fetchMock)

    await api.postAnonymous('/auth/login', { email: 'a@b.c', password: 'x' })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('keeps the session when an anonymous request is rejected', async () => {
    // A failed sign-in must not log the user out of a session they already have.
    tokenStore.set('token-123')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid credentials' }, { status: 401 })),
    )

    await expect(
      api.postAnonymous('/auth/login', { email: 'a@b.c', password: 'wrong' }),
    ).rejects.toMatchObject({ status: 401 })
    expect(tokenStore.get()).toBe('token-123')
  })

  it('normalises an error body into ApiError with its status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ error: 'case not found' }, { status: 404, statusText: 'Not Found' }),
      ),
    )

    await expect(api.get('/cases/does-not-exist')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'case not found',
    })
  })

  it('keeps a structured error body so a conflict can explain itself', async () => {
    // A 409 from submit-review carries the case's actual status; dropping the body
    // would leave the UI able to say only "conflict".
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          { error: 'case cannot be submitted for review from its current status', status: 'closed' },
          { status: 409, statusText: 'Conflict' },
        ),
      ),
    )

    const error = (await api.get('/cases/1').catch((cause: unknown) => cause)) as ApiError
    expect(error.status).toBe(409)
    expect(error.body).toMatchObject({ status: 'closed' })
  })

  it('clears the session on 401', async () => {
    tokenStore.set('token-123')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, { status: 401 })),
    )

    await expect(api.get('/cases')).rejects.toBeInstanceOf(ApiError)
    expect(tokenStore.get()).toBeNull()
  })

  it('reports an unreachable API as a network failure (status 0)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed to fetch')))

    const error = await api.get('/cases').catch((cause: unknown) => cause)
    expect(ApiError.isNetwork(error)).toBe(true)
    expect((error as ApiError).status).toBe(0)
  })

  it('serialises a request body and sets the content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)

    await api.post('/cases/1/progress', { action: 'note', description: 'checked' })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(JSON.parse(String(init.body))).toEqual({ action: 'note', description: 'checked' })
  })
})

/**
 * Refresh behaviour.
 *
 * `/auth/refresh` **rotates**: the token you send is spent and the response carries
 * its replacement. That makes the concurrency case a correctness problem rather
 * than a performance one — two refreshes racing would have the second present a
 * token the first had already consumed, and the user would be signed out at the
 * exact moment the app was trying to keep them in. These tests pin that, and pin
 * that a genuinely dead refresh token is still a hard sign-out.
 */
describe('session refresh', () => {
  /** A server that accepts `Bearer fresh-*` and rejects anything else as expired. */
  function expiringServer(options: { refreshStatus?: number } = {}) {
    const calls: string[] = []
    const fetchMock = vi.fn(async (url: unknown, init?: RequestInit): Promise<Response> => {
      const target = String(url)
      calls.push(target)

      if (target.endsWith('/auth/refresh')) {
        if (options.refreshStatus && options.refreshStatus >= 400) {
          return jsonResponse({ error: 'refresh token revoked' }, { status: options.refreshStatus })
        }
        const attempt = calls.filter((c) => c.endsWith('/auth/refresh')).length
        return jsonResponse({ token: `fresh-${attempt}`, refreshToken: `refresh-${attempt + 1}` })
      }

      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization
      return auth?.startsWith('Bearer fresh')
        ? jsonResponse({ ok: true })
        : jsonResponse({ error: 'token expired' }, { status: 401 })
    })
    return { fetchMock, calls }
  }

  it('refreshes an expired access token, stores the rotation, and replays once', async () => {
    tokenStore.set('stale')
    tokenStore.setRefresh('refresh-1')
    const { fetchMock, calls } = expiringServer()
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.get('/cases')).resolves.toEqual({ ok: true })

    expect(calls).toHaveLength(3) // original → refresh → replay
    expect(calls[1]).toMatch(/\/auth\/refresh$/)

    const replay = fetchMock.mock.calls[2][1] as RequestInit
    expect((replay.headers as Record<string, string>).Authorization).toBe('Bearer fresh-1')

    expect(tokenStore.get()).toBe('fresh-1')
    // Dropping this is the bug rotation is designed to surface.
    expect(tokenStore.getRefresh()).toBe('refresh-2')
  })

  it('runs a single refresh for concurrent 401s rather than one per request', async () => {
    tokenStore.set('stale')
    tokenStore.setRefresh('refresh-1')
    const { fetchMock, calls } = expiringServer()
    vi.stubGlobal('fetch', fetchMock)

    await expect(Promise.all([api.get('/a'), api.get('/b'), api.get('/c')])).resolves.toHaveLength(3)

    expect(calls.filter((c) => c.endsWith('/auth/refresh'))).toHaveLength(1)
  })

  it('signs the user out when the refresh token is itself rejected', async () => {
    tokenStore.set('stale')
    tokenStore.setRefresh('spent')
    const { fetchMock, calls } = expiringServer({ refreshStatus: 401 })
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.get('/cases')).rejects.toMatchObject({ status: 401 })

    // Original + refresh, and no replay — a second 401 is a real sign-out.
    expect(calls).toHaveLength(2)
    expect(tokenStore.get()).toBeNull()
    expect(tokenStore.getRefresh()).toBeNull()
  })

  it('does not attempt a refresh when there is no refresh token to spend', async () => {
    tokenStore.set('stale')
    const { fetchMock, calls } = expiringServer()
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.get('/cases')).rejects.toMatchObject({ status: 401 })
    expect(calls).toHaveLength(1)
  })

  it('never refreshes on behalf of an anonymous request', async () => {
    // A rejected sign-in must not spend the refresh token of a session the user
    // already has, let alone end it.
    tokenStore.setRefresh('refresh-1')
    const { fetchMock, calls } = expiringServer()
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.postAnonymous('/auth/login', { email: 'a@b.c' })).rejects.toMatchObject({
      status: 401,
    })
    expect(calls).toHaveLength(1)
    expect(tokenStore.getRefresh()).toBe('refresh-1')
  })

  it('refreshes again after an earlier refresh has settled', async () => {
    // The in-flight promise must not be cached forever — if it were, the first
    // expiry would work and every later one would quietly reuse a stale result.
    tokenStore.set('stale')
    tokenStore.setRefresh('refresh-1')
    const { fetchMock, calls } = expiringServer()
    vi.stubGlobal('fetch', fetchMock)

    await api.get('/a')
    tokenStore.set('stale-again') // the next access token ages out too
    await api.get('/b')

    expect(calls.filter((c) => c.endsWith('/auth/refresh'))).toHaveLength(2)
  })
})
