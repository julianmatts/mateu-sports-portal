#!/usr/bin/env node
/* ============================================================================
   ventas-api-lineas.mjs · baja las líneas crudas de la API de ventas del sistema
   (GET /v1/ventas/lineas) y las convierte en lo que hoy sale de exports a mano.

   Uso (la key NUNCA va en el repo: se pasa por variable de entorno):
     VENTAS_API_KEY=<key> node scripts/ventas-api-lineas.mjs csv   2026-09-01 2026-09-30 "salida.csv"
     VENTAS_API_KEY=<key> node scripts/ventas-api-lineas.mjs pesos 2026-09 [--publicar]

   csv   → escribe el MISMO archivo que el export «Estadística de venta» del
           sistema (el «Ventas agosto portal.csv» del ETL): `;`, latin1, una fila
           de cabecera «;;;;;;;;Cantidad;Importe» y una fila por línea:
           Sucursal;Lu;Día;Vendedor;Hora;Nro.comprobante;Artículo;Rubro;Cantidad;Importe.
           Sirve tal cual para scripts/etl_indicadores.py (csv=True) y para
           «⇧ Cargar venta del mes» de Indicadores. ⚠ Mientras la API no aplique
           el descuento de cabecera del comprobante, el importe sale 1–3 % arriba
           del sistema: no usarlo para un cierre mensual oficial.
   pesos → la matriz de pesos por turno × día que Objetivos publica en
           objetivos/pesosTurnos (misma forma que «Pesos por turno» del módulo:
           porSlug[slug] = {t1:[Lu..Do], t2:[…], t3:[…]} en % de la semana;
           T1 = 9–12 · T2 = 13–16 · T3 = 17–20). Reemplaza el Excel «PESOS TURNOS».
           Con --publicar hace PUT a recepciones-mateu/objetivos/pesosTurnos;
           sin él imprime el JSON.

   Paginado con cursor y reintentos (la base del sistema se bloquea ~20 s cada
   30 s). Sin npm: solo fetch y fs de node ≥ 18.
   ========================================================================== */
import fs from 'node:fs';

const BASE = process.env.VENTAS_API_BASE || 'https://66-97-37-173.sslip.io';
const KEY = process.env.VENTAS_API_KEY;
const FB_OBJ = 'https://recepciones-mateu-default-rtdb.firebaseio.com/objetivos/pesosTurnos.json';
const SUC = { '01': '01-MS Plaza Italia', '02': '02-Mateu Kids', '03': '03-Outlet Calle 55', '04': '04-Aurelius Calle 12',
  '06': '06-MS City Bell', '07': '07-Aurelius Calle 10', '08': '08-MS Calle 47', '09': '09-Adidas Av. 7', '10': '10-MS Diagonal 80',
  '11': '11-MS Ensenada', '12': '12-MS Calle 12', '13': '13-MS Los Hornos', '14': '14-Outlet Gonnet', '15': '15-Adidas Originals',
  '16': '16-MS Berisso', '17': '17-Aurelius City Bell', '18': '18-Aurelius Calle 5', '19': '19-MS Calle 49', '20': '20-Outlet Av. 44',
  '21': '21-Adidas Calle 12', '99': '99-Ecommerce' };
const SLUG = { '01': 'plaza', '02': 'kids', '03': 'calle-55', '04': 'aurelius-12', '06': 'city-bell', '07': 'aurelius-10', '08': 'calle-47',
  '09': 'adidas', '10': 'diagonal', '11': 'ensenada', '12': 'calle-12', '13': 'los-hornos', '14': 'gonnet', '15': 'originals', '16': 'berisso',
  '17': 'aurelius-cb', '18': 'aurelius-5', '19': 'calle-49', '20': 'av-44', '21': 'adidas-12', '99': 'ecommerce' };
const DOW = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

if (!KEY) { console.error('Falta VENTAS_API_KEY (la key de la API, por variable de entorno).'); process.exit(1); }
const [, , modo, a1, a2, a3] = process.argv;

