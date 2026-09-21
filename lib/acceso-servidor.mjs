/* ============================================================
   lib/acceso-servidor.mjs — el lado SERVIDOR del ingreso al portal
   (21/09/2026). Lo usan las Pages Functions `functions/api/acceso.js`
   y `functions/api/publicar-stock.js`; los tests corren en node:
       node --test lib/acceso-servidor.test.mjs

   Qué resuelve:
   · ETAPA 1 — el PIN ya no viaja al navegador. Los PIN viven en
     `usuariosPriv/<mailKey>` = {h, cambio} (nodo CERRADO por reglas), como
     HMAC con un secreto que solo está en Cloudflare. `usuarios/` sigue
     público pero sin PIN, así los módulos que lo leen para resolver mails y
     roles no cambian. Tope de intentos: 5 por cuenta+IP cada 15 min y 40 por
     cuenta por hora.
   · ETAPA 2 — la aprobación de dispositivos, el cierre de sesiones y el
     registro de ingresos (`accesos/`, también CERRADO) se leen y escriben
     solo desde acá, verificando con un token firmado quién lo pide.

   Variables (Cloudflare Pages → Settings → Variables and Secrets, como Secret):
     SESSION_SECRET   texto largo al azar: firma los tokens y los PIN.
                      ⚠ NO cambiarlo: invalida TODOS los PIN (habría que
                      resetearlos uno por uno). Opcional PIN_PEPPER para
                      separar las dos cosas.
     FIREBASE_SA      el JSON entero de la cuenta de servicio de Firebase
                      (proyecto discontinuos-mateu), o como plan B
     FIREBASE_SECRET  el «secreto de la base de datos» (legado).
   Sin esas variables `disponible:false` y el portal sigue por el camino
   viejo (todo en el navegador).

   Las constantes de roles y fechas son copia de `shared/acceso.js`:
   mantener en sintonía.
   ============================================================ */

const FB = 'https://discontinuos-mateu-default-rtdb.firebaseio.com';
const MSG = 'https://mensajes-mateu-default-rtdb.firebaseio.com';

export const ROLES = ['sucursal', 'outlet', 'deposito', 'puesto'];
export const APRUEBAN = ['julian@mateu.com.ar', 'cristian.campion@mateu.com.ar'];
export const ADMIN = 'julian@mateu.com.ar';
// CLAVE MAESTRA (21/09/2026, pedido de Juli): con el mail de una cuenta + el PIN PROPIO de uno de
// estos mails se entra a esa cuenta, sin pedirle dispositivo ni PIN nuevo. Alcance: 'todas' = cualquier
// cuenta; 'locales' = solo las cuentas de los locales (ROLES + el kiosco). Nunca abre la cuenta de
// otro de esta lista. Solo vale (1) con el PIN propio ya renovado y (2) desde un dispositivo donde
// ese mail ya entró con su cuenta, o que ya está aprobado para la cuenta a la que se entra: así un
// PIN de 4 dígitos no se puede probar desde cualquier lado. Copia en shared/acceso.js.
export const MAESTRAS = { 'julian@mateu.com.ar': 'todas', 'cristian.campion@mateu.com.ar': 'locales' };
const ROLES_LOCALES = ROLES.concat(['deposito-tablet']);
const GRACIA_HASTA = new Date('2026-09-29T00:00:00-03:00').getTime();
const PIN_DESDE = new Date('2026-09-21T00:00:00-03:00').getTime();
const PIN_SIN_CAMBIO = ['puesto', 'deposito-tablet'];
const PIN_INICIAL = { puesto: '1905' };          // «Resetear PIN»: el resto vuelve a 1111 y tiene que crear el suyo
const PIN_FACILES = ['0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321','0123','1905','2580'];

const INTENTOS_IP = 5, VENTANA_IP = 15 * 60 * 1000;
const INTENTOS_CUENTA = 40, VENTANA_CUENTA = 60 * 60 * 1000;
const TOKEN_DIAS = 30;
const DIA_MS = 24 * 60 * 60 * 1000;

