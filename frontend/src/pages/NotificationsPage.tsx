import { BackLink } from '@/components/ui/BackLink'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/hooks/useNotifications'
import { relativeTime } from '@/lib/format'

export function NotificationsPage() {
  const notifications = useNotifications()
  const mark = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const items = notifications.data?.notifications ?? []

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      <BackLink to="/" label="Back to home" />
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-ink">Notifications</h1>
          <p className="mt-1 text-sm text-ink-muted">{notifications.data?.unreadCount ?? 0} unread</p>
        </div>
        {notifications.data?.unreadCount ? (
          <Button loading={markAll.isPending} onClick={() => markAll.mutate()}>Mark all read</Button>
        ) : null}
      </header>
      {mark.isError || markAll.isError ? (
        <p role="alert" className="text-sm text-warn">Could not update the notification. Try again.</p>
      ) : null}
      {notifications.isLoading ? <Skeleton className="h-32 w-full" /> : notifications.isError ? (
        <Card><ErrorState title="Could not load notifications" description="Check your connection and retry." onRetry={() => void notifications.refetch()} /></Card>
      ) : items.length === 0 ? (
        <Card><EmptyState title="No notifications yet" description="Updates will appear here when they arrive." /></Card>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Card className={`flex flex-wrap items-start justify-between gap-3 p-4 ${item.status === 'unread' ? 'border-signal/50' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">{item.message}</p>
                  <p className="mt-2 text-xs text-ink-faint">{relativeTime(item.createdAt)}</p>
                </div>
                {item.status === 'unread' ? <Button size="sm" disabled={mark.isPending} onClick={() => mark.mutate(item.id)}>Mark read</Button> : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
