import { describe, expect, it } from 'vitest'
import { googleDirectionsUrl, osmDirectionsUrl } from './mapDirections'

describe('map directions', () => {
  it('creates a Google Maps destination URL', () => {
    expect(googleDirectionsUrl(6.5244, 3.3792)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=6.5244,3.3792',
    )
  })

  it('creates an OpenStreetMap routing URL', () => {
    expect(osmDirectionsUrl(6.5244, 3.3792)).toBe(
      'https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;6.5244,3.3792',
    )
  })
})
