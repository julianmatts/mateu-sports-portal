// node --test lib/ventas-proxy.test.mjs
// Prueba el proxy de la API de ventas con la API y Firebase simulados en memoria.
import test from 'node:test';
import assert from 'node:assert/strict';
import { manejar, obtener, esLunes, limpiarCache, olvidarFallos, FRESCO_MS, VIEJO_MS } from './ventas-proxy.mjs';

const KEY = 'clave-de-prueba';
const USUARIOS = {
  'julian@mateu,com,ar': { rol: 'admin', email: 'julian@mateu.com.ar' },
  'kids@mateu,com,ar': { rol: 'sucursal', sucursal: 'kids' },
  'gonnet@mateu,com,ar': { rol: 'outlet', outlet_id: 'gonnet' },
  'deposito@mateu,com,ar': { rol: 'deposito' },
};
const SEMANA = { semana: '2026-09-21', actualizado: '2026-09-24T19:00:00Z', sucursales: { kids: { venta: 10, tickets: 2, unidades: 3 }, plaza: { venta: 20, tickets: 4, unidades: 5 } } };
const KIDS = { semana: '2026-09-21', actualizado: '2026-09-24T19:00:00Z', vendedores: [{ nombre: 'A', venta: 10, tickets: 2, unidades: 3, dias: [{ d: 'Lu', v: 10 }] }], total: { venta: 10, tickets: 2, unidades: 3 } };

let llamadasApi = [], apiFalla = null, apiDemora = 0, ESPEJO = {}, FB_VE = {};
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url.includes('recepciones-mateu')) {
    const k = url.split('/ventaEquipo/')[1];
    if ((opt.method || 'GET') === 'PUT') { ESPEJO[k.replace(/\.json$/, '')] = JSON.parse(opt.body); return { ok: true, status: 200, json: async () => ({}) }; }
    const nodo = k.replace(/\/por\.json$/, ''); return { ok: true, status: 200, json: async () => (FB_VE[nodo] ? FB_VE[nodo].por : null) };
  }
  if (url.includes('discontinuos-mateu')) {
    const k = decodeURIComponent(url.split('/usuarios/')[1].split('.json')[0]);
    return { ok: true, status: 200, json: async () => USUARIOS[k] || null };
  }
  llamadasApi.push(url);
  assert.equal(opt.headers.Authorization, 'Bearer ' + KEY, 'la key va en el header Authorization');
  if (apiDemora) await new Promise(r => setTimeout(r, apiDemora));
  if (apiFalla) return { ok: false, status: apiFalla, json: async () => ({ error: 'falló ' + apiFalla }) };
  if (/\/sucursal\/kids$/.test(url)) return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(KIDS)) };
  if (/\/sucursal\//.test(url)) return { ok: false, status: 404, json: async () => ({ error: 'Sucursal desconocida' }) };
  return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(SEMANA)) };
};

function r2Falso(){
  const m = new Map();
  return { m, get: async k => m.has(k) ? { json: async () => JSON.parse(m.get(k)) } : null, put: async (k, v) => { m.set(k, v); } };
}
function envNuevo(extra){ return Object.assign({ VENTAS_API_KEY: KEY, LEGAJOS: r2Falso() }, extra || {}); }
function ctxNuevo(){ const c = { tareas: [] }; c.waitUntil = p => c.tareas.push(p); return c; }
async function pedir(env, qs, email, ctx){
  const h = {}; if (email) h['X-Mateu-Email'] = email;
  const r = await manejar(new Request('https://portal/api/ventas' + (qs ? '?' + qs : ''), { headers: h }), env, ctx || ctxNuevo());
  return { status: r.status, body: await r.json(), cache: r.headers.get('X-Ventas-Cache') };
}
test.beforeEach(() => { limpiarCache(); llamadasApi = []; apiFalla = null; apiDemora = 0; ESPEJO = {}; FB_VE = {}; });

test('esLunes acepta solo lunes ISO', () => {
  assert.equal(esLunes('2026-09-21'), true);
  assert.equal(esLunes('2026-09-22'), false);
  assert.equal(esLunes('21/09/2026'), false);
  assert.equal(esLunes('2026-02-30'), false);
});

test('sin la key: disponible false y 503 al pedir datos', async () => {
  assert.deepEqual((await pedir({}, '', null)).body, { disponible: false });
  assert.equal((await pedir({}, 'semana=2026-09-21', 'julian@mateu.com.ar')).status, 503);
});

