import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'

export type GeocodeResult = {
  address: string
  suburb: string
  lga: string
  state: string
  country: string
  postalCode: string
  landmark: string
  latitude: number
  longitude: number
}

function round5(n: number): number {
  return Math.round(n * 100000) / 100000
}

export function useReverseGeocode(lat: number | null, lng: number | null) {
  const key = lat != null && lng != null ? ['geo', 'reverse', round5(lat), round5(lng)] as const : ['geo', 'reverse', null, null] as const

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (lat == null || lng == null) return undefined
      const response = await api.get<GeocodeResult>(`/geo/reverse?lat=${lat}&lng=${lng}`)
      return response
    },
    enabled: lat != null && lng != null,
    staleTime: 24 * 60 * 60 * 1000,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
  }
}

export function formatAddress(g: GeocodeResult | undefined): string {
  if (!g) return ''

  const parts: string[] = []

  if (g.landmark) {
    parts.push(`near ${g.landmark}`)
  }

  if (g.suburb) {
    parts.push(g.suburb)
  } else if (g.address) {
    parts.push(g.address)
  }

  if (g.state) {
    parts.push(`${g.state} State`)
  }

  return parts.join(', ')
}