/* ============================================================
   scripts/gen-evaluaciones-mock.mjs — Genera datos de prueba de Evaluaciones.

   Emite `evaluaciones/mock-data.js`: los datos que el módulo usa en modo demo
   mientras no se pegó la URL de la base Firebase `evaluaciones-mateu`.

   Reusa lib/evaluacion.js para el puntaje/nota (una sola fuente de verdad).
   Determinístico (PRNG sembrado) para que el diff no cambie sin querer.

   Correr:  node scripts/gen-evaluaciones-mock.mjs
   ============================================================ */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import E from '../lib/evaluacion.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// --- PRNG determinístico (mulberry32) ---------------------------------------
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }

// --- Datos base -------------------------------------------------------------
// Hoy hay un solo supervisor y cubre todas las sucursales.
const SUP = 'cristian.campion@mateu.com.ar';

const SUCS = [
  { slug: 'calle-12',    encargado: 'Diego Fernández',  cadena: 'Mateu',    sup: SUP },
  { slug: 'city-bell',   encargado: 'Marina López',     cadena: 'Mateu',    sup: SUP },
  { slug: 'calle-47',    encargado: 'Rubén Acosta',     cadena: 'Mateu',    sup: SUP },
  { slug: 'calle-49',    encargado: 'Sofía Giménez',    cadena: 'Mateu',    sup: SUP },
  { slug: 'los-hornos',  encargado: 'Pablo Sosa',       cadena: 'Mateu',    sup: SUP },
  { slug: 'plaza',       encargado: 'Carla Medina',     cadena: 'Mateu',    sup: SUP },
  { slug: 'berisso',     encargado: 'Nicolás Duarte',   cadena: 'Mateu',    sup: SUP },
  { slug: 'kids',        encargado: 'Vanina Ríos',      cadena: 'Mateu',    sup: SUP },
  { slug: 'gonnet',      encargado: 'Hernán Vera',      cadena: 'Outlet',   sup: SUP },
  { slug: 'aurelius-12', encargado: 'Julieta Paz',      cadena: 'Aurelius', sup: SUP },
  { slug: 'adidas-12',   encargado: 'Martín Cabrera',   cadena: 'Adidas',   sup: SUP },
  { slug: 'originals',   encargado: 'Florencia Núñez',  cadena: 'Adidas',   sup: SUP },
];

// El supervisor cubre TODAS las sucursales del portal (no sólo las que tienen
// evaluación de prueba), para que el mapa de alcance del demo quede completo.
const TODAS_LAS_SUCURSALES = [
  'calle-12','city-bell','diagonal','calle-47','calle-49','los-hornos','plaza','berisso',
  'ensenada','kids','aurelius-12','aurelius-5','aurelius-cb','adidas-12','adidas','originals',
  'ecommerce','deposito','gonnet','av-44','calle-55','aurelius-10',
];

const SEMANAS = ['2026-W24', '2026-W25', '2026-W26', '2026-W27', '2026-W28'];
const SEMANA_ACTUAL = '2026-W28';
// Sucursales que quedan SIN evaluar en la semana actual (para probar ese estado).
const SIN_EVALUAR_ACTUAL = new Set(['los-hornos', 'originals', 'plaza']);

const VALORES = ['bien', 'regular', 'mal'];
const PLANES = {
  limpieza: 'Reforzar limpieza de probadores y frente antes de abrir.',
  salon: 'Actualizar tags rebajados y reponer talles faltantes de temporada.',
  atencion: 'Trabajar saludo de ingreso y venta adicional en caja.',
  stock_deposito: 'Ordenar estantería de calzado y regularizar negativos en F8.',
  ratio_stock: 'Bajar stock de indumentaria de temporada pasada para acercar el ratio a 4–6.',
  liderazgo: 'Acompañar más de cerca al equipo nuevo en el turno tarde.',
  proactividad: 'Proponer acciones de venta para los días flojos de semana.',
  normas: 'Respetar los tiempos de envío del cierre de caja.',
  comunicacion: 'Responder los mails de Producto dentro del día.',
  personal: 'Capacitar al equipo en las promos vigentes del mes.',
};

// --- Genera una evaluación (valores por ítem, obs, items[]) ------------------
function genEval(suc, semana, sfx) {
  const r = rng(hash(suc.slug + '|' + semana + '|' + sfx));
  // Sesgo por sucursal: cada una tiene un "nivel" base para que las series tengan sentido.
  const nivel = rng(hash(suc.slug))();      // 0..1 fijo por sucursal
  const valores = {};
  const items = [];
  E.ITEMS.forEach((it) => {
    const roll = r() * 0.65 + nivel * 0.35;
    const valor = roll > 0.7 ? 'bien' : roll > 0.42 ? 'regular' : 'mal';
    const plan = valor !== 'bien' ? (PLANES[it.key] || '') : '';
    valores[it.key] = valor;
    items.push({ categoria: it.categoria, item_key: it.key, valor, puntos: E.puntosDe(valor), plan_accion: plan });
  });
  const calc = E.calcularEvaluacion(valores);
  return { valores, items, calc };
}