test('con la key: disponible true; validaciones de semana, sucursal e identidad', async () => {
  const env = envNuevo();
  assert.deepEqual((await pedir(env, '', null)).body, { disponible: true });
  assert.equal((await pedir(env, 'semana=2026-09-22', 'julian@mateu.com.ar')).status, 400);
  assert.equal((await pedir(env, 'semana=2026-09-21&sucursal=Kids!', 'julian@mateu.com.ar')).status, 400);
  assert.equal((await pedir(env, 'semana=2026-09-21', null)).status, 401);
  assert.equal((await pedir(env, 'semana=2026-09-21', 'nadie@mateu.com.ar')).status, 401);
  assert.equal((await pedir(env, 'semana=2026-09-21', 'deposito@mateu.com.ar')).status, 403);
  assert.equal(llamadasApi.length, 0, 'nada llegó a la API');
});

test('admin ve los totales de todas y el detalle de cualquier sucursal', async () => {
  const env = envNuevo();
  const t = await pedir(env, 'semana=2026-09-21', 'julian@mateu.com.ar');
  assert.equal(t.status, 200); assert.deepEqual(Object.keys(t.body.sucursales).sort(), ['kids', 'plaza']); assert.equal(t.cache, 'api');
  const d = await pedir(env, 'semana=2026-09-21&sucursal=kids', 'julian@mateu.com.ar');
  assert.equal(d.status, 200); assert.equal(d.body.vendedores[0].nombre, 'A');
  const x = await pedir(env, 'semana=2026-09-21&sucursal=zzz', 'julian@mateu.com.ar');
  assert.equal(x.status, 404);
});

test('sucursal y outlet: solo lo propio; los totales llegan filtrados', async () => {
  const env = envNuevo();
  assert.equal((await pedir(env, 'semana=2026-09-21&sucursal=plaza', 'kids@mateu.com.ar')).status, 403);
  const ok = await pedir(env, 'semana=2026-09-21&sucursal=kids', 'kids@mateu.com.ar');
  assert.equal(ok.status, 200);
  const t = await pedir(env, 'semana=2026-09-21', 'kids@mateu.com.ar');
  assert.deepEqual(Object.keys(t.body.sucursales), ['kids']);
  const g = await pedir(env, 'semana=2026-09-21', 'gonnet@mateu.com.ar');
  assert.deepEqual(g.body.sucursales, {}, 'el outlet sin venta esa semana recibe el mapa vacío, no el de las demás');
});

test('cache fresco: dos pedidos, una sola consulta a la API; queda en R2', async () => {
  const env = envNuevo();
  await pedir(env, 'semana=2026-09-21', 'julian@mateu.com.ar');
  const r = await pedir(env, 'semana=2026-09-21', 'julian@mateu.com.ar');
  assert.equal(r.cache, 'fresco');
  assert.equal(llamadasApi.length, 1);
  assert.equal(env.LEGAJOS.m.size, 1);
  // otro isolate (memoria vacía) lo encuentra en R2 sin ir a la API
  limpiarCache();
  const r2 = await pedir(env, 'semana=2026-09-21', 'julian@mateu.com.ar');
  assert.equal(r2.cache, 'fresco'); assert.equal(llamadasApi.length, 1);
});

test('cache viejo: se sirve al toque y se refresca de fondo; si la API falla, se sigue sirviendo', async () => {
  const env = envNuevo();
  await pedir(env, 'semana=2026-09-21', 'julian@mateu.com.ar');
  // envejecer la entrada guardada en R2 y en memoria
  limpiarCache();
  const k = [...env.LEGAJOS.m.keys()][0]; const e = JSON.parse(env.LEGAJOS.m.get(k)); e.ts = Date.now() - FRESCO_MS - 1000; env.LEGAJOS.m.set(k, JSON.stringify(e));
  apiFalla = 500;
  const ctx = ctxNuevo();
  const r = await pedir(env, 'semana=2026-09-21', 'julian@mateu.com.ar', ctx);
  assert.equal(r.status, 200); assert.equal(r.cache, 'viejo'); assert.equal(r.body.sucursales.kids.venta, 10);
  assert.equal(ctx.tareas.length, 1, 'el refresco corre con waitUntil');
  await Promise.all(ctx.tareas);
  assert.equal(llamadasApi.length, 2);
  // con la API sana (y pasado el minuto de memoria del fallo) el refresco de fondo actualiza el cache
  apiFalla = null; olvidarFallos();
  const r2 = await pedir(env, 'semana=2026-09-21', 'julian@mateu.com.ar', ctx);
  assert.equal(r2.cache, 'viejo'); await Promise.all(ctx.tareas);
  assert.equal((await pedir(env, 'semana=2026-09-21', 'julian@mateu.com.ar')).cache, 'fresco');
});

