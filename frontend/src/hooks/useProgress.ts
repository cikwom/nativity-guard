import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, api } from '@/lib/apiClient'
import { caseKeys } from './useCases'
import type { Progress, ProgressResponse } from '@/types/api'

export const progressKeys = {
  forCase: (caseId: string) => ['progress', caseId] as const,
}

export function useCaseProgress(caseId: string | undefined) {
  return useQuery({
    queryKey: progressKeys.forCase(caseId ?? ''),
    queryFn: () => api.get<ProgressResponse>(`/cases/${caseId}/progress`),
    enabled: Boolean(caseId),
    select: (data) => data.progress,
  })
}

/**
 * Add a progress update. The write is only accepted while the case is
 * `dispatched`, `on_scene` or `investigating`; `canAddProgress` in
 * `@/lib/status` is the single source of truth for that set, and the UI gates
 * the form on it. Do not restate the list here — it drifts.
 */
export function useAddProgress(caseId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { action: string; description?: string }) =>
      api.post<{ message: string; progress: Progress }>(`/cases/${caseId}/progress`, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: progressKeys.forCase(caseId ?? '') }),
        queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId ?? '') }),
      ])
    },
    // A 409 here means the case moved on without us — it is no longer in a
    // status that accepts progress. Refetch so the form stops being offered for
    // a state the case has left, rather than letting the officer retry into the
    // same refusal.
    onError: async (error) => {
      if (!(error instanceof ApiError) || error.status !== 409) return
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: progressKeys.forCase(caseId ?? '') }),
        queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId ?? '') }),
      ])
    },
  })
}
