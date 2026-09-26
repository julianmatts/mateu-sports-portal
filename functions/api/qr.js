/* functions/api/qr.js — API pública de las etiquetas QR del salón (26/09/2026).
   La llama qr/index.html desde el celular del CLIENTE (sin sesión). Toda la lógica está en
   lib/qr-publico.mjs (con tests); acá solo se parsea el pedido, se aplica el tope por IP y se
   registra el escaneo sin demorar la respuesta.

   GET  /api/qr                    → {disponible:true}
   GET  /api/qr?c=<código>&s=<slug|NN>  → producto + precio + talles acá y en otras sucursales (y registra el escaneo)
   GET  /api/qr?s=<slug|NN>&q=<texto|EAN> → buscador del local (QR genérico de la sucursal)
   GET  /api/qr?s=<slug|NN>        → datos de la sucursal para la pantalla de búsqueda
   POST /api/qr {accion:'aviso'|'pedido', …} → «avisame cuando llegue mi talle» / «pedir que lo traigan»
   Secrets opcionales (cuando esté la API de stock del sistema): STOCK_API_URL, STOCK_API_KEY → precio real. */

import { crear, crearTope, slugDe, SUCS } from '../../lib/qr-publico.mjs';

let CORE = null;
const topeGet = crearTope(120, 60e3), topePost = crearTope(15, 3600e3);
const json = (d, st) => new Response(JSON.stringify(d), { status: st || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const ipDe = req => req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'x';
function core(env) { if (!CORE) CORE = crear({ env }); return CORE; }

export async function onRequestGet(ctx) {
  const env = ctx.env || {}, C = core(env), u = new URL(ctx.request.url);
  if (!topeGet(ipDe(ctx.request))) return json({ error: 'Demasiadas consultas desde este dispositivo. Esperá un minuto.' }, 429);
  const c = u.searchParams.get('c'), s = u.searchParams.get('s'), q = u.searchParams.get('q');
  if (!c && !s) return json({ disponible: true });
  if (c) {
    const r = await C.articulo({ c, s });
    if (r.ok && !u.searchParams.get('nolog')) {
      const p = C.escaneo(r.sucursal.slug, r.codigo, ctx.request.headers.get('user-agent'));
      if (ctx.waitUntil) ctx.waitUntil(p);
    }
    return json(r, r.status || 200);
  }
  if (q) { const r = await C.buscar({ s, q }); return json(r, r.status || 200); }
  const slug = slugDe(s);
  if (!slug) return json({ error: 'No reconozco la sucursal.' }, 400);
  const cfg = await C.configDe(slug);
  return json({ ok: true, sucursal: { slug, nombre: SUCS[slug].nombre, marca: SUCS[slug].marca, outlet: !!SUCS[slug].outlet }, config: cfg });
}

export async function onRequestPost(ctx) {
  const env = ctx.env || {}, C = core(env);
  if (!topePost(ipDe(ctx.request))) return json({ error: 'Ya mandaste varios pedidos desde este dispositivo. Hablá con un vendedor.' }, 429);
  let b; try { b = await ctx.request.json(); } catch (e) { return json({ error: 'JSON inválido' }, 400); }
  let r;
  if (b.accion === 'aviso') r = await C.aviso(b);
  else if (b.accion === 'pedido') r = await C.pedido(b);
  else return json({ error: 'Acción desconocida.' }, 400);
  return json(r, r.status || 200);
}
