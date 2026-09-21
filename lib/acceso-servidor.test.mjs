// node --test lib/acceso-servidor.test.mjs
// Prueba el lado servidor del ingreso con una base Firebase simulada en memoria.
import test from 'node:test';
import assert from 'node:assert/strict';
import { manejar, disponible, mailKey } from './acceso-servidor.mjs';

const ENV = { SESSION_SECRET: 'secreto-de-prueba-largo', FIREBASE_SECRET: 'legado' };
let DB, MSGS;

function nodo(ruta, crear){
  let n = DB, padre = null, clave = null;
  for (const k of ruta){ padre = n; clave = k; if (n[k] === undefined){ if (!crear) return { n: undefined, padre, clave }; n[k] = {}; } n = n[k]; }
  return { n, padre, clave };
}
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  const m = (opt.method || 'GET').toUpperCase();
  if (url.includes('mensajes-mateu')){ MSGS.push(JSON.parse(opt.body)); return { ok: true, json: async () => ({ name: 'x' }) }; }
  assert.ok(url.includes('auth=legado'), 'toda llamada a la base va con la credencial del servidor');
  const ruta = url.split('firebaseio.com/')[1].split('.json')[0].split('/').filter(Boolean).map(decodeURIComponent);
  let out = null;
  if (m === 'GET'){ const r = nodo(ruta, false); out = r.n === undefined ? null : r.n; }
  else {
    const body = JSON.parse(opt.body);
    if (m === 'PUT'){ const r = nodo(ruta, true); if (body === null) delete r.padre[r.clave]; else r.padre[r.clave] = body; }
    if (m === 'POST'){ const r = nodo(ruta, true); r.n['k' + Object.keys(r.n).length] = body; }
    if (m === 'PATCH'){
      for (const [camino, val] of Object.entries(body)){
        const r = nodo(ruta.concat(camino.split('/')), true);
        if (val === null) delete r.padre[r.clave]; else r.padre[r.clave] = val;
      }
    }
    out = body;
  }
  return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(out)) };
};

const DEV = { id: 'dabcdefghijkl1234', cod: '1234', etq: 'Windows · Chrome', ua: 'x' };
async function api(datos, ip = '1.1.1.1'){
  const r = await manejar(new Request('https://x/api/acceso', { method: 'POST', body: JSON.stringify(datos), headers: { 'CF-Connecting-IP': ip } }), ENV);
  return { status: r.status, ...(await r.json()) };
}
function sembrar(){
  MSGS = [];
  DB = { usuarios: {
    [mailKey('julian@mateu.com.ar')]: { email: 'julian@mateu.com.ar', pin: '4821', rol: 'admin', pinCambio: Date.now() },
    [mailKey('calle49@mateu.com.ar')]: { email: 'calle49@mateu.com.ar', pin: '1111', rol: 'sucursal', sucursal: 'calle-49' },
    [mailKey('49-consulta@mateu.com.ar')]: { email: '49-consulta@mateu.com.ar', pin: '1905', rol: 'puesto' }
  } };
}

test('sin variables no está disponible y no toca nada', async () => {
  assert.equal(disponible({}), false);
  const r = await manejar(new Request('https://x/api/acceso', { method: 'POST', body: '{}' }), {});
  assert.equal(r.status, 503);
});

test('login de admin: entra, migra su PIN al nodo cerrado y recibe token', async () => {
  sembrar();
  const r = await api({ accion: 'login', email: 'Julian@mateu.com.ar', pin: '4821', dev: DEV });
  assert.equal(r.estado, 'ok'); assert.ok(r.token); assert.equal(r.usuario.pin, undefined);
  assert.equal(DB.usuarios[mailKey('julian@mateu.com.ar')].pin, undefined, 'el PIN sale de usuarios/');
  assert.ok(DB.usuariosPriv[mailKey('julian@mateu.com.ar')].h);
  assert.notEqual(DB.usuariosPriv[mailKey('julian@mateu.com.ar')].h, '4821');
  const otra = await api({ accion: 'login', email: 'julian@mateu.com.ar', pin: '4821', dev: DEV });
  assert.equal(otra.estado, 'ok', 'el segundo ingreso valida contra el hash');
});

