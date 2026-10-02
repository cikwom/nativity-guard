import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  useMarkAllNotificationsRead,
  useNotifications,
} from '@/hooks/useNotifications'
import { relativeTime } from '@/lib/format'
import { Skeleton } from '@/components/ui/States'

/**
 * Notification bell + popover. Reads via the /mobile/notifications envelope
 * (the only notification read endpoints the backend exposes today).
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { data, isLoading } = useNotifications()
  const markAll = useMarkAllNotificationsRead()

  const unread = data?.unreadCount ?? 0
  const items = data?.notifications ?? []

  useEffect(() => {
    if (!open) return
    function onDocClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        onClick={() => setOpen((v) => !v)}
        className="relative grid size-9 place-items-center rounded-lg border border-border-hi bg-surface-hi text-ink-muted transition-colors hover:text-ink"
      >
        <Bell className="size-4" aria-hidden />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-emergency px-1 text-[10px] font-bold leading-4 text-white tabular-nums">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-panel border border-border bg-surface shadow-panel"
        >
          <header className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold text-ink">Notifications</span>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="inline-flex items-center gap-1 text-[11px] text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
              >
                <CheckCheck className="size-3.5" aria-hidden />
                Mark all read
              </button>
            ) : null}
          </header>

          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : items.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-ink-muted">
                No notifications yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {items.slice(0, 8).map((n) => (
                  <li
                    key={n.id}
                    className={cn('px-3 py-2.5', n.status === 'unread' && 'bg-signal/5')}
                  >
                    <div className="flex items-start gap-2">
                      {n.status === 'unread' ? (
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-signal" aria-hidden />
                      ) : (
                        <span className="mt-1.5 size-1.5 shrink-0" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-ink">{n.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-muted">{n.message}</p>
                        <p className="mt-1 text-[10px] text-ink-faint">{relativeTime(n.createdAt)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-border px-3 py-2.5 text-center text-xs font-semibold text-signal hover:bg-surface-hi">
            View all notifications
          </Link>
        </div>
      ) : null}
    </div>
  )
}