/* ---------- utilidades ---------- */
const enc = new TextEncoder();
export function mailKey(email){ return String(email || '').toLowerCase().trim().replace(/\./g, ','); }
function b64u(buf){
  const b = typeof buf === 'string' ? enc.encode(buf) : new Uint8Array(buf);
  let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function deB64u(s){
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function hex(buf){ return Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, '0')).join(''); }
async function hmac(secreto, texto){
  const k = await crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(texto));
}
function igual(a, b){            // comparación en tiempo constante
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function json(data, status){
  return new Response(JSON.stringify(data), { status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function claveFb(s){ return String(s || 'x').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60) || 'x'; }

export function disponible(env){
  return !!(env && env.SESSION_SECRET && (env.FIREBASE_SA || env.FIREBASE_SECRET));
}

/* ---------- Firebase con credencial del servidor ---------- */
let _tok = null;                                   // token de Google, vive lo que viva el isolate
async function tokenGoogle(env){
  const ahora = Math.floor(Date.now() / 1000);
  if (_tok && _tok.exp > ahora + 120) return _tok.t;
  const sa = JSON.parse(env.FIREBASE_SA);
  const cab = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const cuerpo = b64u(JSON.stringify({
    iss: sa.client_email, aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600,
    scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/firebase.database'
  }));
  const pem = String(sa.private_key).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', deB64u(pem.replace(/\+/g, '-').replace(/\//g, '_')),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const firma = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(cab + '.' + cuerpo));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + cab + '.' + cuerpo + '.' + b64u(firma)
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error('Google rechazó la cuenta de servicio: ' + (j.error_description || j.error || r.status));
  _tok = { t: j.access_token, exp: ahora + (j.expires_in || 3600) };
  return _tok.t;
}
async function fb(env, metodo, ruta, cuerpo, consulta){
  const cred = env.FIREBASE_SA ? 'access_token=' + encodeURIComponent(await tokenGoogle(env))
                               : 'auth=' + encodeURIComponent(env.FIREBASE_SECRET);
  const url = FB + '/' + ruta + '.json?' + cred + (consulta ? '&' + consulta : '');
  const opt = { method: metodo };
  if (cuerpo !== undefined){ opt.headers = { 'Content-Type': 'application/json' }; opt.body = JSON.stringify(cuerpo); }
  const r = await fetch(url, opt);
  if (!r.ok) throw new Error('Firebase ' + r.status + ' en ' + ruta);
  return r.json();
}

/* ---------- PIN ---------- */
async function hashPin(env, mk, pin){
  return hex(await hmac(env.PIN_PEPPER || env.SESSION_SECRET, 'pin|' + mk + '|' + String(pin)));
}
async function guardarPin(env, mk, pin, cambio){
  await fb(env, 'PUT', 'usuariosPriv/' + mk, { h: await hashPin(env, mk, pin), cambio: cambio || null, ts: Date.now() });
}
// ¿Coincide el PIN? Si la cuenta todavía no se migró, vale el `pin` viejo de usuarios/
// (mientras `accesos/config/migrado` no esté en true) y se migra en el acto.
async function pinCorrecto(env, mk, usuario, claveUsuario, pin){
  const priv = await fb(env, 'GET', 'usuariosPriv/' + mk);
  if (priv && priv.h) return igual(priv.h, await hashPin(env, mk, pin));
  if (usuario.pin == null) return false;
  const migrado = await fb(env, 'GET', 'accesos/config/migrado');
  if (migrado === true) return false;                // ya se migró todo: un `pin` que aparezca en usuarios/ no vale
  if (!igual(String(usuario.pin), String(pin))) return false;
  await guardarPin(env, mk, pin, usuario.pinCambio || null);
  await fb(env, 'PATCH', 'usuarios/' + claveUsuario, { pin: null });
  return true;
}

/* ---------- tope de intentos ---------- */
async function topeIntentos(env, mk, ip){
  const reg = (await fb(env, 'GET', 'accesos/intentos/' + mk)) || {};
  const ahora = Date.now(), porIp = reg[ip], total = reg._total;
  if (porIp && porIp.n >= INTENTOS_IP && ahora - porIp.desde < VENTANA_IP)
    return { reg, espera: Math.ceil((VENTANA_IP - (ahora - porIp.desde)) / 60000) };
  if (total && total.n >= INTENTOS_CUENTA && ahora - total.desde < VENTANA_CUENTA)
    return { reg, espera: Math.ceil((VENTANA_CUENTA - (ahora - total.desde)) / 60000) };
  return { reg, espera: 0 };
}
async function anotarFalla(env, mk, ip, reg){
  const ahora = Date.now();
  const sumar = (r, ventana) => (r && ahora - r.desde < ventana) ? { n: r.n + 1, desde: r.desde } : { n: 1, desde: ahora };
  const porIp = sumar(reg[ip], VENTANA_IP), total = sumar(reg._total, VENTANA_CUENTA);
  await fb(env, 'PATCH', 'accesos/intentos/' + mk, { [ip]: porIp, _total: total });
  return Math.max(0, INTENTOS_IP - porIp.n);
}

/* ---------- token de sesión ---------- */
async function firmarToken(env, usuario, dev, maestra){
  const datos = { e: String(usuario.email).toLowerCase(), r: usuario.rol, d: dev || '', x: Date.now() + TOKEN_DIAS * DIA_MS };
  if (maestra) datos.m = maestra;                    // sesión abierta con la clave maestra de ese mail
  const p = b64u(JSON.stringify(datos));
  return p + '.' + b64u(await hmac(env.SESSION_SECRET, 'tok|' + p));
}
export async function leerToken(env, token){
  const partes = String(token || '').split('.');
  if (partes.length !== 2) return null;
  if (!igual(partes[1], b64u(await hmac(env.SESSION_SECRET, 'tok|' + partes[0])))) return null;
  let p = null; try { p = JSON.parse(new TextDecoder().decode(deB64u(partes[0]))); } catch (e) { return null; }
  return (p && p.x > Date.now()) ? p : null;
}

/* ---------- registro y avisos ---------- */
function devLimpio(dev){
  dev = dev || {};
  const id = String(dev.id || '');
  return { id: /^d[a-z0-9]{12,40}$/.test(id) ? id : '', cod: String(dev.cod || '').slice(0, 8),
           etq: String(dev.etq || '').slice(0, 60), ua: String(dev.ua || '').slice(0, 200) };
}
function registrar(env, usuario, dev, resultado, por){
  const d = new Date(), ym = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
  const fila = { ts: Date.now(), mail: String(usuario.email || '').toLowerCase(),
    rol: usuario.rol || '', dev: dev.id, cod: dev.cod, etq: dev.etq, r: resultado };
  if (por) fila.por = por;
  return fb(env, 'POST', 'accesos/log/' + ym, fila).catch(() => {});
}
function avisarAprobadores(usuario, dev){
  const de = String(usuario.email).toLowerCase();
  const texto = '🔒 La cuenta ' + de + ' quiere entrar desde un dispositivo nuevo (' + dev.etq + ', código ' + dev.cod +
    '). No entra hasta que lo apruebes: Portal → 🔒 Dispositivos. Si no sabés de quién es, rechazalo.';
  return Promise.all(APRUEBAN.filter(ap => ap !== de).map(ap => {
    const ck = [mailKey(de), mailKey(ap)].sort().join('__');
    return fetch(MSG + '/directos/' + ck + '.json', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ de, texto, ts: Date.now() }) }).catch(() => {});
  }));
}