test('cuenta de local en dispositivo nuevo: queda pendiente y avisa a los que aprueban', async () => {
  sembrar();
  const r = await api({ accion: 'login', email: 'calle49@mateu.com.ar', pin: '1111', dev: DEV });
  assert.equal(r.estado, 'pendiente'); assert.equal(r.token, undefined);
  assert.equal(MSGS.length, 2);
  assert.equal(DB.accesos.dispositivos[mailKey('calle49@mateu.com.ar')][DEV.id].estado, 'pendiente');
  const otra = await api({ accion: 'login', email: 'calle49@mateu.com.ar', pin: '1111', dev: DEV });
  assert.equal(otra.estado, 'pendiente'); assert.equal(MSGS.length, 2, 'no vuelve a avisar en cada reintento');
});

test('aprobar exige token de quien aprueba; después entra y tiene que cambiar el PIN', async () => {
  sembrar();
  const mk = mailKey('calle49@mateu.com.ar');
  await api({ accion: 'login', email: 'calle49@mateu.com.ar', pin: '1111', dev: DEV });
  const sinToken = await api({ accion: 'disp-set', token: 'trucho.x', mk, id: DEV.id, que: 'aprobado' });
  assert.equal(sinToken.status, 401);
  const juli = await api({ accion: 'login', email: 'julian@mateu.com.ar', pin: '4821', dev: DEV });
  const lista = await api({ accion: 'disp-lista', token: juli.token });
  assert.equal(lista.dispositivos[mk][DEV.id].estado, 'pendiente');
  assert.equal((await api({ accion: 'disp-set', token: juli.token, mk, id: DEV.id, que: 'aprobado' })).ok, true);

  const r = await api({ accion: 'login', email: 'calle49@mateu.com.ar', pin: '1111', dev: DEV });
  assert.equal(r.estado, 'ok'); assert.equal(r.debeCambiarPin, true); assert.equal(r.token, null);
  assert.equal((await api({ accion: 'pin-cambiar', email: 'calle49@mateu.com.ar', pin: '1111', nuevo: '1234', dev: DEV })).status, 400);
  assert.equal((await api({ accion: 'pin-cambiar', email: 'calle49@mateu.com.ar', pin: '1111', nuevo: '1111', dev: DEV })).status, 400);
  const otroDev = { ...DEV, id: 'dzzzzzzzzzzzz9999' };
  assert.equal((await api({ accion: 'pin-cambiar', email: 'calle49@mateu.com.ar', pin: '1111', nuevo: '7394', dev: otroDev })).status, 403,
    'desde un dispositivo sin aprobar no se puede cambiar el PIN');
  const c = await api({ accion: 'pin-cambiar', email: 'calle49@mateu.com.ar', pin: '1111', nuevo: '7394', dev: DEV });
  assert.equal(c.ok, true); assert.ok(c.token); assert.ok(DB.usuarios[mk].pinCambio);
  assert.equal((await api({ accion: 'login', email: 'calle49@mateu.com.ar', pin: '1111', dev: DEV })).status, 401, 'el PIN viejo ya no sirve');
  const fin = await api({ accion: 'login', email: 'calle49@mateu.com.ar', pin: '7394', dev: DEV });
  assert.equal(fin.estado, 'ok'); assert.equal(fin.debeCambiarPin, false); assert.ok(fin.token);
  // Un token de sucursal no administra dispositivos
  assert.equal((await api({ accion: 'disp-lista', token: fin.token })).status, 403);
  assert.equal((await api({ accion: 'pin-reset', token: fin.token, email: 'julian@mateu.com.ar' })).status, 403);
});

test('tope de intentos: 5 fallas desde una IP bloquean 15 min aunque después venga el PIN bueno', async () => {
  sembrar();
  for (let i = 0; i < 5; i++) assert.equal((await api({ accion: 'pin-verificar', email: 'julian@mateu.com.ar', pin: '0000' }, '9.9.9.9')).status, 401);
  const bloqueado = await api({ accion: 'pin-verificar', email: 'julian@mateu.com.ar', pin: '4821' }, '9.9.9.9');
  assert.equal(bloqueado.status, 429);
  assert.equal((await api({ accion: 'pin-verificar', email: 'julian@mateu.com.ar', pin: '4821' }, '8.8.8.8')).ok, true, 'otra IP no queda bloqueada');
});

