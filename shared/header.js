/* ============================================================
   Header unificado del SHELL — Portal Mateu Sports.
   Vanilla JS, cero dependencias. Mismo header que Indicadores:
   botón MENÚ (rojo, abre el drawer lateral con las herramientas
   de la sesión) + logo centrado (vuelve al Portal) + calendario
   retail a la derecha.

   Uso (en el <head> de cada módulo):
     <script src="../shared/header.js" defer></script>

   Config opcional (definir ANTES de cargar este script):
     window.MATEU_HEADER = {
       herramienta: 'gestion-stock',  // slug de TOOLS; si falta se deduce de la URL
       calendario: false              // false = no montar el calendario retail
     }

   Notas:
   - Clases con prefijo msh- para no chocar con el CSS de cada módulo.
   - Publica la variable CSS --msh-h (alto real del header) para que los
     elementos sticky de los módulos se ubiquen debajo: top:var(--msh-h,67px).
   - Lee la sesión del Portal (mateu_portal_session); sin sesión el drawer
     ofrece solo el link al Portal. NO redirige: el gate sigue en cada módulo.
   - Carga solo el calendario retail (css+js) si el módulo no lo hizo ya.
   - Indicadores y el Portal raíz tienen su header propio: NO incluir acá.
   ============================================================ */
