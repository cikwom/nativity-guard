import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'
import { caseKeys } from './useCases'
import type { Evidence, EvidenceCreateResponse, EvidenceListResponse } from '@/types/api'

export const evidenceKeys = {
  forCase: (caseId: string) => ['evidence', caseId] as const,
}

export function useCaseEvidence(caseId: string | undefined) {
  return useQuery({
    queryKey: evidenceKeys.forCase(caseId ?? ''),
    queryFn: () => api.get<EvidenceListResponse>(`/evidence/case/${caseId}`),
    enabled: Boolean(caseId),
    select: (data) => data.evidence,
  })
}

export interface UploadEvidenceInput {
  type: string
  fileUrl: string
  description?: string
  latitude?: number
  longitude?: number
}

export function useUploadEvidence(caseId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UploadEvidenceInput) =>
      api.post<EvidenceCreateResponse>('/evidence/upload', { caseId, ...input }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: evidenceKeys.forCase(caseId ?? '') }),
        queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId ?? '') }),
      ])
    },
  })
}

export function useVerifyEvidence(caseId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (evidenceId: string) =>
      api.patch<{ message: string; evidence: Evidence }>(`/evidence/${evidenceId}/verify`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: evidenceKeys.forCase(caseId ?? '') })
    },
  })
}
