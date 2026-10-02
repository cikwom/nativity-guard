import type { Case } from '@/types/api'

export interface CaseGroup {
  cases: Case[]
  latitude: number
  longitude: number
}

/** Group nearby screen positions; never expose a case outside the caller's scoped list. */
export function groupCases(
  cases: Case[],
  project: (latitude: number, longitude: number) => { x: number; y: number },
  cellPixels: number,
): CaseGroup[] {
  const groups = new Map<string, Case[]>()
  for (const item of cases) {
    if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) continue
    const point = project(item.latitude, item.longitude)
    const key = `${Math.floor(point.x / cellPixels)}:${Math.floor(point.y / cellPixels)}`
    const group = groups.get(key) ?? []
    group.push(item)
    groups.set(key, group)
  }
  return [...groups.values()].map((items) => ({
    cases: items,
    latitude: items.reduce((sum, item) => sum + item.latitude, 0) / items.length,
    longitude: items.reduce((sum, item) => sum + item.longitude, 0) / items.length,
  }))
}

/** Only sufficiently aggregated concentrations are eligible for a heat overlay. */
export function activityGroups(groups: CaseGroup[], minimum = 5): CaseGroup[] {
  return groups.filter((group) => group.cases.length >= minimum)
}