async function pagina(url, intento = 0) {
  try {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + KEY }, signal: AbortSignal.timeout(90000) });
    if (r.ok) { const j = await r.json(); if (j && Array.isArray(j.lineas)) return j; }
    throw new Error('HTTP ' + r.status);
  } catch (e) {
    if (intento >= 6) throw e;
    process.stderr.write('  reintento ' + (intento + 1) + ' (' + (e.message || e) + ')\n');
    await new Promise(f => setTimeout(f, 4000));
    return pagina(url, intento + 1);
  }
}
async function lineas(desde, hasta, suc) {
  const out = []; let cursor = null, pag = 0;
  do {
    const u = BASE + '/v1/ventas/lineas?desde=' + desde + '&hasta=' + hasta + (suc ? '&sucursal=' + suc : '') + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
    const j = await pagina(u); out.push(...j.lineas); cursor = j.cursor || null; pag++;
    process.stderr.write('  página ' + pag + ': ' + out.length + ' líneas\n');
  } while (cursor);
  return out;
}
const dowDe = f => DOW[new Date(f + 'T00:00:00Z').getUTCDay()];
const num2 = v => (Math.round((+v || 0) * 100) / 100).toFixed(2);

async function modoCsv() {
  const [desde, hasta, salida] = [a1, a2, a3];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde || '') || !/^\d{4}-\d{2}-\d{2}$/.test(hasta || '') || !salida) { console.error('Uso: csv <desde> <hasta> <salida.csv>'); process.exit(1); }
  const L = await lineas(desde, hasta);
  const filas = [';;;;;;;;Cantidad;Importe'];
  let sinSuc = 0;
  for (const l of L) {
    const nombre = SUC[l.sucursal]; if (!nombre) { sinSuc++; continue; }
    const limpio = s => String(s == null ? '' : s).replace(/[;\r\n]/g, ' ');
    filas.push([nombre, dowDe(l.fecha), +l.fecha.slice(8, 10), limpio(l.vendedor), l.hora, limpio(l.comprobante), limpio(l.articulo), limpio(l.rubro), num2(l.cantidad), num2(l.importe)].join(';'));
  }
  fs.writeFileSync(salida, Buffer.from(filas.join('\r\n') + '\r\n', 'latin1'));
  const tot = L.reduce((a, l) => a + (+l.importe || 0), 0);
  console.log('OK ' + salida + ': ' + (filas.length - 1) + ' líneas, importe total ' + Math.round(tot).toLocaleString('es-AR') + (sinSuc ? ' · ' + sinSuc + ' líneas de sucursales sin nombre (depósito) descartadas' : ''));
}

const turno = h => (h >= 9 && h <= 12) ? 0 : (h >= 13 && h <= 16) ? 1 : (h >= 17 && h <= 20) ? 2 : -1;
async function modoPesos() {
  const ym = a1, publicar = process.argv.includes('--publicar');
  if (!/^\d{4}-\d{2}$/.test(ym || '')) { console.error('Uso: pesos YYYY-MM [--publicar]'); process.exit(1); }
  const y = +ym.slice(0, 4), m = +ym.slice(5, 7);
  const hasta = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const L = await lineas(ym + '-01', hasta);
  const acc = {};
  for (const l of L) {
    const slug = SLUG[l.sucursal]; const t = turno(+l.hora); if (!slug || t < 0) continue;
    const d = (new Date(l.fecha + 'T00:00:00Z').getUTCDay() + 6) % 7;   // Lu=0 … Do=6
    const mtx = acc[slug] = acc[slug] || [[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]];
    if (+l.importe > 0) mtx[t][d] += +l.importe;
  }
  const porSlug = {};
  for (const [slug, mtx] of Object.entries(acc)) {
    const tot = mtx.flat().reduce((a, x) => a + x, 0); if (!tot) continue;
    porSlug[slug] = { t1: mtx[0].map(v => Math.round(v / tot * 1000000) / 10000), t2: mtx[1].map(v => Math.round(v / tot * 1000000) / 10000), t3: mtx[2].map(v => Math.round(v / tot * 1000000) / 10000) };
  }
  const payload = { actualizado: new Date().toISOString(), fuente: 'api ' + ym, por: 'ventas-api-lineas', porSlug };
  console.log(Object.keys(porSlug).length + ' sucursales con matriz de pesos para ' + ym + ' (' + L.length + ' líneas).');
  if (!publicar) { console.log(JSON.stringify(payload, null, 1)); return; }
  const r = await fetch(FB_OBJ, { method: 'PUT', body: JSON.stringify(payload) });
  if (!r.ok) throw new Error('Firebase respondió ' + r.status);
  console.log('Publicado en objetivos/pesosTurnos ✓ (Indicadores ya la usa).');
}

(modo === 'csv' ? modoCsv() : modo === 'pesos' ? modoPesos() : Promise.reject(new Error('Modo: csv | pesos')))
  .catch(e => { console.error('ERROR: ' + (e.message || e)); process.exit(1); });
