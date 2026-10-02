import { describe, expect, it } from 'vitest'
import { matchRoute } from './adapter'
import { communityRoutes } from './community'
import { handlers } from './handlers'
import { MOCK_ACCOUNTS, mockTokenFor } from './config'
import { seedDatabase } from './seed'

const citizenId = MOCK_ACCOUNTS[2].userId
const officerId = MOCK_ACCOUNTS[0].userId
const context = (path: string, userId = citizenId, body?: unknown) => {
  const url = new URL(`http://localhost/api/v1${path}`)
  return { request: new Request(url, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${mockTokenFor(userId)}` }, ...(body ? { body: JSON.stringify(body) } : {}) }), params: {}, url }
}

describe('awareness and community mock boundaries', () => {
  it('matches subscriptions before an alert id and scopes the result by account', async () => {
    const match = matchRoute('GET', '/api/v1/alerts/subscriptions', communityRoutes, '/api/v1')
    expect(match?.route.path).toBe('/alerts/subscriptions')
    const mine = await match!.route.respond({ ...context('/alerts/subscriptions'), params: match!.params })
    expect(mine.body).toMatchObject({ subscription: { deviceRegistered: false } })
  })

  it('requires authentication for a forum post and keeps report action idempotent', async () => {
    const post = communityRoutes.find((route) => route.method === 'POST' && route.path === '/community/posts')!
    const anonymous = await post.respond({ request: new Request('http://localhost/api/v1/community/posts', { method: 'POST', body: '{}' }), params: {}, url: new URL('http://localhost/api/v1/community/posts') })
    expect(anonymous.status).toBe(401)
    const created = await post.respond(context('/community/posts', citizenId, { title: 'Demo discussion', body: 'A sample question.' }))
    expect(created.status).toBe(201)
    const id = (created.body as { post: { id: string } }).post.id
    const report = communityRoutes.find((route) => route.path === '/community/posts/:id/report')!
    const reported = await report.respond({ ...context(`/community/posts/${id}/report`, citizenId, {}), params: { id } })
    expect(reported.status).toBeUndefined()
    const again = await report.respond({ ...context(`/community/posts/${id}/report`, citizenId, {}), params: { id } })
    expect(again.status).toBeUndefined()
  })

  it('accepts feedback only from the reporter on a closed case, once', async () => {
    const seed = seedDatabase()
    const closed = seed.cases.find((item) => item.reportedBy === citizenId && item.status === 'closed' && !seed.feedback.some((feedback) => feedback.caseId === item.id))!
    const route = handlers.find((item) => item.method === 'POST' && item.path === '/cases/:id/feedback')!
    const payload = { rating: 4, comment: 'Clear updates.' }
    const outsider = await route.respond({ ...context(`/cases/${closed.id}/feedback`, officerId, payload), params: { id: closed.id } })
    expect(outsider.status).toBe(403)
    const first = await route.respond({ ...context(`/cases/${closed.id}/feedback`, citizenId, payload), params: { id: closed.id } })
    expect(first.status).toBe(201)
    const duplicate = await route.respond({ ...context(`/cases/${closed.id}/feedback`, citizenId, payload), params: { id: closed.id } })
    expect(duplicate.status).toBe(409)
  })
})
