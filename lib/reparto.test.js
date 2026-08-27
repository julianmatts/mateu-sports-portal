/* Tests del reparto de la meta (Indicadores de Sucursal).
   Correr con:  node --test lib/reparto.test.js

   Las funciones NO viven acá: se extraen del propio indicadores/index.html
   (patrón de scripts/gen-modelos-oc.js) para que el test pruebe siempre el
   código real y no una copia que se desincroniza. Cubre la matemática que
   reparte la meta en plata entre las personas:
   - eqShares / eqSharesDia  (share semanal y por día de cada persona)
   - eqPesosDia              (peso de cada día en la semana)
   - pesosSinDomingo         (solo ecommerce y gonnet abren los domingos)
   - ritmoEsperado           (% esperado de la meta según días transcurridos)
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
function constSrc(name){
  const m = src.match(new RegExp('const ' + name + '\\s*=\\s*(\\[[^\\]]*\\])'));
  assert.ok(m, 'no encontré const ' + name);
  return 'const ' + name + '=' + m[1] + ';';
}

const codigo = [
  constSrc('EQ_DIAS'), constSrc('EQ_DOW'), constSrc('ABRE_DOMINGO'),
  fnSrc('eqSanea'), fnSrc('eqShares'), fnSrc('eqSharesDia'),
  fnSrc('eqPesosDia'), fnSrc('pesosSinDomingo'), fnSrc('ritmoEsperado'),
].join('\n');
const R = new Function(codigo +
  '\nreturn {eqSanea,eqShares,eqSharesDia,eqPesosDia,pesosSinDomingo,ritmoEsperado,EQ_DIAS,EQ_DOW};')();

// Matriz de pesos de prueba: suma 100. Día (Lu..Do): 10 · 10 · 10 · 10 · 16 · 44 · 0
const PESOS = {
  t1: [2, 2, 2, 2, 2, 10, 0],
  t2: [3, 3, 3, 3, 4, 14, 0],
  t3: [5, 5, 5, 5, 10, 20, 0],
};
// Equipo: A trabaja los tres turnos Lu–Sá; B solo el sábado a la tarde (T3, mismas horas que A)
const hDia = t => [ [4,3,4],[4,3,4],[4,3,4],[4,3,4],[4,3,4],[4,3,4],[0,0,0] ][t];
const EQUIPO = R.eqSanea([
  { nombre: 'A', h: [[4,3,4],[4,3,4],[4,3,4],[4,3,4],[4,3,4],[4,3,4],[0,0,0]] },
  { nombre: 'B', h: [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,4],[0,0,0]] },
]);

test('eqShares: cobertura completa y B se lleva la mitad del T3 del sábado', () => {
  const { shares, cobertura, totalPeso } = R.eqShares(EQUIPO, PESOS);
  assert.ok(Math.abs(totalPeso - 100) < 1e-9);
  assert.ok(Math.abs(cobertura - 100) < 1e-9, 'todos los turnos con peso tienen horas');
  // B: solo T3 del sábado (peso 20), mitad de las horas → 10% de la meta
  assert.ok(Math.abs(shares[1] - 0.10) < 1e-9, 'share de B = ' + shares[1]);
  // lo repartido suma la cobertura
  assert.ok(Math.abs(shares[0] + shares[1] - cobertura / 100) < 1e-9);
});

test('eqShares: un turno con peso y sin horas queda sin dueño (no se reparte)', () => {
  const soloManana = R.eqSanea([{ nombre: 'A', h: [[4,0,0],[4,0,0],[4,0,0],[4,0,0],[4,0,0],[4,0,0],[0,0,0]] }]);
  const { shares, cobertura, totalPeso } = R.eqShares(soloManana, PESOS);
  const pesoT1 = PESOS.t1.reduce((a, x) => a + x, 0);   // 20
  assert.ok(Math.abs(cobertura - pesoT1) < 1e-9);
  assert.ok(Math.abs(shares[0] - pesoT1 / 100) < 1e-9);
  assert.ok(cobertura < totalPeso);
});

test('eqSharesDia: la suma de los 7 días de una persona da su share semanal', () => {
  const { shares } = R.eqShares(EQUIPO, PESOS);
  const porDia = R.eqSharesDia(EQUIPO, PESOS);
  porDia.forEach((dias, i) => {
    const suma = dias.reduce((a, x) => a + x, 0);
    assert.ok(Math.abs(suma - shares[i]) < 1e-9, 'persona ' + i + ': ' + suma + ' vs ' + shares[i]);
  });
  // B solo tiene share el sábado
  assert.ok(porDia[1][5] > 0);
  assert.ok(porDia[1].filter((x, d) => d !== 5).every(x => x === 0));
});

test('eqPesosDia: fracción de la semana por día (suma 1) y null sin matriz', () => {
  const pd = R.eqPesosDia(PESOS);
  assert.ok(Math.abs(pd.reduce((a, x) => a + x, 0) - 1) < 1e-9);
  assert.ok(Math.abs(pd[5] - 0.44) < 1e-9, 'sábado 44%');
  assert.strictEqual(pd[6], 0);
  assert.strictEqual(R.eqPesosDia(null), null);
});

test('pesosSinDomingo: anula el domingo y renormaliza, salvo ecommerce/gonnet', () => {
  const conDom = { t1: [2,2,2,2,2,8,2], t2: [3,3,3,3,4,12,2], t3: [5,5,5,5,10,16,4] };  // domingo 8
  const ajustada = R.pesosSinDomingo('plaza', conDom);
  const dom = ['t1','t2','t3'].reduce((a, t) => a + ajustada[t][6], 0);
  assert.strictEqual(dom, 0, 'domingo en 0');
  const tot = ['t1','t2','t3'].reduce((a, t) => a + ajustada[t].reduce((x, y) => x + y, 0), 0);
  assert.ok(Math.abs(tot - 100) < 0.01, 'renormalizada a 100 (' + tot + ')');
  // gonnet y ecommerce conservan su domingo
  assert.strictEqual(R.pesosSinDomingo('gonnet', conDom), conDom);
  assert.strictEqual(R.pesosSinDomingo('ecommerce', conDom), conDom);
  // una matriz que ya viene sin domingo no se toca (mismo objeto)
  assert.strictEqual(R.pesosSinDomingo('plaza', PESOS), PESOS);
});

test('ritmoEsperado: % transcurrido según la curva; un día sin venta sale de la base', () => {
  // lunes y martes cargados → 20% de la semana
  const r1 = R.ritmoEsperado(PESOS, new Set(['lu', 'ma']));
  assert.ok(Math.abs(r1 - 0.20) < 1e-9);
  // feriado el martes (sin venta) dentro de lo transcurrido: su peso sale de la base
  const r2 = R.ritmoEsperado(PESOS, new Set(['lu', 'mi']));
  assert.ok(Math.abs(r2 - 20 / 90) < 1e-9, 'esperado 20/90, dio ' + r2);
  // semana completa (todos los días con peso cargados) → 1
  const r3 = R.ritmoEsperado(PESOS, new Set(['lu','ma','mi','ju','vi','sa']));
  assert.ok(Math.abs(r3 - 1) < 1e-9);
  assert.strictEqual(R.ritmoEsperado(PESOS, new Set()), null);
});
