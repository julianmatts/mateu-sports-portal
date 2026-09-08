/* Tests del parser de logística: node --test lib/logistica-parse.test.js
   Fixtures chicos con el formato real de los exports del sistema (pivot por mes),
   incluida una copia con las columnas de texto en otro orden. */
const test = require('node:test');
const assert = require('node:assert/strict');
const LP = require('./logistica-parse.js');

// «Estad transferencias»: origen · rubro · subrubro · marca · proveedor · disciplina · tipo · campaña · línea · código · artículo · id · destino · meses 1..3
const TRANSF = [
  ';;;;;;;;;;;;;1;2;3',
  '05-Depósito;02-CALZADO;02-HOMBRE;Adidas;ADIDAS ARGENTINA S.A.;ADVENTURE;CALZADO ADULTO;*** NO TIENE ***;ADIDAS EXCLUSIVOS;ADIJI0958;TERREX TRACEFINDER AZL/GRS;231448;09-Adidas Av. 7;0.00;15.00;6.00',
  '05-Depósito;02-CALZADO;02-HOMBRE;Adidas;ADIDAS ARGENTINA S.A.;ADVENTURE;CALZADO ADULTO;*** NO TIENE ***;ADIDAS EXCLUSIVOS;ADIJI0958;TERREX TRACEFINDER AZL/GRS;231448;21-Adidas Calle 12;0.00;14.00;1.00',
  '05-Depósito;02-CALZADO;02-HOMBRE;Adidas;ADIDAS ARGENTINA S.A.;ADVENTURE;CALZADO ADULTO;*** NO TIENE ***;ADIDAS EXCLUSIVOS;ADIJI0958;TERREX TRACEFINDER AZL/GRS;231448;Total;0.00;29.00;7.00',
  '05-Depósito;03-INDUMENTARIA;03-DAMA;Nike;NIKE ARGENTINA;TRAINING;REMERAS;*** NO TIENE ***;;NIKDX0687010;REMERA DF WNS NEGRO;229001;12-MS Calle 12;3.00;0.00;0.00',
  '05-Depósito;03-INDUMENTARIA;03-DAMA;Nike;NIKE ARGENTINA;TRAINING;REMERAS;*** NO TIENE ***;;NIKDX0687010;REMERA DF WNS NEGRO;229001;Total;3.00;0.00;0.00',
  '05-Depósito;04-ACCESORIOS;VARIOS;Puma;DISTRINANDO S A;CASUAL;MEDIAS;PROMO MEDIAS;;PUM09240101;MEDIA CREW X3 BLANCO;234186;12-MS Calle 12;0.00;0.00;24.00',
  '05-Depósito;04-ACCESORIOS;VARIOS;Puma;DISTRINANDO S A;CASUAL;MEDIAS;PROMO MEDIAS;;PUM09240101;MEDIA CREW X3 BLANCO;234186;Total;0.00;0.00;24.00',
].join('\r\n');

// «Estad remitos»: marca · rubro · subrubro · disciplina · remito · tipo · campaña · línea · artículo · código · id · (cant,costo)×3 · Total
const REMITOS = [
  ';;;;;;;;;;;1;1;2;2;3;3;Total;Total',
  ';;;;;;;;;;;Cant.recibido;Costo;Cant.recibido;Costo;Cant.recibido;Costo;Cant.recibido;Costo',
  '47 STREET;02-CALZADO;03-DAMA;CALZADO VERANO;0005-00045898;SANDALIAS;*** NO TIENE ***;;SANDALIA SWAY WNS BLANCO;47S2621470410106;230409;0.00;0.00;50.00;1075241.48;0.00;0.00;50.00;1075241.48',
  'Adidas;02-CALZADO;02-HOMBRE;ADVENTURE;0005-00045900;CALZADO ADULTO;*** NO TIENE ***;ADIDAS EXCLUSIVOS;TERREX TRACEFINDER AZL/GRS;ADIJI0958;231448;20.00;800000.00;0.00;0.00;10.00;400000.00;30.00;1200000.00',
  'Adidas;02-CALZADO;02-HOMBRE;ADVENTURE;0005-00046001;CALZADO ADULTO;*** NO TIENE ***;ADIDAS EXCLUSIVOS;TERREX TRACEFINDER AZL/GRS;ADIJI0958;231448;5.00;200000.00;0.00;0.00;0.00;0.00;5.00;200000.00',
].join('\r\n');

