/* ============================================================
   shared/acceso.js — Dispositivos autorizados + registro de ingresos
   (21/09/2026, pedido de Juli: que un encargado no pueda pasarle el
   usuario y el PIN a alguien de afuera).

   Las cuentas de los locales (roles sucursal / outlet / deposito /
   puesto) solo entran desde un DISPOSITIVO AUTORIZADO. La primera vez
   que una cuenta entra desde un dispositivo nuevo queda «pendiente» y
   les llega un aviso por la Bandeja a los que aprueban (APRUEBAN);
   hasta que lo aprueben en el Portal → 🔒 Dispositivos, no entra.
   El resto de los roles no se bloquea: solo queda el registro.

   Firebase (discontinuos-mateu, nodo `accesos/`):
     dispositivos/<mailKey>/<devId> = {estado:'aprobado'|'pendiente'|'revocado',
        cod, etq, ua, alta, ultimo, origen:'login'|'previo', por, en}
     cierre/<mailKey> = ts  → toda sesión abierta ANTES de ese momento se cierra
     log/<YYYY-MM>/<id> = {ts, mail, rol, dev, cod, etq, r:'ok'|'pendiente'|'revocado'|'pin'}

   El dispositivo se identifica con un id al azar guardado en localStorage
   (`mateu_dev_id`). Es seguridad BLANDA, como el resto del portal: frena a
   quien recibió un usuario y un PIN, no a un programador.

   Las sesiones que ya estaban abiertas al activar esto se dan por buenas
   (decisión de Juli): su dispositivo se registra solo como aprobado
   (origen 'previo') hasta GRACIA_HASTA; después, una sesión sin dispositivo
   registrado se cierra y tiene que volver a entrar.

   Se incluye SIN defer. `header.js` lo carga solo; el Portal e Indicadores
   (header propio) lo incluyen con una línea.
   ============================================================ */