async function buscarUsuario(env, email){
  const mk = mailKey(email);
  let u = await fb(env, 'GET', 'usuarios/' + mk), clave = mk;
  if (!u || !u.email){                               // registros viejos con otra clave
    const todos = (await fb(env, 'GET', 'usuarios')) || {};
    u = null;
    for (const k in todos){ if (todos[k] && String(todos[k].email || '').toLowerCase() === String(email).toLowerCase()){ u = todos[k]; clave = k; break; } }
  }
  return u ? { u, clave, mk } : null;
}
function debeCambiarPin(u){
  if (PIN_SIN_CAMBIO.indexOf(u.rol) !== -1) return false;
  return !(u.pinCambio && u.pinCambio >= PIN_DESDE);
}
function sinPin(u){ const c = Object.assign({}, u); delete c.pin; return c; }

/* ---------- clave maestra ---------- */
// ¿El PIN es el de alguien con clave maestra que puede abrir esta cuenta desde este dispositivo?
// Devuelve su mail o null. El dispositivo se mira ANTES de comparar el PIN.
async function pinMaestro(env, u, mk, pin, devId){
  const destino = String(u.email || '').toLowerCase();
  if (!devId || MAESTRAS[destino]) return null;
  let aprobadoDestino = null;
  for (const mail of Object.keys(MAESTRAS)){
    if (MAESTRAS[mail] !== 'todas' && ROLES_LOCALES.indexOf(u.rol) === -1) continue;
    const mmk = mailKey(mail);
    const propio = await fb(env, 'GET', 'accesos/dispositivos/' + mmk + '/' + devId);
    if (propio && propio.estado === 'revocado') continue;
    let conocido = !!(propio && propio.estado === 'aprobado');
    if (!conocido){
      if (aprobadoDestino === null){
        const reg = await fb(env, 'GET', 'accesos/dispositivos/' + mk + '/' + devId);
        aprobadoDestino = !!(reg && reg.estado === 'aprobado');
      }
      conocido = aprobadoDestino;
    }
    if (!conocido) continue;
    const m = await buscarUsuario(env, mail);
    if (!m || debeCambiarPin(m.u)) continue;          // con el PIN inicial sin renovar no hay clave maestra
    if (await pinCorrecto(env, m.mk, m.u, m.clave, pin)) return mail;
  }
  return null;
}
// El que tiene clave maestra deja anotado el dispositivo al entrar con SU cuenta.
async function anotarDispositivoPropio(env, mk, dev){
  if (!dev.id) return;
  const ruta = 'accesos/dispositivos/' + mk + '/' + dev.id, reg = await fb(env, 'GET', ruta), ahora = Date.now();
  if (reg && reg.estado === 'revocado') return;
  if (reg) await fb(env, 'PATCH', ruta, { ultimo: ahora, etq: dev.etq });
  else await fb(env, 'PUT', ruta, { estado: 'aprobado', cod: dev.cod, etq: dev.etq, ua: dev.ua, alta: ahora, ultimo: ahora, origen: 'propio' });
}

