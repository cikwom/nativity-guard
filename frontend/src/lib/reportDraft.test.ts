import { describe, expect, it } from 'vitest'
import {
  REPORT_DRAFT_KEY,
  clearReportDraft,
  emptyReportDraft,
  isReportDraftEmpty,
  loadReportDraft,
  parseReportDraft,
  saveReportDraft,
  type DraftStorage,
  type ReportDraft,
} from './reportDraft'

/**
 * A draft is the only place this app stores user content on the device, and the
 * only place it reads back something it did not write in this session. So the
 * tests that matter are the negative ones: junk in storage must produce a fresh
 * form, never a half-restored one.
 */

/** An in-memory `Storage`, since this repo's test environment has no DOM. */
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  }
}

/**
 * A draft with *only* the given fields set.
 *
 * Kept separate from `draft()` on purpose: `isReportDraftEmpty` is a conjunction,
 * so asserting it against a populated draft proves nothing about the field under
 * test — every assertion would pass for the wrong reason. Isolation is the point.
 */
function only(overrides: Partial<ReportDraft> = {}): ReportDraft {
  return { ...emptyReportDraft(), ...overrides }
}

function draft(overrides: Partial<ReportDraft> = {}): ReportDraft {
  return only({
    title: 'Burst pipe flooding the junction',
    description: 'Water has been running since yesterday evening.',
    location: 'Bode Thomas / Adeniran Ogunsanya',
    latitude: 6.5001,
    longitude: 3.3543,
    ...overrides,
  })
}

describe('emptyReportDraft / isReportDraftEmpty', () => {
  it('starts empty', () => {
    expect(isReportDraftEmpty(emptyReportDraft())).toBe(true)
  })

  it('counts any real field as content', () => {
    expect(isReportDraftEmpty(only({ title: 'x' }))).toBe(false)
    expect(isReportDraftEmpty(only({ description: 'x' }))).toBe(false)
    expect(isReportDraftEmpty(only({ location: 'x' }))).toBe(false)
    expect(isReportDraftEmpty(only({ urgent: true }))).toBe(false)
    expect(isReportDraftEmpty(only({ unitId: 'unit-a' }))).toBe(false)
    expect(isReportDraftEmpty(only({ latitude: 6.5, longitude: 3.3 }))).toBe(false)
  })

  it('does not count whitespace', () => {
    expect(isReportDraftEmpty(only({ title: '   ', description: '\n\t' }))).toBe(true)
  })

  it('does not count an evidence row that has no link in it', () => {
    expect(isReportDraftEmpty(only({ evidence: [{ fileUrl: '  ', type: 'image' }] }))).toBe(true)
    expect(isReportDraftEmpty(only({ evidence: [{ fileUrl: 'https://x/y.jpg', type: '' }] }))).toBe(
      false,
    )
  })
})

describe('parseReportDraft', () => {
  it('returns null for nothing, for junk, and for a non-object', () => {
    expect(parseReportDraft(null)).toBeNull()
    expect(parseReportDraft('')).toBeNull()
    expect(parseReportDraft('not json')).toBeNull()
    expect(parseReportDraft('"a string"')).toBeNull()
    expect(parseReportDraft('[1,2,3]')).toBeNull()
    expect(parseReportDraft('null')).toBeNull()
  })

  it('round-trips a real draft', () => {
    const original = draft({
      urgent: true,
      unitId: 'unit-a',
      evidence: [{ fileUrl: 'https://x/y.jpg', type: 'image' }],
    })
    expect(parseReportDraft(JSON.stringify(original))).toEqual(original)
  })

  it('substitutes a usable default for every wrong-typed field', () => {
    const parsed = parseReportDraft(
      JSON.stringify({
        title: 42,
        description: null,
        urgent: 'yes',
        location: { road: 'Bode Thomas' },
        latitude: '6.5',
        longitude: Number.NaN,
        unitId: '',
        evidence: 'none',
      }),
    )
    expect(parsed).toEqual(emptyReportDraft())
  })

  it('drops a lone coordinate rather than placing a pin at the equator', () => {
    const parsed = parseReportDraft(JSON.stringify({ latitude: 6.5001 }))
    expect(parsed?.latitude).toBeNull()
    expect(parsed?.longitude).toBeNull()
  })

  it('ignores unknown keys, so an older or newer draft still restores', () => {
    const parsed = parseReportDraft(JSON.stringify({ title: 'Flooding', step: 3, category: 'flood' }))
    expect(parsed?.title).toBe('Flooding')
    expect(parsed).not.toHaveProperty('step')
    expect(parsed).not.toHaveProperty('category')
  })

  it('keeps only the evidence rows that are objects', () => {
    const parsed = parseReportDraft(
      JSON.stringify({ evidence: [null, 'x', 7, { fileUrl: 'https://x/y.jpg' }] }),
    )
    expect(parsed?.evidence).toEqual([{ fileUrl: 'https://x/y.jpg', type: '' }])
  })
})

describe('load / save / clear', () => {
  it('writes a non-empty draft under the documented key', () => {
    const storage = fakeStorage()
    saveReportDraft(storage, draft())
    expect(storage.getItem(REPORT_DRAFT_KEY)).toContain('Burst pipe')
    expect(loadReportDraft(storage)?.title).toBe('Burst pipe flooding the junction')
  })

  it('removes the key instead of storing an empty draft', () => {
    const storage = fakeStorage({ [REPORT_DRAFT_KEY]: JSON.stringify(draft()) })
    saveReportDraft(storage, emptyReportDraft())
    expect(storage.getItem(REPORT_DRAFT_KEY)).toBeNull()
    expect(loadReportDraft(storage)).toBeNull()
  })

  it('clears on demand', () => {
    const storage = fakeStorage({ [REPORT_DRAFT_KEY]: JSON.stringify(draft()) })
    clearReportDraft(storage)
    expect(loadReportDraft(storage)).toBeNull()
  })

  it('opens fresh when storage is unreachable or throws', () => {
    expect(loadReportDraft(undefined)).toBeNull()
    expect(() => saveReportDraft(undefined, draft())).not.toThrow()
    expect(() => clearReportDraft(undefined)).not.toThrow()

    const hostile: DraftStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    // Private mode and sandboxed iframes throw on access, not just on quota.
    expect(loadReportDraft(hostile)).toBeNull()
    expect(() => saveReportDraft(hostile, draft())).not.toThrow()
    expect(() => clearReportDraft(hostile)).not.toThrow()
  })
})
