/* ============================================================
   lib/evaluacion.test.js — Tests del cálculo puro (§3/§4).

   Correr sin instalar nada (no hay package.json):
       node --test lib/evaluacion.test.js

   Usa node:test + node:assert (built-in). No agrega dependencias.
   ============================================================ */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('./evaluacion.js');

// Helper: setea el mismo valor a los N ítems de un bloque.
function bloque(keys, valor) {
  return keys.reduce((m, k) => { m[k] = valor; return m; }, {});
}
const KEYS_OP  = E.ITEMS_OPERATIVA.map(i => i.key);
const KEYS_ACT = E.ITEMS_ACTITUDINAL.map(i => i.key);
const TODOS = { ...bloque(KEYS_OP, 'bien'), ...bloque(KEYS_ACT, 'bien') };

test('la escala de cada ítem es Bien=10, Regular=5, Mal=0', () => {
  assert.equal(E.puntosDe('bien'), 10);
  assert.equal(E.puntosDe('regular'), 5);
  assert.equal(E.puntosDe('mal'), 0);
});

test('valor inválido o ausente cuenta 0', () => {
  assert.equal(E.puntosDe('excelente'), 0);
  assert.equal(E.puntosDe(undefined), 0);
  assert.equal(E.puntosDe(null), 0);
});

test('hay exactamente 5 ítems operativos y 5 actitudinales', () => {
  assert.equal(E.ITEMS_OPERATIVA.length, 5);
  assert.equal(E.ITEMS_ACTITUDINAL.length, 5);
  assert.equal(E.ITEMS.length, 10);
});

test('las item_key son las claves estables esperadas (§4)', () => {
  assert.deepEqual(KEYS_OP,  ['limpieza', 'salon', 'atencion', 'stock_deposito', 'ratio_stock']);
  assert.deepEqual(KEYS_ACT, ['liderazgo', 'proactividad', 'normas', 'comunicacion', 'personal']);
});

test('todo Bien = 100, nota A, 50/50 por bloque', () => {
  const r = E.calcularEvaluacion(TODOS);
  assert.deepEqual(r, { pts_operativa: 50, pts_actitudinal: 50, pts_total: 100, nota: 'A' });
});

test('todo Mal = 0, nota D', () => {
  const r = E.calcularEvaluacion({ ...bloque(KEYS_OP, 'mal'), ...bloque(KEYS_ACT, 'mal') });
  assert.deepEqual(r, { pts_operativa: 0, pts_actitudinal: 0, pts_total: 0, nota: 'D' });
});

test('todo Regular = 50, nota C, 25/25 por bloque', () => {
  const r = E.calcularEvaluacion({ ...bloque(KEYS_OP, 'regular'), ...bloque(KEYS_ACT, 'regular') });
  assert.deepEqual(r, { pts_operativa: 25, pts_actitudinal: 25, pts_total: 50, nota: 'C' });
});

test('cada bloque suma independiente (operativa todo bien, actitudinal todo mal)', () => {
  const r = E.calcularEvaluacion({ ...bloque(KEYS_OP, 'bien'), ...bloque(KEYS_ACT, 'mal') });
  assert.equal(r.pts_operativa, 50);
  assert.equal(r.pts_actitudinal, 0);
  assert.equal(r.pts_total, 50);
});

test('umbrales de nota exactos: A≥80, B≥60, C≥40, D<40', () => {
  assert.equal(E.notaDe(80), 'A');
  assert.equal(E.notaDe(79), 'B');
  assert.equal(E.notaDe(60), 'B');
  assert.equal(E.notaDe(59), 'C');
  assert.equal(E.notaDe(40), 'C');
  assert.equal(E.notaDe(39), 'D');
  assert.equal(E.notaDe(0), 'D');
  assert.equal(E.notaDe(100), 'A');
});

test('ítems faltantes cuentan 0 (evaluación a medio cargar)', () => {
  const r = E.calcularEvaluacion({ limpieza: 'bien', salon: 'bien' });
  assert.equal(r.pts_operativa, 20);
  assert.equal(r.pts_actitudinal, 0);
  assert.equal(r.pts_total, 20);
  assert.equal(r.nota, 'D');
});

test('sugerencia de ratio_stock según objetivo 4–6 (§6.3)', () => {
  assert.equal(E.sugerirRatioStock(5),    'bien');    // dentro
  assert.equal(E.sugerirRatioStock(4),    'bien');    // borde inferior incluido
  assert.equal(E.sugerirRatioStock(6),    'bien');    // borde superior incluido
  assert.equal(E.sugerirRatioStock(3.7),  'regular'); // casi
  assert.equal(E.sugerirRatioStock(6.4),  'regular'); // casi
  assert.equal(E.sugerirRatioStock(2),    'mal');     // fuera
  assert.equal(E.sugerirRatioStock(9),    'mal');     // fuera
  assert.equal(E.sugerirRatioStock(null), null);      // sin dato
  assert.equal(E.sugerirRatioStock(NaN),  null);
});