function desordenar(csv, orden) {
  return csv.split(/\r?\n/).map(l => { const c = l.split(';'); return orden.map(i => c[i]).concat(c.slice(orden.length)).join(';'); }).join('\r\n');
}

test('transferencias: detecta el pivot, infiere las columnas y suma por artículo × sucursal × mes', () => {
  const m = LP.csvAMatriz(TRANSF);
  const det = LP.detectarPivot(m);
  assert.ok(det && det.pivot && !det.esRemito);
  assert.deepEqual(det.meses.map(x => x.mes), [1, 2, 3]);
  const { map } = LP.inferirColumnas(m, det);
  assert.deepEqual(map, { rubro: 1, sub: 2, disc: 5, tipo: 6, id: 11, cod: 9, suc: 12, art: 10, marca: 3 });
  const p = LP.parsearPivot(m, 2026, det, map);
  assert.equal(p.tipo, 'envios');
  assert.equal(p.desc, 3, 'las filas Total se descartan');
  assert.equal(Object.keys(p.arts).length, 3);
  assert.deepEqual(p.arts.ADIJI0958, ['CALZADO', '02-HOMBRE', 'ADVENTURE', 'Adidas', '231448', 'TERREX TRACEFINDER AZL/GRS', 'CALZADO ADULTO', 'ADIJI0958']);
  assert.deepEqual(Object.keys(p.porMes).sort(), ['2026-01', '2026-02', '2026-03']);
  assert.equal(LP.unidadesDe(p.porMes['2026-02']), 29);
  assert.equal(LP.unidadesDe(p.porMes['2026-03']), 7 + 24);
  assert.deepEqual(LP.filasMes('envios', p.porMes['2026-01']), [['NIKDX0687010', '12-MS Calle 12', 3]]);
});

test('transferencias con las columnas de texto en otro orden: mismo resultado', () => {
  const orden = [12, 10, 9, 11, 3, 5, 1, 2, 6, 0, 4, 7, 8];
  const m = LP.csvAMatriz(desordenar(TRANSF, orden));
  const det = LP.detectarPivot(m);
  const { map } = LP.inferirColumnas(m, det);
  assert.deepEqual(map, { rubro: 6, sub: 7, disc: 5, tipo: 8, id: 3, cod: 2, suc: 0, art: 1, marca: 4 });
  const p = LP.parsearPivot(m, 2026, det, map);
  const ref = LP.parsearPivot(LP.csvAMatriz(TRANSF), 2026, LP.detectarPivot(LP.csvAMatriz(TRANSF)), { rubro: 1, sub: 2, disc: 5, tipo: 6, id: 11, cod: 9, suc: 12, art: 10, marca: 3 });
  assert.deepEqual(p.arts, ref.arts);
  assert.deepEqual([...p.porMes['2026-02'].values()], [...ref.porMes['2026-02'].values()]);
});

test('remitos: segunda fila de encabezado, cantidad + costo por mes, varios remitos del mismo artículo se suman', () => {
  const m = LP.csvAMatriz(REMITOS);
  const det = LP.detectarPivot(m);
  assert.ok(det.esRemito);
  assert.deepEqual(det.meses.map(x => x.i), [11, 13, 15], 'toma la columna Cant. de cada mes (el costo va al lado)');
  const { map } = LP.inferirColumnas(m, det);
  assert.deepEqual(map, { rubro: 1, sub: 2, disc: 3, tipo: 5, id: 10, cod: 9, art: 8, marca: 0 });
  const p = LP.parsearPivot(m, 2026, det, map);
  assert.equal(p.tipo, 'ingresos');
  const ene = LP.filasMes('ingresos', p.porMes['2026-01']);
  assert.deepEqual(ene, [['ADIJI0958', 25, 1000000]]);
  assert.deepEqual(LP.filasMes('ingresos', p.porMes['2026-02']), [['47S2621470410106', 50, 1075241]]);
  assert.equal(p.arts['47S2621470410106'][3], '47 STREET');
});

