/* ============================================================
   Matts — el asistente del portal (chat flotante, abajo a la IZQUIERDA;
   la campana y el «?» del tutorial viven a la derecha).
   Vanilla JS, cero dependencias, ES5 (tiene que andar en las PC viejas).

   header.js lo carga solo en todos los módulos con header unificado;
   el Portal raíz e Indicadores lo incluyen con una línea:
     <script src="../shared/asistente.js" defer></script>

   Habla con /api/asistente (Pages Function; ahí están el prompt, las
   herramientas y los topes). Si la Function no está disponible (falta
   la clave en Cloudflare, o se abrió el HTML suelto) el botón no aparece.
   No se monta sin sesión, en el puesto del salón ni en los informes
   públicos (?pres=).

   La charla vive en sessionStorage (se borra al cerrar la pestaña) y se
   manda recortada a las últimas vueltas. Clases con prefijo mat-.
   ============================================================ */
(function(){
  'use strict';
  if(window.__mattsCargado) return; window.__mattsCargado = true;

  var NOMBRE = 'Matts';
  var SESSION = null;
  try{ var s = localStorage.getItem('mateu_portal_session'); SESSION = s ? JSON.parse(s) : null; }catch(e){}
  if(!SESSION || !SESSION.email || SESSION.rol === 'puesto') return;
  if(/[?&]pres=/.test(location.search)) return;

  var THIS = document.currentScript || (function(){ var l = document.querySelectorAll('script[src*="shared/asistente"]'); return l[l.length-1]; })();
  var ROOT = THIS && THIS.src ? THIS.src.replace(/shared\/asistente\.js.*$/, '') : '../';
  var API = ROOT + 'api/asistente';

  var K_CHAT = 'matts_chat', K_DISP = 'matts_disp';
  var CHAT = [], ABIERTO = false, ESPERANDO = false;
  function ssGet(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } }
  function ssSet(k,v){ try{ sessionStorage.setItem(k,v); }catch(e){} }
  try{ CHAT = JSON.parse(ssGet(K_CHAT) || '[]') || []; }catch(e){ CHAT = []; }

  function esc(x){ return (x==null?'':String(x)).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  // texto del modelo → HTML mínimo: **negrita**, viñetas y saltos de línea
  function formato(t){
    return esc(t).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|\n)\s*(?:[-•*])\s+/g, '$1• ')
      .replace(/\n/g, '<br>');
  }
  function modulo(){
    if(window.MATEU_TUTORIAL && window.MATEU_TUTORIAL.herramienta) return window.MATEU_TUTORIAL.herramienta;
    var m = location.pathname.match(/\/([^\/]+)\/(?:index\.html)?$/);
    return m ? m[1] : 'portal';
  }

  function pedir(metodo, cuerpo, cb){
    var x = new XMLHttpRequest();
    x.open(metodo, API, true);
    x.timeout = 60000;
    if(cuerpo) x.setRequestHeader('Content-Type', 'application/json');
    x.onload = function(){ var d = null; try{ d = JSON.parse(x.responseText); }catch(e){} cb(x.status, d); };
    x.onerror = x.ontimeout = function(){ cb(0, null); };
    x.send(cuerpo ? JSON.stringify(cuerpo) : null);
  }

  var CSS = ''
  +'#mattsWidget{position:fixed;left:22px;bottom:22px;z-index:1270;font-family:Barlow,sans-serif}'
  +'#mattsWidget.abierto{z-index:1290}'   // abierto tapa al «?» y a la campana (en celular se pisaban con Enviar); el tutorial (1300) sigue arriba
  +'#mattsWidget *{box-sizing:border-box}'
  +'.mat-fab{height:48px;padding:0 16px 0 6px;border-radius:24px;border:none;border-bottom:3px solid var(--marca-red,#CC0000);cursor:pointer;background:var(--marca-navy,#0B1527);color:#fff;display:flex;align-items:center;gap:9px;box-shadow:0 8px 30px rgba(11,21,39,.22);transition:transform .15s}'
  +'.mat-fab:hover{transform:translateY(-2px)}'
  +'.mat-av{width:38px;height:38px;border-radius:50%;overflow:hidden;background:var(--marca-red,#CC0000);color:#fff;display:flex;align-items:center;justify-content:center;font-family:\'Bebas Neue\',sans-serif;font-size:21px;line-height:1;flex:none}'
  // avatar: una persona que va cambiando de deporte (5 poses que se turnan; sin animaciones queda la primera)
  +'.mat-av svg{width:100%;height:100%;display:block;overflow:visible}'
  +'.mat-av .mat-p{opacity:0;animation:matPose 12.5s infinite}'
  +'.mat-av .mat-p1{opacity:1}'
  +'.mat-av .mat-p2{animation-delay:2.5s}.mat-av .mat-p3{animation-delay:5s}.mat-av .mat-p4{animation-delay:7.5s}.mat-av .mat-p5{animation-delay:10s}'
  +'@keyframes matPose{0%{opacity:0}2.5%{opacity:1}18%{opacity:1}20.5%{opacity:0}100%{opacity:0}}'
  +'.mat-av .mat-bob{animation:matBob .5s ease-in-out infinite alternate}'
  +'@keyframes matBob{from{transform:translateY(.7px)}to{transform:translateY(-.9px)}}'
  +'.mat-av .mat-b-ten{animation:matBTen 1.25s linear infinite}'
  +'@keyframes matBTen{0%{transform:translate(8px,7px)}50%{transform:translate(0,0)}100%{transform:translate(8px,-6px)}}'
  +'.mat-av .mat-b-fut{animation:matBFut 1.25s ease-out infinite}'
  +'@keyframes matBFut{0%,20%{transform:translate(0,0)}100%{transform:translate(9px,-7px)}}'
  +'.mat-av .mat-b-bas{animation:matBBas 1.25s ease-in-out infinite}'
  +'@keyframes matBBas{0%,25%{transform:translate(0,0)}100%{transform:translate(7px,-6px)}}'
  +'.mat-av .mat-b-hoc{animation:matBHoc 1.25s ease-out infinite}'
  +'@keyframes matBHoc{0%,30%{transform:translate(0,0)}100%{transform:translate(7px,0)}}'
  +'@media(prefers-reduced-motion:reduce){.mat-av .mat-p,.mat-av .mat-bob,.mat-av [class*=mat-b-]{animation:none}}'
  +'.mat-fab span{font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:15px;letter-spacing:.6px;text-transform:uppercase}'
  +'.mat-panel{position:absolute;left:0;bottom:60px;width:372px;max-width:calc(100vw - 32px);height:min(70vh,560px);background:#fff;border:1px solid #dce3f0;border-radius:14px;box-shadow:0 12px 40px rgba(11,21,39,.25);overflow:hidden;display:none;flex-direction:column}'
  +'.mat-panel.on{display:flex}'
  +'.mat-head{background:var(--marca-navy,#0B1527);color:#fff;padding:11px 12px 11px 14px;display:flex;align-items:center;gap:10px;border-bottom:3px solid var(--marca-red,#CC0000)}'
  +'.mat-head b{font-family:\'Bebas Neue\',sans-serif;font-weight:400;font-size:22px;letter-spacing:1px;line-height:1;display:block}'
  +'.mat-head small{font-size:11.5px;opacity:.75;display:block;margin-top:2px}'
  +'.mat-head .mat-sp{flex:1}'
  +'.mat-hb{background:none;border:none;color:#fff;opacity:.75;cursor:pointer;font-size:12px;font-family:\'Barlow Condensed\',sans-serif;letter-spacing:.4px;text-transform:uppercase;padding:6px 8px;border-radius:6px}'
  +'.mat-hb:hover{opacity:1;background:rgba(255,255,255,.12)}'
  +'.mat-log{flex:1;overflow-y:auto;padding:14px 12px;background:var(--marca-off,#f5f7fc);display:flex;flex-direction:column;gap:9px}'
  +'.mat-m{max-width:88%;padding:9px 12px;border-radius:13px;font-size:14px;line-height:1.42;color:var(--marca-navy,#0B1527);word-wrap:break-word}'
  +'.mat-m.bot{align-self:flex-start;background:#fff;border:1px solid #dce3f0;border-bottom-left-radius:4px}'
  +'.mat-m.yo{align-self:flex-end;background:var(--marca-navy,#0B1527);color:#fff;border-bottom-right-radius:4px}'
  +'.mat-m.err{align-self:flex-start;background:#fff4f4;border:1px solid #f1c4c4;color:#8a1c1c;font-size:13px}'
  +'.mat-sug{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}'
  +'.mat-sug button{background:#fff;border:1px solid #cfd8ea;border-radius:16px;padding:6px 11px;font-family:Barlow,sans-serif;font-size:12.5px;color:var(--marca-navy,#0B1527);cursor:pointer;text-align:left}'
  +'.mat-sug button:hover{border-color:var(--marca-red,#CC0000)}'
  +'.mat-dots i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#8b97b0;margin-right:4px;animation:matDot 1s infinite}'
  +'.mat-dots i:nth-child(2){animation-delay:.15s}.mat-dots i:nth-child(3){animation-delay:.3s}'
  +'@keyframes matDot{0%,60%,100%{opacity:.25}30%{opacity:1}}'
  +'.mat-form{display:flex;gap:8px;padding:10px;border-top:1px solid #dce3f0;background:#fff;align-items:flex-end}'
  +'.mat-form textarea{flex:1;resize:none;height:40px;max-height:110px;padding:9px 11px;border:1.5px solid #dce3f0;border-radius:10px;font-family:Barlow,sans-serif;font-size:14px;color:var(--marca-navy,#0B1527);outline:none}'
  +'.mat-form textarea:focus{border-color:var(--marca-navy,#0B1527)}'
  +'.mat-send{height:40px;padding:0 14px;border:none;border-radius:10px;background:var(--marca-red,#CC0000);color:#fff;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:14px;letter-spacing:.5px;text-transform:uppercase;cursor:pointer}'
  +'.mat-send:disabled{opacity:.45;cursor:default}'
  +'.mat-pie{font-size:10.5px;color:#7b86a0;text-align:center;padding:0 10px 8px;background:#fff}'
  +'@media(max-width:560px){#mattsWidget{left:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px))}.mat-fab{padding:0 6px}.mat-fab span{display:none}.mat-panel{position:fixed;left:8px;right:8px;bottom:calc(74px + env(safe-area-inset-bottom,0px));width:auto;max-width:none;height:min(72vh,560px)}}'
  +'@media print{#mattsWidget{display:none!important}}';

  /* Avatar de Matts: pictograma que rota entre running, tenis, fútbol, básquet y hockey.
     SVG inline (sin archivos ni CDN); los trazos son blancos sobre el círculo rojo de .mat-av. */
  function avatarSvg(){
    var T = ' fill="none" stroke="#fff" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"';
    var F = ' fill="#fff" stroke="none"';
    function pose(n, cuerpo, extra){ return '<g class="mat-p mat-p'+n+'"><g class="mat-bob"'+T+'>'+cuerpo+'</g>'+(extra||'')+'</g>'; }
    return '<svg viewBox="0 0 48 48" aria-hidden="true">'
      + '<g transform="translate(24 24) scale(.7) translate(-26 -24.5)">'   // la figura entra entera en el círculo (raqueta, palo y pelotas incluidos)
      // 1 · running
      + pose(1, '<circle cx="28" cy="11" r="3.6"'+F+'/><path d="M26 17 L21 29"/><path d="M25.5 19.5 L31 24 L36 21"/><path d="M25 19.5 L18.5 21.5 L15 26.5"/><path d="M21 29 L28 33.5 L26 41.5"/><path d="M21 29 L15.5 34 L9.5 32"/>')
      // 2 · tenis (raqueta arriba, la pelota viene y se va)
      + pose(2, '<circle cx="21" cy="12" r="3.6"'+F+'/><path d="M21 17.5 L21 30"/><path d="M21 30 L16 41"/><path d="M21 30 L27.5 40.5"/><path d="M21 20.5 L15 25.5"/><path d="M21 20.5 L28 17 L31 12.5"/><ellipse cx="34.5" cy="8" rx="3.6" ry="4.8" transform="rotate(38 34.5 8)" stroke-width="2"/>',
             '<circle class="mat-b-ten" cx="37" cy="9" r="1.9"'+F+'/>')
      // 3 · fútbol (patea y la pelota sale)
      + pose(3, '<circle cx="19" cy="11" r="3.6"'+F+'/><path d="M19.5 16.5 L21.5 28.5"/><path d="M21.5 28.5 L19 41"/><path d="M21.5 28.5 L28.5 33 L34.5 31"/><path d="M20 19.5 L13.5 24"/><path d="M20 19.5 L27 22.5"/>',
             '<circle class="mat-b-fut" cx="38.5" cy="34.5" r="3"'+F+'/>')
      // 4 · básquet (tiro en suspensión)
      + pose(4, '<circle cx="21" cy="15" r="3.6"'+F+'/><path d="M21 20.5 L21 32"/><path d="M21 32 L17 42"/><path d="M21 32 L25.5 42"/><path d="M21 22.5 L26.5 17 L27 10.5"/><path d="M21 22.5 L18 16.5 L23 10.5"/>',
             '<circle class="mat-b-bas" cx="25.5" cy="6.5" r="3.3"'+F+'/>')
      // 5 · hockey (palo al piso, empuja la bocha)
      + pose(5, '<circle cx="18" cy="13" r="3.6"'+F+'/><path d="M19 18.5 L23.5 29"/><path d="M23.5 29 L18.5 41"/><path d="M23.5 29 L30 40.5"/><path d="M20.5 21.5 L27.5 27.5"/><path d="M26 24 L36 40 L40 39" stroke-width="2.3"/>',
             '<circle class="mat-b-hoc" cx="41.5" cy="41" r="1.9"'+F+'/>')
      + '</g></svg>';
  }

  var SUGERENCIAS = {
    _def: ['¿Cómo se usa este módulo?', 'Un cliente quiere empezar a correr, ¿qué zapatilla le recomiendo?', '¿Qué raquetas de tenis trabajamos?'],
    ubicaciones: ['¿Cómo cargo el stock del día?', '¿Cómo vinculo una etiqueta que no encuentra?', 'Un cliente busca paleta de pádel para principiante'],
    indicadores: ['¿Cómo armo el equipo de la semana?', '¿Qué es el ritmo del objetivo?', '¿Cómo pido un compensatorio?'],
    'gestion-stock': ['¿Cómo comento un discontinuo?', '¿Cómo se lee meses de stock?'],
    barrida: ['¿Qué archivos necesito para la barrida?', '¿Qué hace «Abrir a más sucursales»?'],
    tareas: ['¿Cómo registro un cambio de vidriera?', '¿Cómo cargo el checklist de limpieza?']
  };

  var $log, $txt, $send, $panel;

  function guardar(){ ssSet(K_CHAT, JSON.stringify(CHAT.slice(-30))); }
  function bajar(){ if($log) $log.scrollTop = $log.scrollHeight; }

  function pintar(){
    var h = '';
    if(!CHAT.length){
      var nom = (SESSION.nombre || '').split(' ')[0];
      h += '<div class="mat-m bot">¡Buenas' + (nom ? ', ' + esc(nom) : '') + '! Soy <b>' + NOMBRE + '</b>. Preguntame cómo se usa el portal o pedime una mano para asesorar a un cliente en cualquier deporte.</div>';
      var sug = (SUGERENCIAS[modulo()] || []).concat(SUGERENCIAS._def).slice(0, 3);
      h += '<div class="mat-sug">' + sug.map(function(t){ return '<button type="button" data-sug="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div>';
    }
    CHAT.forEach(function(m){
      h += '<div class="mat-m ' + (m.err ? 'err' : m.role === 'user' ? 'yo' : 'bot') + '">' + (m.role === 'user' ? esc(m.content).replace(/\n/g,'<br>') : formato(m.content)) + '</div>';
    });
    if(ESPERANDO) h += '<div class="mat-m bot mat-dots"><i></i><i></i><i></i></div>';
    $log.innerHTML = h;
    bajar();
  }

  function enviar(texto){
    texto = (texto || '').replace(/^\s+|\s+$/g, '');
    if(!texto || ESPERANDO) return;
    CHAT = CHAT.filter(function(m){ return !m.err; });
    CHAT.push({ role:'user', content:texto });
    ESPERANDO = true; $send.disabled = true; $txt.value = ''; $txt.style.height = '40px';
    guardar(); pintar();
    var mensajes = CHAT.slice(-12).map(function(m){ return { role:m.role, content:m.content }; });
    pedir('POST', { email:SESSION.email, modulo:modulo(), mensajes:mensajes }, function(st, d){
      ESPERANDO = false; $send.disabled = false;
      if(st === 200 && d && d.respuesta) CHAT.push({ role:'assistant', content:d.respuesta });
      else CHAT.push({ role:'assistant', err:true, content:(d && d.error) || 'No me pude conectar. Revisá internet y probá de nuevo.' });
      guardar(); pintar();
      try{ $txt.focus(); }catch(e){}
    });
  }

  function abrir(si){
    ABIERTO = si;
    $panel.className = 'mat-panel' + (si ? ' on' : '');
    $panel.parentNode.className = si ? 'abierto' : '';
    if(si){ pintar(); setTimeout(function(){ try{ $txt.focus(); }catch(e){} }, 60); }
  }

  function montar(){
    if(document.getElementById('mattsWidget')) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var w = document.createElement('div'); w.id = 'mattsWidget';
    w.innerHTML = ''
      +'<div class="mat-panel" role="dialog" aria-label="' + NOMBRE + ', asistente del portal">'
      +  '<div class="mat-head"><div class="mat-av">' + avatarSvg() + '</div><div><b>' + NOMBRE + '</b><small>Asistente del portal · asesor deportivo</small></div><div class="mat-sp"></div>'
      +    '<button type="button" class="mat-hb" data-act="nueva" title="Empezar una charla nueva">Nueva</button>'
      +    '<button type="button" class="mat-hb" data-act="cerrar" aria-label="Cerrar">✕</button></div>'
      +  '<div class="mat-log"></div>'
      +  '<div class="mat-form"><textarea placeholder="Escribile a ' + NOMBRE + '…" maxlength="1500" rows="1"></textarea><button type="button" class="mat-send">Enviar</button></div>'
      +  '<div class="mat-pie">Todavía no ve stock ni ventas. Puede equivocarse: ante la duda, consultá.</div>'
      +'</div>'
      +'<button type="button" class="mat-fab" aria-label="Abrir a ' + NOMBRE + '"><div class="mat-av">' + avatarSvg() + '</div><span>' + NOMBRE + '</span></button>';
    document.body.appendChild(w);
    $panel = w.querySelector('.mat-panel'); $log = w.querySelector('.mat-log');
    $txt = w.querySelector('textarea'); $send = w.querySelector('.mat-send');

    w.querySelector('.mat-fab').onclick = function(){ abrir(!ABIERTO); };
    $send.onclick = function(){ enviar($txt.value); };
    $txt.onkeydown = function(e){
      e = e || window.event;
      if((e.key === 'Enter' || e.keyCode === 13) && !e.shiftKey){ if(e.preventDefault) e.preventDefault(); enviar($txt.value); return false; }
    };
    $txt.oninput = function(){ $txt.style.height = '40px'; $txt.style.height = Math.min(110, $txt.scrollHeight) + 'px'; };
    w.onclick = function(e){
      var t = (e || window.event).target;
      while(t && t !== w){
        if(t.getAttribute){
          var sug = t.getAttribute('data-sug'), act = t.getAttribute('data-act');
          if(sug){ enviar(sug); return; }
          if(act === 'cerrar'){ abrir(false); return; }
          if(act === 'nueva'){ if(!ESPERANDO){ CHAT = []; guardar(); pintar(); } return; }
        }
        t = t.parentNode;
      }
    };
    document.addEventListener('keydown', function(e){ if(ABIERTO && (e.key === 'Escape' || e.keyCode === 27)) abrir(false); });
  }

  function arrancar(){
    function listo(){ if(document.body) montar(); else document.addEventListener('DOMContentLoaded', montar); }
    var disp = ssGet(K_DISP);
    if(disp === '1') return listo();
    pedir('GET', null, function(st, d){
      if(st === 200 && d && d.disponible){ ssSet(K_DISP, '1'); listo(); }
    });
  }
  arrancar();
})();
