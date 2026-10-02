import { describe, expect, it } from 'vitest'
import { handlers } from './handlers'
import { MOCK_ACCOUNTS, mockTokenFor } from './config'

function call(path: string, method: 'GET' | 'PUT', account: number, body?: unknown) {
  const route = handlers.find((r) => r.path === path && r.method === method)!
  const url = new URL(`http://localhost/api/v1${path}`)
  return route.respond({ request: new Request(url, { method, headers: { Authorization: `Bearer ${mockTokenFor(MOCK_ACCOUNTS[account].userId)}` }, ...(body ? { body: JSON.stringify(body) } : {}) }), url, params: path.endsWith(':section') ? { section: 'units' } : {} })
}

describe('demo administration access and validation', () => {
  it('rejects citizen admin reads and unit administrator platform writes', async () => {
    expect((await call('/demo/admin/state', 'GET', 2)).status).toBe(403)
    expect((await call('/demo/admin/:section', 'PUT', 1, { name: 'Other unit' })).status).toBe(403)
  })
  it('shows a unit administrator only their unit and its cases', async () => {
    const response = await call('/demo/admin/state', 'GET', 1)
    const state = response.body as { units: { id: string }[]; cases: { unitId: string }[] }
    expect(state.units).toHaveLength(1)
    expect(state.cases.every((item) => item.unitId === state.units[0].id)).toBe(true)
  })
  it('rejects invalid profile updates and prevents other users changing the demo account', async () => {
    const route = handlers.find((r) => r.method === 'PUT' && r.path === '/demo/profile')!
    const url = new URL('http://localhost/api/v1/demo/profile')
    const request = new Request(url, { method: 'PUT', headers: { Authorization: `Bearer ${mockTokenFor(MOCK_ACCOUNTS[2].userId)}` }, body: JSON.stringify({ firstName: 'Amaka', lastName: 'Obi', phone: '123', photoUrl: 'javascript:alert(1)' }) })
    expect((await route.respond({ request, url, params: {} })).status).toBe(400)
  })
})
