/* Nativity Guard service worker — v3
 *
 * Cache-first for immutable hashed assets (JS, CSS) so repeat visits are
 * instant. Network-first for API GETs with cache fallback so reads work
 * offline. Never caches POST/PUT/DELETE — those go through the offline
 * write queue in @/lib/offlineQueue.ts.
 *
 * v3 change: HTML is NEVER cached or served stale. A cached index.html
 * from an old deploy points at chunk files that no longer exist on the
 * server, which manifests as "Failed to fetch dynamically imported
 * module". Network-only for HTML means the browser always gets the
 * current deployment's index.html, whose chunk references are always
 * valid.
 */
const CACHE = 'ng-shell-v3'
const TILE_CACHE = 'ng-map-tiles-v1'
const TILE_HOSTS = new Set(['tile.openstreetmap.org', 'a.tile.openstreetmap.org', 'b.tile.openstreetmap.org', 'c.tile.openstreetmap.org'])
// Static assets that never change and are safe to precache.
// Deliberately excludes index.html — see the header comment.
const SHELL = ['/favicon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => undefined)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE && k !== TILE_CACHE).map((k) => caches.delete(k)),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Only handle GET. POST/PUT/DELETE go through the offline queue.
  if (req.method !== 'GET') return

  const sameOrigin = url.origin === self.location.origin
  const isApi = sameOrigin && url.pathname.startsWith('/api/')
  const isHashedAsset = sameOrigin && url.pathname.startsWith('/assets/')
  const isMapTile = TILE_HOSTS.has(url.hostname) && /\/\d+\/\d+\/\d+\.png$/.test(url.pathname)

  // 1. HTML navigation — NETWORK ONLY. Never serve a cached index.html.
  //    A stale index.html references deleted chunks and breaks the app.
  if (req.mode === 'navigate') {
    // Let the browser fetch it natively. No respondWith() = no SW
    // interception, no stale fallback. The browser's own cache headers
    // (or lack of them) decide freshness.
    return
  }

  // 2. Hashed JS/CSS — cache-first forever. Content hashes mean a
  //    filename change signals new content, so a cache hit is always safe.
  if (isHashedAsset) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached
        return fetch(req).then((resp) => {
          if (resp.ok) {
            const copy = resp.clone()
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined)
          }
          return resp
        })
      }),
    )
    return
  }

  // 3. Map tiles — cache-first after the first successful online visit.
  // Keep this bounded by storing only requested tiles; production deployments
  // should use a tile provider whose terms explicitly permit client caching.
  if (isMapTile) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached
        return fetch(req).then((resp) => {
          if (resp.ok || resp.type === 'opaque') {
            const copy = resp.clone()
            caches.open(TILE_CACHE).then((c) => c.put(req, copy)).catch(() => undefined)
          }
          return resp
        }).catch(() => caches.match(req).then((r) => r || Response.error()))
      }),
    )
    return
  }

  // 3. API GETs — network-first, fall back to last cached response.
  if (isApi) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined)
          return resp
        })
        .catch(() => caches.match(req).then((r) => r || Response.error())),
    )
    return
  }

  // 4. Everything else same-origin — network with cache fallback.
  if (sameOrigin) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req)),
    )
  }
})