// --- Construye el dataset ----------------------------------------------------
const evaluaciones = [];
const evaluacion_items = [];
const puntos_mejora = [];
let evalId = 0, itemId = 0, pmId = 0;

for (const suc of SUCS) {
  for (const semana of SEMANAS) {
    if (semana === SEMANA_ACTUAL && SIN_EVALUAR_ACTUAL.has(suc.slug)) continue;
    const { items, calc } = genEval(suc, semana, 'v1');
    evalId++;
    const esActual = semana === SEMANA_ACTUAL;
    // La semana actual queda 'enviada' salvo alguna en 'borrador' para probar autosave.
    const borrador = esActual && (evalId % 7 === 0);
    const visto = !esActual && (evalId % 3 !== 0);   // el encargado ya vio las viejas
    const ev = {
      id: evalId,
      sucursal: suc.slug,
      encargado: suc.encargado,
      supervisor: suc.sup,
      semana,
      pts_operativa: calc.pts_operativa,
      pts_actitudinal: calc.pts_actitudinal,
      pts_total: calc.pts_total,
      nota: calc.nota,
      obs_operativa: calc.pts_operativa < 35 ? 'Foco en salón y depósito esta semana.' : '',
      obs_actitudinal: calc.pts_actitudinal < 35 ? 'Trabajar liderazgo y comunicación con el equipo.' : '',
      estado: borrador ? 'borrador' : 'enviada',
      visto_encargado: visto ? 1 : 0,
      visto_en: visto ? semana + '-vie' : null,
      visto_comentario: visto && evalId % 5 === 0 ? 'Recibido, ya estamos trabajando en los puntos.' : null,
      created_at: semana + ' 10:00:00',
      updated_at: semana + ' 18:00:00',
    };
    evaluaciones.push(ev);
    items.forEach((it) => { itemId++; evaluacion_items.push({ id: itemId, evaluacion_id: evalId, ...it }); });
    // Cada ítem Regular/Mal con plan genera un punto de mejora.
    items.forEach((it) => {
      if (it.valor !== 'bien' && it.plan_accion) {
        pmId++;
        // Algunos viejos ya resueltos/confirmados para exercitar el seguimiento.
        let estado = 'pendiente', marcado_por = null, marcado_en = null, confirmado_por = null, confirmado_en = null;
        if (!esActual) {
          const roll = rng(hash('pm|' + suc.slug + '|' + semana + '|' + it.item_key))();
          if (roll > 0.66) { estado = 'confirmado'; marcado_por = suc.slug; marcado_en = semana + '-jue'; confirmado_por = suc.sup; confirmado_en = semana + '-vie'; }
          else if (roll > 0.4) { estado = 'resuelto'; marcado_por = suc.slug; marcado_en = semana + '-jue'; }
        }
        puntos_mejora.push({
          id: pmId, sucursal: suc.slug, item_key: it.item_key, semana_origen: semana,
          texto: it.plan_accion, estado, marcado_por, marcado_en, confirmado_por, confirmado_en,
          evaluacion_id: evalId, created_at: semana + ' 18:00:00',
        });
      }
    });
  }
}

const sucursal_supervisor = TODAS_LAS_SUCURSALES.map((slug) => (
  { sucursal: slug, supervisor: SUP, updated_at: '2026-06-01 00:00:00' }
));

// --- Salida 1: mock-data.js (browser, UMD) ----------------------------------
const mockJs = `/* ============================================================
   evaluaciones/mock-data.js — Datos de prueba (GENERADO, no editar a mano).
   Regenerar: node scripts/gen-evaluaciones-mock.mjs
   El módulo lo usa en modo demo, cuando todavía no se pegó la URL de la base
   Firebase evaluaciones-mateu (EVAL_DB_URL vacío). Ver evaluaciones/index.html.
   ${evaluaciones.length} evaluaciones · semana actual ${SEMANA_ACTUAL}.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EVALUACIONES_MOCK = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return {
    semana_actual: ${JSON.stringify(SEMANA_ACTUAL)},
    sucursal_supervisor: ${JSON.stringify(sucursal_supervisor)},
    evaluaciones: ${JSON.stringify(evaluaciones)},
    evaluacion_items: ${JSON.stringify(evaluacion_items)},
    puntos_mejora: ${JSON.stringify(puntos_mejora)}
  };
});
`;
writeFileSync(join(ROOT, 'evaluaciones', 'mock-data.js'), mockJs);

console.log(`OK · ${evaluaciones.length} evaluaciones, ${evaluacion_items.length} items, ${puntos_mejora.length} puntos de mejora, ${sucursal_supervisor.length} sucursales.`);
console.log('  → evaluaciones/mock-data.js');
