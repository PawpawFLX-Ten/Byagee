/*
 * Civic Man service worker — offline-capable installable PWA, no build step.
 *
 * Strategy:
 *  - Navigations: network-first, fall back to the cached shell (index.html)
 *    so players always get fresh code when online.
 *  - Same-origin GET assets: stale-while-revalidate — serve from cache,
 *    refresh in the background. The app is a single canvas bundle, so this
 *    makes repeat visits instant and fully offline after first play.
 *  - Everything else (cross-origin, non-GET, TTS/audio internals) passes
 *    through untouched.
 *
 * Bump CACHE_VERSION when deploy contents change shape; old caches are
 * purged on activate.
 */
const CACHE_VERSION = 'civicman-v1'
const SHELL = ['./', './index.html', './manifest.json', './favicon.svg', './icon-192.png', './icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE_VERSION).then((c) => c.put('./index.html', copy))
          return res
        })
        .catch(() => caches.match('./index.html')),
    )
    return
  }

  // Stale-while-revalidate for hashed assets and static files.
  event.respondWith(
    caches.match(req).then((cached) => {
      const refresh = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone()
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || refresh
    }),
  )
})