// Valida mail + PIN con tope de intentos. Devuelve {ok, usuario, clave, mk} o {error, status}.
// Con `devMaestra` (id del dispositivo) también acepta la clave maestra → {…, maestra: mail}.
export async function validarPin(env, email, pin, ip, devMaestra){
  email = String(email || '').trim().toLowerCase(); pin = String(pin || '').trim();
  if (!email || !/^\d{4}$/.test(pin)) return { error: 'Email o PIN incorrectos.', status: 401 };
  const hallado = await buscarUsuario(env, email);
  if (!hallado) return { error: 'Email o PIN incorrectos.', status: 401 };
  const { u, clave, mk } = hallado, ipK = claveFb(ip);
  const tope = await topeIntentos(env, mk, ipK);
  if (tope.espera) return { error: 'Demasiados intentos con el PIN equivocado. Probá de nuevo en ' + tope.espera + ' min.', status: 429, usuario: u };
  if (!(await pinCorrecto(env, mk, u, clave, pin))){
    const maestra = devMaestra ? await pinMaestro(env, u, mk, pin, devMaestra) : null;
    if (maestra) return { ok: true, usuario: u, clave, mk, maestra };
    const quedan = await anotarFalla(env, mk, ipK, tope.reg);
    return { error: 'Email o PIN incorrectos.' + (quedan <= 2 ? ' Quedan ' + quedan + ' intento' + (quedan === 1 ? '' : 's') + '.' : ''), status: 401, usuario: u };
  }
  if (tope.reg[ipK]) await fb(env, 'PATCH', 'accesos/intentos/' + mk, { [ipK]: null });
  return { ok: true, usuario: u, clave, mk };
}

