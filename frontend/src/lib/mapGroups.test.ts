import { describe, expect, it } from 'vitest'
import { activityGroups, groupCases } from './mapGroups'
import type { Case } from '@/types/api'

const example = (id: string, latitude: number, longitude: number): Case =>
  ({ id, latitude, longitude } as Case)

describe('map grouping', () => {
  it('clusters close cases and leaves distant cases separate', () => {
    const groups = groupCases(
      [example('one', 10, 10), example('two', 11, 11), example('three', 90, 90)],
      (lat, lng) => ({ x: lng, y: lat }), 40,
    )
    expect(groups.map((group) => group.cases.length)).toEqual([2, 1])
  })

  it('never exposes a location for a sparse activity group', () => {
    const cases = Array.from({ length: 5 }, (_, index) => example(String(index), 10 + index, 10))
    const grouped = groupCases(cases.slice(0, 4), (lat, lng) => ({ x: lng, y: lat }), 100)
    expect(activityGroups(grouped)).toEqual([])
    const five = groupCases(cases, (lat, lng) => ({ x: lng, y: lat }), 100)
    expect(activityGroups(five)).toHaveLength(1)
  })
})
