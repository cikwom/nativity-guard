import { describe, expect, it } from 'vitest'
import { handlers } from './handlers'
import { MOCK_ACCOUNTS, mockTokenFor } from './config'

const route = (method: string, path: string) => {
  const handler = handlers.find((item) => item.method === method && item.path === path)
  if (!handler) throw new Error(`Missing ${method} ${path}`)
  return handler
}

const request = (userId: string, body?: unknown) => new Request('http://localhost/api/v1/sos/send', {
  method: body ? 'POST' : 'GET',
  headers: { Authorization: `Bearer ${mockTokenFor(userId)}` },
  ...(body ? { body: JSON.stringify(body) } : {}),
})

describe('mock SOS contract', () => {
  it('refuses invalid locations and staff submissions', async () => {
    const send = route('POST', '/sos/send')
    const invalid = await send.respond({ request: request(MOCK_ACCOUNTS[2].userId, { latitude: 0, longitude: 0 }), params: {}, url: new URL('http://localhost/api/v1/sos/send') })
    expect(invalid.status).toBe(400)
    const staff = await send.respond({ request: request(MOCK_ACCOUNTS[0].userId, { latitude: 6, longitude: 3 }), params: {}, url: new URL('http://localhost/api/v1/sos/send') })
    expect(staff.status).toBe(403)
  })

  it('returns a pending receipt and keeps the alert private to the reporter', async () => {
    const userId = MOCK_ACCOUNTS[2].userId
    const send = route('POST', '/sos/send')
    const result = await send.respond({ request: request(userId, { latitude: 6.5, longitude: 3.3, priority: 'high' }), params: {}, url: new URL('http://localhost/api/v1/sos/send') })
    expect(result.status).toBe(201)
    expect(result.body).toMatchObject({ alert: { status: 'pending', latitude: 6.5, userId } })
    const history = await route('GET', '/sos/my').respond({ request: request(userId), params: {}, url: new URL('http://localhost/api/v1/sos/my') })
    expect(history.body).toMatchObject({ alerts: [result.body && (result.body as { alert: unknown }).alert] })
    const other = await route('GET', '/sos/my').respond({ request: request(MOCK_ACCOUNTS[0].userId), params: {}, url: new URL('http://localhost/api/v1/sos/my') })
    expect(other.body).toEqual({ alerts: [] })
  })
})