test('sin cache y API caída: 502 con el status de la API; más viejo que 24 h no se sirve', async () => {
  const env = envNuevo();
  apiFalla = 500;
  const r = await pedir(env, 'semana=2026-09-21', 'julian@mateu.com.ar');
  assert.equal(r.status, 502); assert.equal(r.body.upstream, 500);
  apiFalla = null; olvidarFallos();
  await pedir(env, 'semana=2026-09-21', 'julian@mateu.com.ar');
  limpiarCache();
  const k = [...env.LEGAJOS.m.keys()][0]; const e = JSON.parse(env.LEGAJOS.m.get(k)); e.ts = Date.now() - VIEJO_MS - 1000; env.LEGAJOS.m.set(k, JSON.stringify(e));
  apiFalla = 500;
  assert.equal((await pedir(env, 'semana=2026-09-21', 'julian@mateu.com.ar')).status, 502);
});

test('una sola consulta en vuelo por ruta aunque lleguen pedidos en paralelo', async () => {
  const env = envNuevo();
  apiDemora = 30;
  const rs = await Promise.all([1, 2, 3].map(() => obtener(env, ctxNuevo(), '/v1/ventas/semana/2026-09-21')));
  assert.equal(llamadasApi.length, 1);
  rs.forEach(r => assert.equal(r.data.sucursales.plaza.venta, 20));
});

test('con el ingreso por servidor activo, sin token válido no hay datos', async () => {
  const env = envNuevo({ SESSION_SECRET: 'secreto-largo-de-prueba', FIREBASE_SECRET: 'x' });
  const r = await pedir(env, 'semana=2026-09-21', 'julian@mateu.com.ar');
  assert.equal(r.status, 401); assert.equal(r.body.reingresar, true);
  assert.equal(llamadasApi.length, 0);
});

test('una ruta que falló no se vuelve a pedir a la API durante un rato', async () => {
  const env = envNuevo();
  apiFalla = 500;
  const a = await pedir(env, 'semana=2026-09-21&sucursal=kids', 'julian@mateu.com.ar');
  const b = await pedir(env, 'semana=2026-09-21&sucursal=kids', 'julian@mateu.com.ar');
  assert.equal(a.status, 502); assert.equal(b.status, 502); assert.equal(b.body.upstream, 500);
  assert.equal(llamadasApi.length, 1, 'el segundo pedido no llegó a la API');
  // otra ruta sí se consulta
  await pedir(env, 'semana=2026-09-21', 'julian@mateu.com.ar');
  assert.equal(llamadasApi.length, 2);
});

test('espejo: el detalle de una sucursal se copia a ventaEquipo salvo que lo haya cargado alguien a mano', async () => {
  const env = envNuevo();
  const ctx = ctxNuevo();
  await pedir(env, 'semana=2026-09-21&sucursal=kids', 'julian@mateu.com.ar', ctx);
  await Promise.all(ctx.tareas);
  assert.ok(ESPEJO['kids/2026-09-21'], 'se escribió ventaEquipo/kids/2026-09-21');
  assert.equal(ESPEJO['kids/2026-09-21'].por, 'api'); assert.equal(ESPEJO['kids/2026-09-21'].fuente, 'api');
  assert.equal(ESPEJO['kids/2026-09-21'].total.tickets, 2); assert.equal(ESPEJO['kids/2026-09-21'].vendedores[0].nombre, 'A');
  // los totales de la semana no se espejan
  await pedir(env, 'semana=2026-09-21', 'julian@mateu.com.ar', ctx); await Promise.all(ctx.tareas);
  assert.equal(Object.keys(ESPEJO).length, 1);
  // un nodo cargado a mano por el encargado no se pisa
  limpiarCache(); env.LEGAJOS.m.clear(); ESPEJO = {}; FB_VE['kids/2026-09-21'] = { por: 'kids@mateu.com.ar' };
  const c2 = ctxNuevo(); await pedir(env, 'semana=2026-09-21&sucursal=kids', 'julian@mateu.com.ar', c2); await Promise.all(c2.tareas);
  assert.equal(Object.keys(ESPEJO).length, 0);
  // uno que ya era del proxy sí se actualiza
  limpiarCache(); env.LEGAJOS.m.clear(); FB_VE['kids/2026-09-21'] = { por: 'api' };
  const c3 = ctxNuevo(); await pedir(env, 'semana=2026-09-21&sucursal=kids', 'julian@mateu.com.ar', c3); await Promise.all(c3.tareas);
  assert.ok(ESPEJO['kids/2026-09-21']);
  // apagado con VENTAS_ESPEJO=0
  limpiarCache(); ESPEJO = {}; FB_VE = {};
  const c4 = ctxNuevo(); await pedir(envNuevo({ VENTAS_ESPEJO: '0' }), 'semana=2026-09-21&sucursal=kids', 'julian@mateu.com.ar', c4); await Promise.all(c4.tareas);
  assert.equal(Object.keys(ESPEJO).length, 0);
});
