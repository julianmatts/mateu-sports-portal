/* Tests de la carga de venta por vendedor (Indicadores de Sucursal).
   Correr con:  node --test lib/venta-exacta.test.js

   Igual que reparto.test.js, las funciones se extraen del propio
   indicadores/index.html para probar el código real y no una copia.

   Lo que se exige (pedido de Juli 17/09/2026): la venta que carga la sucursal
   tiene que dar EXACTO lo que muestra el sistema.
   - la suma del local = la suma de la columna Importe del export, sin descartar
     ninguna línea (conceptos, cupones, llaveros, redondeo, rubro Otros)
   - cada línea va al vendedor que la hizo, no al de la línea más grande del ticket
   - los tickets del local son comprobantes distintos, aunque un ticket tenga
     líneas de dos vendedores
*/
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'indicadores', 'index.html'), 'utf8');

function fnSrc(name){
  const i = src.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'no encontré function ' + name + ' en indicadores/index.html');
  const b = src.indexOf('{', i);
  let depth = 1, j = b + 1;
  while (depth > 0 && j < src.length){
    const c = src[j];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    j++;
  }
  return src.slice(i, j);
}
function lineaSrc(re, que){
  const m = src.match(re);
  assert.ok(m, 'no encontré ' + que);
  return m[0];
}

const codigo = [
  lineaSrc(/const VE_EXACTO = \w+;/, 'VE_EXACTO'),
  lineaSrc(/const VE_DOW = \[[^\]]*\];/, 'VE_DOW'),
  lineaSrc(/const VE_MESES = \[[^\]]*\];/, 'VE_MESES'),
  lineaSrc(/const VE_DOW_SET = \{[^}]*\};/, 'VE_DOW_SET'),
  lineaSrc(/const VE_DOW_ALIAS=\{[\s\S]*?\};/, 'VE_DOW_ALIAS'),
  lineaSrc(/const veDow = .+/, 'veDow'),
  lineaSrc(/const veStr = [^;]+;/, 'veStr'),
  lineaSrc(/const ECOM = [^;]+;/, 'ECOM'),
  // el mapa NN→slug se arma desde SLUG_SUC/OUTLET_SUC: acá se fija a mano
  "const VE_PFX_SLUG = {'10':'diagonal','99':'ecommerce'};",
  fnSrc('veNum'), fnSrc('veNormU'), fnSrc('veFechaISO'), fnSrc('veSumarDias'),
  fnSrc('veCriterioLinea'), fnSrc('veDetectarColumnas'), fnSrc('veParseDetallado'),
  fnSrc('veAgregarSemana'),
].join('\n');
const V = new Function(codigo +
  '\nreturn {veParseDetallado, veAgregarSemana, veCriterioLinea, VE_EXACTO};')();

/* Export de prueba con el formato del sistema. Semana del lunes 2026-09-07.
   FcB.0001-001 lo empezó ANA (zapatillas, 120.000) y lo cerró BETO (medias, 8.000):
   un solo ticket con líneas de los dos.
   Además: un cupón, un redondeo y una línea del rubro Otros, que el criterio viejo
   descartaba. */
const ENCABEZADO = ['Sucursal','Dia semana','Dia','Vendedor','Nro.comprobante','Articulo','Rubro','Cantidad','Importe'];
const FILAS = [
  ['10-MS Diagonal 80','Lu',7,'ANA','FcB.0001-001','ZAPATILLA RUN','01-CALZADO',1,120000],
  ['10-MS Diagonal 80','Lu',7,'BETO','FcB.0001-001','MEDIA X3','03-ACCESORIOS',1,8000],
  ['10-MS Diagonal 80','Lu',7,'ANA','FcB.0001-002','CAMPERA','02-INDUMENTARIA',1,90000],
  ['10-MS Diagonal 80','Ma',8,'BETO','FcB.0001-003','GORRA','03-ACCESORIOS',1,15000],
  ['10-MS Diagonal 80','Ma',8,'BETO','FcB.0001-003','INGRESO CUPON','05-CONCEPTOS',0,-5000],
  ['10-MS Diagonal 80','Ma',8,'BETO','FcB.0001-003','REDONDEO','01-VARIOS',0,-13],
  ['10-MS Diagonal 80','Ma',8,'ANA','FcB.0001-004','BOLSA','09-OTROS',1,500],
];
const MATRIZ = [ENCABEZADO].concat(FILAS);
const SEM = '2026-09-07';
const SUMA_IMPORTE = FILAS.reduce((a, f) => a + f[8], 0);   // 228.487
const SUMA_CANT = FILAS.reduce((a, f) => a + f[7], 0);      // 6

