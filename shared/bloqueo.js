/* ============================================================
   Bloqueo por inactividad — Portal Mateu Sports.
   Vanilla JS, cero dependencias, self-contained.

   Qué hace: si la cuenta de un ENCARGADO (rol sucursal / outlet)
   pasa BLOQUEO_MIN minutos sin actividad (mouse, teclado, touch,
   scroll) en cualquier módulo del portal, se tapa la pantalla con
   una cortina navy y hay que volver a ingresar el PIN de la cuenta
   para seguir. La sesión NO se cierra: al desbloquear se sigue en
   la misma pantalla, con todo como estaba.

   Uso:
   - shared/header.js lo carga solo en todos los módulos que usan el
     header unificado (no hace falta incluirlo ahí).
   - El Portal raíz e Indicadores (header propio) lo incluyen con:
       <script src="shared/bloqueo.js" defer></script>   (Portal)
       <script src="../shared/bloqueo.js" defer></script> (Indicadores)

   Config opcional (definir ANTES de cargar este script):
     window.MATEU_BLOQUEO = { minutos: 10, roles: ['sucursal','outlet'] }

   Cómo funciona:
   - La última actividad se guarda en localStorage (`mateu_bloqueo_act`),
     compartida entre pestañas y módulos: navegar de Mi Sucursal al
     Buscador no reinicia nada raro, y una pestaña abandonada en segundo
     plano se bloquea igual al volver (los timers de fondo se frenan,
     por eso además se chequea en visibilitychange/focus).
   - El estado bloqueado también queda en localStorage
     (`mateu_bloqueo_lock`): recargar la página no lo saltea, y al
     desbloquear en una pestaña se destraban las demás (evento storage).
   - El PIN se valida contra discontinuos-mateu/usuarios/<mail>, igual
     que el login del Portal (seguridad blanda, como todo el portal).
   - Roles excluidos: puesto (quiosco: ya tiene su circuito), admin,
     supervisor, deposito, capacitador.
   ============================================================ */
