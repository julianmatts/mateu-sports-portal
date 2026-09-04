/* ============================================================
   shared/notificaciones.js — Campana flotante de notificaciones del shell.

   La MISMA campana que el Portal e Indicadores (base mensajes-mateu:
   avisos + tablero + directos no leídos), como componente compartido:
   un módulo la suma con UNA línea en el <head>, ANTES de tutorial.js
   (así el «?» del tutorial se corre solo arriba de la campana):

     <script src="../shared/notificaciones.js" defer></script>

   - Se inyecta sola (CSS + widget + lógica). No requiere nada del módulo.
   - Si la página ya tiene su propia campana (#notifWidget: Portal,
     Indicadores) o no hay sesión del Portal, no hace nada.
   - Al tocar un mensaje abre la Bandeja del Portal (../?ver=bandeja).
   - El rol admin puede publicar un aviso desde el panel, como en el Portal.
   ============================================================ */
(function(){
  'use strict';
  if(document.getElementById('notifWidget')) return;   // la página ya trae su campana

  var SESSION=null;
  try{ var s=localStorage.getItem('mateu_portal_session'); SESSION=s?JSON.parse(s):null; }catch(e){}
  if(!SESSION || !SESSION.email) return;

  var DB='https://mensajes-mateu-default-rtdb.firebaseio.com';
  var LAST_NOTIFS=[], LAST_AVISO_TS=0, SEEN={}, PRIMED=false, TOAST_T=null, TIMER=null;

  function esc(x){ return (x==null)?'':String(x).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function $(id){ return document.getElementById(id); }
  function fetchJSON(u){ return fetch(u).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }); }
  function postJSON(u,d){ return fetch(u,{method:'POST',body:JSON.stringify(d),headers:{'Content-Type':'application/json'}}); }
  function putJSON(u,d){ return fetch(u,{method:'PUT',body:JSON.stringify(d),headers:{'Content-Type':'application/json'}}); }
  function keyMail(email){ return (email||'').toLowerCase().trim().replace(/\./g,','); }
  function nombreCorto(email){
    var u=(email||'').split('@')[0]||email||'';
    return u?u.split(/[._-]+/).map(function(p){return !p?p:/^rrhh$/i.test(p)?'RRHH':p.charAt(0).toUpperCase()+p.slice(1);}).join(' '):'—';
  }
  function horaCorta(ts){ try{ return new Date(ts).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; } }
  function objToSortedList(obj){ return Object.keys(obj||{}).map(function(id){ var o=Object.assign({id:id},obj[id]); return o; }).sort(function(a,b){ return (a.ts||0)-(b.ts||0); }); }
  function paraMi(para){
    if(!para||!para.length||para.indexOf('todos')!==-1) return true;
    return para.some(function(t){ return t==='rol:'+SESSION.rol || (SESSION.sucursal&&t==='suc:'+SESSION.sucursal) || (SESSION.outlet_id&&t==='out:'+SESSION.outlet_id); });
  }
  function notifKey(n){ return n.kind+'|'+(n.de||'')+'|'+(n.ts||0); }
  function irABandeja(n){
    var q = n&&n.kind==='directo' ? '?ver=bandeja&con='+encodeURIComponent(n.de) : '?ver=bandeja';
    location.href='../'+q;
  }

  /* --- CSS (mismos estilos que la campana de Indicadores; con fallback de tokens) --- */
  var css=''
    +'#notifWidget{position:fixed;right:22px;bottom:22px;z-index:1000;font-family:Barlow,sans-serif}'
    +'#notifWidget .notif-fab{position:relative;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;background:var(--navy,#0B1527);color:#fff;font-size:23px;line-height:1;box-shadow:0 8px 30px rgba(11,21,39,.18);display:flex;align-items:center;justify-content:center;transition:transform .15s,background .15s;border-bottom:3px solid var(--red,#CC0000)}'
    +'#notifWidget .notif-fab:hover{transform:translateY(-2px);background:#1a2f55}'
    +'#notifWidget .notif-fab-badge{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:var(--red,#CC0000);color:#fff;font-family:\'Barlow Condensed\',sans-serif;font-size:11px;font-weight:700;line-height:20px;text-align:center;border:2px solid var(--navy,#0B1527)}'
    +'#notifWidget .notif-panel{position:absolute;right:0;bottom:70px;width:344px;max-width:calc(100vw - 44px);background:#fff;border:1px solid #dce3f0;border-radius:14px;box-shadow:0 8px 30px rgba(11,21,39,.18);overflow:hidden;flex-direction:column;max-height:min(72vh,540px);animation:mshNotifRise .2s}'
    +'@keyframes mshNotifRise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'
    +'#notifWidget .notif-head{background:var(--navy,#0B1527);color:#fff;padding:13px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid var(--red,#CC0000)}'
    +'#notifWidget .notif-head .t{font-family:\'Bebas Neue\',sans-serif;font-size:19px;letter-spacing:1px}'
    +'#notifWidget .notif-close{background:transparent;border:none;color:rgba(255,255,255,.7);font-size:22px;line-height:1;cursor:pointer;padding:0 2px}'
    +'#notifWidget .notif-close:hover{color:#fff}'
    +'#notifWidget .notif-list{flex:1;overflow-y:auto;padding:6px}'
    +'#notifWidget .notif-empty{color:#6B7A99;font-size:13.5px;text-align:center;padding:34px 20px}'
    +'#notifWidget .notif-item{display:flex;gap:11px;padding:11px 12px;border-radius:10px;cursor:pointer;transition:background .12s}'
    +'#notifWidget .notif-item:hover{background:#f5f7fc}'
    +'#notifWidget .notif-item .ic{font-size:18px;line-height:1.2;flex:0 0 auto}'
    +'#notifWidget .notif-item .bd{flex:1;min-width:0}'
    +'#notifWidget .notif-item .hd{display:flex;justify-content:space-between;gap:8px;align-items:baseline}'
    +'#notifWidget .notif-item .au{font-family:\'Barlow Condensed\',sans-serif;font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--navy,#0B1527)}'
    +'#notifWidget .notif-item .tm{font-size:10.5px;color:#b0bcd4;white-space:nowrap}'
    +'#notifWidget .notif-item .tx{font-size:13.5px;color:#6B7A99;margin-top:2px;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}'
    +'#notifWidget .notif-item .kind{display:inline-block;font-family:\'Barlow Condensed\',sans-serif;font-size:9.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:1px 6px;border-radius:5px;margin-top:5px}'
    +'#notifWidget .notif-item .kind.aviso{background:#fff0f0;color:var(--red,#CC0000)}'
    +'#notifWidget .notif-item .kind.tablero{background:#eef1f8;color:#1a2f55}'
    +'#notifWidget .notif-item .kind.directo{background:#e9f7ee;color:#1c7a3f}'
    +'#notifWidget .notif-aviso{border-top:1px solid #dce3f0;padding:12px;background:#fafbff}'
    +'#notifWidget .notif-aviso textarea{width:100%;resize:none;height:52px;padding:9px 11px;border:1.5px solid #dce3f0;border-radius:8px;font-family:Barlow,sans-serif;font-size:13.5px;color:var(--navy,#0B1527);margin-bottom:8px;box-sizing:border-box}'
    +'#notifWidget .notif-aviso textarea:focus{outline:none;border-color:#1a2f55}'
    +'#notifWidget .notif-aviso button{width:100%;border:none;border-radius:8px;padding:8px 12px;font-family:\'Barlow Condensed\',sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;background:var(--red,#CC0000);color:#fff}'
    /* el aviso sale de la campana hacia la izquierda (a su altura, con puntita) */
    +'#notifWidget .notif-toast{position:absolute;right:70px;bottom:2px;width:322px;max-width:calc(100vw - 112px);background:#fff;border:1px solid #dce3f0;border-left:4px solid var(--red,#CC0000);border-radius:12px;box-shadow:0 8px 30px rgba(11,21,39,.18);padding:12px 14px;gap:11px;cursor:pointer;opacity:0;transform:translateX(10px);transition:opacity .25s,transform .25s}'
    +'#notifWidget .notif-toast::after{content:\'\';position:absolute;right:-8px;bottom:20px;border:8px solid transparent;border-right:0;border-left-color:#fff}'
    +'#notifWidget .notif-toast.show{opacity:1;transform:none}'
    +'#notifWidget .notif-toast-ic{font-size:20px;line-height:1.1;flex:0 0 auto}'
    +'#notifWidget .notif-toast-bd{flex:1;min-width:0}'
    +'#notifWidget .notif-toast-hd{font-family:\'Barlow Condensed\',sans-serif;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--navy,#0B1527)}'
    +'#notifWidget .notif-toast-more{color:var(--red,#CC0000)}'
    +'#notifWidget .notif-toast-tx{font-size:13.5px;color:#6B7A99;margin-top:2px;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}'
    +'@media(max-width:560px){#notifWidget{right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px))}}'
    +'@media print{#notifWidget{display:none!important}}';
  var st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);

  /* --- Widget --- */
  var w=document.createElement('div'); w.id='notifWidget'; w.style.display='none';
  w.innerHTML=''
    +'<div class="notif-toast" id="notifToast" style="display:none"></div>'
    +'<div class="notif-panel" id="notifPanel" style="display:none">'
    +'  <div class="notif-head"><span class="t">Notificaciones</span>'
    +'    <button class="notif-close" id="notifClose" title="Cerrar">×</button></div>'
    +'  <div class="notif-list" id="notifList"></div>'
    +'  <div class="notif-aviso" id="notifAvisoBox" style="display:none">'
    +'    <textarea id="notifAvisoInput" placeholder="Publicar un aviso para todas las sucursales…"></textarea>'
    +'    <button id="notifAvisoSend">Publicar aviso</button>'
    +'  </div>'
    +'</div>'
    +'<button class="notif-fab" id="notifFab" title="Notificaciones">🔔<span class="notif-fab-badge" id="notifFabBadge" style="display:none">0</span></button>';
  document.body.appendChild(w);

  /* --- Lógica (misma que la campana del Portal/Indicadores) --- */
  function cargar(){
    var miEmail=(SESSION.email||'').toLowerCase(), miKey=keyMail(SESSION.email);
    return Promise.all([
      fetchJSON(DB+'/tablero.json').catch(function(){return null;}),
      fetchJSON(DB+'/directos.json').catch(function(){return null;}),
      fetchJSON(DB+'/avisos.json').catch(function(){return null;}),
      fetchJSON(DB+'/lecturas/'+miKey+'.json').catch(function(){return null;}),
    ]).then(function(r){
      var tablero=r[0],directos=r[1],avisos=r[2],lecturas=r[3];
      var lecTab=(lecturas&&lecturas.tablero)||0, lecAv=(lecturas&&lecturas.avisos)||0, lecCon=(lecturas&&lecturas.con)||{};
      var avisosList=objToSortedList(avisos), items=[];
      avisosList.forEach(function(a){ if((a.ts||0)>lecAv && (a.de||'').toLowerCase()!==miEmail) items.push({kind:'aviso',de:a.de,texto:a.texto,ts:a.ts}); });
      objToSortedList(tablero).forEach(function(p){ if((p.ts||0)>lecTab && (p.de||'').toLowerCase()!==miEmail && paraMi(p.para)) items.push({kind:'tablero',de:p.de,texto:p.texto,ts:p.ts}); });
      Object.keys(directos||{}).forEach(function(ck){
        var partes=ck.split('__'); if(partes.indexOf(miKey)===-1) return;
        var otro=partes[0]===miKey?partes[1]:partes[0], visto=lecCon[otro]||0;
        objToSortedList(directos[ck]).forEach(function(m){ if((m.ts||0)>visto && keyMail(m.de)!==miKey) items.push({kind:'directo',de:m.de,texto:m.texto,ts:m.ts}); });
      });
      items.sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
      return {items:items, ultimoAvisoTs:avisosList.length?avisosList[avisosList.length-1].ts:0};
    });
  }
  function refresh(){
    cargar().then(function(r){
      LAST_NOTIFS=r.items; LAST_AVISO_TS=r.ultimoAvisoTs;
      var total=r.items.length, fab=$('notifFabBadge');
      if(fab){ if(total>0){ fab.textContent=total>99?'99+':total; fab.style.display='block'; } else fab.style.display='none'; }
      var panel=$('notifPanel'), abierto=panel&&panel.style.display==='flex';
      if(abierto) pintar();
      var nuevos=r.items.filter(function(n){ return !SEEN[notifKey(n)]; });
      r.items.forEach(function(n){ SEEN[notifKey(n)]=1; });
      if(PRIMED && nuevos.length && !abierto) mostrarToast(nuevos);
      PRIMED=true;
    }).catch(function(){ /* silencioso: la campana no debe romper el módulo */ });
  }
  function pintar(){
    var list=$('notifList'); if(!list) return;
    if(!LAST_NOTIFS.length){ list.innerHTML='<div class="notif-empty">No tenés notificaciones nuevas.</div>'; return; }
    var IC={aviso:'📣',tablero:'📢',directo:'✉️'}, KND={aviso:'Aviso',tablero:'Tablero',directo:'Directo'};
    list.innerHTML=LAST_NOTIFS.map(function(n,i){ return '<div class="notif-item" data-i="'+i+'"><div class="ic">'+IC[n.kind]+'</div>'
      +'<div class="bd"><div class="hd"><span class="au">'+esc(nombreCorto(n.de))+'</span><span class="tm">'+esc(horaCorta(n.ts))+'</span></div>'
      +'<div class="tx">'+esc(n.texto)+'</div><span class="kind '+n.kind+'">'+KND[n.kind]+'</span></div></div>'; }).join('');
    Array.prototype.forEach.call(list.querySelectorAll('.notif-item'),function(elx){
      elx.addEventListener('click',function(){ var n=LAST_NOTIFS[+elx.dataset.i]; if(!n) return;
        if(n.kind==='aviso'){ var tx=elx.querySelector('.tx'); if(tx) tx.style.webkitLineClamp='unset'; return; }
        cerrarPanel(); irABandeja(n); });
    });
  }
  function abrirPanel(){ var p=$('notifPanel'); if(!p) return; p.style.display='flex'; $('notifAvisoBox').style.display=(SESSION.rol==='admin')?'block':'none'; pintar(); }
  function cerrarPanel(){
    var p=$('notifPanel'); if(!p || p.style.display!=='flex') return;
    p.style.display='none';
    if(LAST_AVISO_TS) putJSON(DB+'/lecturas/'+keyMail(SESSION.email)+'/avisos.json', LAST_AVISO_TS).then(refresh).catch(function(){});
  }
  function publicarAviso(){
    var inp=$('notifAvisoInput'), texto=(inp.value||'').trim(); if(!texto) return;
    var btn=$('notifAvisoSend'); btn.disabled=true; btn.textContent='Publicando…';
    var ts=Date.now();
    postJSON(DB+'/avisos.json',{de:SESSION.email,texto:texto,ts:ts}).then(function(){
      putJSON(DB+'/lecturas/'+keyMail(SESSION.email)+'/avisos.json',ts).catch(function(){}); inp.value='';
    }).catch(function(){ alert('No se pudo publicar el aviso.'); }).then(function(){
      btn.disabled=false; btn.textContent='Publicar aviso'; refresh(); });
  }
  function mostrarToast(nuevos){
    var host=$('notifToast'); if(!host) return;
    var n=nuevos[0], IC={aviso:'📣',tablero:'📢',directo:'✉️'}, KND={aviso:'Aviso',tablero:'Tablero',directo:'Directo'};
    var extra=nuevos.length>1?' <span class="notif-toast-more">+'+(nuevos.length-1)+' más</span>':'';
    host.innerHTML='<div class="notif-toast-ic">'+IC[n.kind]+'</div><div class="notif-toast-bd">'
      +'<div class="notif-toast-hd">'+esc(KND[n.kind])+' · '+esc(nombreCorto(n.de))+extra+'</div>'
      +'<div class="notif-toast-tx">'+esc(n.texto)+'</div></div>';
    host.style.display='flex'; setTimeout(function(){ host.classList.add('show'); },20);
    host.onclick=function(){ ocultarToast(); if(n.kind==='aviso') abrirPanel(); else irABandeja(n); };
    if(TOAST_T) clearTimeout(TOAST_T);
    TOAST_T=setTimeout(ocultarToast,6000);
  }
  function ocultarToast(){ var host=$('notifToast'); if(!host) return; host.classList.remove('show'); setTimeout(function(){ host.style.display='none'; },260); }

  w.style.display='block';
  $('notifFab').addEventListener('click',function(){ var p=$('notifPanel'); if(p&&p.style.display==='flex') cerrarPanel(); else abrirPanel(); });
  $('notifClose').addEventListener('click',cerrarPanel);
  $('notifAvisoSend').addEventListener('click',publicarAviso);
  document.addEventListener('click',function(e){ if(w.style.display!=='none' && !w.contains(e.target)) cerrarPanel(); });
  refresh();
  TIMER=setInterval(refresh,20000);
})();
