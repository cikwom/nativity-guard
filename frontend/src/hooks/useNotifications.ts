import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'
import type { Notification, NotificationsResponse } from '@/types/api'

/**
 * Notifications.
 *
 * NOTE: the backend exposes notification *reads* only under /mobile/*, not
 * /notifications (that group only has register/unregister/test). The mobile
 * envelope is `{ notifications, unreadCount }`.
 */
export const notificationKeys = {
  all: ['notifications'] as const,
}

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: () => api.get<NotificationsResponse>('/mobile/notifications'),
    staleTime: 60_000,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.put<{ message: string }>(`/mobile/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.put<{ message: string }>('/mobile/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}

export type { Notification }
