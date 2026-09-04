/* ============================================================
 * functions/api/rrhh/[[path]].js
 * API de archivos de RRHH (fotos + documentos por persona) sobre Cloudflare R2.
 *
 * Binding: env.LEGAJOS  → bucket "mateu-legajos".
 *   · Producción: se declara en Pages → Settings → Bindings (LEGAJOS → mateu-legajos).
 *   · Local (wrangler pages dev): se toma de wrangler.toml ([[r2_buckets]]).
 *
 * Rutas (todas cuelgan de /api/rrhh/):
 *   GET    /api/rrhh/list/<dni>            → lista los archivos de esa persona
 *   PUT    /api/rrhh/obj/<dni>/<...key>    → sube/reemplaza un archivo (body = bytes)
 *   GET    /api/rrhh/obj/<dni>/<...key>    → descarga/sirve un archivo
 *   DELETE /api/rrhh/obj/<dni>/<...key>    → borra un archivo
 *
 * La ruta usa el DNI como carpeta para que los objetos no sean enumerables por
 * URL (seguridad "blanda", igual que el resto del portal). El módulo rrhh/ es
 * la única puerta de entrada. Nada de datos personales en la query string.
 * ============================================================ */

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
function err(msg, status) { return json({ ok: false, error: msg }, status || 400); }

// key segura: letras/números/._-/ y espacio; sin ".." ni barras iniciales raras.
function keyValida(k) {
  return typeof k === 'string' && k.length > 0 && k.length <= 512 &&
         /^[A-Za-z0-9._\-/ ]+$/.test(k) && !k.includes('..') && !k.startsWith('/');
}

export async function onRequest(context) {
  const { request, env, params } = context;
  if (!env.LEGAJOS) return err('R2 no configurado (falta el binding LEGAJOS)', 500);

  const seg = params.path || [];              // segmentos tras /api/rrhh/
  const kind = seg[0];
  const rest = seg.slice(1).map(s => { try { return decodeURIComponent(s); } catch (e) { return s; } });
  const method = request.method;

  try {
    // ---- listar los archivos de una persona ----
    if (kind === 'list') {
      const dni = rest[0];
      if (!dni || !/^[A-Za-z0-9]+$/.test(dni)) return err('DNI inválido');
      const out = await env.LEGAJOS.list({ prefix: dni + '/' });
      const objetos = (out.objects || []).map(o => ({
        key: o.key,
        nombre: o.key.split('/').pop(),
        carpeta: o.key.split('/').slice(1, -1).join('/'),
        size: o.size,
        subido: o.uploaded,
        tipo: (o.httpMetadata && o.httpMetadata.contentType) || ''
      }));
      return json({ ok: true, objetos });
    }

    // ---- un objeto puntual ----
    if (kind === 'obj') {
      const key = rest.join('/');
      if (!keyValida(key)) return err('key inválida');

      if (method === 'PUT') {
        const ct = request.headers.get('content-type') || 'application/octet-stream';
        await env.LEGAJOS.put(key, request.body, { httpMetadata: { contentType: ct } });
        return json({ ok: true, key });
      }
      if (method === 'GET') {
        const obj = await env.LEGAJOS.get(key);
        if (!obj) return err('no existe', 404);
        const h = new Headers();
        h.set('Content-Type', (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream');
        h.set('Cache-Control', 'private, max-age=60');
        if (obj.size != null) h.set('Content-Length', String(obj.size));
        return new Response(obj.body, { headers: h });
      }
      if (method === 'DELETE') {
        await env.LEGAJOS.delete(key);
        return json({ ok: true });
      }
      return err('método no permitido', 405);
    }

    return err('ruta desconocida', 404);
  } catch (e) {
    return err('R2: ' + (e && e.message || e), 500);
  }
}
