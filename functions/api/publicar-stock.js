/* ============================================================
   /api/publicar-stock — publica gestion-stock/datos-meses-stock.js
   ------------------------------------------------------------
   Cloudflare Pages Function (se deploya sola con el push, como el
   resto del sitio). Commitea el dataset de Meses de Stock a main con
   un token de GitHub que vive EN EL SERVIDOR, así el que carga el mes
   (Daniel, David) publica solo, sin token propio ni confirmación de
   Juli. Antes el token estaba en el localStorage del navegador de
   Juli y a los demás les salía un prompt pidiéndoles un token.

   Necesita la variable de entorno GITHUB_TOKEN en Cloudflare Pages →
   Settings → Environment variables (Production), como SECRETO:
   token fine-grained con acceso SOLO al repo mateu-sports-portal y
   permiso «Contents: Read and write». Sin la variable, GET responde
   {disponible:false} y el módulo cae al camino viejo (token propio).
   Opcional: PUBLICAN_STOCK = lista de mails separados por coma.

   El endpoint es público (Pages no tiene auth), así que el permiso se
   valida acá con lo único que el portal tiene: **mail en la lista +
   PIN correcto contra discontinuos-mateu/usuarios**. El PIN se
   verifica del lado del servidor y el token nunca baja al navegador.
   Además solo se puede escribir ESE archivo y el contenido tiene que
   empezar con `window.STOCK_DATA = {`: no hay forma de pushear otra
   cosa al repo desde acá.

   GET  /api/publicar-stock  → { disponible:true|false, quienes:[mails] }
   POST /api/publicar-stock  → cuerpo = el .js YA en base64 (text/plain)
                               headers: X-Mateu-Email, X-Mateu-Pin, X-Mateu-Meta
                               → { ok:true, commit:'abc1234' }

   El cuerpo viaja como texto plano y los datos chicos por headers a
   propósito: el dataset pesa ~3,5 MB (4,7 MB en base64) y hacerle
   JSON.parse + base64 acá adentro quemaría el presupuesto de CPU de
   la Function. Así la Function solo lo revisa y lo reenvía.
   ============================================================ */

const REPO = { owner: 'julianmatts', repo: 'mateu-sports-portal', branch: 'main', path: 'gestion-stock/datos-meses-stock.js' };
const FB_USUARIOS = 'https://discontinuos-mateu-default-rtdb.firebaseio.com/usuarios.json';
const PUEDEN_DEFECTO = 'julian@mateu.com.ar,producto@mateu.com.ar';
const MAX_B64 = 14 * 1024 * 1024;          // ~10 MB de archivo; hoy pesa 3,5
const PREFIJO = 'window.STOCK_DATA = {';   // lo único que se acepta publicar

function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function quienes(env) {
  return String((env && env.PUBLICAN_STOCK) || PUEDEN_DEFECTO)
    .split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
}

export async function onRequestGet(ctx) {
  return json({ disponible: !!(ctx.env && ctx.env.GITHUB_TOKEN), quienes: quienes(ctx.env) });
}

