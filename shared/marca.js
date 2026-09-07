/* ============================================================
   Estética por marca — Portal Mateu Sports (shared/marca.js)
   ============================================================
   Las sucursales AURELIUS (Aurelius 12, 5, CB y el outlet Aurelius 10) ven el
   portal con la estética de Aurelius: negro + rojo + blanco y el logo de Aurelius
   en lugar del de Mateu. El resto no nota nada.

   Cómo decide qué marca aplicar (en este orden):
     1. Gerencia mirando una sucursal: el módulo avisa con `Marca.vista(slug)`
        (Indicadores al elegir la sucursal, Buscador, Tareas). Vale solo para ESA
        página (sessionStorage `mateu_marca_vista` guarda {path, marca}).
     2. La sesión del Portal: cuentas de sucursal/outlet/depósito/puesto cuya
        sucursal es Aurelius (`sucursal` u `outlet_id` empieza con "aurelius").
     3. Sin sesión (pantalla de ingreso): `?marca=aurelius` en la URL o la última
        marca con la que se entró en este dispositivo (localStorage
        `mateu_marca_login`; el Portal la guarda al iniciar sesión).

   Qué hace: pone `data-marca="aurelius"` en <html>, inyecta la paleta (pisa las
   variables --navy/--red/--off/… del módulo y publica --marca-navy/--marca-red/
   --marca-off/--marca-mid para los scripts del shell), reemplaza el logo de
   Mateu (todo <img alt="Mateu Sports">) por el de Aurelius, cambia el título,
   el theme-color, el manifest y el ícono de la app instalada, suma «Acceso
   Aurelius» al drawer (cómo guardar el link / instalar la app) y una nota en el
   login. Se incluye SIN defer, antes de iconos.js, en el <head> de cada módulo:
     <script src="../shared/marca.js"></script>
   Todo self-contained (el isotipo oficial va embebido como PNG en data URI, sin archivos sueltos).
   ============================================================ */
