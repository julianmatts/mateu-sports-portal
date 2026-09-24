/* ============================================================
   lib/ventas-proxy.mjs — proxy del Portal a la API de ventas del sistema
   (24/09/2026). Lo usa functions/api/ventas.js; tests en
   lib/ventas-proxy.test.mjs (node --test lib/ventas-proxy.test.mjs).

   Por qué existe: la API del dev (SQL Server del sistema, ver
   docs/API-VENTAS-FASE1.md) se autentica con una key fija que NO puede
   ir al navegador (el repo es público y el HTML se lee), y la base tiene
   un bloqueo cada ~30 s que hace que una de cada tres consultas tarde
   20 s. El proxy resuelve las dos cosas: la key vive en un Secret de
   Cloudflare Pages (VENTAS_API_KEY) y la respuesta se sirve desde un
   cache propio (memoria del isolate + R2), así el encargado nunca espera
   a la base.

   Rutas (solo GET, mismo origen que el Portal, sin CORS):
     GET /api/ventas                          → { disponible }
     GET /api/ventas?semana=YYYY-MM-DD        → totales de la semana por sucursal
     GET /api/ventas?semana=…&sucursal=<slug> → detalle por vendedor (shape ventaEquipo)

   Identidad: headers X-Mateu-Email y X-Mateu-Tok (el token de sesión de
   acceso.js). El rol y la sucursal salen de discontinuos-mateu/usuarios,
   no del navegador. admin / supervisor ven cualquier sucursal; sucursal /
   outlet SOLO la propia (los totales de la semana les llegan filtrados a
   su slug); el resto de los roles no entra. Con el ingreso por servidor
   activo (Secrets de acceso cargados) el token es obligatorio y tiene que
   ser del mismo mail; sin esos Secrets sigue la seguridad blanda del resto
   del portal.

   Cache: una respuesta se considera FRESCA 5 minutos (se sirve sin tocar
   la API), VIEJA hasta 24 h (se sirve al toque y se refresca de fondo con
   ctx.waitUntil) y después se descarta. Una sola consulta en vuelo por
   ruta (VUELO). El timeout contra la API es de 40 s: absorbe un bloqueo
   de 20 s de la base cuando no hay ningún cache; con cache viejo nunca
   se espera. Una ruta que FALLÓ (500 de la API, timeout) no se vuelve a
   pedir durante 60 s (FALLOS): la respuesta repite el error al toque, así
   una semana rota en la API no se consulta 20 veces por cada pantalla que
   la pide. Headers de salida: X-Ventas-Cache (fresco | viejo | api) y
   X-Ventas-Ts (cuándo se consultó la API por última vez).

   Variables en Cloudflare Pages → Settings → Variables and Secrets:
     VENTAS_API_KEY   (Secret, obligatoria) — la key Bearer de la API
     VENTAS_API_BASE  (opcional) — por defecto https://66-97-37-173.sslip.io
     VENTAS_CACHE     (binding R2 opcional); si no está, usa LEGAJOS
                      (el bucket de RRHH, bajo el prefijo _cache/ventas/)
   Un Secret nuevo toma efecto en el deploy siguiente (Retry deployment).
   ============================================================ */

import { disponible as accesoDisponible, leerToken, mailKey } from './acceso-servidor.mjs';

export const BASE_DEF = 'https://66-97-37-173.sslip.io';
export const FRESCO_MS = 5 * 60 * 1000;
export const VIEJO_MS = 24 * 60 * 60 * 1000;
export const TIMEOUT_MS = 40 * 1000;
const USUARIO_MS = 10 * 60 * 1000;
const R2_PREFIJO = '_cache/ventas/';
const FB_USUARIOS = 'https://discontinuos-mateu-default-rtdb.firebaseio.com/usuarios/';
const ROLES_TODO = ['admin', 'supervisor'];
const ROLES_PROPIO = ['sucursal', 'outlet'];
const RX_ISO = /^\d{4}-\d{2}-\d{2}$/, RX_SLUG = /^[a-z0-9-]{2,30}$/;

