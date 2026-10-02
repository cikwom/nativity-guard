import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, api } from '@/lib/apiClient'
import { caseKeys } from './useCases'
import type {
  CaseWeeklyUpdate,
  CaseWeeklyUpdateCreateResponse,
  CaseWeeklyUpdateInput,
  CaseWeeklyUpdatesResponse,
} from '@/types/api'

export const weeklyKeys = {
  all: ['case-weekly'] as const,
  detail: (id: string) => [...weeklyKeys.all, id] as const,
}

/**
 * A case's weekly narratives (`GET /cases/:id/weekly-updates`), oldest week first.
 *
 * The server does the authorization *and* the privacy filtering: a reporter who is
 * neither an administrator nor the assigned officer receives only the updates
 * flagged `citizenVisible`. That means the same case legitimately yields different
 * lists to two different roles, and this hook must never be pointed at a cache
 * populated by a different role's request. React Query keys by case id only, so the
 * safety here comes from the session being fixed for the lifetime of the cache.
 */
export function useWeeklyUpdates(id: string | undefined) {
  return useQuery({
    queryKey: weeklyKeys.detail(id ?? ''),
    queryFn: () => api.get<CaseWeeklyUpdatesResponse>(`/cases/${id}/weekly-updates`),
    enabled: Boolean(id),
    select: (data) => data.updates,
  })
}

/**
 * File this week's narrative (`POST /cases/:id/weekly-update`, assigned officer only).
 *
 * A **409 is not a failure**. The contract refuses a second submission for the same
 * reporting week and returns the update already on file — so the caller is meant to
 * treat it as "you have already filed this week" and show what exists, which is why
 * the existing update is extracted by `conflictingWeeklyUpdate` rather than reported
 * as an error.
 */
export function useFileWeeklyUpdate(id: string | undefined) {
  const queryClient = useQueryClient()

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: weeklyKeys.detail(id ?? '') }),
      queryClient.invalidateQueries({ queryKey: caseKeys.detail(id ?? '') }),
      queryClient.invalidateQueries({ queryKey: caseKeys.list() }),
    ])

  return useMutation({
    mutationFn: (input: CaseWeeklyUpdateInput) =>
      api.post<CaseWeeklyUpdateCreateResponse>(`/cases/${id}/weekly-update`, input),
    onSuccess: invalidate,
    // Refetch even on the refusal: the client's list is now known to be missing (or
    // stale about) an update that exists, and the screen is about to claim otherwise.
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) void invalidate()
    },
  })
}

/**
 * The update on file, from a duplicate-week refusal.
 *
 * Returns `null` for anything that is not that specific 409 — a closed case also
 * answers 409, but carries `{ error, status }` and no update, and treating it as
 * "already filed" would tell an officer they had filed a narrative they never wrote.
 */
export function conflictingWeeklyUpdate(error: unknown): CaseWeeklyUpdate | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null
  const body = error.body as { update?: CaseWeeklyUpdate } | undefined
  return body?.update ?? null
}

/** True when the refusal came from a **closed** case rather than a duplicate week. */
export function isClosedCaseRefusal(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 409) return false
  const body = error.body as { status?: string } | undefined
  return body?.status === 'closed'
}
