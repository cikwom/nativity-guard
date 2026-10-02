import { describe, expect, it } from 'vitest'
import { formatAddress } from './useReverseGeocode'
import type { GeocodeResult } from './useReverseGeocode'

const base: GeocodeResult = {
  address: '',
  suburb: '',
  lga: '',
  state: '',
  country: '',
  postalCode: '',
  landmark: '',
  latitude: 0,
  longitude: 0,
}

describe('formatAddress', () => {
  it('returns empty string when input is undefined', () => {
    expect(formatAddress(undefined)).toBe('')
  })

  it('returns suburb + state when present', () => {
    const r = formatAddress({ ...base, suburb: 'Oturkpo', state: 'Benue' })
    expect(r).toBe('Oturkpo, Benue State')
  })

  it('uses landmark when present', () => {
    const r = formatAddress({
      ...base,
      landmark: 'Oturkpo Main Market',
      state: 'Benue',
    })
    expect(r).toBe('near Oturkpo Main Market, Benue State')
  })

  it('falls back to address when suburb is empty', () => {
    const r = formatAddress({
      ...base,
      address: 'A3 Road',
      state: 'Benue',
    })
    expect(r).toBe('A3 Road, Benue State')
  })

  it('returns only state when nothing else is set', () => {
    const r = formatAddress({ ...base, state: 'Benue' })
    expect(r).toBe('Benue State')
  })

  it('returns empty string when every field is empty', () => {
    expect(formatAddress(base)).toBe('')
  })
})