const MEM = new Map();        // ruta → {ts, data}
const VUELO = new Map();      // ruta → Promise<{ts, data}>
const USUARIOS = new Map();   // mail → {ts, user}
const FALLOS = new Map();     // ruta → {ts, status, upstream, msg}: una ruta que falló no se vuelve a pedir por FALLO_MS
export const FALLO_MS = 60 * 1000;

export function disponible(env){ return !!(env && env.VENTAS_API_KEY); }
export function esLunes(iso){
  if (!RX_ISO.test(iso || '')) return false;
  const d = new Date(iso + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === iso && d.getUTCDay() === 1;
}
/** Solo para los tests: vacía los caches del isolate. */
export function limpiarCache(){ MEM.clear(); VUELO.clear(); USUARIOS.clear(); FALLOS.clear(); }
export function olvidarFallos(){ FALLOS.clear(); }

function json(data, status, extra){
  const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' };
  Object.assign(h, extra || {});
  return new Response(JSON.stringify(data), { status: status || 200, headers: h });
}
const err = (msg, status, extra) => json(Object.assign({ error: msg }, extra || {}), status);

async function usuarioDe(email){
  const c = USUARIOS.get(email);
  if (c && Date.now() - c.ts < USUARIO_MS) return c.user;
  let user = null;
  try {
    const r = await fetch(FB_USUARIOS + encodeURIComponent(mailKey(email)) + '.json');
    user = r.ok ? await r.json() : null;
  } catch (e) { user = null; }
  if (user && typeof user === 'object') USUARIOS.set(email, { ts: Date.now(), user });
  return (user && typeof user === 'object') ? user : null;
}

/* ---------- cache ---------- */
function r2(env){ return env && (env.VENTAS_CACHE || env.LEGAJOS) || null; }
const claveR2 = ruta => R2_PREFIJO + ruta.replace(/^\/+/, '').replace(/[^a-zA-Z0-9-]+/g, '_') + '.json';
async function r2Leer(env, ruta){
  const b = r2(env); if (!b) return null;
  try { const o = await b.get(claveR2(ruta)); if (!o) return null; const e = await o.json(); return (e && e.ts && e.data) ? e : null; }
  catch (e) { return null; }
}
async function r2Escribir(env, ruta, ent){
  const b = r2(env); if (!b) return;
  try { await b.put(claveR2(ruta), JSON.stringify(ent), { httpMetadata: { contentType: 'application/json' } }); } catch (e) {}
}

function refrescar(env, ruta){
  if (VUELO.has(ruta)) return VUELO.get(ruta);
  const f = FALLOS.get(ruta);
  if (f && Date.now() - f.ts < FALLO_MS) { const x = new Error(f.msg); x.status = f.status; x.upstream = f.upstream; x.repetido = true; return Promise.reject(x); }
  const p = (async () => {
    const base = String(env.VENTAS_API_BASE || BASE_DEF).replace(/\/+$/, '');
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let r;
    try {
      r = await fetch(base + ruta, { headers: { Authorization: 'Bearer ' + env.VENTAS_API_KEY, Accept: 'application/json' }, signal: ctl.signal });
    } catch (e) {
      const x = new Error('La API de ventas no respondió a tiempo.'); x.status = 504; throw x;
    } finally { clearTimeout(t); }
    if (!r.ok) {
      let m = ''; try { m = String((await r.json()).error || ''); } catch (e) {}
      const x = new Error(m || ('La API de ventas respondió ' + r.status + '.'));
      x.status = (r.status === 400 || r.status === 404) ? r.status : 502; x.upstream = r.status; throw x;
    }
    const data = await r.json();
    FALLOS.delete(ruta);
    const ent = { ts: Date.now(), data };
    MEM.set(ruta, ent);
    await r2Escribir(env, ruta, ent);
    return ent;
  })().catch(e => { FALLOS.set(ruta, { ts: Date.now(), status: e.status || 502, upstream: e.upstream, msg: e.message }); throw e; })
    .finally(() => VUELO.delete(ruta));
  VUELO.set(ruta, p);
  return p;
}

/** Devuelve {data, estado, ts}: fresco (cache < 5 min), viejo (cache servido mientras
 *  se refresca de fondo) o api (se esperó a la API). Tira con .status si no hay nada. */
export async function obtener(env, ctx, ruta){
  const ahora = Date.now();
  let ent = MEM.get(ruta);
  if (!ent) { ent = await r2Leer(env, ruta); if (ent) MEM.set(ruta, ent); }
  if (ent && ahora - ent.ts < FRESCO_MS) return { data: ent.data, estado: 'fresco', ts: ent.ts };
  const p = refrescar(env, ruta);
  if (ent && ahora - ent.ts < VIEJO_MS) {
    const bg = p.catch(() => {});
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(bg);
    return { data: ent.data, estado: 'viejo', ts: ent.ts };
  }
  const nuevo = await p;
  return { data: nuevo.data, estado: 'api', ts: nuevo.ts };
}

/* ---------- la Function ---------- */
export async function manejar(request, env, ctx){
  if (request.method !== 'GET') return err('Solo GET.', 405);
  const url = new URL(request.url);
  const semana = url.searchParams.get('semana') || '';
  const slug = url.searchParams.get('sucursal') || '';
  if (!semana) return json({ disponible: disponible(env) });
  if (!disponible(env)) return err('La API de ventas no está configurada en el servidor (falta VENTAS_API_KEY).', 503);
  if (!esLunes(semana)) return err('La semana tiene que ser el lunes en formato YYYY-MM-DD.', 400);
  if (slug && !RX_SLUG.test(slug)) return err('Sucursal inválida.', 400);

  const email = String(request.headers.get('X-Mateu-Email') || '').toLowerCase().trim();
  if (!email) return err('Falta la identidad de la sesión.', 401);
  const user = await usuarioDe(email);
  if (!user) return err('La cuenta no existe.', 401);
  if (accesoDisponible(env)) {
    const tk = await leerToken(env, request.headers.get('X-Mateu-Tok') || '').catch(() => null);
    if (!tk || String(tk.e || '').toLowerCase() !== email) return err('La sesión es anterior al control de ingreso: salí del Portal y volvé a entrar.', 401, { reingresar: true });
  }
  let propio = null;
  if (ROLES_TODO.indexOf(user.rol) >= 0) propio = null;
  else if (ROLES_PROPIO.indexOf(user.rol) >= 0) {
    propio = String(user.sucursal || user.outlet_id || '');
    if (!propio) return err('La cuenta no tiene sucursal asignada.', 403);
    if (slug && slug !== propio) return err('Esta cuenta solo puede ver la venta de su sucursal.', 403);
  } else return err('Este rol no tiene acceso a la venta.', 403);

  const ruta = slug ? '/v1/ventas/semana/' + semana + '/sucursal/' + slug : '/v1/ventas/semana/' + semana;
  let res;
  try { res = await obtener(env, ctx, ruta); }
  catch (e) { return err(e.message || 'No se pudo consultar la API de ventas.', e.status || 502, e.upstream ? { upstream: e.upstream } : null); }
  let salida = res.data;
  if (!slug && propio && salida && salida.sucursales && typeof salida.sucursales === 'object') {
    const s = {}; if (salida.sucursales[propio]) s[propio] = salida.sucursales[propio];
    salida = Object.assign({}, salida, { sucursales: s });
  }
  return json(salida, 200, { 'X-Ventas-Cache': res.estado, 'X-Ventas-Ts': new Date(res.ts).toISOString(), 'Cache-Control': 'private, max-age=60' });
}
