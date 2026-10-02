export interface CommunityAlert {
  id: string
  title: string
  description: string
  severity: 'info' | 'caution' | 'urgent'
  location: string
  createdAt: string
  confirmations: number
  confirmedByMe?: boolean
}

export interface NewsItem {
  id: string
  title: string
  summary: string
  publishedAt: string
  kind: 'news' | 'alert'
}

export interface Subscription {
  areas: string[]
  categories: string[]
  channels: string[]
  deviceRegistered: boolean
}

export interface CommunityPost {
  id: string
  title: string
  body: string
  createdAt: string
  author: string
  replies: { id: string; body: string; author: string; createdAt: string }[]
  reportedByMe?: boolean
}

export interface Announcement {
  id: string
  title: string
  body: string
  createdAt: string
}

export interface CommunityEvent {
  id: string
  title: string
  description: string
  startsAt: string
  location: string
  attendees: number
  attending?: boolean
}