(function(){
  'use strict';
  var SESSION_KEY = 'mateu_portal_session';
  var KEY_LOGIN = 'mateu_marca_login';     // marca de la pantalla de ingreso (por dispositivo)
  var KEY_VISTA = 'mateu_marca_vista';     // gerencia mirando una sucursal (por pestaña + página)
  var KEY_AVISO = 'mateu_marca_aviso_v1';  // aviso de bienvenida ya mostrado

  var sc = document.currentScript || (function(){ var s=document.querySelectorAll('script[src*="shared/marca"]'); return s[s.length-1]; })();
  var ROOT = (sc && sc.src) ? sc.src.replace(/shared\/marca\.js.*$/, '') : '../';

  /* ---------- logo de Aurelius: isotipo OFICIAL (escudo + corona), PNG embebido ----------
     Sale del identificador que pasó Juli (07/09/2026, «id aurelius_Mesa de trabajo 1.png»,
     4500 px), reducido a 200 px de alto. La palabra AURELIUS no existe como dibujo:
     se tipea en Bebas Neue al lado del isotipo (.marca-lockup / .marca-word). */
  var ISO_AU = 'data:image/png;base64,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';

  /* ---------- las marcas ---------- */
  var MARCAS = {
    aurelius: {
      id: 'aurelius',
      nombre: 'Aurelius',
      appNombre: 'Portal Aurelius',
      appCorto: 'Aurelius',
      themeColor: '#000000',
      manifest: 'manifest-aurelius.json',
      appleIcon: 'icons/aurelius-180.png',
      esSlug: function(s){ return /^aurelius/i.test(String(s||'')); },
      iso: ISO_AU,               // isotipo oficial (header, login, modal, drawer, favicon)
      icono: ISO_AU,
      palabra: 'AURELIUS',       // se tipea al lado del isotipo
      css: ''
        +':root[data-marca=aurelius]{--navy:#0b0b0d;--navy-mid:#2b2b31;--navy-soft:#19191d;--red:#C2201F;--red-soft:#ff4a45;'
        +'--off:#f4f4f6;--muted:#6d6d77;--muted-light:#b6b6be;--border:#e0e0e5;--shadow:0 1px 4px rgba(0,0,0,.08);--shadow-md:0 8px 30px rgba(0,0,0,.2);'
        +'--marca-navy:#0b0b0d;--marca-red:#C2201F;--marca-off:#f4f4f6;--marca-mid:#2b2b31}'
        // fondo del login (el Portal lo tiene horneado en navy)
        +'[data-marca=aurelius] #login{background:radial-gradient(120% 120% at 50% 0%,#26262b 0%,#050506 60%)!important}'
        // login: logo apaisado a la altura del de Mateu; el subtítulo «Aurelius» sobra (ya lo dice el logo)
        +'[data-marca=aurelius] .login-head .marca-lockup{margin-bottom:14px}'
        +'[data-marca=aurelius] .login-head .marca-lockup img{height:46px!important;margin:0!important}'
        +'[data-marca=aurelius] .login-head .marca-word{font-size:38px}'
        +'[data-marca=aurelius] .login-head .s{display:none!important}'
        +'[data-marca=aurelius] .msh-ditem:hover,[data-marca=aurelius] .msh-dhome:hover{background:#f1f1f3}'
        +'[data-marca=aurelius] .msh-ditem .msh-ic{background:#ececef}'
    }
  };

  /* ---------- sesión / resolución ---------- */
  function leerSesion(){
    try{ var raw = localStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; }catch(e){ return (window.__sess||null); }
  }
  function esGerencia(s){ return !!s && (s.rol==='admin' || s.rol==='supervisor' || s.rol==='capacitador'); }
  function slugDe(s){ if(!s) return null; return (s.rol==='outlet' ? s.outlet_id : s.sucursal) || s.outlet_id || null; }
  function marcaDeSlug(slug){
    if(!slug) return null;
    for(var k in MARCAS){ if(MARCAS[k].esSlug(slug)) return k; }
    return null;
  }
  function marcaSesion(s){ return esGerencia(s) ? null : marcaDeSlug(slugDe(s)); }
  function marcaVista(){
    // undefined = sin registro para esta página; null = gerencia mira algo que no es de marca
    try{
      var v = JSON.parse(sessionStorage.getItem(KEY_VISTA)||'null');
      if(v && v.path===location.pathname) return v.marca || null;
    }catch(e){}
    return undefined;
  }
  function marcaLogin(){
    var q = null;
    try{ q = new URLSearchParams(location.search).get('marca'); }catch(e){}
    if(q){
      if(MARCAS[q]){ try{ localStorage.setItem(KEY_LOGIN, q); }catch(e){} return q; }
      try{ localStorage.removeItem(KEY_LOGIN); }catch(e){}   // ?marca=mateu (o cualquier otra cosa) vuelve al Portal común
      return null;
    }
    try{ var g = localStorage.getItem(KEY_LOGIN); return MARCAS[g] ? g : null; }catch(e){ return null; }
  }
  function resolver(){
    var s = leerSesion();
    if(s && s.email){
      if(esGerencia(s)){ var v = marcaVista(); return v===undefined ? null : v; }
      return marcaSesion(s);
    }
    return marcaLogin();
  }

  /* ---------- aplicar ---------- */
  var ACTIVA = null, _tituloOrig = null, _estilo = null, _metaOrig = {};
  var SEL_LOGO = 'img[alt="Mateu Sports"],img[data-marca-logo]';
  var TEXTOS = [ ['.login-head .s', /^\s*Mateu Sports\s*$/i], ['.mbl-marca', /^\s*MATEU SPORTS\s*$/i] ];

  function asegurarEstilo(){
    if(_estilo) return;
    _estilo = document.createElement('style');
    _estilo.id = 'marcaEstilo';
    var css = ':root{--marca-navy:#0B1527;--marca-red:#CC0000;--marca-off:#f5f7fc;--marca-mid:#1a2f55}';
    for(var k in MARCAS) css += MARCAS[k].css;
    css += ''
      +'[data-marca] img[data-marca-logo]{filter:none!important}'
      // lockup: isotipo + AURELIUS tipeado. El alto del <img> lo sigue poniendo el módulo; la palabra va a escala.
      +'.marca-lockup{display:inline-flex;align-items:center;gap:.32em;line-height:1;vertical-align:middle;text-decoration:none}'
      +'.marca-word{font-family:"Bebas Neue","Barlow Condensed",Impact,sans-serif;font-weight:400;letter-spacing:2.5px;color:#fff;font-size:30px;line-height:.9;padding-top:.06em}'
      +'.msh-logo .marca-word{font-size:32px}.top .marca-word{font-size:30px}'
      +'@media(max-width:640px){.msh-logo .marca-word,.top .marca-word{font-size:23px}}'
      +'@media(max-width:480px){.top .marca-word{font-size:21px}}'
      +'.marca-head .marca-lockup img{height:40px}.marca-head .marca-word{font-size:34px}'
      +'.marca-nota{margin-top:18px;text-align:center;font-family:"Barlow Condensed",Barlow,system-ui,sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#8a8a93}'
      +'.marca-nota a{color:var(--marca-red,#CC0000);font-weight:700;cursor:pointer;text-decoration:none;border-bottom:1px solid currentColor}.marca-nota a:hover{opacity:.8}'
      +'.marca-acc img{width:22px;height:22px;flex:0 0 auto}'
      +'.marca-modal{position:fixed;inset:0;z-index:2147482000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:18px;font-family:Barlow,system-ui,sans-serif}'
      +'.marca-card{width:100%;max-width:440px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.5);color:#1a1a1e}'
      +'.marca-head{background:#050506;border-bottom:3px solid var(--marca-red,#C2201F);padding:20px 20px 16px;text-align:center}'
            +'.marca-body{padding:18px 20px 20px;font-size:14px;line-height:1.5}'
      +'.marca-body h3{margin:0 0 8px;font-family:"Bebas Neue",Impact,sans-serif;font-weight:400;font-size:24px;letter-spacing:1.5px;color:#0b0b0d}'
      +'.marca-body p{margin:0 0 10px}.marca-body ol{margin:0 0 10px;padding-left:20px}.marca-body li{margin:3px 0}'
      +'.marca-url{display:flex;gap:8px;align-items:center;margin:10px 0 14px}'
      +'.marca-url input{flex:1 1 auto;min-width:0;padding:9px 10px;border:1.5px solid #dcdce1;border-radius:8px;font-family:Barlow,system-ui,sans-serif;font-size:13px;color:#0b0b0d;background:#f7f7f9}'
      +'.marca-url button,.marca-cerrar{padding:9px 14px;border:0;border-radius:8px;background:var(--marca-red,#C2201F);color:#fff;font-family:"Barlow Condensed",Barlow,sans-serif;font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;cursor:pointer}'
      +'.marca-cerrar{width:100%;background:#0b0b0d;margin-top:4px}'
      +'.marca-toast{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147481000;max-width:calc(100vw - 28px);width:420px;'
      +'background:#050506;color:#fff;border-left:4px solid var(--marca-red,#C2201F);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.45);padding:12px 14px;display:flex;gap:12px;align-items:center;font-family:Barlow,system-ui,sans-serif;font-size:13.5px;line-height:1.4}'
      +'.marca-toast img{height:34px;flex:0 0 auto}.marca-toast .tx{flex:1 1 auto}.marca-toast .tx b{display:block;font-family:"Barlow Condensed",Barlow,sans-serif;letter-spacing:.5px;font-size:14px}'
      +'.marca-toast button{background:transparent;border:1px solid rgba(255,255,255,.35);color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer;font-family:"Barlow Condensed",Barlow,sans-serif;font-weight:700;font-size:12px;letter-spacing:1px;text-transform:uppercase}'
      +'.marca-toast .x{border:0;font-size:20px;line-height:1;padding:0 4px;color:rgba(255,255,255,.7)}'
      +'@media print{.marca-toast,.marca-modal{display:none!important}}';
    _estilo.textContent = css;
    (document.head || document.documentElement).appendChild(_estilo);
  }

  function envolver(img, M){
    if(img.parentNode && img.parentNode.classList && img.parentNode.classList.contains('marca-lockup')) return;
    var w = document.createElement('span'); w.className = 'marca-lockup';
    img.parentNode.insertBefore(w, img); w.appendChild(img);
    var t = document.createElement('span'); t.className = 'marca-word'; t.textContent = M.palabra; w.appendChild(t);
  }
  function desenvolver(img){
    var w = img.parentNode;
    if(!(w && w.classList && w.classList.contains('marca-lockup'))) return;
    w.parentNode.insertBefore(img, w); w.parentNode.removeChild(w);
  }
  function logos(m){
    var M = m ? MARCAS[m] : null;
    var imgs = document.querySelectorAll(SEL_LOGO);
    for(var i=0;i<imgs.length;i++){
      var img = imgs[i];
      if(M){
        if(img.getAttribute('data-marca-logo')===m){ envolver(img, M); continue; }
        if(!img.hasAttribute('data-marca-orig')){ img.setAttribute('data-marca-orig', img.getAttribute('src')||''); img.setAttribute('data-marca-alt', img.getAttribute('alt')||''); }
        img.setAttribute('src', M.iso);
        img.setAttribute('alt', M.nombre);
        img.setAttribute('data-marca-logo', m);
        envolver(img, M);
      } else if(img.hasAttribute('data-marca-orig')){
        desenvolver(img);
        img.setAttribute('src', img.getAttribute('data-marca-orig'));
        img.setAttribute('alt', img.getAttribute('data-marca-alt')||'Mateu Sports');
        img.removeAttribute('data-marca-orig'); img.removeAttribute('data-marca-alt'); img.removeAttribute('data-marca-logo');
      }
    }
  }
  function textos(m){
    var M = m ? MARCAS[m] : null;
    for(var i=0;i<TEXTOS.length;i++){
      var els = document.querySelectorAll(TEXTOS[i][0]);
      for(var j=0;j<els.length;j++){
        var el = els[j];
        if(M){
          if(el.hasAttribute('data-marca-txt')) continue;
          if(!TEXTOS[i][1].test(el.textContent)) continue;
          el.setAttribute('data-marca-txt', el.textContent);
          el.textContent = (/[a-z]/.test(el.textContent)) ? M.nombre : M.nombre.toUpperCase();
        } else if(el.hasAttribute('data-marca-txt')){
          el.textContent = el.getAttribute('data-marca-txt'); el.removeAttribute('data-marca-txt');
        }
      }
    }
  }
  function titulo(m){
    var M = m ? MARCAS[m] : null;
    if(M){
      if(/Mateu Sports/i.test(document.title)){ _tituloOrig = document.title; document.title = document.title.replace(/Mateu Sports/gi, M.nombre); }
    } else if(_tituloOrig){ document.title = _tituloOrig; _tituloOrig = null; }
  }
  function metaSet(sel, attr, val){
    var el = document.querySelector(sel); if(!el) return;
    var k = sel+'|'+attr;
    if(val!==null){ if(!(k in _metaOrig)) _metaOrig[k] = el.getAttribute(attr); el.setAttribute(attr, val); }
    else if(k in _metaOrig){ el.setAttribute(attr, _metaOrig[k]); delete _metaOrig[k]; }
  }
  function metas(m){
    var M = m ? MARCAS[m] : null;
    metaSet('meta[name="theme-color"]', 'content', M ? M.themeColor : null);
    metaSet('link[rel="manifest"]', 'href', M ? ROOT+M.manifest : null);
    metaSet('link[rel="apple-touch-icon"]', 'href', M ? ROOT+M.appleIcon : null);
    metaSet('meta[name="apple-mobile-web-app-title"]', 'content', M ? M.appCorto : null);
    metaSet('link[rel="icon"]', 'href', M ? M.icono : null);
  }

  /* ---------- «Acceso Aurelius»: ítem del drawer + nota del login + modal ---------- */
  function urlAcceso(m){
    try{ return new URL(ROOT+'?marca='+m, location.href).href; }catch(e){ return ROOT+'?marca='+m; }
  }
  function drawerItem(m){
    var M = m ? MARCAS[m] : null;
    var viejo = document.getElementById('marcaAcceso');
    if(!M){ if(viejo) viejo.parentNode.removeChild(viejo); return; }
    if(viejo) return;
    var foot = document.querySelector('.msh-dfoot') || document.querySelector('.drawer-foot');
    if(!foot) return;
    var cls = foot.className.indexOf('msh-')===0 ? 'msh-dhome' : 'drawer-home';
    var a = document.createElement('a');
    a.className = cls+' marca-acc'; a.id = 'marcaAcceso'; a.href = '#';
    a.innerHTML = '<img src="'+M.icono+'" alt=""> <span>Acceso '+M.nombre+'</span>';
    a.onclick = function(e){ e.preventDefault(); abrirAcceso(m); };
    var salir = foot.querySelector('.msh-dsalir,.drawer-salir');
    if(salir) foot.insertBefore(a, salir); else foot.appendChild(a);
  }
  function notaLogin(m){
    var M = m ? MARCAS[m] : null;
    var vieja = document.getElementById('marcaNota');
    if(!M){ if(vieja) vieja.parentNode.removeChild(vieja); return; }
    if(vieja) return;
    var body = document.querySelector('#login .login-body'); if(!body) return;
    var d = document.createElement('div');
    d.className = 'marca-nota'; d.id = 'marcaNota';
    d.innerHTML = 'Acceso '+M.nombre+' · <a id="marcaNotaComo">Guardarlo como app</a>';
    body.appendChild(d);
    var a = document.getElementById('marcaNotaComo'); if(a) a.onclick = function(){ abrirAcceso(m); };
  }
  function abrirAcceso(m){
    var M = MARCAS[m]; if(!M) return;
    cerrarAcceso();
    var url = urlAcceso(m);
    var ov = document.createElement('div');
    ov.className = 'marca-modal'; ov.id = 'marcaModal';
    ov.innerHTML = '<div class="marca-card" role="dialog" aria-label="Acceso '+M.nombre+'">'
      +'<div class="marca-head"><span class="marca-lockup"><img src="'+M.iso+'" alt="'+M.nombre+'"><span class="marca-word">'+M.palabra+'</span></span></div>'
      +'<div class="marca-body">'
      +'<h3>Acceso '+M.nombre+'</h3>'
      +'<p>Las cuentas de las sucursales '+M.nombre+' ven el portal con la estética '+M.nombre+' apenas ingresan. Para que <b>también la pantalla de ingreso y el ícono de la app</b> sean '+M.nombre+', entrá siempre por este link:</p>'
      +'<div class="marca-url"><input type="text" readonly value="'+url.replace(/"/g,'&quot;')+'" id="marcaUrl"><button type="button" id="marcaCopiar">Copiar</button></div>'
      +'<p><b>Guardarlo como app en el celular</b></p>'
      +'<ol>'
      +'<li><b>iPhone</b> (Safari): abrí el link, tocá <b>Compartir</b> y después <b>Agregar a pantalla de inicio</b>.</li>'
      +'<li><b>Android</b> (Chrome): abrí el link, menú <b>⋮</b> y después <b>Instalar app</b> (o <b>Agregar a pantalla principal</b>).</li>'
      +'</ol>'
      +'<p style="color:#6d6d77;font-size:12.5px">Si ya tenés instalada la app de Mateu, esta se agrega como una app aparte con el escudo de '+M.nombre+'. En la computadora alcanza con guardar el link en favoritos.</p>'
      +'<button type="button" class="marca-cerrar" id="marcaCerrar">Entendido</button>'
      +'</div></div>';
    document.body.appendChild(ov);
    ov.onclick = function(e){ if(e.target===ov) cerrarAcceso(); };
    document.getElementById('marcaCerrar').onclick = cerrarAcceso;
    document.getElementById('marcaCopiar').onclick = function(){
      var inp = document.getElementById('marcaUrl'), b = this;
      var ok = function(){ b.textContent = 'Copiado ✓'; setTimeout(function(){ b.textContent='Copiar'; }, 1800); };
      if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(ok, function(){ inp.select(); try{ document.execCommand('copy'); ok(); }catch(e){} }); }
      else { inp.select(); try{ document.execCommand('copy'); ok(); }catch(e){} }
    };
    try{ localStorage.setItem(KEY_AVISO, '1'); }catch(e){}
  }
  function cerrarAcceso(){ var ov = document.getElementById('marcaModal'); if(ov) ov.parentNode.removeChild(ov); }

  // Aviso de bienvenida (una vez por dispositivo): la cuenta ya entró con la
  // estética de su marca y le contamos dónde está la explicación.
  function avisoInicial(m){
    var M = m ? MARCAS[m] : null; if(!M) return;
    var s = leerSesion(); if(!s || !s.email || s.rol==='puesto' || esGerencia(s)) return;
    try{ if(localStorage.getItem(KEY_AVISO)) return; }catch(e){ return; }
    if(document.getElementById('marcaToast')) return;
    var t = document.createElement('div');
    t.className = 'marca-toast'; t.id = 'marcaToast';
    t.innerHTML = '<img src="'+M.icono+'" alt=""><div class="tx"><b>Portal con la estética '+M.nombre+'</b>En <b>Menú → Acceso '+M.nombre+'</b> te contamos cómo guardarlo como app con el escudo de '+M.nombre+'.</div>'
      +'<button type="button" id="marcaToastVer">Ver</button><button type="button" class="x" id="marcaToastX" aria-label="Cerrar">×</button>';
    document.body.appendChild(t);
    var fin = function(){ try{ localStorage.setItem(KEY_AVISO,'1'); }catch(e){} if(t.parentNode) t.parentNode.removeChild(t); };
    document.getElementById('marcaToastX').onclick = fin;
    document.getElementById('marcaToastVer').onclick = function(){ fin(); abrirAcceso(m); };
    setTimeout(fin, 20000);
  }

  function aplicar(m){
    m = (m && MARCAS[m]) ? m : null;
    ACTIVA = m;
    var root = document.documentElement;
    if(m) root.setAttribute('data-marca', m); else root.removeAttribute('data-marca');
    asegurarEstilo();
    metas(m); titulo(m);
    if(document.body){ logos(m); textos(m); drawerItem(m); notaLogin(m); }
  }
  function refrescar(){ aplicar(resolver()); }

  /* ---------- API pública ---------- */
  window.Marca = {
    activa: function(){ return ACTIVA; },
    deSlug: marcaDeSlug,
    refrescar: refrescar,
    // Gerencia eligió una sucursal para mirar (null = ninguna / todas). Solo
    // cambia la estética de ESTA página y solo para admin/supervisor.
    vista: function(slug){
      var s = leerSesion(); if(!esGerencia(s)) return;
      var m = marcaDeSlug(slug);
      try{
        if(m) sessionStorage.setItem(KEY_VISTA, JSON.stringify({path:location.pathname, marca:m}));
        else sessionStorage.removeItem(KEY_VISTA);
      }catch(e){}
      refrescar();
    },
    // El Portal avisa al iniciar sesión: la pantalla de ingreso de este
    // dispositivo recuerda la marca de la última cuenta que entró.
    alIniciarSesion: function(session){
      var m = marcaSesion(session);
      try{ if(m) localStorage.setItem(KEY_LOGIN, m); else localStorage.removeItem(KEY_LOGIN); }catch(e){}
      refrescar();
    },
    abrirAcceso: function(m){ abrirAcceso(m || ACTIVA || 'aurelius'); },
    urlAcceso: function(m){ return urlAcceso(m || ACTIVA || 'aurelius'); }
  };

  /* ---------- arranque ---------- */
  aplicar(resolver());   // lo antes posible (sin defer): evita el parpadeo del tema Mateu

  var _pend = false;
  function reaplicar(){
    if(_pend) return; _pend = true;
    (window.requestAnimationFrame || setTimeout)(function(){
      _pend = false;
      if(!ACTIVA) return;
      logos(ACTIVA); textos(ACTIVA); drawerItem(ACTIVA); notaLogin(ACTIVA); titulo(ACTIVA);
    });
  }
  function listo(){
    aplicar(resolver());
    // lo que header.js / bloqueo.js / el módulo inyectan después (logo, drawer, título…)
    if(window.MutationObserver){
      new MutationObserver(reaplicar).observe(document.documentElement, {childList:true, subtree:true});
    } else { setInterval(reaplicar, 1500); }
    // otra pestaña inició/cerró sesión
    window.addEventListener('storage', function(e){ if(e.key===SESSION_KEY || e.key===KEY_LOGIN) refrescar(); });
    setTimeout(function(){ avisoInicial(ACTIVA); }, 1600);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', listo); else listo();
})();
