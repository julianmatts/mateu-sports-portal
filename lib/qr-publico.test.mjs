// node --test lib/qr-publico.test.mjs — la lógica de la página pública de las etiquetas QR, con Firebase simulado
import test from 'node:test';
import assert from 'node:assert/strict';
import { crear, crearTope, slugDe, cmpTalle, parsearTalles, equivalencias, marcaDePrefijo, FB_UBIC, FB_REC, FB_USUARIOS, FB_MENSAJES } from './qr-publico.mjs';

function baseSimulada() {
  const escritos = [];
  const idx = {
    diagonal: { ts: 1758900000000, n: 2, a: { ADIJS2852: [5, '8.5:3,9:2,10:0', 'Est. 3 · Mód. 2', 233282, 'ZAPATILLA DURAMO SPEED M'], PUM31273108: [1, 'UNI:1', '', 1, 'PUMA REBOUND'] } },
    'calle-49': { ts: 1758800000000, n: 1, a: { ADIJS2852: [4, '7.5:2,10:2', 'Est. 1', 233282, 'ZAPATILLA DURAMO SPEED M'] } },
    'city-bell': { ts: 1758700000000, n: 1, a: { ADIJS2852: [2, '11:2', '', 233282, ''] } },
    berisso: { ts: 1758600000000, n: 1, a: { OTRO1: [1, '', '', 9, 'OTRO'] } }
  };
  const rutas = {
    // fila del catálogo = [código, artículo, marca, disciplina, rubro, género, tipo] (scripts/gen-asistente.js)
    [FB_REC + '/asistente/catalogo/porCod/ADIJS2852.json']: ['ADIJS2852', 'Zapatilla Duramo Speed M', 'ADIDAS', 'RUNNING', 'CALZADO', 'HOMBRE', 'CALZADO ADULTO'],
    [FB_REC + '/qr/config.json']: { global: { ecommerce: 'https://mateu.com.ar', promoTexto: '3 cuotas' }, sucursales: { diagonal: { resena: 'https://g.page/r/x', whatsapp: '2211234567' } } },
    [FB_USUARIOS]: { a: { email: 'diagonal@mateu.com.ar', rol: 'sucursal', sucursal: 'diagonal' }, b: { email: 'otra@mateu.com.ar', rol: 'sucursal', sucursal: 'plaza' }, c: { email: 'julian@mateu.com.ar', rol: 'admin' } },
    [FB_UBIC + '/ean/4066765123456.json']: { codigo: 'ADIJS2852', t: '8.5' }
  };
  const fetch = async (url, opts) => {
    if (opts && opts.method === 'POST') { escritos.push({ url, body: JSON.parse(opts.body) }); return { ok: true, json: async () => ({ name: 'id' + escritos.length }) }; }
    if (opts && opts.method === 'PATCH') { escritos.push({ url, body: JSON.parse(opts.body), patch: true }); return { ok: true, json: async () => ({}) }; }
    const m = url.match(/\/sucursales\/([^/]+)\/indice\.json$/);
    if (m) return { ok: true, json: async () => idx[m[1]] || null };
    return { ok: true, json: async () => (rutas[url] === undefined ? null : rutas[url]) };
  };
  return { fetch, escritos };
}

test('slugDe acepta slug o NN del sistema', () => {
  assert.equal(slugDe('10'), 'diagonal');
  assert.equal(slugDe('diagonal'), 'diagonal');
  assert.equal(slugDe('1'), 'plaza');
  assert.equal(slugDe('zzz'), '');
});

test('talles en orden humano y parseo con ceros', () => {
  assert.deepEqual(['M', '10', '8.5', 'UNI', 'S', '37/38'].sort(cmpTalle), ['8.5', '10', '37/38', 'S', 'M', 'UNI']);
  assert.deepEqual(parsearTalles('8.5:3,9:0'), [{ t: '8.5', c: 3 }, { t: '9', c: 0 }]);
  assert.deepEqual(parsearTalles(''), []);
});

test('equivalencias: Adidas rotula US y trae el AR de cada rótulo; marca sin tabla queda en AR', () => {
  const e = equivalencias('ADIDAS', 'HOMBRE');
  assert.equal(e.escala, 'US');
  assert.ok(e.ar['9'] > 40 && e.ar['9'] < 44);
  assert.equal(equivalencias('HEAD', '').escala, 'AR');
  assert.equal(marcaDePrefijo('PUM31273108'), 'PUMA');
});

test('articulo: producto del catálogo, talles de acá con tachados, otras sucursales por cercanía, sin ubicaciones', async () => {
  const B = baseSimulada();
  const C = crear({ fetch: B.fetch, now: () => 1758950000000 });
  const r = await C.articulo({ c: 'adijs2852', s: '10' });
  assert.equal(r.ok, true);
  assert.equal(r.articulo.descripcion, 'Zapatilla Duramo Speed M');
  assert.equal(r.articulo.marca, 'ADIDAS');
  assert.equal(r.sucursal.nombre, 'Diagonal 80');
  // curva = unión de todos los talles vistos; acá el 7.5 y el 11 no quedan (0), el 10 está en 0 en Diagonal
  assert.deepEqual(r.aca.talles.map(x => x.t + ':' + x.c), ['7.5:0', '8.5:3', '9:2', '10:0', '11:0']);
  assert.equal(r.aca.stock, 5);
  // otras: Calle 49 (misma zona centro) antes que City Bell; Berisso no lo tiene → no figura
  assert.deepEqual(r.otras.map(x => x.slug), ['calle-49', 'city-bell']);
  assert.deepEqual(r.otras[0].talles.map(x => x.t), ['7.5', '10']);
  assert.equal(r.escala, 'US');
  assert.equal(r.precio, null);
  assert.equal(r.config.resena, 'https://g.page/r/x');
  assert.equal(r.config.ecommerce, 'https://mateu.com.ar');
  assert.equal(JSON.stringify(r).indexOf('Est. 3'), -1, 'la ubicación del depósito no sale al cliente');
});

