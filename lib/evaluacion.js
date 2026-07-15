/* ============================================================
   lib/evaluacion.js — Cálculo puro de las Evaluaciones de Supervisor.

   Es la ÚNICA fuente de verdad del puntaje y la nota (§3 del prompt) y de
   la lista de ítems (§4). Lo usan tres consumidores distintos, por eso está
   escrito como UMD isomórfico (sin build, sin package.json):

     - el browser  → <script src="../lib/evaluacion.js"></script>  ⇒ window.Evaluacion
     - las Pages Functions (Cloudflare) → import Evaluacion from '.../evaluacion.js'
     - los tests (node --test)          → require('../lib/evaluacion.js')

   NO cambiar la escala ni los umbrales sin avisar a Juli: son contrato con
   el negocio. Ver lib/evaluacion.test.js.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();            // Node / esbuild (Functions)
  } else {
    root.Evaluacion = factory();           // Browser
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // --- Escala de cada ítem (§3): Bien = 10 · Regular = 5 · Mal = 0 ----------
  var VALOR_PUNTOS = { bien: 10, regular: 5, mal: 0 };
  var VALORES = ['bien', 'regular', 'mal'];

  // --- Ítems de la evaluación (§4). item_key es la clave ESTABLE (no cambiar) -
  // Cada bloque tiene 5 ítems ⇒ máx 50 por bloque, 100 total.
  var ITEMS = [
    // OPERATIVA (50 pts)
    { key: 'limpieza',       categoria: 'operativa',   titulo: 'Limpieza y Mantenimiento',                detalle: 'Frente, caja, vidrieras, salón, depósito, baño, cocina, probadores.' },
    { key: 'salon',          categoria: 'operativa',   titulo: 'Salón — Calzado, Indumentaria y Exhibición', detalle: 'Precios, tags rebajados, orden, faltantes, temporada, vidriera.' },
    { key: 'atencion',       categoria: 'operativa',   titulo: 'Atención al Cliente',                     detalle: 'Sonrisa, saludo, ubicación de vendedores, venta adicional, predisposición.' },
    { key: 'stock_deposito', categoria: 'operativa',   titulo: 'Stock y Depósito',                        detalle: 'Orden estanterías, F8, remitos, negativos, discontinuos, fallados, reservas.' },
    { key: 'ratio_stock',    categoria: 'operativa',   titulo: 'Ratio Stock / Ventas',                    detalle: 'Relación stock vs ventas (objetivo: 4 a 6). Calzado, Indumentaria, Accesorios.' },
    // ACTITUDINAL (50 pts)
    { key: 'liderazgo',      categoria: 'actitudinal', titulo: 'Liderazgo Positivo',                      detalle: 'Conducción, motivación del equipo, manejo de conflictos.' },
    { key: 'proactividad',   categoria: 'actitudinal', titulo: 'Proactividad',                            detalle: 'Esfuerzo constante por lograr resultados. Actitud permanente de cambio.' },
    { key: 'normas',         categoria: 'actitudinal', titulo: 'Normas y Procedimientos',                 detalle: 'Respeto a políticas, diálogo con superiores, captación de órdenes.' },
    { key: 'comunicacion',   categoria: 'actitudinal', titulo: 'Comunicación y Responsabilidad',          detalle: 'Diálogo claro, tiempos pactados, respuesta a mails y mensajes.' },
    { key: 'personal',       categoria: 'actitudinal', titulo: 'Personal y Capacitación',                 detalle: 'Capacitación, conocimiento de promociones, producto y venta adicional.' }
  ];

  var ITEMS_OPERATIVA   = ITEMS.filter(function (i) { return i.categoria === 'operativa'; });
  var ITEMS_ACTITUDINAL = ITEMS.filter(function (i) { return i.categoria === 'actitudinal'; });
  var ITEM_KEYS = ITEMS.map(function (i) { return i.key; });
  var ITEM_BY_KEY = ITEMS.reduce(function (m, i) { m[i.key] = i; return m; }, {});

  var MAX_BLOQUE = 50;   // 5 ítems × 10
  var MAX_TOTAL = 100;

  // --- Puntos de un valor individual -----------------------------------------
  function puntosDe(valor) {
    return Object.prototype.hasOwnProperty.call(VALOR_PUNTOS, valor) ? VALOR_PUNTOS[valor] : 0;
  }

  // --- Nota a partir del total (§3): A ≥ 80 · B ≥ 60 · C ≥ 40 · D < 40 --------
  function notaDe(total) {
    var t = Number(total) || 0;
    if (t >= 80) return 'A';
    if (t >= 60) return 'B';
    if (t >= 40) return 'C';
    return 'D';
  }

  /* Calcula el resultado completo de una evaluación.
     `valores` es un mapa item_key → 'bien'|'regular'|'mal'. Los ítems ausentes
     o con valor inválido cuentan 0 (equivalente a "Mal"), así una evaluación a
     medio cargar sigue dando un total coherente.
     Devuelve { pts_operativa, pts_actitudinal, pts_total, nota }. */
  function calcularEvaluacion(valores) {
    valores = valores || {};
    var op = 0, act = 0;
    ITEMS_OPERATIVA.forEach(function (i) { op += puntosDe(valores[i.key]); });
    ITEMS_ACTITUDINAL.forEach(function (i) { act += puntosDe(valores[i.key]); });
    var total = op + act;
    return { pts_operativa: op, pts_actitudinal: act, pts_total: total, nota: notaDe(total) };
  }

  /* Sugerencia de valor para el ítem ratio_stock a partir del ratio real (§6.3).
     Objetivo 4–6: dentro → 'bien'; en el borde (±0.5) → 'regular'; fuera → 'mal'.
     Es SUGERENCIA (el supervisor confirma o corrige), nunca automático.
     Devuelve null si no hay dato de ratio. */
  function sugerirRatioStock(ratio) {
    if (ratio === null || ratio === undefined || isNaN(ratio)) return null;
    var r = Number(ratio);
    if (r >= 4 && r <= 6) return 'bien';
    if (r >= 3.5 && r < 4) return 'regular';
    if (r > 6 && r <= 6.5) return 'regular';
    return 'mal';
  }

  return {
    VALOR_PUNTOS: VALOR_PUNTOS,
    VALORES: VALORES,
    ITEMS: ITEMS,
    ITEMS_OPERATIVA: ITEMS_OPERATIVA,
    ITEMS_ACTITUDINAL: ITEMS_ACTITUDINAL,
    ITEM_KEYS: ITEM_KEYS,
    ITEM_BY_KEY: ITEM_BY_KEY,
    MAX_BLOQUE: MAX_BLOQUE,
    MAX_TOTAL: MAX_TOTAL,
    puntosDe: puntosDe,
    notaDe: notaDe,
    calcularEvaluacion: calcularEvaluacion,
    sugerirRatioStock: sugerirRatioStock
  };
});
