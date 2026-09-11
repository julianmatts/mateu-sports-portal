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
   - eqRitmoPersona          (ritmo de cada vendedor y lo que le falta por día para meta y ★ 120%)
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
  // eqSanea completa el id desde el padrón (shared/equipo.js): acá no hay padrón
  'const eqPersona=()=>null;',
  constSrc('EQ_DIAS'), constSrc('EQ_DOW'), constSrc('ABRE_DOMINGO'),
  fnSrc('eqSanea'), fnSrc('eqShares'), fnSrc('eqSharesDia'),
  fnSrc('eqPesosDia'), fnSrc('pesosSinDomingo'), fnSrc('ritmoEsperado'),
  fnSrc('eqRitmoPersona'),
].join('\n');
const R = new Function(codigo +
  '\nreturn {eqSanea,eqShares,eqSharesDia,eqPesosDia,pesosSinDomingo,ritmoEsperado,eqRitmoPersona,EQ_DIAS,EQ_DOW};')();

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

// Objetivo diario de un vendedor (meta semanal 1.000): Lu–Ju 100 · Vi 200 · Sá 400 · Do 0
const OBJ_DIAS = [100, 100, 100, 100, 200, 400, 0];
const cerca = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, (msg || '') + ' esperado ' + b + ', dio ' + a);

test('eqRitmoPersona: ritmo a mitad de semana y lo que falta por día para meta y ★ 120%', () => {
  // venta cargada lunes y martes, hoy miércoles 09/09/2026 (semana del lunes 07/09)
  const r = R.eqRitmoPersona(180, OBJ_DIAS, new Set(['lu', 'ma']), '2026-09-07', new Date(2026, 8, 9));
  cerca(r.meta, 1000); cerca(r.s120, 1200);
  cerca(r.esperado, 200, 'esperado');
  cerca(r.idx, 0.9, 'ritmo');
  assert.deepStrictEqual(r.quedan.map(x => x.i), [2, 3, 4, 5], 'le quedan Mi–Sá (el domingo no tiene horas)');
  assert.strictEqual(r.hoyIdx, 2);
  assert.strictEqual(r.atrasada, false);
  cerca(r.proy, 180 + 800 * 0.9, 'proyección');
  // ★ 120%: faltan 1.020 en 4 días → 255 por día; abierto por la curva suma lo que falta
  cerca(r.a120.falta, 1020); cerca(r.a120.porDia, 255);
  cerca(r.a120.dias.reduce((a, d) => a + d.v, 0), 1020, 'suma por día');
  cerca(r.a120.dias.find(d => d.i === 5).v, 400 * 1020 / 800, 'sábado');
  cerca(r.aMeta.porDia, 820 / 4);
  assert.strictEqual(r.aMeta.ok, false);
});

test('eqRitmoPersona: feriado sale de lo esperado; venta atrasada se avisa', () => {
  // martes sin venta en el local (feriado) y miércoles cargado: esperado = lunes + miércoles
  const r = R.eqRitmoPersona(200, OBJ_DIAS, new Set(['lu', 'mi']), '2026-09-07', new Date(2026, 8, 10));
  cerca(r.esperado, 200); cerca(r.idx, 1);
  assert.deepStrictEqual(r.quedan.map(x => x.i), [3, 4, 5]);
  // venta cargada solo hasta el lunes y hoy es viernes: el «por día» incluye días ya pasados
  const r2 = R.eqRitmoPersona(100, OBJ_DIAS, new Set(['lu']), '2026-09-07', new Date(2026, 8, 11));
  assert.strictEqual(r2.atrasada, true);
});

test('eqRitmoPersona: meta cumplida, semana terminada y sin objetivo', () => {
  const ok = R.eqRitmoPersona(1300, OBJ_DIAS, new Set(['lu', 'ma', 'mi']), '2026-09-07', new Date(2026, 8, 10));
  assert.strictEqual(ok.a120.ok, true); assert.strictEqual(ok.aMeta.ok, true);
  cerca(ok.a120.falta, 0);
  // semana ya terminada: no se le pide nada por día
  const pas = R.eqRitmoPersona(500, OBJ_DIAS, new Set(['lu', 'ma']), '2026-09-07', new Date(2026, 8, 15));
  assert.strictEqual(pas.pasada, true);
  assert.strictEqual(pas.quedan.length, 0);
  assert.strictEqual(pas.a120.porDia, null);
  // sin venta todavía: el por día es el objetivo diario promedio y no hay ritmo
  const ini = R.eqRitmoPersona(0, OBJ_DIAS, new Set(), '2026-09-07', new Date(2026, 8, 7));
  assert.strictEqual(ini.idx, null);
  cerca(ini.aMeta.porDia, 1000 / 6);
  assert.strictEqual(R.eqRitmoPersona(0, [0, 0, 0, 0, 0, 0, 0], new Set(), '2026-09-07', new Date()), null);
  assert.strictEqual(R.eqRitmoPersona(0, null, new Set(), '2026-09-07', new Date()), null);
});