/* ---------- acciones ---------- */
async function accLogin(env, d, ip){
  const dev = devLimpio(d.dev);
  const v = await validarPin(env, d.email, d.pin, ip, dev.id);
  if (!v.ok){ if (v.usuario && v.status === 401) registrar(env, v.usuario, dev, 'pin'); return json({ error: v.error }, v.status); }
  const u = v.usuario;
  if (v.maestra){
    // Clave maestra: no pide dispositivo aprobado ni PIN nuevo. Queda en el registro con quién fue.
    await registrar(env, u, dev, 'maestra', v.maestra);
    return json({ estado: 'ok', usuario: sinPin(u), debeCambiarPin: false, maestra: v.maestra, token: await firmarToken(env, u, dev.id, v.maestra) });
  }
  if (MAESTRAS[String(u.email).toLowerCase()]) await anotarDispositivoPropio(env, v.mk, dev);
  if (ROLES.indexOf(u.rol) !== -1){
    if (!dev.id) return json({ error: 'No pude identificar este dispositivo. Recargá la página.' }, 400);
    const ruta = 'accesos/dispositivos/' + v.mk + '/' + dev.id;
    const reg = await fb(env, 'GET', ruta);
    if (!reg){
      await fb(env, 'PUT', ruta, { estado: 'pendiente', cod: dev.cod, etq: dev.etq, ua: dev.ua, alta: Date.now(), origen: 'login' });
      await avisarAprobadores(u, dev);
      await registrar(env, u, dev, 'pendiente');
      return json({ estado: 'pendiente' });
    }
    if (reg.estado !== 'aprobado'){
      await registrar(env, u, dev, reg.estado === 'revocado' ? 'revocado' : 'pendiente');
      return json({ estado: reg.estado === 'revocado' ? 'revocado' : 'pendiente' });
    }
    await fb(env, 'PATCH', ruta, { ultimo: Date.now(), etq: dev.etq });
  }
  await registrar(env, u, dev, 'ok');
  const cambiar = debeCambiarPin(u);
  // Con el PIN por renovar todavía no hay token: lo entrega `pin-cambiar`.
  return json({ estado: 'ok', usuario: sinPin(u), debeCambiarPin: cambiar, token: cambiar ? null : await firmarToken(env, u, dev.id) });
}

async function accPinCambiar(env, d, ip){
  const dev = devLimpio(d.dev), nuevo = String(d.nuevo || '').trim();
  const v = await validarPin(env, d.email, d.pin, ip);
  if (!v.ok) return json({ error: v.error }, v.status);
  const u = v.usuario;
  if (ROLES.indexOf(u.rol) !== -1){
    const reg = dev.id ? await fb(env, 'GET', 'accesos/dispositivos/' + v.mk + '/' + dev.id) : null;
    if (!reg || reg.estado !== 'aprobado') return json({ error: 'Este dispositivo no está autorizado para esa cuenta.' }, 403);
  }
  if (!/^\d{4}$/.test(nuevo)) return json({ error: 'El PIN tiene que tener 4 números.' }, 400);
  if (nuevo === String(d.pin).trim()) return json({ error: 'Tiene que ser distinto del PIN que venías usando.' }, 400);
  if (PIN_FACILES.indexOf(nuevo) !== -1) return json({ error: 'Ese PIN es muy fácil de adivinar. Elegí otro.' }, 400);
  const ahora = Date.now();
  await guardarPin(env, v.mk, nuevo, ahora);
  await fb(env, 'PATCH', 'usuarios/' + v.clave, { pinCambio: ahora, pin: null });
  u.pinCambio = ahora;
  return json({ ok: true, usuario: sinPin(u), token: await firmarToken(env, u, dev.id) });
}

