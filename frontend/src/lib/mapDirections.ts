/** External navigation links for a unit destination. */
export function googleDirectionsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
}

export function osmDirectionsUrl(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${latitude},${longitude}`
}
