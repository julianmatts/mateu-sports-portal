/* ============================================================
 * functions/api/ventas.js — proxy del Portal a la API de ventas del sistema
 * (24/09/2026). Toda la lógica vive en lib/ventas-proxy.mjs (ahí están las
 * variables que hay que cargar en Cloudflare, el cache y los tests).
 *
 *   GET /api/ventas                          → {disponible}
 *   GET /api/ventas?semana=YYYY-MM-DD        → totales por sucursal
 *   GET /api/ventas?semana=…&sucursal=<slug> → detalle por vendedor (shape ventaEquipo)
 * ============================================================ */
import { manejar } from '../../lib/ventas-proxy.mjs';

export function onRequest(ctx) {
  return manejar(ctx.request, ctx.env, ctx);
}