async function accPinVerificar(env, d, ip){
  const v = await validarPin(env, d.email, d.pin, ip, devLimpio(d.dev).id);   // la cortina y «Salir» también aceptan la clave maestra
  return v.ok ? json({ ok: true }) : json({ error: v.error }, v.status);
}

// Sesión ya abierta de una cuenta de local: ¿sigue valiendo en este dispositivo?
async function accEstado(env, d){
  const dev = devLimpio(d.dev);
  const hallado = await buscarUsuario(env, d.email);
  if (!hallado) return json({ ok: false, motivo: 'reingresar' });
  const { u, mk } = hallado;
  if (ROLES.indexOf(u.rol) === -1) return json({ ok: true });
  if (!dev.id) return json({ ok: false, motivo: 'reingresar' });
  // Sesión abierta con la clave maestra: vale mientras el token sea de esta cuenta y este dispositivo,
  // y no se hayan cerrado las sesiones de la cuenta ni las de quien entró.
  const tk = d.token ? await leerToken(env, d.token) : null;
  if (tk && tk.m && MAESTRAS[tk.m] && tk.e === String(u.email).toLowerCase() && tk.d === dev.id){
    const [c1, c2] = await Promise.all([fb(env, 'GET', 'accesos/cierre/' + mk), fb(env, 'GET', 'accesos/cierre/' + mailKey(tk.m))]);
    if (Math.max(c1 || 0, c2 || 0) > (Number(d.loginTs) || 0)) return json({ ok: false, motivo: 'cerrada' });
    return json({ ok: true });
  }
  const ruta = 'accesos/dispositivos/' + mk + '/' + dev.id;
  const reg = await fb(env, 'GET', ruta), ahora = Date.now();
  if (d.previo){
    // Sesión anterior al control: se da por buena una sola vez, hasta GRACIA_HASTA (decisión de Juli).
    if (ahora > GRACIA_HASTA) return json({ ok: false, motivo: 'reingresar' });
    if (reg && reg.estado === 'revocado') return json({ ok: false, motivo: 'revocado' });
    if (!reg || reg.estado !== 'aprobado')
      await fb(env, 'PUT', ruta, { estado: 'aprobado', cod: dev.cod, etq: dev.etq, ua: dev.ua, alta: ahora, ultimo: ahora, origen: 'previo' });
    await registrar(env, u, dev, 'ok');
    return json({ ok: true, sellar: true });
  }
  if (!reg || reg.estado !== 'aprobado') return json({ ok: false, motivo: reg && reg.estado === 'pendiente' ? 'pendiente' : 'revocado' });
  const cierre = (await fb(env, 'GET', 'accesos/cierre/' + mk)) || 0;
  if (cierre && cierre > (Number(d.loginTs) || 0)) return json({ ok: false, motivo: 'cerrada' });
  if (ahora - (reg.ultimo || 0) > DIA_MS) await fb(env, 'PATCH', ruta, { ultimo: ahora });
  return json({ ok: true });
}

async function exigir(env, token, lista){
  const p = await leerToken(env, token);
  if (!p) return { resp: json({ error: 'Tu sesión es anterior a este control. Salí y volvé a ingresar para administrar esto.', token: true }, 401) };
  if (lista.indexOf(p.e) === -1) return { resp: json({ error: 'No tenés permiso para esto.' }, 403) };
  return { p };
}

