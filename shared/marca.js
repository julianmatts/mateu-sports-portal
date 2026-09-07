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
   Todo self-contained (el logo es SVG generado acá, sin archivos sueltos).
   ============================================================ */
(function(){
  'use strict';
  var SESSION_KEY = 'mateu_portal_session';
  var KEY_LOGIN = 'mateu_marca_login';     // marca de la pantalla de ingreso (por dispositivo)
  var KEY_VISTA = 'mateu_marca_vista';     // gerencia mirando una sucursal (por pestaña + página)
  var KEY_AVISO = 'mateu_marca_aviso_v1';  // aviso de bienvenida ya mostrado

  var sc = document.currentScript || (function(){ var s=document.querySelectorAll('script[src*="shared/marca"]'); return s[s.length-1]; })();
  var ROOT = (sc && sc.src) ? sc.src.replace(/shared\/marca\.js.*$/, '') : '../';

  /* ---------- logo de Aurelius (SVG propio: escudo + corona + palabra) ---------- */
  var ROJO_AU = '#C2201F';
  var ESCUDO = 'M8 10 Q50 20 92 10 C98 42 87 80 50 94 C13 80 2 42 8 10 Z';
  var CORONA = 'M50 25 C53 37 55.5 48 58 59 C62 52 68 44 75 35 C73 47 71 57 69 65 Q50 72 31 65 C29 57 27 47 25 35 C32 44 38 52 42 59 C44.5 48 47 37 50 25 Z';
  function emblema(x, y, esc, plano){
    return '<g transform="translate('+x+' '+y+') scale('+esc+')">'
      +(plano ? '' : '<defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f4f6"/><stop offset="1" stop-color="#9a9aa2"/></linearGradient></defs>')
      +'<path d="'+ESCUDO+'" fill="'+(plano ? '#b9b9c0' : 'url(#ag)')+'"/>'
      +'<path d="'+ESCUDO+'" fill="'+ROJO_AU+'" transform="translate(50 52) scale(.86) translate(-50 -52)"/>'
      +'<path d="'+CORONA+'" fill="#fff"/></g>';
  }
  function letras(x, y, esc, color){
    // AURELIUS en trazos geométricos redondeados (alto de caja 60, trazo 11)
    return '<g fill="none" stroke="'+color+'" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" transform="translate('+x+' '+y+') scale('+esc+')">'
      +'<path d="M0 60 L22 0 L44 60 M9 37 H35"/>'
      +'<path transform="translate(58 0)" d="M0 0 V38 A22 22 0 0 0 44 38 V0"/>'
      +'<path transform="translate(116 0)" d="M0 60 V0 H27 A16 16 0 0 1 27 32 H0 M25 32 L44 60"/>'
      +'<path transform="translate(174 0)" d="M40 0 H0 V60 H40 M0 30 H30"/>'
      +'<path transform="translate(228 0)" d="M0 0 V60 H38"/>'
      +'<path transform="translate(280 0)" d="M0 0 V60"/>'
      +'<path transform="translate(294 0)" d="M0 0 V38 A22 22 0 0 0 44 38 V0"/>'
      +'<path transform="translate(352 0)" d="M42 12 Q42 0 30 0 H12 Q0 0 0 12 V18 Q0 30 12 30 H30 Q42 30 42 42 V48 Q42 60 30 60 H12 Q0 60 0 48"/>'
      +'</g>';
  }
  function svgUri(vb, inner){
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+vb+'">'+inner+'</svg>');
  }

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
      logoH: svgUri('0 0 455 100', emblema(0,0,1,false)+letras(122,21,.8,'#fff')),        // header (apaisado)
      logoV: svgUri('0 0 420 196', emblema(160,0,1,false)+letras(7,118,1,'#fff')),        // login / pantallas (apilado)
      icono: svgUri('0 0 100 100', emblema(0,0,1,false)),                                  // favicon / ítems
      css: ''
        +':root[data-marca=aurelius]{--navy:#0b0b0d;--navy-mid:#2b2b31;--navy-soft:#19191d;--red:#C2201F;--red-soft:#ff4a45;'
        +'--off:#f4f4f6;--muted:#6d6d77;--muted-light:#b6b6be;--border:#e0e0e5;--shadow:0 1px 4px rgba(0,0,0,.08);--shadow-md:0 8px 30px rgba(0,0,0,.2);'
        +'--marca-navy:#0b0b0d;--marca-red:#C2201F;--marca-off:#f4f4f6;--marca-mid:#2b2b31}'
        // fondo del login (el Portal lo tiene horneado en navy)
        +'[data-marca=aurelius] #login{background:radial-gradient(120% 120% at 50% 0%,#26262b 0%,#050506 60%)!important}'
        +'[data-marca=aurelius] .login-head img{height:104px!important;margin-bottom:8px!important}'
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
      +'.marca-nota{margin-top:16px;padding:10px 12px;border-radius:8px;background:var(--marca-off,#f5f7fc);border:1px solid #e0e0e5;font-family:Barlow,system-ui,sans-serif;font-size:12.5px;line-height:1.45;color:#444}'
      +'.marca-nota b{color:var(--marca-navy,#0B1527)}.marca-nota a{color:var(--marca-red,#CC0000);font-weight:600;cursor:pointer;text-decoration:underline}'
      +'.marca-acc img{width:22px;height:22px;flex:0 0 auto}'
      +'.marca-modal{position:fixed;inset:0;z-index:2147482000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:18px;font-family:Barlow,system-ui,sans-serif}'
      +'.marca-card{width:100%;max-width:440px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.5);color:#1a1a1e}'
      +'.marca-head{background:#050506;border-bottom:3px solid var(--marca-red,#C2201F);padding:22px 20px 16px;text-align:center}'
      +'.marca-head img{height:82px}'
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

  function logos(m){
    var M = m ? MARCAS[m] : null;
    var imgs = document.querySelectorAll(SEL_LOGO);
    for(var i=0;i<imgs.length;i++){
      var img = imgs[i];
      if(M){
        if(img.getAttribute('data-marca-logo')===m) continue;
        if(!img.hasAttribute('data-marca-orig')){ img.setAttribute('data-marca-orig', img.getAttribute('src')||''); img.setAttribute('data-marca-alt', img.getAttribute('alt')||''); }
        var apilado = !!(img.closest && img.closest('.login-head,.marca-apilado'));
        img.setAttribute('src', apilado ? M.logoV : M.logoH);
        img.setAttribute('alt', M.nombre);
        img.setAttribute('data-marca-logo', m);
      } else if(img.hasAttribute('data-marca-orig')){
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
    d.innerHTML = '<b>Acceso '+M.nombre+'.</b> Guardá esta dirección en favoritos o agregala a la pantalla de inicio del celular: el ingreso y la app quedan con la estética '+M.nombre+'. <a id="marcaNotaComo">Cómo hacerlo</a>';
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
      +'<div class="marca-head"><img src="'+M.logoV+'" alt="'+M.nombre+'"></div>'
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
