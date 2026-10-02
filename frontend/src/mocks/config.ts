/**
 * Mock configuration.
 *
 * Kept dependency-free (no MSW import) so that anything may safely read
 * `USE_MOCKS` / the demo accounts without pulling the mock worker into the
 * production bundle.
 *
 * The worker itself is dynamically imported in `src/main.tsx`, only when
 * `VITE_USE_MOCKS === 'true'`.
 */

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

/** Deterministic pseudo-UUIDs so the demo data is stable between reloads. */
export function mockUid(prefix: string, index: number): string {
  return `${prefix}-0000-4000-8000-${String(index).padStart(12, '0')}`
}

export interface MockAccount {
  email: string
  password: string
  role: string
  userId: string
}

/** One-tap sign-in targets offered on the login screen while mocking. */
export const MOCK_ACCOUNTS: MockAccount[] = [
  { email: 'officer@shield.ng', password: 'password', role: 'Officer', userId: mockUid('aaaa1111', 1) },
  { email: 'admin@shield.ng', password: 'password', role: 'Unit admin', userId: mockUid('aaaa1111', 2) },
  { email: 'citizen@shield.ng', password: 'password', role: 'Citizen', userId: mockUid('aaaa1111', 3) },
  { email: 'super@shield.ng', password: 'password', role: 'Super admin', userId: mockUid('aaaa1111', 4) },
]

export function mockTokenFor(userId: string): string {
  return `mock.${userId}`
}

export function userIdFromToken(token: string | null): string | null {
  if (!token?.startsWith('mock.')) return null
  return token.slice('mock.'.length) || null
}

/**
 * The refresh half of a mock session. `generation` advances on every rotation, so
 * a client that fails to store the replacement gets caught rather than quietly
 * reusing a spent token — the failure mode the real rotation exists to prevent.
 */
export function mockRefreshFor(userId: string, generation = 0): string {
  return `mockrefresh.${generation}.${userId}`
}

export function userIdFromRefreshToken(token: string | null): string | null {
  if (!token?.startsWith('mockrefresh.')) return null
  const rest = token.slice('mockrefresh.'.length)
  const separator = rest.indexOf('.')
  if (separator < 0) return null
  return rest.slice(separator + 1) || null
}

/**
 * The code the mock accepts at `POST /auth/reset-password`, for any account.
 *
 * No message is actually sent in mock mode, so the flow needs a code the person
 * exercising it can know. Deliberately an obvious placeholder rather than
 * something plausible: a realistic-looking code would suggest a real message had
 * arrived. The reset screen prints it while `USE_MOCKS` is on.
 */
export const MOCK_RESET_CODE = '123456'
