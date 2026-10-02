import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, api } from '@/lib/apiClient'
import { caseKeys } from './useCases'
import type { Case, CaseReview, CaseReviewResponse } from '@/types/api'

export const reviewKeys = {
  all: ['case-review'] as const,
  detail: (id: string) => [...reviewKeys.all, id] as const,
}

/**
 * A case's closure-review history (`GET /cases/:id/review`).
 *
 * Returns the envelope rather than just `reviews`, because the response also
 * carries the case's **current** status — which is how the UI corrects itself
 * after being refused for submitting from the wrong state.
 */
export function useCaseReview(id: string | undefined) {
  return useQuery({
    queryKey: reviewKeys.detail(id ?? ''),
    queryFn: () => api.get<CaseReviewResponse>(`/cases/${id}/review`),
    enabled: Boolean(id),
  })
}

type DecisionResponse = { message: string; review: CaseReview; case: Case }

/**
 * The administrator's half of the closure decision.
 *
 * Both outcomes require a non-empty `comment` — the backend refuses a bare click —
 * which is why the mutations take the comment as their only argument rather than
 * accepting an empty default.
 *
 * A 409 means the case moved out of `pending_admin_review` while this screen was
 * open (the officer resubmitted, or another administrator decided first). The
 * screen's error copy promises it has been refreshed with the case's real state,
 * so the refetch is not optional: without it the admin is told the case moved and
 * then shown the state it was in before.
 */
export function useReviewDecision(id: string | undefined) {
  const queryClient = useQueryClient()

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: caseKeys.detail(id ?? '') }),
      queryClient.invalidateQueries({ queryKey: caseKeys.list() }),
      queryClient.invalidateQueries({ queryKey: reviewKeys.detail(id ?? '') }),
    ])
  }

  const onError = (error: unknown) => {
    if (error instanceof ApiError && error.status === 409) void invalidate()
  }

  const requestChanges = useMutation({
    mutationFn: (comment: string) =>
      api.post<DecisionResponse>(`/cases/${id}/review/request-changes`, { comment }),
    onSuccess: invalidate,
    onError,
  })

  const approve = useMutation({
    mutationFn: (comment: string) =>
      api.post<DecisionResponse>(`/cases/${id}/review/approve`, { comment }),
    onSuccess: invalidate,
    onError,
  })

  return { requestChanges, approve }
}
