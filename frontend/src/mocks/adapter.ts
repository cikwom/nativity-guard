/**
 * A tiny fetch-level mock adapter.
 *
 * Why not MSW: MSW needs both an npm install and a generated
 * `public/mockServiceWorker.js` before it can run. This adapter needs neither,
 * works in any environment (including a machine with no network), and keeps the
 * *contract* identical — the app talks to `fetch`, and the same client code
 * runs against mocks or the real API depending on `VITE_USE_MOCKS`.
 *
 * The route table in `handlers.ts` is written in MSW's shape (`method`,
 * `path` with `:params`, `respond({ request, params })`) so it can be ported
 * to MSW later with almost no change.
 */

export interface MockRequestContext {
  request: Request
  params: Record<string, string>
  url: URL
}

export interface MockResult {
  status?: number
  body?: unknown
}

export type MockResponder = (ctx: MockRequestContext) => MockResult | Promise<MockResult>

export interface MockRoute {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Path relative to the API base, with `:name` placeholders. */
  path: string
  respond: MockResponder
}

interface Match {
  route: MockRoute
  params: Record<string, string>
}

function segments(path: string): string[] {
  return path.split('/').filter(Boolean)
}

export function matchRoute(
  method: string,
  pathname: string,
  routes: MockRoute[],
  base: string,
): Match | null {
  if (!pathname.startsWith(base)) return null
  const rest = pathname.slice(base.length)
  const actual = segments(rest)

  for (const route of routes) {
    if (route.method !== method) continue
    const expected = segments(route.path)
    if (expected.length !== actual.length) continue

    const params: Record<string, string> = {}
    let matched = true
    for (let i = 0; i < expected.length; i += 1) {
      const segment = expected[i]
      if (segment.startsWith(':')) {
        params[segment.slice(1)] = decodeURIComponent(actual[i])
      } else if (segment !== actual[i]) {
        matched = false
        break
      }
    }
    if (matched) return { route, params }
  }

  return null
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