(function(){
  'use strict';
  if(window.Acceso) return;

  var THIS = document.currentScript ||
    (function(){ var s=document.getElementsByTagName('script'); return s[s.length-1]; })();
  var ROOT = THIS && THIS.src ? new URL('../', THIS.src).href : '../';

  var FB = 'https://discontinuos-mateu-default-rtdb.firebaseio.com';
  var NODO = FB + '/accesos';
  var MSG_DB = 'https://mensajes-mateu-default-rtdb.firebaseio.com';
  var SESSION_KEY = 'mateu_portal_session';
  var DEV_KEY = 'mateu_dev_id';

  // Roles que necesitan dispositivo autorizado.
  var ROLES = ['sucursal', 'outlet', 'deposito', 'puesto'];
  // Quiénes aprueban dispositivos (y reciben el aviso por la Bandeja).
  var APRUEBAN = ['julian@mateu.com.ar', 'cristian.campion@mateu.com.ar'];
  // CLAVE MAESTRA (21/09/2026, pedido de Juli): con el mail de una cuenta + el PIN PROPIO de uno de
  // estos mails se entra a esa cuenta sin pedirle dispositivo ni PIN nuevo. 'todas' = cualquier cuenta;
  // 'locales' = solo las de los locales. Nunca abre la cuenta de otro de la lista. Vale solo con el PIN
  // propio ya renovado y desde un dispositivo donde ese mail ya entró con su cuenta (o ya aprobado para
  // la cuenta a la que se entra). Copia de lib/acceso-servidor.mjs: mantener en sintonía.
  var MAESTRAS = {'julian@mateu.com.ar':'todas', 'cristian.campion@mateu.com.ar':'locales'};
  var ROLES_LOCALES = ROLES.concat(['deposito-tablet']);
  // Hasta cuándo una sesión que ya estaba abierta registra su dispositivo sola.
  var GRACIA_HASTA = new Date('2026-09-29T00:00:00-03:00').getTime();
  // PIN nuevo obligatorio (21/09/2026): toda cuenta cuyo `usuarios/<mail>/pinCambio` sea anterior
  // a esta fecha (o no exista) tiene que crear un PIN propio al entrar. Los puestos de consulta
  // quedan con el PIN fijo que les pone gerencia. Para volver a obligar a todos: subir la fecha.
  var PIN_DESDE = new Date('2026-09-21T00:00:00-03:00').getTime();
  var PIN_SIN_CAMBIO = ['puesto', 'deposito-tablet'];   // pantallas compartidas: PIN fijo que pone gerencia
  function debeCambiarPin(usuario){
    if(!usuario || PIN_SIN_CAMBIO.indexOf(usuario.rol) !== -1) return false;
    return !(usuario.pinCambio && usuario.pinCambio >= PIN_DESDE);
  }
  var REVALIDAR_MS = 60 * 1000;         // una sesión abierta se revisa a lo sumo una vez por minuto
  var DIA_MS = 24 * 60 * 60 * 1000;

  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
  function lsDel(k){ try{ localStorage.removeItem(k); }catch(e){} }
  function ssGet(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } }
  function ssSet(k, v){ try{ sessionStorage.setItem(k, v); }catch(e){} }

  function mailKey(email){ return (email||'').toLowerCase().trim().replace(/\./g, ','); }
  function controla(rol){ return ROLES.indexOf(rol) !== -1; }
  function puedeAprobar(session){
    return !!session && APRUEBAN.indexOf((session.email||'').toLowerCase()) !== -1;
  }

  function azar(n){
    var abc = 'abcdefghijkmnpqrstuvwxyz23456789', out = '', i, arr = null;
    try{ arr = new Uint8Array(n); (window.crypto || window.msCrypto).getRandomValues(arr); }catch(e){ arr = null; }
    for(i=0;i<n;i++) out += abc.charAt((arr ? arr[i] : Math.floor(Math.random()*256)) % abc.length);
    return out;
  }
  function devId(){
    var id = lsGet(DEV_KEY);
    if(!id || !/^d[a-z0-9]{12,}$/.test(id)){ id = 'd' + azar(20); lsSet(DEV_KEY, id); }
    return id;
  }
  // Código corto que ve el usuario y el que aprueba: sirve para confirmar por teléfono
  // que el pedido es de ESE dispositivo.
  function codigo(id){ id = id || devId(); return id.slice(-4).toUpperCase(); }
  function etiqueta(){
    var ua = navigator.userAgent || '';
    var so = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' :
      /Windows NT 6\.1/.test(ua) ? 'Windows 7' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' :
      /Linux/.test(ua) ? 'Linux' : 'Otro';
    var nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' :
      /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Trident|MSIE/.test(ua) ? 'Internet Explorer' : 'Navegador';
    return so + ' · ' + nav;
  }

  function req(method, url, data){
    var opt = {method: method};
    if(data !== undefined){ opt.headers = {'Content-Type':'application/json'}; opt.body = JSON.stringify(data); }
    return fetch(url, opt).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); });
  }
  function urlDev(email, id){ return NODO+'/dispositivos/'+mailKey(email)+'/'+(id||devId())+'.json'; }

  /* ---- Ingreso por servidor (functions/api/acceso.js + lib/acceso-servidor.mjs) ----
     Si la Function está configurada, el PIN y `accesos/` ya no se tocan desde el
     navegador. `servidor()` lo averigua una vez (se recuerda 10 min si está, 2 si no). */
  var API = ROOT + 'api/acceso';
  var _srv = null;
  function servidor(forzar){
    if(forzar){ _srv = null; ssSet('mateu_acceso_srv', ''); }
    if(_srv) return _srv;
    var c = (ssGet('mateu_acceso_srv') || '').split('|'), hace = Date.now() - (parseInt(c[1], 10) || 0);
    if(c[0] === 'si' && hace < 10*60*1000) return (_srv = Promise.resolve(true));
    if(c[0] === 'no' && hace < 2*60*1000) return (_srv = Promise.resolve(false));
    if(!window.fetch) return (_srv = Promise.resolve(false));
    _srv = fetch(API).then(function(r){ return r.ok ? r.json() : {}; }).then(function(j){
      var si = !!(j && j.disponible);
      ssSet('mateu_acceso_srv', (si ? 'si' : 'no') + '|' + Date.now());
      return si;
    }).catch(function(){ return false; });
    return _srv;
  }
  // POST a la Function. Siempre resuelve: {status, …respuesta}; status 0 = no hubo respuesta.
  function api(accion, datos){
    var cuerpo = {accion: accion}, k;
    for(k in (datos || {})) cuerpo[k] = datos[k];
    return fetch(API, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(cuerpo)})
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ j = j || {}; j.status = r.status; return j; }); })
      .catch(function(){ return {status: 0, error: 'No hay conexión con el servidor. Probá de nuevo.'}; });
  }
  function devInfo(){ return {id: devId(), cod: codigo(), etq: etiqueta(), ua: (navigator.userAgent||'').slice(0,200)}; }
  function tokenSesion(){ var s = leerSesion(); return (s && s.tok) || ''; }

  /* ¿Es el PIN de esa cuenta? Lo usan la cortina de inactividad, «Salir» del puesto y el
     kiosco del depósito. Resuelve {ok, error}. Con servidor cuenta para el tope de intentos. */
  function verificarPin(email, pin){
    return servidor().then(function(si){
      if(si) return api('pin-verificar', {email: email, pin: String(pin||'').trim(), dev: devInfo()}).then(function(r){
        return {ok: !!r.ok, error: r.ok ? '' : (r.status === 429 ? r.error : (r.status === 401 ? 'PIN incorrecto.' : (r.error || 'No se pudo verificar el PIN.')))};
      });
      return req('GET', FB+'/usuarios/'+mailKey(email)+'.json').then(function(u){
        if(!u || u.pin == null) return {ok:false, error:'No se pudo verificar el PIN.'};
        if(String(u.pin) === String(pin||'').trim()) return {ok:true, error:''};
        return claveMaestra(u, pin).then(function(m){ return m ? {ok:true, error:''} : {ok:false, error:'PIN incorrecto.'}; });
      }).catch(function(){ return {ok:false, error:'No se pudo verificar el PIN. Revisá la conexión.'}; });
    });
  }

  function registrar(email, rol, resultado, por){
    var d = new Date(), ym = d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2);
    var fila = {ts: {'.sv':'timestamp'}, mail:(email||'').toLowerCase(), rol: rol||'', dev: devId(),
      cod: codigo(), etq: etiqueta(), r: resultado};
    if(por) fila.por = por;            // ingreso con clave maestra: quién entró
    return req('POST', NODO+'/log/'+ym+'.json', fila).catch(function(){});
  }

  function avisarAprobadores(email){
    var texto = '🔒 La cuenta '+email+' quiere entrar desde un dispositivo nuevo ('+etiqueta()+', código '+codigo()+
      '). No entra hasta que lo apruebes: Portal → 🔒 Dispositivos. Si no sabés de quién es, rechazalo.';
    var de = (email||'').toLowerCase();
    APRUEBAN.forEach(function(ap){
      if(ap === de) return;
      var ck = [mailKey(de), mailKey(ap)].sort().join('__');
      req('POST', MSG_DB+'/directos/'+ck+'.json', {de: de, texto: texto, ts: Date.now()}).catch(function(){});
    });
  }

  /* Clave maestra por el camino del navegador (sin servidor). Resuelve el mail de quien entra
     o null. El dispositivo se mira antes que el PIN, igual que en el servidor. */
  function claveMaestra(usuario, pin){
    var destino = ((usuario && usuario.email) || '').toLowerCase();
    if(!destino || MAESTRAS[destino]) return Promise.resolve(null);
    var mails = Object.keys(MAESTRAS).filter(function(m){ return MAESTRAS[m] === 'todas' || ROLES_LOCALES.indexOf(usuario.rol) !== -1; });
    pin = String(pin||'').trim();
    var aprobadoDestino = null;
    function probar(i){
      if(i >= mails.length) return Promise.resolve(null);
      var mail = mails[i];
      return req('GET', urlDev(mail)).then(function(propio){
        if(propio && propio.estado === 'revocado') return false;
        if(propio && propio.estado === 'aprobado') return true;
        if(aprobadoDestino !== null) return aprobadoDestino;
        return req('GET', urlDev(destino)).then(function(d){ return (aprobadoDestino = !!(d && d.estado === 'aprobado')); });
      }).then(function(conocido){
        if(!conocido) return null;
        return req('GET', FB+'/usuarios/'+mailKey(mail)+'.json').then(function(m){
          return (m && m.pin != null && !debeCambiarPin(m) && String(m.pin) === pin) ? mail : null;
        });
      }).catch(function(){ return null; }).then(function(ok){ return ok || probar(i+1); });
    }
    return probar(0);
  }
  // El que tiene clave maestra deja anotado el dispositivo al entrar con SU cuenta.
  function anotarDispositivoPropio(email){
    var ahora = Date.now();
    req('GET', urlDev(email)).then(function(d){
      if(d && d.estado === 'revocado') return;
      if(d) return req('PATCH', urlDev(email), {ultimo: ahora, etq: etiqueta()});
      return req('PUT', urlDev(email), {estado:'aprobado', cod: codigo(), etq: etiqueta(),
        ua:(navigator.userAgent||'').slice(0,200), alta: ahora, ultimo: ahora, origen:'propio'});
    }).catch(function(){});
  }

  /* Login: después de validar el PIN. Devuelve una promesa con
     'ok' | 'pendiente' | 'revocado' | 'error' (no se pudo consultar → no entra). */
  function verificarLogin(usuario){
    var email = (usuario && usuario.email) || '', rol = usuario && usuario.rol;
    if(!controla(rol)){
      if(MAESTRAS[email.toLowerCase()]) anotarDispositivoPropio(email);
      registrar(email, rol, 'ok'); return Promise.resolve('ok');
    }
    return req('GET', urlDev(email)).then(function(d){
      var ahora = Date.now();
      if(d && d.estado === 'aprobado'){
        req('PATCH', urlDev(email), {ultimo: ahora, etq: etiqueta()}).catch(function(){});
        registrar(email, rol, 'ok');
        return 'ok';
      }
      if(d && d.estado === 'revocado'){ registrar(email, rol, 'revocado'); return 'revocado'; }
      if(!d){
        return req('PUT', urlDev(email), {
          estado:'pendiente', cod: codigo(), etq: etiqueta(), ua: (navigator.userAgent||'').slice(0,200),
          alta: ahora, origen:'login'
        }).then(function(){
          avisarAprobadores(email);
          registrar(email, rol, 'pendiente');
          return 'pendiente';
        });
      }
      registrar(email, rol, 'pendiente');
      return 'pendiente';
    }).catch(function(){ return 'error'; });
  }

  // Marca que lleva la sesión cuando entró por un dispositivo autorizado.
  function sellar(session){
    if(session){ session.acc = devId(); session.loginTs = Date.now(); }
    return session;
  }

  function leerSesion(){ try{ var s = lsGet(SESSION_KEY); return s ? JSON.parse(s) : null; }catch(e){ return null; } }
  function expulsar(motivo){
    lsDel(SESSION_KEY);
    ssSet('mateu_acceso_msg', motivo);
    try{ location.replace(ROOT + '?acceso=' + encodeURIComponent(motivo)); }catch(e){ location.href = ROOT; }
  }

  /* Sesión ya abierta: en cada página se confirma que el dispositivo sigue aprobado
     y que no se pidió cerrar las sesiones de la cuenta. Si Firebase no contesta, no
     se toca nada (el local tiene que poder seguir trabajando sin internet). */
  function revalidar(){
    var s = leerSesion();
    if(!s || !s.email || !window.fetch) return;
    var ahora = Date.now();

    // PIN nuevo obligatorio: una sesión abierta con el PIN viejo vuelve al ingreso, que
    // es donde se crea el nuevo. Se mira una vez por pestaña; con el PIN ya renovado
    // queda anotado en el dispositivo y no se consulta más.
    function chequearPin(){
      if(PIN_SIN_CAMBIO.indexOf(s.rol) !== -1 || lsGet('mateu_pin_ok') === mailKey(s.email) || ssGet('mateu_pin_rev')) return;
      req('GET', FB+'/usuarios/'+mailKey(s.email)+'/pinCambio.json').then(function(pc){
        ssSet('mateu_pin_rev', '1');   // recién con la respuesta: una redirección a mitad de camino no lo da por revisado
        if(pc && pc >= PIN_DESDE){ lsSet('mateu_pin_ok', mailKey(s.email)); return; }
        expulsar('pin');
      }).catch(function(){});
    }
    // Sesión abierta con la clave maestra: no se le pide el PIN nuevo de la cuenta (no es su dueño).
    var maestra = !!(s.maestra && MAESTRAS[String(s.maestra).toLowerCase()]);
    if(maestra) chequearPin = function(){};
    if(!controla(s.rol)){ chequearPin(); return; }
    if(s.acc && s.acc !== devId()){ expulsar('reingresar'); return; }   // sesión copiada de otro dispositivo
    if(!s.acc && ahora > GRACIA_HASTA){ expulsar('reingresar'); return; }

    servidor().then(function(si){
      // Con el ingreso por servidor, `accesos/` está cerrado: se pregunta por la Function.
      if(si){
        var marcaS = 'mateu_acceso_rev';
        if(s.acc && ahora - (parseInt(ssGet(marcaS), 10) || 0) < REVALIDAR_MS){ chequearPin(); return; }
        ssSet(marcaS, String(ahora));
        api('estado', {email: s.email, dev: devInfo(), loginTs: s.loginTs || 0, previo: !s.acc, token: s.tok || ''}).then(function(r){
          if(r.status >= 500 || r.status === 0) return;          // la Function no contesta: no se toca nada
          if(r.ok === false && r.motivo){ expulsar(r.motivo); return; }
          if(r.sellar){
            var s2 = leerSesion(); if(s2 && s2.email === s.email){ sellar(s2); lsSet(SESSION_KEY, JSON.stringify(s2)); }
          }
          chequearPin();
        });
        return;
      }
      if(maestra){
        // Sin servidor: vale mientras no se cierren las sesiones de la cuenta ni las de quien entró.
        Promise.all([req('GET', NODO+'/cierre/'+mailKey(s.email)+'.json'), req('GET', NODO+'/cierre/'+mailKey(s.maestra)+'.json')]).then(function(c){
          if(Math.max(c[0] || 0, c[1] || 0) > (s.loginTs || 0)) expulsar('cerrada');
        }).catch(function(){});
        return;
      }
      revalidarDirecto(s, ahora, chequearPin);
    });
  }

  // Camino sin servidor (la Function todavía no está configurada): lee `accesos/` directo.
  function revalidarDirecto(s, ahora, chequearPin){
    if(!s.acc){
      // Sesión anterior a este control: se da por buena una sola vez, hasta GRACIA_HASTA.
      req('GET', urlDev(s.email)).then(function(d){
        if(d && d.estado === 'revocado'){ expulsar('revocado'); return; }
        var p = (d && d.estado === 'aprobado') ? Promise.resolve() : req('PUT', urlDev(s.email), {
          estado:'aprobado', cod: codigo(), etq: etiqueta(), ua:(navigator.userAgent||'').slice(0,200),
          alta: ahora, ultimo: ahora, origen:'previo'
        });
        return p.then(function(){
          var s2 = leerSesion(); if(!s2 || s2.email !== s.email) return;
          sellar(s2); lsSet(SESSION_KEY, JSON.stringify(s2));
          registrar(s.email, s.rol, 'ok');
          chequearPin();   // recién con el dispositivo ya registrado: si no, al volver a entrar pediría aprobación
        });
      }).catch(function(){});
      return;
    }
    chequearPin();
    var marca = 'mateu_acceso_rev';
    if(ahora - (parseInt(ssGet(marca), 10) || 0) < REVALIDAR_MS) return;
    ssSet(marca, String(ahora));
    Promise.all([ req('GET', urlDev(s.email)), req('GET', NODO+'/cierre/'+mailKey(s.email)+'.json') ]).then(function(r){
      var d = r[0], cierre = r[1] || 0;
      if(!d || d.estado !== 'aprobado'){ expulsar(d && d.estado === 'pendiente' ? 'pendiente' : 'revocado'); return; }
      if(cierre && cierre > (s.loginTs || 0)){ expulsar('cerrada'); return; }
      if(ahora - (d.ultimo || 0) > DIA_MS) req('PATCH', urlDev(s.email), {ultimo: ahora}).catch(function(){});
    }).catch(function(){});
  }

  var MENSAJES = {
    pendiente: 'Este dispositivo todavía no está autorizado para esa cuenta.',
    revocado: 'Este dispositivo fue bloqueado para esa cuenta. Hablá con gerencia.',
    cerrada: 'Gerencia cerró las sesiones de esta cuenta. Volvé a ingresar.',
    reingresar: 'Por seguridad hay que volver a ingresar.',
    pin: 'Por seguridad cada cuenta tiene que crear un PIN nuevo. Ingresá con tu PIN actual y elegí el nuevo.'
  };

  window.Acceso = {
    ROLES: ROLES, APRUEBAN: APRUEBAN, MAESTRAS: MAESTRAS, claveMaestra: claveMaestra, NODO: NODO, MENSAJES: MENSAJES,
    controla: controla, puedeAprobar: puedeAprobar, mailKey: mailKey,
    devId: devId, codigo: codigo, etiqueta: etiqueta,
    debeCambiarPin: debeCambiarPin, PIN_DESDE: PIN_DESDE,
    servidor: servidor, api: api, devInfo: devInfo, tokenSesion: tokenSesion, verificarPin: verificarPin,
    verificarLogin: verificarLogin, registrar: registrar, sellar: sellar, revalidar: revalidar
  };

  revalidar();
})();