export async function onRequestPost(ctx) {
  const env = ctx.env || {};
  const token = env.GITHUB_TOKEN;
  if (!token) return json({ error: 'Falta configurar GITHUB_TOKEN en Cloudflare Pages. Publicá con el camino viejo (token en el navegador) o pedile a Juli que lo cargue.' }, 503);

  const h = ctx.request.headers;
  const email = String(h.get('X-Mateu-Email') || '').trim().toLowerCase();
  const pin = String(h.get('X-Mateu-Pin') || '').trim();
  let meta = {};
  try { meta = JSON.parse(h.get('X-Mateu-Meta') || '{}') || {}; } catch (e) { meta = {}; }

  if (!email || !pin) return json({ error: 'Falta el mail o el PIN.' }, 400);
  if (quienes(env).indexOf(email) < 0) return json({ error: 'Tu usuario no está habilitado para publicar Meses de Stock. Pedile a Juli que te sume.' }, 403);

  // PIN contra Firebase, igual que el login del Portal (los usuarios están
  // indexados con clave arbitraria: se busca por el campo email).
  let usuarios = null;
  try { usuarios = await (await fetch(FB_USUARIOS)).json(); } catch (e) { usuarios = null; }
  if (!usuarios) return json({ error: 'No pude verificar el PIN (no responde la base de usuarios). Probá de nuevo en un minuto.' }, 502);
  let user = null;
  for (const k in usuarios) {
    const u = usuarios[k];
    if (u && u.email && String(u.email).toLowerCase() === email) { user = u; break; }
  }
  if (!user || String(user.pin) !== pin) return json({ error: 'PIN incorrecto.' }, 401);
  if (user.rol !== 'admin' && (user.herramientas || []).indexOf('gestion-stock') < 0)
    return json({ error: 'Tu usuario no tiene Gestión de Stock.' }, 403);

  // El archivo llega ya en base64. Se valida el juego de caracteres (así se
  // puede armar el JSON de GitHub concatenando, sin stringify de 5 MB) y que
  // el contenido arranque con window.STOCK_DATA.
  const b64 = (await ctx.request.text()).trim();
  if (!b64) return json({ error: 'Llegó vacío.' }, 400);
  if (b64.length > MAX_B64) return json({ error: 'El archivo es demasiado grande (' + Math.round(b64.length / 1048576) + ' MB).' }, 413);
  if (/[^A-Za-z0-9+/=]/.test(b64)) return json({ error: 'El contenido no es base64 válido.' }, 400);
  let cabeza = '';
  try { cabeza = atob(b64.slice(0, 64)); } catch (e) { return json({ error: 'El contenido no es base64 válido.' }, 400); }
  if (cabeza.indexOf(PREFIJO) !== 0) return json({ error: 'Esto no es un datos-meses-stock.js (tiene que empezar con «' + PREFIJO + '»).' }, 400);

  const api = 'https://api.github.com/repos/' + REPO.owner + '/' + REPO.repo;
  const H = { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'User-Agent': 'mateu-sports-portal' };

  const mesesTxt = Array.isArray(meta.meses) && meta.meses.length ? ' (' + meta.meses.join(', ') + ')' : '';
  const mensaje = 'Meses de Stock: datos RATIO ' + (meta.anio || '') + mesesTxt + ' — publicado desde el portal por ' + email;

  for (let intento = 0; intento < 2; intento++) {
    // El sha del archivo vigente sale del listado del directorio: el GET
    // directo no devuelve archivos de más de 1 MB.
    let sha = null;
    try {
      const dir = await fetch(api + '/contents/gestion-stock?ref=' + REPO.branch, { headers: H });
      if (dir.status === 401 || dir.status === 403) return json({ error: 'GitHub rechazó el token del servidor (vencido o sin permiso «Contents: Read and write»). Hay que renovar GITHUB_TOKEN en Cloudflare.' }, 502);
      if (!dir.ok) return json({ error: 'GitHub respondió ' + dir.status + ' al buscar la versión actual.' }, 502);
      const list = await dir.json();
      const actual = (Array.isArray(list) ? list : []).find(f => f.name === 'datos-meses-stock.js');
      sha = actual ? actual.sha : null;
    } catch (e) { return json({ error: 'No pude contactar a GitHub: ' + e.message }, 502); }

    const cuerpo = '{"message":' + JSON.stringify(mensaje) +
      ',"branch":' + JSON.stringify(REPO.branch) +
      (sha ? ',"sha":' + JSON.stringify(sha) : '') +
      ',"content":"' + b64 + '"}';

    let res;
    try {
      res = await fetch(api + '/contents/' + REPO.path, { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, H), body: cuerpo });
    } catch (e) { return json({ error: 'No pude contactar a GitHub: ' + e.message }, 502); }

    if (res.status === 401 || res.status === 403) return json({ error: 'GitHub rechazó el token del servidor (vencido o sin permiso «Contents: Read and write»). Hay que renovar GITHUB_TOKEN en Cloudflare.' }, 502);
    if ((res.status === 409 || res.status === 422) && intento === 0) continue;   // otro push en el medio: se rebusca el sha
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return json({ error: 'GitHub respondió ' + res.status + (e && e.message ? ': ' + e.message : '') }, 502);
    }
    const out = await res.json().catch(() => ({}));
    return json({ ok: true, commit: (out.commit && out.commit.sha ? out.commit.sha.slice(0, 7) : 'ok'), por: email });
  }
  return json({ error: 'Conflicto de versión persistente — probá de nuevo en un rato.' }, 409);
}
