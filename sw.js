/* Service Worker del Portal Mateu Sports.
   Estrategia: NETWORK-FIRST para GET same-origin (siempre trae lo último cuando
   hay conexión; cae al cache solo si estás offline). Nunca sirve contenido viejo
   estando online, así que no interfiere con los deploys de Cloudflare Pages ni con
   los datos de Firebase (que van cross-origin y pasan de largo sin tocar cache).
   Subir CACHE_VERSION cuando quieras limpiar cachés viejos. */
const CACHE = 'mateu-portal-v1';

// Shell mínimo para que el Portal abra offline (los módulos se cachean solos al visitarlos).
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // POST/PUT (Firebase) -> passthrough
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // CDNs / Firebase -> passthrough

  e.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.status === 200 && fresh.type === 'basic') {
        const c = await caches.open(CACHE);
        c.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const shell = (await caches.match('./index.html')) || (await caches.match('./'));
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