function agregar(){
  const res = V.veParseDetallado(MATRIZ);
  assert.ok(res, 'no se reconoció el export de prueba');
  const agg = V.veAgregarSemana(res, SEM);
  const suc = agg.porSlug['diagonal'];
  assert.ok(suc, 'no salió la sucursal diagonal');
  const de = n => suc.vendedores.find(v => v.nombre === n) || {venta:0,tickets:0,unidades:0};
  return {res, agg, suc, de};
}

test('el total del local es la suma exacta de la columna Importe', () => {
  const {suc} = agregar();
  assert.equal(suc.total.venta, SUMA_IMPORTE);
  assert.equal(suc.total.unidades, SUMA_CANT);
});

test('ninguna línea se descarta: cupón, redondeo y rubro Otros suman', () => {
  assert.deepEqual(V.veCriterioLinea('05-CONCEPTOS', 'INGRESO CUPON'), [true, true]);
  assert.deepEqual(V.veCriterioLinea('01-VARIOS', 'REDONDEO'), [true, true]);
  assert.deepEqual(V.veCriterioLinea('09-OTROS', 'BOLSA'), [true, true]);
  const {de} = agregar();
  // BETO: gorra 15.000 − cupón 5.000 − redondeo 13 + media 8.000 = 17.987
  assert.equal(de('BETO').venta, 17987);
  // ANA: 120.000 + 90.000 + bolsa 500 = 210.500
  assert.equal(de('ANA').venta, 210500);
});

test('cada línea va a su vendedor, no al de la línea más grande del ticket', () => {
  const {de, suc} = agregar();
  // el ticket compartido: ANA se queda con sus 120.000 y BETO con sus 8.000.
  // Con el criterio viejo el comprobante entero (128.000 y 2 unidades) iba a ANA.
  assert.equal(de('ANA').unidades, 3);
  assert.equal(de('BETO').unidades, 2);
  // y nada se duplica: los vendedores suman el total del local
  assert.equal(de('ANA').venta + de('BETO').venta, suc.total.venta);
  assert.equal(de('ANA').unidades + de('BETO').unidades, suc.total.unidades);
});

test('los tickets del local son comprobantes distintos', () => {
  const {suc, de} = agregar();
  // 4 comprobantes en el archivo; el compartido le cuenta a los dos vendedores
  assert.equal(suc.total.tickets, 4);
  assert.equal(de('ANA').tickets, 3);
  assert.equal(de('BETO').tickets, 2);
});

test('el día a día de cada vendedor sigue la línea, no el ticket', () => {
  const {de} = agregar();
  const dia = (n, d) => (de(n).dias.find(x => x.d === d) || {v:0}).v;
  assert.equal(dia('ANA', 'Lu'), 210000);
  assert.equal(dia('BETO', 'Lu'), 8000);
  assert.equal(dia('BETO', 'Ma'), 9987);
  assert.equal(dia('ANA', 'Ma'), 500);
});

test('el mix por rubro se arma con las líneas del vendedor', () => {
  const {de} = agregar();
  assert.equal(de('ANA').rubros.CALZADO, 120000);
  assert.equal(de('ANA').rubros.INDUMENTARIA, 90000);
  assert.equal(de('BETO').rubros.ACCESORIOS, 23000);
  assert.ok(!de('BETO').rubros.CALZADO, 'BETO no vendió calzado');
});

test('los comprobantes de otra semana no entran', () => {
  const res = V.veParseDetallado(MATRIZ);
  const agg = V.veAgregarSemana(res, '2026-09-14');
  assert.equal(agg.nIn, 0);
  assert.equal(Object.keys(agg.porSlug).length, 0);
});
