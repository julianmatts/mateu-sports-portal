/* Service Worker del Portal Mateu Sports.
   Estrategia: NETWORK-FIRST para GET same-origin (siempre trae lo último cuando
   hay conexión; cae al cache solo si estás offline). Nunca sirve contenido viejo
   estando online, así que no interfiere con los deploys de Cloudflare Pages ni con
   los datos de Firebase (que van cross-origin y pasan de largo sin tocar cache).

   Endurecido 24/08/2026 («primero carga la versión vieja y a los segundos se
   actualiza», reporte de Juli):
   - Las NAVEGACIONES (HTML) van con cache:'no-cache': el cache HTTP del navegador
     nunca puede entregar una página vieja sin revalidar contra Cloudflare.
   - Si una navegación cayó al cache (red dormida al abrir la app instalada), el SW
     reintenta de fondo y, cuando la red vuelve y el HTML cambió, re-navega esa
     ventana a la versión nueva — antes la página vieja quedaba servida sin aviso.
   Subir CACHE cuando quieras limpiar cachés viejos. */
const CACHE = 'mateu-portal-v4';

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

// Una navegación servida desde el cache quedó "vieja": reintentar de fondo y,
// si al volver la red el HTML es distinto, re-navegar esa ventana a lo nuevo.
function repararNavegacion(e, req, cached) {
  e.waitUntil((async () => {
    for (let i = 0; i < 8; i++) {                        // ~1½ minutos de reintentos
      await new Promise((r) => setTimeout(r, 1500 + i * 3000));
      try {
        const fresh = await fetch(req.url, { cache: 'no-cache' });
        if (!fresh || !fresh.ok) continue;
        const c = await caches.open(CACHE);
        await c.put(req, fresh.clone());
        // ¿cambió el contenido? (ETag si está; si no, comparar el cuerpo)
        const et = fresh.headers.get('etag'), etc = cached && cached.headers.get('etag');
        let cambio = !et || !etc || et !== etc;
        if (cambio && cached) {
          try { cambio = (await fresh.clone().text()) !== (await cached.clone().text()); } catch (err) {}
        }
        if (cambio) {
          const wins = await self.clients.matchAll({ type: 'window' });
          const win = wins.find((w) => w.url === req.url) || wins.find((w) => w.url.split('#')[0] === req.url.split('#')[0]);
          if (win && win.navigate) await win.navigate(win.url).catch(() => {});
        }
        return;
      } catch (err) { /* sigue sin red: probar de nuevo */ }
    }
  })());
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // POST/PUT (Firebase) -> passthrough
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // CDNs / Firebase -> passthrough

  const esNav = req.mode === 'navigate';
  e.respondWith((async () => {
    try {
      // HTML siempre revalidado contra el servidor (nunca del cache HTTP sin preguntar)
      // (con la URL: un Request con mode 'navigate' no se puede reconstruir con init)
      const fresh = await (esNav ? fetch(req.url, { cache: 'no-cache' }) : fetch(req));
      if (fresh && fresh.status === 200 && fresh.type === 'basic') {
        const c = await caches.open(CACHE);
        c.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) {
        if (esNav) repararNavegacion(e, req, cached.clone());
        return cached;
      }
      if (esNav) {
        const shell = (await caches.match('./index.html')) || (await caches.match('./'));
        if (shell) { repararNavegacion(e, req, null); return shell; }
      }
      throw err;
    }
  })());
});