(function(){
  'use strict';
  if(window.__mateuBloqueo) return;           // guardia contra doble carga
  window.__mateuBloqueo = true;

  var THIS = document.currentScript ||
    (function(){ var s=document.querySelectorAll('script[src*="bloqueo"]'); return s[s.length-1]; })();
  var ROOT = THIS ? new URL('../', THIS.src).href : '../';
  var CFG = window.MATEU_BLOQUEO || {};
  var BLOQUEO_MIN = +CFG.minutos > 0 ? +CFG.minutos : 10;
  var ROLES = CFG.roles || ['sucursal','outlet'];
  var TIMEOUT = BLOQUEO_MIN*60*1000;

  var FB = 'https://discontinuos-mateu-default-rtdb.firebaseio.com';
  var SESSION_KEY = 'mateu_portal_session';
  var K_ACT  = 'mateu_bloqueo_act';
  var K_LOCK = 'mateu_bloqueo_lock';

  function leerSesion(){ try{ return JSON.parse(localStorage.getItem(SESSION_KEY)||'null'); }catch(e){ return null; } }
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  function lsDel(k){ try{ localStorage.removeItem(k); }catch(e){} }
  function esc(s){ return (s==null?'':String(s)).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function keyMail(email){ return (email||'').toLowerCase().trim().replace(/\./g,','); }
  function bonito(s){ return s ? String(s).split('-').map(function(p){ return p ? p.charAt(0).toUpperCase()+p.slice(1) : p; }).join(' ') : ''; }

  var S = leerSesion();
  if(!S || !S.email || ROLES.indexOf(S.rol)<0) return;   // solo encargados

  var locked = false;
  var lastWrite = 0;
  var ultimaAct = +lsGet(K_ACT) || 0;

  // ---- actividad ----
  function actividad(){
    if(locked) return;
    var now = Date.now();
    ultimaAct = now;
    if(now - lastWrite > 3000){ lastWrite = now; lsSet(K_ACT, String(now)); }
  }
  ['mousemove','mousedown','keydown','touchstart','scroll','wheel','pointerdown'].forEach(function(ev){
    document.addEventListener(ev, actividad, {passive:true, capture:true});
  });

  function chequear(){
    if(locked) return;
    var guard = +lsGet(K_ACT) || 0;          // la más nueva entre esta pestaña y las demás
    var ref = Math.max(ultimaAct, guard);
    if(lsGet(K_LOCK)==='1' || (ref && Date.now()-ref > TIMEOUT)) bloquear();
  }

  // ---- cortina ----
  var CSS = ''
  +'.mbl{position:fixed;inset:0;z-index:2147483000;background:#0B1527;display:flex;align-items:center;justify-content:center;padding:24px;'
  +'font-family:Barlow,system-ui,Segoe UI,sans-serif;color:#0B1527;padding-top:calc(24px + env(safe-area-inset-top,0px))}'
  +'.mbl-card{background:#fff;border-radius:16px;width:100%;max-width:380px;padding:32px 28px 26px;box-shadow:0 24px 60px rgba(0,0,0,.45);text-align:center;'
  +'border-top:4px solid #CC0000;animation:mblIn .25s ease-out}'
  +'@keyframes mblIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'
  +'.mbl-ico{width:52px;height:52px;margin:0 auto 10px;border-radius:50%;background:#f5f7fc;display:flex;align-items:center;justify-content:center}'
  +'.mbl-ico svg{width:26px;height:26px;stroke:#0B1527;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}'
  +'.mbl-marca{font-family:"Bebas Neue",Impact,sans-serif;font-size:26px;letter-spacing:2px;color:#0B1527;line-height:1}'
  +'.mbl-tit{font-family:"Barlow Condensed",Barlow,sans-serif;font-weight:700;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:#CC0000;margin-top:10px}'
  +'.mbl-sub{font-size:14px;color:#5a6478;margin-top:6px;line-height:1.4}'
  +'.mbl-sub b{color:#0B1527;font-weight:600}'
  +'.mbl-pin{margin-top:18px;width:100%;box-sizing:border-box;padding:12px 14px;border:1.5px solid #cfd6e4;border-radius:10px;'
  +'font-family:Barlow,system-ui,sans-serif;font-size:26px;letter-spacing:12px;text-align:center;color:#0B1527;outline:none;transition:border-color .15s}'
  +'.mbl-pin:focus{border-color:#0B1527}'
  +'.mbl-btn{margin-top:12px;width:100%;padding:13px;border:0;border-radius:10px;background:#CC0000;color:#fff;cursor:pointer;'
  +'font-family:"Barlow Condensed",Barlow,sans-serif;font-weight:700;font-size:15px;letter-spacing:2px;text-transform:uppercase;transition:background .15s}'
  +'.mbl-btn:hover{background:#a80000}.mbl-btn[disabled]{opacity:.6;cursor:default}'
  +'.mbl-err{display:none;margin-top:10px;font-size:13px;color:#CC0000;font-weight:600}.mbl-err.on{display:block}'
  +'.mbl-salir{margin-top:16px;background:none;border:0;color:#5a6478;font-family:Barlow,system-ui,sans-serif;font-size:13px;cursor:pointer;text-decoration:underline}'
  +'.mbl-salir:hover{color:#0B1527}'
  +'.mbl-nota{margin-top:14px;font-size:11.5px;color:#9aa3b5}'
  +'body.mbl-on{overflow:hidden!important}';

  var overlay = null;
  function bloquear(){
    if(locked) return;
    locked = true;
    lsSet(K_LOCK,'1');
    try{ if(document.activeElement && document.activeElement.blur) document.activeElement.blur(); }catch(e){}

    if(!document.getElementById('mblCss')){
      var st = document.createElement('style'); st.id='mblCss'; st.textContent = CSS;
      document.head.appendChild(st);
    }
    var quien = bonito(S.sucursal || S.outlet_id) || S.email;
    overlay = document.createElement('div');
    overlay.className = 'mbl'; overlay.id = 'mblOverlay';
    overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true');
    overlay.innerHTML = '<div class="mbl-card">'
      +'<div class="mbl-ico"><svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>'
      +'<div class="mbl-marca">MATEU SPORTS</div>'
      +'<div class="mbl-tit">Pantalla bloqueada</div>'
      +'<div class="mbl-sub">Pasaron '+BLOQUEO_MIN+' minutos sin actividad.<br>Ingresá el PIN de <b>'+esc(quien)+'</b> para seguir.</div>'
      +'<form id="mblForm" autocomplete="off">'
      +'<input class="mbl-pin" id="mblPin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="••••" aria-label="PIN de 4 dígitos" autocomplete="off">'
      +'<button class="mbl-btn" id="mblBtn" type="submit">Desbloquear</button>'
      +'<div class="mbl-err" id="mblErr">PIN incorrecto.</div>'
      +'</form>'
      +'<button class="mbl-salir" id="mblSalir" type="button">Cerrar sesión y volver al Portal</button>'
      +'<div class="mbl-nota">Lo que estabas haciendo queda tal cual al desbloquear.</div>'
      +'</div>';
    document.body.appendChild(overlay);
    document.body.classList.add('mbl-on');

    var pin = document.getElementById('mblPin');
    var btn = document.getElementById('mblBtn');
    var err = document.getElementById('mblErr');
    setTimeout(function(){ try{ pin.focus(); }catch(e){} }, 50);
    pin.addEventListener('input', function(){ pin.value = pin.value.replace(/\D/g,'').slice(0,4); err.classList.remove('on'); });
    document.getElementById('mblForm').addEventListener('submit', function(e){
      e.preventDefault();
      var v = pin.value.trim();
      if(v.length<4) return;
      btn.disabled = true; btn.textContent = 'Verificando…';
      validarPin(v).then(function(ok){
        if(ok){ desbloquear(); return; }
        err.textContent = 'PIN incorrecto.'; err.classList.add('on');
        pin.value=''; pin.focus();
        setTimeout(function(){ btn.disabled=false; btn.textContent='Desbloquear'; }, 1200);
      }, function(){
        err.textContent = 'No se pudo verificar el PIN. Revisá la conexión e intentá de nuevo.'; err.classList.add('on');
        btn.disabled=false; btn.textContent='Desbloquear';
      });
    });
    document.getElementById('mblSalir').addEventListener('click', function(){
      lsDel(K_LOCK); lsDel(K_ACT);
      try{ localStorage.removeItem(SESSION_KEY); }catch(e){}
      location.href = ROOT;
    });
  }

  // Mismo criterio que el login del Portal: el registro vive en usuarios/<mail con , por .>
  function validarPin(v){
    var url = FB+'/usuarios/'+encodeURIComponent(keyMail(S.email))+'.json';
    return fetch(url,{cache:'no-store'}).then(function(r){
      if(!r.ok) throw new Error('HTTP '+r.status);
      return r.json();
    }).then(function(u){
      if(!u || u.pin==null) throw new Error('sin registro');
      return String(u.pin) === v;
    });
  }

  function desbloquear(){
    locked = false;
    lsDel(K_LOCK);
    var now = Date.now(); ultimaAct = now; lastWrite = now; lsSet(K_ACT, String(now));
    if(overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
    document.body.classList.remove('mbl-on');
  }

  // ---- arranque y vigilancia ----
  function iniciar(){
    // sin actividad registrada todavía → arrancamos a contar desde ahora
    if(!ultimaAct){ ultimaAct = Date.now(); lastWrite = ultimaAct; lsSet(K_ACT, String(ultimaAct)); }
    chequear();
    setInterval(chequear, 15000);
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) chequear(); });
    window.addEventListener('focus', chequear);
    window.addEventListener('pageshow', chequear);
    // otra pestaña desbloqueó (o bloqueó): seguirla
    window.addEventListener('storage', function(e){
      if(e.key===K_LOCK){
        if(e.newValue==='1' && !locked) bloquear();
        else if(e.newValue==null && locked) desbloquear();
      }
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
