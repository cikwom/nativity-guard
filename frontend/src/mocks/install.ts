import { API_BASE } from '@/lib/apiClient'
import { matchRoute } from './adapter'
import { handlers } from './handlers'

/**
 * Install the mock API by wrapping `globalThis.fetch`.
 *
 * Only called when `VITE_USE_MOCKS === 'true'` (see `src/main.tsx`). Anything
 * not matched by a route falls through to the real network, so a partially
 * mocked backend still works.
 *
 * Returns an uninstall function.
 */
export function installMockApi(): () => void {
  const original = globalThis.fetch.bind(globalThis)

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let request: Request
    try {
      request = input instanceof Request && !init ? input : new Request(input, init)
    } catch {
      return original(input, init)
    }

    const url = new URL(request.url, globalThis.location?.origin ?? 'http://localhost')
    const match = matchRoute(request.method, url.pathname, handlers, API_BASE)

    if (!match) return original(input, init)

    const result = await match.route.respond({
      request,
      params: match.params,
      url,
    })

    const status = result.status ?? 200
    if (status === 204 || result.body === undefined) {
      return new Response(null, { status })
    }

    return new Response(JSON.stringify(result.body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Surface the mock layer in the console so it is never mistaken for a live API.
  console.info(
    '%c[Nativity Guard]%c Mock API active — requests are served in-browser. Set VITE_USE_MOCKS=false to use the real API.',
    'background:#3fbf7f;color:#0b0e14;padding:2px 6px;border-radius:3px;font-weight:600',
    'color:inherit',
  )

  return () => {
    globalThis.fetch = original
  }
}