(function(){
  'use strict';

  // ---- rutas: la raíz del portal se deduce del src de este script ----
  var THIS = document.currentScript ||
    (function(){ var s=document.querySelectorAll('script[src*="header"]'); return s[s.length-1]; })();
  var ROOT = THIS ? new URL('../', THIS.src).href : '../';
  var CFG = window.MATEU_HEADER || {};
  var SESSION_KEY = 'mateu_portal_session';

  var LOGO = 'data:image/webp;base64,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';

  // Mismo mapa que el Portal / Indicadores (nombre e ícono por herramienta).
  // El slug coincide con la carpeta del módulo.
  var TOOLS = {
    indicadores:        { name:'Panel General',             icon:'🏪' }, // «Mi Sucursal» para sucursal/outlet (ver drawer)
    turnero:            { name:'Turnero Depósito',           icon:'📅' },
    marcas:             { name:'Asignación de Marcas',       icon:'🏷️' },
    equipo:             { name:'Área de Producto',           icon:'📦' },
    condiciones:        { name:'Condiciones Comerciales',    icon:'📄' },
    'gestion-stock':    { name:'Gestión de Stock',           icon:'📊' },
    managment:          { name:'Managment',                  icon:'🧾' },
    recepciones:        { name:'Control de Recepciones',     icon:'📥' },
    'pedidos-semanales':{ name:'Pedidos Semanales',          icon:'📝' },
    evaluaciones:       { name:'Evaluaciones de Supervisor', icon:'📋' },
    diagonal80:         { name:'Apertura Diagonal 80',       icon:'🏬' },
    ubicaciones:        { name:'Buscador de Artículos',      icon:'📍' },
    regalias:           { name:'Regalías RUGE / EDLP',       icon:'⚽' },
    presupuesto:        { name:'Presupuesto de Compras',     icon:'💰' },
    barrida:            { name:'Análisis de Reserva Depósito Central', icon:'🧹' },
    picking:            { name:'Picking',                    icon:'📋' },
    objetivos:          { name:'Objetivos de Venta',         icon:'🎯' },
    rrhh:               { name:'Recursos Humanos',           icon:'🧑‍💼' },
    capacitaciones:     { name:'Capacitaciones',             icon:'🎓' }
  };

  // herramienta actual: config o carpeta de la URL (…/<slug>/…)
  function toolActual(){
    if(CFG.herramienta) return CFG.herramienta;
    var m = location.pathname.match(/\/([^\/]+)\/(?:index\.html)?(?:[?#].*)?$/);
    return m ? m[1] : '';
  }

  function leerSesion(){
    try{ return JSON.parse(localStorage.getItem(SESSION_KEY)||'null'); }catch(e){ return null; }
  }
  function esc(s){ return (s==null?'':String(s)).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  // Usuario del mail, con inicial en mayúscula ("julian" -> "Julian", "cristian.campion" -> "Cristian Campion")
  function nombreCorto(email){
    var u = (email||'').split('@')[0] || email || '';
    // Siglas que van todas en mayúscula ("rrhh" -> "RRHH"), el resto con inicial.
    return u ? u.split(/[._-]+/).map(function(p){ return !p ? p : /^rrhh$/i.test(p) ? 'RRHH' : p.charAt(0).toUpperCase()+p.slice(1); }).join(' ') : '—';
  }

  // ---- estilos (colores horneados: no dependen de las variables del módulo) ----
  var CSS = ''
  +'.msh-top{background:#0B1527;border-bottom:3px solid #CC0000;position:sticky;top:0;z-index:100}'
  +'.msh-top-in{max-width:1240px;margin:0 auto;padding:12px 12px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px}'
  +'html .msh-top-in{padding-top:calc(12px + env(safe-area-inset-top,0px))}'
  +'.msh-logo{grid-column:2;justify-self:center;display:inline-flex;align-items:center;text-decoration:none;line-height:0}'
  +'.msh-logo img{height:40px;filter:brightness(0) invert(1)}'
  +'.msh-cal{grid-column:3;justify-self:end;display:flex;align-items:center}'
  +'.msh-menu{grid-column:1;justify-self:start;display:inline-flex;align-items:center;gap:9px;background:#CC0000;color:#fff;border:none;'
  +'border-radius:10px;font-family:\'Barlow Condensed\',sans-serif;font-size:14px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;'
  +'padding:11px 18px;cursor:pointer;box-shadow:0 3px 12px rgba(204,0,0,.35);transition:transform .14s,background .14s}'
  +'.msh-menu:hover{background:#a00000;transform:translateY(-1px)}'
  +'.msh-bars{font-size:18px;line-height:1}'
  /* celular: header compacto (mismas medidas que Indicadores) */
  +'@media(max-width:640px){.msh-top-in{padding:10px 12px;gap:8px}.msh-logo img{height:28px}'
  +'.msh-menu{padding:9px 13px;font-size:13px;gap:7px;letter-spacing:1px}.msh-subbar{padding:8px 12px;gap:8px}}'
  /* barra secundaria opcional de los módulos (controles que vivían en el header viejo) */
  +'.msh-subbar{background:#fff;border-bottom:1px solid #dce3f0;padding:9px 22px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}'
  +'.msh-subbar .msh-sub-t{font-family:\'Barlow Condensed\',sans-serif;font-weight:600;font-size:15px;letter-spacing:.6px;text-transform:uppercase;color:#0B1527}'
  /* drawer */
  +'.msh-scrim{position:fixed;inset:0;background:rgba(11,21,39,.5);opacity:0;visibility:hidden;transition:opacity .25s;z-index:1290}'
  +'.msh-scrim.open{opacity:1;visibility:visible}'
  +'.msh-drawer{position:fixed;top:0;left:0;height:100%;width:322px;max-width:88vw;background:#fff;'
  +'box-shadow:12px 0 40px rgba(11,21,39,.28);transform:translateX(-102%);'
  +'transition:transform .28s cubic-bezier(.2,.8,.2,1);z-index:1291;display:flex;flex-direction:column;font-family:\'Barlow\',sans-serif}'
  +'.msh-drawer.open{transform:translateX(0)}'
  +'.msh-dhead{background:#0B1527;color:#fff;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:3px solid #CC0000}'
  +'.msh-duser{display:flex;align-items:center;gap:12px;min-width:0}'
  +'.msh-dav{width:40px;height:40px;border-radius:50%;background:#CC0000;color:#fff;display:flex;align-items:center;'
  +'justify-content:center;font-family:\'Bebas Neue\',sans-serif;font-size:20px;line-height:1;flex:0 0 auto}'
  +'.msh-dname{font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:16px;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  +'.msh-drole{font-family:\'Barlow Condensed\',sans-serif;font-size:10.5px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#ff3b3b;margin-top:2px}'
  +'.msh-dclose{background:transparent;border:none;color:rgba(255,255,255,.75);font-size:26px;line-height:1;cursor:pointer;padding:0 4px;flex:0 0 auto}'
  +'.msh-dclose:hover{color:#fff}'
  /* blindado contra módulos que estilan el elemento nav a secas (equipo,
     gestion-stock, pedidos, recepcion definen nav{display:flex;height;sticky;…}) */
  +'.msh-dnav{flex:1 1 auto;display:block;position:static;top:auto;height:auto;min-height:0;'
  +'overflow-y:auto;overflow-x:hidden;padding:10px;background:transparent;border:0;box-shadow:none}'
  +'.msh-ditem{display:flex;align-items:center;gap:13px;padding:11px 12px;border-radius:12px;text-decoration:none;color:#0B1527;transition:background .14s}'
  +'.msh-ditem:hover{background:#f0f3fa}'
  +'.msh-ditem .msh-ic{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:19px;flex:0 0 auto;background:#eef1f8;transition:background .14s}'
  +'.msh-ditem .msh-nm{font-family:\'Barlow Condensed\',sans-serif;font-weight:600;font-size:15px;letter-spacing:.3px;display:block}'
  +'.msh-ditem.cur{background:#fbeaea}'
  +'.msh-ditem.cur .msh-ic{background:#CC0000}'
  +'.msh-ditem.cur .msh-nm{color:#CC0000}'
  +'.msh-dfoot{padding:12px;border-top:1px solid #dce3f0;display:flex;flex-direction:column;gap:8px}'
  +'.msh-dhome{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:10px;text-decoration:none;'
  +'color:#0B1527;font-family:\'Barlow Condensed\',sans-serif;font-weight:600;font-size:14px;letter-spacing:.3px}'
  +'.msh-dhome:hover{background:#f0f3fa}'
  +'.msh-dsalir{width:100%;padding:12px;border:1px solid #f0bfbc;border-radius:10px;background:#fdeceb;color:#c0261f;'
  +'font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all .14s}'
  +'.msh-dsalir:hover{background:#c0261f;color:#fff;border-color:#c0261f}';

  function montar(){
    if(document.querySelector('.msh-top')) return;   // guardia contra doble carga

    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    // Puesto de consulta del salón (quiosco a la vista de clientes): header
    // pelado — sin botón Menú, sin drawer y con el logo SIN link al Portal.
    var S0 = leerSesion() || {};
    var esPuesto = S0.rol === 'puesto';

    // ---- barra superior ----
    var top = document.createElement('div');
    top.className = 'msh-top';
    top.innerHTML = '<div class="msh-top-in">'
      +(esPuesto ? '<span></span>'
        : '<button class="msh-menu" id="mshMenuBtn" aria-haspopup="true" aria-expanded="false" aria-controls="mshDrawer"><span class="msh-bars">☰</span> Menú</button>')
      +(esPuesto ? '<span class="msh-logo"><img src="'+LOGO+'" alt="Mateu Sports"></span>'
        : '<a class="msh-logo" href="'+ROOT+'" title="Volver al Portal"><img src="'+LOGO+'" alt="Mateu Sports"></a>')
      +'<span class="msh-cal"></span>'
      +'</div>';
    document.body.insertBefore(top, document.body.firstChild);

    if(esPuesto){
      // sin drawer: solo publicar --msh-h y montar el calendario
      var setH0 = function(){ document.documentElement.style.setProperty('--msh-h', top.offsetHeight+'px'); };
      setH0();
      window.addEventListener('resize', setH0);
      montarCalendario();
      return;
    }

    // ---- drawer ----
    var scrim = document.createElement('div');
    scrim.className = 'msh-scrim'; scrim.id = 'mshScrim';
    var dr = document.createElement('aside');
    dr.className = 'msh-drawer'; dr.id = 'mshDrawer';
    dr.setAttribute('aria-hidden','true'); dr.setAttribute('aria-label','Menú');
    dr.innerHTML = '<div class="msh-dhead">'
      +'<div class="msh-duser"><div class="msh-dav" id="mshDav">?</div>'
      +'<div style="min-width:0"><div class="msh-dname" id="mshDname">—</div><div class="msh-drole" id="mshDrole">—</div></div></div>'
      +'<button class="msh-dclose" id="mshDclose" title="Cerrar" aria-label="Cerrar menú">×</button></div>'
      +'<nav class="msh-dnav" id="mshDnav"></nav>'
      +'<div class="msh-dfoot">'
      // Bandeja de mensajes del Portal (tablero + directos); ?ver=bandeja evita el redirect a Indicadores
      +'<a class="msh-dhome" id="mshDbandeja" href="'+ROOT+'?ver=bandeja">📬 <span>Bandeja de mensajes</span></a>'
      // ?ver=portal: evita que el Portal rebote a sucursal/outlet de vuelta a Indicadores
      +'<a class="msh-dhome" id="mshDhome" href="'+ROOT+'?ver=portal">🏠 <span>Portal (todas las herramientas)</span></a>'
      +'<button class="msh-dsalir" id="mshDsalir">⎋ Cerrar sesión</button></div>';
    document.body.appendChild(scrim);
    document.body.appendChild(dr);

    // ---- sesión → usuario + herramientas ----
    var S = S0;
    var ROLE = {admin:'Administrador',sucursal:'Sucursal',outlet:'Outlet',supervisor:'Supervisor',deposito:'Depósito',puesto:'Puesto de consulta'};
    var esGerencia = S.rol==='admin' || S.rol==='supervisor';
    // slug del Portal -> legible ("diagonal" -> "Diagonal", "calle-49" -> "Calle 49")
    var bonito = function(s){ return s ? String(s).split('-').map(function(p){ return p ? p.charAt(0).toUpperCase()+p.slice(1) : p; }).join(' ') : ''; };
    var raw = esGerencia ? nombreCorto(S.email) : (bonito(S.sucursal || S.outlet_id) || nombreCorto(S.email));
    var nombre = (raw||'').replace(/^\d+-\s*/,'');   // "01-MS Plaza Italia" -> "MS Plaza Italia"
    document.getElementById('mshDname').textContent = nombre || '—';
    document.getElementById('mshDrole').textContent = ROLE[S.rol] || S.rol || 'Sin sesión';
    document.getElementById('mshDav').textContent = (nombre||'?').trim().charAt(0).toUpperCase() || '?';

    var cur = toolActual();
    var herr = (S.herramientas||[]).filter(function(h){ return TOOLS[h]; });
    document.getElementById('mshDnav').innerHTML = herr.map(function(h){
      var t = TOOLS[h], on = (h===cur);
      var nm = (h==='indicadores' && (S.rol==='sucursal'||S.rol==='outlet')) ? 'Mi Sucursal' : t.name;
      return '<a class="msh-ditem'+(on?' cur':'')+'" href="'+(on?'./':ROOT+h+'/')+'"'+(on?' aria-current="page"':'')+'>'
        +'<span class="msh-ic">'+t.icon+'</span><span><span class="msh-nm">'+esc(nm)+'</span></span></a>';
    }).join('') || '<div style="padding:14px;color:#6B7A99;font-size:13px">Sin herramientas asignadas.</div>';

    // Para sucursal/outlet la home es Indicadores (ya está en su lista): el link al Portal es de gerencia.
    document.getElementById('mshDhome').style.display = (S.rol==='sucursal'||S.rol==='outlet') ? 'none' : 'flex';

    var btn = document.getElementById('mshMenuBtn');
    var abrir = function(){ dr.classList.add('open'); scrim.classList.add('open'); dr.setAttribute('aria-hidden','false'); btn.setAttribute('aria-expanded','true'); };
    var cerrar = function(){ dr.classList.remove('open'); scrim.classList.remove('open'); dr.setAttribute('aria-hidden','true'); btn.setAttribute('aria-expanded','false'); };
    btn.onclick = abrir; scrim.onclick = cerrar;
    document.getElementById('mshDclose').onclick = cerrar;
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') cerrar(); });
    document.getElementById('mshDsalir').onclick = function(){
      try{ localStorage.removeItem(SESSION_KEY); }catch(e){}
      location.replace(ROOT);
    };

    // ---- --msh-h: alto real del header para los sticky de los módulos ----
    var setH = function(){ document.documentElement.style.setProperty('--msh-h', top.offsetHeight+'px'); };
    setH();
    window.addEventListener('resize', setH);

    // ---- calendario retail (si el módulo no lo cargó ya) ----
    montarCalendario();
  }

  function montarCalendario(){
    if(CFG.calendario!==false && !window.CALENDARIO_RETAIL_CONFIG){
      window.CALENDARIO_RETAIL_CONFIG = { mount:'.msh-cal' };
      var lk = document.createElement('link');
      lk.rel = 'stylesheet';
      lk.href = ROOT+'shared/components/calendario-retail/calendario.css';
      document.head.appendChild(lk);
      var sc = document.createElement('script');
      sc.src = ROOT+'shared/components/calendario-retail/calendario.js';
      document.head.appendChild(sc);
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();

  /* Bloqueo por inactividad de las cuentas de encargado (shared/bloqueo.js):
     se carga solo desde acá, así ningún módulo con header unificado se lo
     olvida. El Portal e Indicadores (header propio) lo incluyen a mano. */
  if(!document.querySelector('script[src*="shared/bloqueo"]')){
    var sb = document.createElement('script');
    sb.src = ROOT+'shared/bloqueo.js';
    document.head.appendChild(sb);
  }

  /* Mantener el service worker del Portal al día desde cualquier módulo.
     El registro original vive en el index raíz, pero sucursal/gerencia son
     redirigidas a Indicadores antes del evento load: sin esto, el sw.js nuevo
     recién se descargaba cuando Chrome revisaba por su cuenta (cada 24 h) y
     mientras tanto la restauración de sesión servía páginas viejas. */
  if('serviceWorker' in navigator){
    try{
      var swURL = ROOT + 'sw.js';
      var refresco = function(reg){ if(reg && reg.update) reg.update().catch(function(){}); };
      navigator.serviceWorker.register(swURL).then(function(reg){
        refresco(reg);
        document.addEventListener('visibilitychange', function(){ if(!document.hidden) refresco(reg); });
        window.addEventListener('focus', function(){ refresco(reg); });
      }).catch(function(){});
    }catch(e){}
  }
})();
