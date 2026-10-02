import type { MockRoute } from './adapter'
import { userIdFromToken } from './config'
import type { Announcement, CommunityAlert, CommunityEvent, CommunityPost, NewsItem, Subscription } from '@/types/community'

const timestamp = new Date().toISOString()
const alerts: CommunityAlert[] = [
  { id: 'demo-drill', title: 'Demo: community safety drill', description: 'This is sample content for testing the alert screen. It is not a real incident or instruction.', severity: 'info', location: 'Sample area', createdAt: timestamp, confirmations: 0 },
]
const news: NewsItem[] = [
  { id: 'demo-news', title: 'Demo: planning a neighborhood safety walk', summary: 'Sample news content for exploring the layout. No walk is scheduled by this app.', publishedAt: timestamp, kind: 'news' },
]
const announcements: Announcement[] = [
  { id: 'demo-announcement', title: 'Welcome to the sample community hub', body: 'Posts and events here are in-memory demo data. They are not public notices.', createdAt: timestamp },
]
const events: CommunityEvent[] = [
  { id: 'demo-event', title: 'Demo: safety orientation', description: 'Sample event to exercise RSVP and attendee count. This event is not scheduled.', location: 'Sample venue', startsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(), attendees: 0 },
]
const posts: CommunityPost[] = []
const subscriptions = new Map<string, Subscription>()
const alertConfirmations = new Set<string>()
const eventRsvps = new Set<string>()
const postReports = new Set<string>()

const getUserId = (request: Request) =>
  userIdFromToken((request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, ''))
const unauth = { status: 401, body: { error: 'Sign in to continue.' } }
const absent = { status: 404, body: { error: 'Not found.' } }
const invalid = (error: string) => ({ status: 400, body: { error } })
const subscriptionFor = (id: string): Subscription => subscriptions.get(id) ?? { areas: [], categories: [], channels: ['in-app'], deviceRegistered: false }
const textField = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : ''

/** Demo endpoints only. No seed is presented as a real alert, news story or event. */
export const communityRoutes: MockRoute[] = [
  { method: 'GET', path: '/alerts', respond({ request }) {
    if (!getUserId(request)) return unauth
    return { body: { alerts: alerts.map((alert) => ({ ...alert, confirmedByMe: alertConfirmations.has(`${getUserId(request)}:${alert.id}`) })) } }
  } },
  { method: 'GET', path: '/alerts/subscriptions', respond({ request }) {
    const id = getUserId(request)
    return id ? { body: { subscription: subscriptionFor(id) } } : unauth
  } },
  { method: 'GET', path: '/alerts/:id', respond({ request, params }) {
    const userId = getUserId(request)
    if (!userId) return unauth
    const alert = alerts.find((item) => item.id === params.id)
    return alert ? { body: { alert: { ...alert, confirmedByMe: alertConfirmations.has(`${userId}:${alert.id}`) } } } : absent
  } },
  { method: 'POST', path: '/alerts/:id/confirm', respond({ request, params }) {
    const userId = getUserId(request)
    if (!userId) return unauth
    const alert = alerts.find((item) => item.id === params.id)
    if (!alert) return absent
    const key = `${userId}:${alert.id}`
    if (!alertConfirmations.has(key)) { alertConfirmations.add(key); alert.confirmations += 1 }
    return { body: { alert: { ...alert, confirmedByMe: true } } }
  } },
  { method: 'GET', path: '/news', respond({ request }) {
    if (!getUserId(request)) return unauth
    return { body: { news } }
  } },
  { method: 'POST', path: '/alerts/subscribe', async respond({ request }) {
    const id = getUserId(request)
    if (!id) return unauth
    const body = await request.json() as Partial<Subscription>
    const pick = (values: unknown) => Array.isArray(values) ? values.filter((v): v is string => typeof v === 'string').slice(0, 12) : []
    const subscription = { ...subscriptionFor(id), areas: pick(body.areas), categories: pick(body.categories), channels: pick(body.channels) }
    subscriptions.set(id, subscription)
    return { body: { subscription } }
  } },
  { method: 'POST', path: '/notifications/register', respond({ request }) {
    const id = getUserId(request)
    if (!id) return unauth
    const subscription = { ...subscriptionFor(id), deviceRegistered: true }
    subscriptions.set(id, subscription)
    return { body: { subscription } }
  } },
  { method: 'DELETE', path: '/notifications/unregister', respond({ request }) {
    const id = getUserId(request)
    if (!id) return unauth
    const subscription = { ...subscriptionFor(id), deviceRegistered: false }
    subscriptions.set(id, subscription)
    return { body: { subscription } }
  } },
  { method: 'GET', path: '/community/posts', respond({ request }) {
    if (!getUserId(request)) return unauth
    return { body: { posts: posts.map((post) => ({ ...post, reportedByMe: postReports.has(`${getUserId(request)}:${post.id}`) })) } }
  } },
  { method: 'POST', path: '/community/posts', async respond({ request }) {
    const id = getUserId(request)
    if (!id) return unauth
    const body = await request.json() as { title?: string; body?: string }
    const title = textField(body.title, 120)
    const content = textField(body.body, 2000)
    if (!title || !content) return invalid('Title and message are required.')
    const post: CommunityPost = { id: crypto.randomUUID(), title, body: content, createdAt: new Date().toISOString(), author: 'Community member', replies: [] }
    posts.unshift(post)
    return { status: 201, body: { post } }
  } },
  { method: 'GET', path: '/community/posts/:id', respond({ request, params }) {
    const id = getUserId(request)
    if (!id) return unauth
    const post = posts.find((item) => item.id === params.id)
    return post ? { body: { post: { ...post, reportedByMe: postReports.has(`${id}:${post.id}`) } } } : absent
  } },
  { method: 'POST', path: '/community/replies', async respond({ request }) {
    if (!getUserId(request)) return unauth
    const body = await request.json() as { postId?: string; body?: string }
    const post = posts.find((item) => item.id === body.postId)
    if (!post) return absent
    const content = textField(body.body, 1000)
    if (!content) return invalid('Reply cannot be empty.')
    post.replies.push({ id: crypto.randomUUID(), body: content, author: 'Community member', createdAt: new Date().toISOString() })
    return { status: 201, body: { post } }
  } },
  { method: 'POST', path: '/community/posts/:id/report', respond({ request, params }) {
    const id = getUserId(request)
    if (!id) return unauth
    const post = posts.find((item) => item.id === params.id)
    if (!post) return absent
    postReports.add(`${id}:${post.id}`)
    return { body: { message: 'Report recorded in this demo.' } }
  } },
  { method: 'GET', path: '/community/announcements', respond({ request }) {
    if (!getUserId(request)) return unauth
    return { body: { announcements } }
  } },
  { method: 'GET', path: '/community/events', respond({ request }) {
    const id = getUserId(request)
    if (!id) return unauth
    return { body: { events: events.map((event) => ({ ...event, attending: eventRsvps.has(`${id}:${event.id}`) })) } }
  } },
  { method: 'POST', path: '/community/events/:id/rsvp', respond({ request, params }) {
    const id = getUserId(request)
    if (!id) return unauth
    const event = events.find((item) => item.id === params.id)
    if (!event) return absent
    const key = `${id}:${event.id}`
    if (eventRsvps.has(key)) { eventRsvps.delete(key); event.attendees -= 1 }
    else { eventRsvps.add(key); event.attendees += 1 }
    return { body: { event: { ...event, attending: eventRsvps.has(key) } } }
  } },
]