test('el puesto no cambia PIN; bloquear el dispositivo y cerrar sesiones echan a la sesión abierta', async () => {
  sembrar();
  const mail = '49-consulta@mateu.com.ar', mk = mailKey(mail);
  await api({ accion: 'login', email: mail, pin: '1905', dev: DEV });
  const juli = await api({ accion: 'login', email: 'julian@mateu.com.ar', pin: '4821', dev: DEV });
  await api({ accion: 'disp-set', token: juli.token, mk, id: DEV.id, que: 'aprobado' });
  const r = await api({ accion: 'login', email: mail, pin: '1905', dev: DEV });
  assert.equal(r.debeCambiarPin, false); assert.ok(r.token);
  const loginTs = Date.now();
  assert.equal((await api({ accion: 'estado', email: mail, dev: DEV, loginTs })).ok, true);
  await new Promise(s => setTimeout(s, 5));
  await api({ accion: 'cierre', token: juli.token, mk });
  assert.equal((await api({ accion: 'estado', email: mail, dev: DEV, loginTs })).motivo, 'cerrada');
  await api({ accion: 'disp-set', token: juli.token, mk, id: DEV.id, que: 'revocado' });
  assert.equal((await api({ accion: 'estado', email: mail, dev: DEV, loginTs: Date.now() })).motivo, 'revocado');
  assert.equal((await api({ accion: 'login', email: mail, pin: '1905', dev: DEV })).estado, 'revocado');
});

test('migrar: saca todos los PIN de usuarios/ y después un pin plantado ahí no vale', async () => {
  sembrar();
  const juli = await api({ accion: 'login', email: 'julian@mateu.com.ar', pin: '4821', dev: DEV });
  const m = await api({ accion: 'migrar', token: juli.token });
  assert.equal(m.migrados, 2);
  assert.ok(Object.values(DB.usuarios).every(u => u.pin === undefined));
  assert.equal(DB.accesos.config.migrado, true);
  // Alguien escribe una cuenta nueva con PIN en el nodo público: no entra
  DB.usuarios[mailKey('intruso@x.com')] = { email: 'intruso@x.com', pin: '2468', rol: 'admin', pinCambio: Date.now() };
  assert.equal((await api({ accion: 'login', email: 'intruso@x.com', pin: '2468', dev: DEV })).status, 401);
  // Reset del admin: vuelve a 1111 (1905 en el puesto) y obliga a crear uno
  const rs = await api({ accion: 'pin-reset', token: juli.token, email: '49-consulta@mateu.com.ar' });
  assert.equal(rs.pin, '1905');
  assert.equal((await api({ accion: 'pin-reset', token: juli.token, email: 'calle49@mateu.com.ar' })).pin, '1111');
});

test('cuenta de servicio: firma un JWT RS256 válido y usa el access_token de Google', async () => {
  const { generateKeyPairSync, createVerify } = await import('node:crypto');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sa = { client_email: 'portal@discontinuos-mateu.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const base = globalThis.fetch; let pedidosToken = 0, conToken = 0;
  globalThis.fetch = async (url, opt = {}) => {
    url = String(url);
    if (url.includes('oauth2.googleapis.com')){
      pedidosToken++;
      const jwt = decodeURIComponent(String(opt.body).split('assertion=')[1]);
      const [c, p, f] = jwt.split('.');
      const v = createVerify('RSA-SHA256'); v.update(c + '.' + p);
      assert.ok(v.verify(publicKey, Buffer.from(f, 'base64url')), 'la firma del JWT verifica con la clave pública');
      const claim = JSON.parse(Buffer.from(p, 'base64url').toString());
      assert.equal(claim.iss, sa.client_email); assert.match(claim.scope, /firebase\.database/);
      return { ok: true, json: async () => ({ access_token: 'tok-google', expires_in: 3600 }) };
    }
    if (url.includes('firebaseio.com') && !url.includes('mensajes')){
      assert.ok(url.includes('access_token=tok-google')); conToken++;
      return base(url.replace('access_token=tok-google', 'auth=legado'), opt);
    }
    return base(url, opt);
  };
  try {
    sembrar();
    const r = await manejar(new Request('https://x/api/acceso', { method: 'POST',
      body: JSON.stringify({ accion: 'login', email: 'julian@mateu.com.ar', pin: '4821', dev: DEV }) }),
      { SESSION_SECRET: 'otro-secreto', FIREBASE_SA: JSON.stringify(sa) });
    assert.equal((await r.json()).estado, 'ok');
    assert.equal(pedidosToken, 1, 'pide el token una sola vez y lo reutiliza'); assert.ok(conToken > 2);
  } finally { globalThis.fetch = base; }
});