test('mapa corregido a mano: manda sobre lo inferido', () => {
  const m = LP.csvAMatriz(TRANSF);
  const det = LP.detectarPivot(m);
  const p = LP.parsearPivot(m, 2026, det, { cod: 9, art: 10, suc: 12, marca: 4 /* proveedor como marca, a propósito */ });
  assert.equal(p.arts.ADIJI0958[3], 'ADIDAS ARGENTINA S.A.');
  assert.equal(p.arts.ADIJI0958[0], '', 'sin columna de rubro queda vacío');
});

test('formato por nombre de columna (una fila por movimiento)', () => {
  const m = LP.csvAMatriz([
    'SUCURSAL;MES;RUBRO;SUBRUBRO;DISCIPLINA;MARCA;CODIGO DE BARRAS;ID ITEM;ARTICULO;CANTIDAD',
    '12-MS Calle 12;6;CALZADO;02-HOMBRE;RUNNING;Nike;NIKFD6034001;225905;QUEST 6 NEGRO;4',
    '12-MS Calle 12;Julio;CALZADO;02-HOMBRE;RUNNING;Nike;NIKFD6034001;225905;QUEST 6 NEGRO;2',
    'Total;0;;;;;;;;6',
  ].join('\n'));
  assert.equal(LP.detectarPivot(m), null);
  const det = LP.detectarPorNombre(m);
  assert.ok(det && !det.tipoIng);
  const p = LP.parsearPorNombre(m, 2026, det, det.map, 'hoja');
  assert.deepEqual(Object.keys(p.porMes).sort(), ['2026-06', '2026-07']);
  assert.equal(p.desc, 1);
  assert.equal(LP.unidadesDe(p.porMes['2026-07']), 2);
});

test('ymDeCelda: número, nombre, YYYY-MM, MM/YYYY y fecha', () => {
  assert.equal(LP.ymDeCelda(6, 2026), '2026-06');
  assert.equal(LP.ymDeCelda('Septiembre', 2026), '2026-09');
  assert.equal(LP.ymDeCelda('sep 25', 2026), '2025-09');
  assert.equal(LP.ymDeCelda('2026-03', 2026), '2026-03');
  assert.equal(LP.ymDeCelda('03/2026', 2026), '2026-03');
  assert.equal(LP.ymDeCelda('15/08/2026', 2026), '2026-08');
  assert.equal(LP.ymDeCelda('x', 2026), null);
});

test('resumenPorSucursal agrupa por slug con rubros, marcas y top', () => {
  const m = LP.csvAMatriz(TRANSF);
  const det = LP.detectarPivot(m);
  const p = LP.parsearPivot(m, 2026, det, LP.inferirColumnas(m, det).map);
  const slugDe = n => ({ '12-MS Calle 12': 'calle-12', '09-Adidas Av. 7': 'adidas', '21-Adidas Calle 12': 'adidas-12' })[n] || null;
  const r = LP.resumenPorSucursal(p.porMes['2026-03'], p.arts, slugDe);
  assert.deepEqual(Object.keys(r).sort(), ['adidas', 'adidas-12', 'calle-12']);
  assert.equal(r['calle-12'].u, 24);
  assert.deepEqual(r['calle-12'].rubros, { ACCESORIOS: 24 });
  assert.equal(r.adidas.top[0][0], 'TERREX TRACEFINDER AZL/GRS');
});
