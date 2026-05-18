// Service Worker for RepairDesk PWA
const CACHE_NAME = 'repairdesk-v1'

self.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([
      '/',
      '/login',
      '/manifest.json',
    ]))
  )
})

self.addEventListener('fetch', (event: any) => {
  event.respondWith(
    caches.match(event.request).then(res => res || fetch(event.request))
  )
})