test('articulo: código que no existe en ningún lado → 404 amable; sucursal desconocida → 400', async () => {
  const B = baseSimulada();
  const C = crear({ fetch: B.fetch });
  const r = await C.articulo({ c: 'NOEXISTE1', s: 'diagonal' });
  assert.equal(r.status, 404);
  const r2 = await C.articulo({ c: 'ADIJS2852', s: '77' });
  assert.equal(r2.status, 400);
});

test('articulo: artículo sin catálogo pero con stock en el Buscador sale con la descripción del índice y la marca por prefijo', async () => {
  const B = baseSimulada();
  const C = crear({ fetch: B.fetch });
  const r = await C.articulo({ c: 'PUM31273108', s: 'diagonal' });
  assert.equal(r.ok, true);
  assert.equal(r.articulo.descripcion, 'PUMA REBOUND');
  assert.equal(r.articulo.marca, 'PUMA');
  assert.equal(r.escala, 'UK');
});

test('buscar: por texto, por código y por EAN (mapa compartido)', async () => {
  const B = baseSimulada();
  const C = crear({ fetch: B.fetch });
  const t = await C.buscar({ s: 'diagonal', q: 'duramo speed' });
  assert.equal(t.resultados.length, 1);
  assert.equal(t.resultados[0].codigo, 'ADIJS2852');
  assert.deepEqual(t.resultados[0].talles.map(x => x.t), ['8.5', '9']);   // sin los ceros
  const e = await C.buscar({ s: 'diagonal', q: '4066765123456' });
  assert.equal(e.porEan, 'ADIJS2852');
  assert.equal(e.resultados.length, 1);
  const nada = await C.buscar({ s: 'diagonal', q: 'zzzz' });
  assert.equal(nada.resultados.length, 0);
  const corto = await C.buscar({ s: 'diagonal', q: 'ab' });
  assert.equal(corto.status, 400);
});

test('aviso: valida el WhatsApp, guarda en qr/avisos/<slug> y manda un directo a las cuentas del local', async () => {
  const B = baseSimulada();
  const C = crear({ fetch: B.fetch, now: () => 1758950000000 });
  const mal = await C.aviso({ s: 'diagonal', c: 'ADIJS2852', talle: '10', tel: 'x' });
  assert.equal(mal.status, 400);
  const r = await C.aviso({ s: '10', c: 'adijs2852', talle: '10', tel: '221 555-1234', nombre: 'Ana <b>' });
  assert.equal(r.ok, true);
  const av = B.escritos.find(e => e.url === FB_REC + '/qr/avisos/diagonal.json');
  assert.ok(av);
  assert.equal(av.body.talle, '10');
  assert.equal(av.body.nombre, 'Ana b');
  assert.equal(av.body.estado, 'pendiente');
  const dm = B.escritos.filter(e => e.url.startsWith(FB_MENSAJES + '/directos/'));
  assert.equal(dm.length, 1, 'un directo por cuenta de la sucursal, y solo a Diagonal');
  assert.ok(dm[0].url.indexOf('diagonal@mateu,com,ar') >= 0);
  assert.ok(dm[0].body.texto.indexOf('talle 10') >= 0);
  assert.equal(r.avisados, 1);
});

test('pedido: guarda en qr/pedidos/<slug> con la sucursal de origen', async () => {
  const B = baseSimulada();
  const C = crear({ fetch: B.fetch });
  const r = await C.pedido({ s: 'diagonal', desde: 'calle-49', c: 'ADIJS2852', talle: '7.5', tel: '2215551234' });
  assert.equal(r.ok, true);
  const p = B.escritos.find(e => e.url === FB_REC + '/qr/pedidos/diagonal.json');
  assert.equal(p.body.desde, 'calle-49');
});

test('escaneo: se registra por sucursal y mes', async () => {
  const B = baseSimulada();
  const C = crear({ fetch: B.fetch, now: () => Date.UTC(2026, 8, 26, 15) });
  await C.escaneo('diagonal', 'ADIJS2852', 'Mozilla/5.0 (iPhone)');
  const s = B.escritos.find(e => e.url.indexOf('/qr/scans/diagonal/2026-09.json') >= 0);
  assert.ok(s);
  assert.equal(s.body.m, 1);
});

test('el índice se cachea: dos consultas seguidas bajan cada sucursal una sola vez', async () => {
  const B = baseSimulada();
  let n = 0;
  const f = async (u, o) => { if (/indice\.json$/.test(u)) n++; return B.fetch(u, o); };
  const C = crear({ fetch: f, now: () => 1758950000000 });
  await C.articulo({ c: 'ADIJS2852', s: 'diagonal' });
  const antes = n;
  await C.articulo({ c: 'ADIJS2852', s: 'calle-49' });
  assert.equal(n, antes);
});

test('crearTope: deja pasar hasta el máximo por ventana y después corta', () => {
  let t = 0;
  const tope = crearTope(3, 1000, () => t);
  assert.equal(tope('a'), true); assert.equal(tope('a'), true); assert.equal(tope('a'), true);
  assert.equal(tope('a'), false);
  assert.equal(tope('b'), true);
  t = 2000;
  assert.equal(tope('a'), true);
});
