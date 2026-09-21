/* ============================================================
 * functions/api/acceso.js — ingreso al portal del lado del servidor
 * (21/09/2026). Toda la lógica vive en lib/acceso-servidor.mjs (ahí
 * están las variables que hay que cargar en Cloudflare y los tests).
 *
 *   GET  /api/acceso → {disponible}
 *   POST /api/acceso → {accion: login | pin-cambiar | pin-verificar | estado |
 *                       disp-lista | disp-set | cierre | pin-reset | migrar, …}
 * ============================================================ */
import { manejar } from '../../lib/acceso-servidor.mjs';

export function onRequest(ctx) {
  return manejar(ctx.request, ctx.env);
}
