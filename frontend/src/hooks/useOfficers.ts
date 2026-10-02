import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'
import { caseKeys } from './useCases'
import type {
  AssignCaseResponse,
  CaseAssignmentsResponse,
  UnitOfficersResponse,
} from '@/types/api'

export const officerKeys = {
  byUnit: (unitId: string) => ['officers', 'unit', unitId] as const,
  assignments: (caseId: string) => ['officers', 'assignments', caseId] as const,
}

/**
 * The roster of a unit, used to pick someone to assign.
 *
 * `GET /units/:id/officers` is registered as of 2026-09-26 — the handler sat
 * implemented but unrouted in `handlers/officers_handler.go` for a long time, and
 * `routes/routes.go` now mounts it. A deployment running an older build may
 * still 404.
 *
 * `retry: false` is deliberate either way: a 404 means the route is absent from
 * that deployment's router, which retrying cannot fix — not a transient blip.
 * Callers treat a 404 as "no roster available" rather than as a failure
 * (see components/admin/AssignOfficerDialog.tsx).
 */
export function useUnitOfficers(unitId: string | undefined) {
  return useQuery({
    queryKey: officerKeys.byUnit(unitId ?? ''),
    queryFn: () => api.get<UnitOfficersResponse>(`/units/${unitId}/officers`),
    enabled: Boolean(unitId),
    select: (data) => data.officers,
    retry: false,
  })
}

/** Officers attached to a case (`GET /cases/:id/assignments`). */
export function useCaseAssignments(caseId: string | undefined) {
  return useQuery({
    queryKey: officerKeys.assignments(caseId ?? ''),
    queryFn: () => api.get<CaseAssignmentsResponse>(`/cases/${caseId}/assignments`),
    enabled: Boolean(caseId),
    select: (data) => data.assignments,
    retry: false,
  })
}

export interface AssignOfficerInput {
  officerId: string
  role?: string
}

/**
 * Assign or reassign an officer. Mirrors `POST /cases/:id/assign`, which is the
 * only transition that moves a case out of `pending`.
 */
export function useAssignOfficer(caseId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AssignOfficerInput) =>
      api.post<AssignCaseResponse>(`/cases/${caseId}/assign`, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId ?? '') }),
        queryClient.invalidateQueries({ queryKey: caseKeys.list() }),
        queryClient.invalidateQueries({ queryKey: officerKeys.assignments(caseId ?? '') }),
      ])
    },
  })
}
