# GIS v2 frontend handoff

## Purpose

This branch extends the existing Nativity Guard Leaflet map. It does **not** replace the team's Go API and it does not add a second mapping stack.

## Implemented in this frontend

### 1. Case clustering
- Existing screen-space case clustering in `src/lib/mapGroups.ts` remains the single clustering implementation.
- Cluster markers expand as the user zooms in.
- No third-party clustering package was introduced.

### 2. Activity heatmap-style layer
- `MapView` now exposes the existing activity layer as the **Activity heatmap** control on `/map`.
- It uses real cases already returned by the frontend case query.
- It is zoom-aware and aggregates nearby reports before drawing density circles.
- The UI explicitly describes the layer as reported activity, not a prediction of danger.
- A true SOS-wide heatmap still requires the production `/sos` response contract for the role that can see all SOS records.

### 3. Viewport-bounded unit loading
- `MapView` reports visible bounds, center, and an enclosing radius through `onViewportChange`.
- `MapPage` feeds that center/radius into the existing `/units/nearby` endpoint.
- The radius is capped at 200 km client-side to prevent an accidental huge request.
- The existing `/units` query remains as the initial/fallback source.
- This requires no new backend endpoint.

### 4. Offline map tile caching
- `public/sw.js` now has a separate runtime cache for requested OSM map tiles.
- Tiles are cache-first after they have been successfully requested online.
- The service worker keeps the existing network-only HTML behaviour and API caching behaviour.
- Production should use a tile provider whose terms explicitly permit client-side caching; self-hosted/MapLibre remains the long-term rural/offline upgrade path.


## Existing working logic that must be preserved

This GIS branch is an integration layer, not a replacement for existing product behavior. In particular, preserve and merge: 
- existing browser/user live-location handling in `src/hooks/useLocation.ts`;
- existing location-sharing consent before `POST /location`;
- existing incident/case loading and filtering through `useCases()`;
- existing SOS send/detail/accept/release/assign flows in `src/hooks/useSos.ts`;
- existing report and SOS location-picker behavior using the shared `MapView`.

When the backend teammate supplies the responder-position contract, wire it into these existing flows rather than creating a second location or incident data model.

## Backend-dependent work deliberately not fabricated

### Live responder positions
The team-lead specification says accepted SOS responders use officer `UserLocation` rows written through `/location`, with a stale-position cutoff and privacy protection. The frontend repository available to this branch does not contain the authoritative Go response contract for listing responder positions.

Backend teammate should provide/confirm:
- endpoint/query for responder positions for an accepted SOS;
- response fields for officer/unit identity and timestamp;
- whether exact coordinates are returned only to authorized responders/dispatchers;
- server-side enforcement of the two-minute stale-position cutoff (preferred) or an explicit timestamp contract for the frontend to enforce as a second safety check.

Do not expose officer coordinates to public/citizen map views.

### Landmarks
The Go contract documents `GET /api/v1/geo/reverse?lat=&lng=` and a `landmark` field. A viewport-wide landmark feed is not documented, so the frontend should not invent an Overpass response contract. The backend teammate can add a viewport landmark endpoint if required.

### Directions
- `/units/:id` now exposes **Get directions** using the unit latitude/longitude.
- Both Google Maps and OpenStreetMap routing links are available.
- This uses the existing unit coordinates and requires no new backend endpoint.

### SOS heatmap
The current frontend hook `/sos/my` is intentionally user-scoped. It must not be changed to expose all SOS records. The super-admin/all-SOS contract described in the team email must be confirmed before adding those points to the operations heatmap.

## Verification note

The source archive does not contain a usable installed dependency tree in this environment. `npm run typecheck` reached TypeScript but stopped because `vite/client` was unavailable locally. Run the normal dependency install in the real checkout and then:

```bash
npm run typecheck
npm test
npm run build
npm run lint
```

## Suggested merge order

1. Merge the frontend GIS branch after the frontend checks pass.
2. Backend teammate reviews the GIS handoff items above.
3. Backend adds/confirm the responder-position and all-SOS contracts.
4. Frontend then wires those confirmed contracts without changing the existing map architecture.

## Responder-location safety boundary

The frontend now contains `src/lib/responderLocation.ts` as the safety boundary for the future live responder layer.

- A responder position older than 2 minutes is rejected and must not be rendered.
- Invalid/future timestamps are rejected.
- Unauthorized viewers receive coordinates rounded to 3 decimal places instead of the raw GPS fix.
- Exact coordinates are only retained when the caller explicitly has `canViewExact` permission.
- This is a frontend defence-in-depth measure. The Go backend must enforce authorization and must not publish exact officer coordinates to unauthorized clients.
- When the backend teammate wires the live responder endpoint, they should return a stable officer identifier, latitude, longitude, and an authoritative `recordedAt` timestamp.

## 2026-10-02 frontend build continuation

### Added in this pass
- Map unit popups expose Google Maps and OpenStreetMap directions.
- The shared map accepts the `landmark` returned by `GET /api/v1/geo/reverse` and renders it as an OSM reference marker.
- The shared map accepts pre-authorized, already-sanitized responder locations through `responderLocations`.
- Responder markers are rendered only when the caller supplies them; the map itself does not fetch or invent officer locations.
- Existing incident/case markers, SOS/report location pickers, and the user's own live location remain in the existing `MapView` flow.

### Backend merge contract for responder locations
The Go backend should provide the responder-location data only to authorized callers. The frontend expects:
- `officerId`
- `latitude`
- `longitude`
- `recordedAt` (ISO timestamp)
- `exact` indicating whether the supplied coordinates are authorized exact coordinates or privacy-safe rounded coordinates.

The frontend safety helper rejects positions older than two minutes. The backend must enforce authorization and should also stop publishing exact coordinates to callers without permission.

### Existing functionality that MUST remain during merge
Do not replace or remove the existing:
- live user location / location permission flow
- incident/case loading and markers
- SOS location picker and SOS tracking
- report-incident location picker
- reverse geocoding
- unit registry and unit detail behavior

GIS v2 is an integration layer over these existing flows, not a replacement for them.

## Latest build — live responder integration

Frontend now accepts an optional `location` object on each SOS responder returned by `GET /api/v1/sos/:id`:

```json
{
  "location": {
    "latitude": 6.5244,
    "longitude": 3.3792,
    "recordedAt": "2026-10-02T12:00:00Z",
    "exact": true
  }
}
```

The existing `useSosDetail()` polling remains the transport (10-second refresh). The SOS detail map passes responder locations through the client safety boundary before rendering.

Backend requirements:
- only return responder locations to callers authorized to see them;
- set `exact: true` only when exact coordinates are authorized;
- keep `recordedAt` as the actual GPS/location timestamp;
- stop returning/marking positions as active when the responder is no longer authorized or responding;
- `/location` remains the source of officer location updates; do not replace the existing location flow.

Frontend behavior:
- positions older than 2 minutes are rejected;
- invalid/future timestamps are rejected;
- exact positions require the backend `exact: true` flag;
- otherwise coordinates are rounded to approximately 100m;
- existing SOS, incident, report, and user-location behavior is preserved.