async function accDispLista(env, d){
  const a = await exigir(env, d.token, APRUEBAN); if (a.resp) return a.resp;
  const f = new Date(), ym = f.getUTCFullYear() + '-' + String(f.getUTCMonth() + 1).padStart(2, '0');
  const [dispositivos, cierres, log] = await Promise.all([
    fb(env, 'GET', 'accesos/dispositivos'), fb(env, 'GET', 'accesos/cierre'),
    fb(env, 'GET', 'accesos/log/' + ym, undefined, 'orderBy=%22%24key%22&limitToLast=150')
  ]);
  return json({ dispositivos: dispositivos || {}, cierres: cierres || {}, log: log || {} });
}
async function accDispSet(env, d){
  const a = await exigir(env, d.token, APRUEBAN); if (a.resp) return a.resp;
  const mk = String(d.mk || ''), id = String(d.id || '');
  if (!/^[^.$#\[\]\/]+$/.test(mk) || !/^d[a-z0-9]{12,40}$/.test(id)) return json({ error: 'Dispositivo inválido.' }, 400);
  const ruta = 'accesos/dispositivos/' + mk + '/' + id;
  if (d.que === 'borrar') await fb(env, 'PUT', ruta, null);
  else if (d.que === 'aprobado' || d.que === 'revocado') await fb(env, 'PATCH', ruta, { estado: d.que, por: a.p.e, en: Date.now() });
  else return json({ error: 'Acción inválida.' }, 400);
  return json({ ok: true });
}
async function accCierre(env, d){
  const a = await exigir(env, d.token, APRUEBAN); if (a.resp) return a.resp;
  const mk = String(d.mk || '');
  if (!/^[^.$#\[\]\/]+$/.test(mk)) return json({ error: 'Cuenta inválida.' }, 400);
  await fb(env, 'PUT', 'accesos/cierre/' + mk, Date.now());
  return json({ ok: true });
}
async function accPinReset(env, d){
  const a = await exigir(env, d.token, [ADMIN]); if (a.resp) return a.resp;
  const hallado = await buscarUsuario(env, d.email);
  if (!hallado) return json({ error: 'No existe esa cuenta.' }, 404);
  const pin = PIN_INICIAL[hallado.u.rol] || '1111';
  await guardarPin(env, hallado.mk, pin, null);
  await fb(env, 'PATCH', 'usuarios/' + hallado.clave, { pin: null, pinCambio: null });
  await fb(env, 'PUT', 'accesos/intentos/' + hallado.mk, null);
  return json({ ok: true, pin });
}
// Pasa al nodo cerrado todos los PIN que sigan en usuarios/ y da por terminada la migración.
async function accMigrar(env, d){
  const a = await exigir(env, d.token, [ADMIN]); if (a.resp) return a.resp;
  const [todos, priv] = await Promise.all([fb(env, 'GET', 'usuarios'), fb(env, 'GET', 'usuariosPriv')]);
  const cambios = { 'accesos/config/migrado': true }; let n = 0;
  for (const k in (todos || {})){
    const u = todos[k]; if (!u || !u.email || u.pin == null) continue;
    const mk = mailKey(u.email);
    if (!(priv && priv[mk] && priv[mk].h)) cambios['usuariosPriv/' + mk] = { h: await hashPin(env, mk, u.pin), cambio: u.pinCambio || null, ts: Date.now() };
    cambios['usuarios/' + k + '/pin'] = null; n++;
  }
  await fb(env, 'PATCH', '', cambios);
  return json({ ok: true, migrados: n });
}

const ACCIONES = { 'login': accLogin, 'pin-cambiar': accPinCambiar, 'pin-verificar': accPinVerificar, 'estado': accEstado,
  'disp-lista': accDispLista, 'disp-set': accDispSet, 'cierre': accCierre, 'pin-reset': accPinReset, 'migrar': accMigrar };

export async function manejar(request, env){
  if (request.method === 'GET') return json({ disponible: disponible(env) });
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  if (!disponible(env)) return json({ error: 'El ingreso por servidor no está configurado.', disponible: false }, 503);
  let d = null; try { d = await request.json(); } catch (e) { d = null; }
  const accion = d && ACCIONES[d.accion];
  if (!accion) return json({ error: 'Acción desconocida.' }, 400);
  const ip = request.headers.get('CF-Connecting-IP') || 'sin-ip';
  try { return await accion(env, d, ip); }
  catch (e) { return json({ error: 'No pude completar la operación (' + (e && e.message || e) + '). Probá de nuevo en un minuto.' }, 502); }
}
