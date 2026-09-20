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
  +'.mat-fab{height:52px;padding:0 17px 0 5px;border-radius:26px;border:none;border-bottom:3px solid var(--marca-red,#CC0000);cursor:pointer;background:var(--marca-navy,#0B1527);color:#fff;display:flex;align-items:center;gap:9px;box-shadow:0 8px 30px rgba(11,21,39,.22);transition:transform .15s}'
  +'.mat-fab:hover{transform:translateY(-2px)}'
  +'.mat-av{width:42px;height:42px;border-radius:50%;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 2px var(--marca-red,#CC0000);color:#fff;display:flex;align-items:center;justify-content:center;font-family:\'Bebas Neue\',sans-serif;font-size:21px;line-height:1;flex:none}'
  // avatar: personaje (cabezón, vincha, camiseta) que va cambiando de deporte; ver avatarSvg()
  +'.mat-av svg{width:100%;height:100%;display:block}'
  +'.mat-av .c-red{fill:var(--marca-red,#CC0000)}.mat-av .s-red{stroke:var(--marca-red,#CC0000)}'
  +'.mat-av .c-nav{fill:var(--marca-navy,#0B1527)}.mat-av .s-nav{stroke:var(--marca-navy,#0B1527)}'
  +'.mat-av .mat-s{opacity:0;animation:matSport 15s infinite}.mat-av .mat-s1{opacity:1}'
  +'.mat-av .mat-s2{animation-delay:2.5s}.mat-av .mat-s3{animation-delay:5s}.mat-av .mat-s4{animation-delay:7.5s}.mat-av .mat-s5{animation-delay:10s}.mat-av .mat-s6{animation-delay:12.5s}'
  +'@keyframes matSport{0%{opacity:0}1.5%{opacity:1}15.4%{opacity:1}16.9%{opacity:0}100%{opacity:0}}'
  +'.mat-av .mat-bob{animation:matBob .35s ease-in-out infinite alternate}'
  +'@keyframes matBob{from{transform:translateY(.9px)}to{transform:translateY(-1.1px)}}'
  +'.mat-av .mat-cola{animation:matCola .3s ease-in-out infinite alternate;transform-origin:20.7px 17.8px}'
  +'@keyframes matCola{from{transform:rotate(-14deg)}to{transform:rotate(16deg)}}'
  // extremidades: balanceo entre dos ángulos (el origen va inline, en la articulación)
  +'@keyframes matR1{from{transform:rotate(38deg)}to{transform:rotate(-38deg)}}'
  +'@keyframes matR2{from{transform:rotate(-38deg)}to{transform:rotate(38deg)}}'
  +'@keyframes matRaq{0%,20%{transform:rotate(-150deg)}55%,100%{transform:rotate(-25deg)}}'
  +'@keyframes matPat{0%,35%{transform:rotate(42deg)}55%,100%{transform:rotate(-62deg)}}'
  +'@keyframes matDri{from{transform:rotate(-62deg)}to{transform:rotate(-38deg)}}'
  +'@keyframes matPalo{0%,30%{transform:rotate(16deg)}60%,100%{transform:rotate(-14deg)}}'
  +'@keyframes matPunA{0%,45%{transform:rotate(-100deg) translateY(-2px)}70%,100%{transform:rotate(-92deg) translateY(6px)}}'
  +'@keyframes matPunB{0%,45%{transform:rotate(-96deg) translateY(6px)}70%,100%{transform:rotate(-104deg) translateY(-2px)}}'
  // pelotas
  +'@keyframes matBTen{0%{transform:translate(16px,-12px)}48%{transform:translate(0,0)}100%{transform:translate(18px,-16px)}}'
  +'@keyframes matBFut{0%,50%{transform:translate(0,0)}100%{transform:translate(20px,-14px)}}'
  +'@keyframes matBBas{from{transform:translateY(0)}to{transform:translateY(11px)}}'
  +'@keyframes matBHoc{0%,55%{transform:translate(0,0)}100%{transform:translate(12px,0)}}'
  +'@keyframes matVel{from{transform:translateX(5px);opacity:0}40%{opacity:1}to{transform:translateX(-6px);opacity:0}}'
  +'@media(prefers-reduced-motion:reduce){.mat-av *{animation:none!important}}'
  +'.mat-fab span{font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:15px;letter-spacing:.6px;text-transform:uppercase}'
  +'.mat-panel{position:absolute;left:0;bottom:64px;width:372px;max-width:calc(100vw - 32px);height:min(70vh,560px);background:#fff;border:1px solid #dce3f0;border-radius:14px;box-shadow:0 12px 40px rgba(11,21,39,.25);overflow:hidden;display:none;flex-direction:column}'
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

  /* Avatar de Matts: un personaje (cabezón, pelo, vincha roja con las puntas al viento, camiseta roja y
     short azul) que cada 2,5 s cambia de deporte Y SE MUEVE en cada uno: corre, pega un drive, patea,
     pica la pelota, barre con el palo de hockey y tira golpes de box. SVG inline, sin archivos ni CDN.
     Cabeza y torso son comunes (dan continuidad); por deporte cambian piernas (grupo de atrás) y brazos +
     elementos (grupo de adelante), los dos con la misma clase mat-sN. Sin animaciones queda corriendo. */
  function avatarSvg(){
    var PIEL = '#f0b78c', PELO = '#3a2417';
    function mov(ox, oy, anim){ return ' style="transform-origin:'+ox+'px '+oy+'px;animation:'+anim+'"'; }
    function fijo(ox, oy, g){ return ' transform="rotate('+g+' '+ox+' '+oy+')"'; }
    // pierna: cuelga de la cadera (hx,45), con zapatilla
    function pierna(hx, t){
      return '<g'+t+'><path d="M'+hx+' 45 L'+hx+' 55.5" stroke="'+PIEL+'" stroke-width="4.6" stroke-linecap="round" fill="none"/>'
        + '<ellipse class="c-nav" cx="'+(hx+1.7)+'" cy="57.3" rx="3.7" ry="2.2"/></g>';
    }
    // brazo: cuelga del hombro (sx,32), con manga; `guante` = mano roja de box y `extra` = lo que lleva en la mano
    function brazo(sx, t, guante, extra){
      return '<g'+t+'>'+(extra||'')+'<path d="M'+sx+' 32 L'+sx+' 41.5" stroke="'+PIEL+'" stroke-width="4.2" stroke-linecap="round" fill="none"/>'
        + '<path class="s-red" d="M'+sx+' 32 L'+sx+' 34.5" stroke-width="4.8" stroke-linecap="round" fill="none"/>'
        + (guante ? '<circle class="c-red" cx="'+sx+'" cy="43" r="3.5"/>' : '<circle cx="'+sx+'" cy="42.2" r="2.5" fill="'+PIEL+'"/>')+'</g>';
    }
    var HL = 27.5, HR = 34.5, SL = 25.5, SR = 36.5;   // caderas y hombros
    var RAQ = '<path class="s-nav" d="M'+SR+' 43.5 L'+SR+' 48" stroke-width="1.9" stroke-linecap="round"/><ellipse class="s-nav" cx="'+SR+'" cy="52.6" rx="3.9" ry="4.8" stroke-width="1.7" fill="#fff" fill-opacity=".7"/>';
    var atras = [
      pierna(HL, mov(HL,45,'matR1 .3s ease-in-out infinite alternate')) + pierna(HR, mov(HR,45,'matR2 .3s ease-in-out infinite alternate')),
      pierna(HL, fijo(HL,45,20)) + pierna(HR, fijo(HR,45,-20)),
      pierna(HL, fijo(HL,45,10)) + pierna(HR, mov(HR,45,'matPat 1.25s ease-in-out infinite')),
      pierna(HL, fijo(HL,45,12)) + pierna(HR, fijo(HR,45,-12)),
      pierna(HL, fijo(HL,45,22)) + pierna(HR, fijo(HR,45,-24)),
      pierna(HL, fijo(HL,45,18)) + pierna(HR, fijo(HR,45,-18))
    ];
    var adelante = [
      // running: brazos al revés que las piernas + líneas de velocidad
      '<g stroke="#b9c3d8" stroke-width="1.8" stroke-linecap="round"><path d="M6 31 H13" style="animation:matVel .5s linear infinite"/><path d="M4 39 H12" style="animation:matVel .5s linear .17s infinite"/><path d="M7 47 H13" style="animation:matVel .5s linear .33s infinite"/></g>'
        + brazo(SL, mov(SL,32,'matR2 .3s ease-in-out infinite alternate')) + brazo(SR, mov(SR,32,'matR1 .3s ease-in-out infinite alternate')),
      // tenis: drive con la raqueta, la pelota viene y sale
      brazo(SL, fijo(SL,32,55)) + brazo(SR, mov(SR,32,'matRaq 1.25s cubic-bezier(.5,0,.2,1) infinite'), false, RAQ)
        + '<circle cx="47" cy="36" r="2.2" fill="#c8e11c" stroke="#8fa30f" stroke-width=".6" style="animation:matBTen 1.25s linear infinite"/>',
      // fútbol: patea y la pelota sale
      brazo(SL, fijo(SL,32,58)) + brazo(SR, fijo(SR,32,-58))
        + '<g style="animation:matBFut 1.25s ease-out infinite"><circle cx="44.5" cy="54.5" r="3.7" fill="#fff" class="s-nav" stroke-width="1.3"/><path class="c-nav" d="M44.5 52.4l2 1.5-.8 2.3h-2.4l-.8-2.3z"/></g>',
      // básquet: pica la pelota
      brazo(SL, fijo(SL,32,32)) + brazo(SR, mov(SR,32,'matDri .28s ease-in-out infinite alternate'))
        + '<g style="animation:matBBas .28s ease-in infinite alternate"><circle cx="46" cy="44.5" r="3.8" fill="#e8772e" stroke="#9c4512" stroke-width=".9"/><path d="M42.4 44.5h7.2M46 40.8v7.4" stroke="#9c4512" stroke-width=".8"/></g>',
      // hockey: las dos manos al palo, barre y sale la bocha
      '<g'+mov(40,38,'matPalo 1.25s ease-in-out infinite')+'><path d="M40 37 L50.5 56.5 L55 55.5" stroke="#8a5a2b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>'
        + brazo(SL, fijo(SL,32,-62)) + brazo(SR, fijo(SR,32,-34))
        + '<circle cx="57" cy="57" r="2.1" fill="#f4b400" stroke="#a87b00" stroke-width=".6" style="animation:matBHoc 1.25s ease-out infinite"/>',
      // box: uno-dos con guantes
      brazo(SL, mov(SL,32,'matPunB .5s ease-in-out infinite alternate'), true) + brazo(SR, mov(SR,32,'matPunA .5s ease-in-out infinite alternate'), true)
    ];
    function capa(lista){ return lista.map(function(h, i){ return '<g class="mat-s mat-s'+(i+1)+'">'+h+'</g>'; }).join(''); }
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><g transform="translate(32 33) scale(.9) translate(-32 -32)"><g class="mat-bob">'
      + capa(atras)
      // torso: short + camiseta con cuello
      + '<rect class="c-nav" x="24" y="38" width="14" height="9" rx="3.2"/><rect class="c-red" x="23.5" y="28.5" width="15" height="13" rx="5"/><path d="M28 29.2 L31 32.2 L34 29.2" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
      // cabeza: puntas de la vincha, cara, pelo, vincha, ojos y sonrisa (mira hacia la derecha, a la pelota)
      + '<g class="mat-cola"><path class="s-red" d="M20.7 17.8 L15.5 19.6 M20.7 17.8 L16.4 23.2" stroke-width="2.2" stroke-linecap="round" fill="none"/></g>'
      + '<circle cx="31" cy="18" r="10.5" fill="'+PIEL+'"/>'
      + '<path d="M20.6 17.2 A10.5 10.5 0 0 1 41.4 17.2 Q37 11.5 31 12.2 Q25 12 20.6 17.2Z" fill="'+PELO+'"/>'
      + '<path class="s-red" d="M20.6 17.6 Q31 12.4 41.4 17.6" stroke-width="2.7" fill="none" stroke-linecap="round"/>'
      + '<circle cx="33.4" cy="21" r="1.35" fill="#1b1b1b"/><circle cx="38.4" cy="20.6" r="1.35" fill="#1b1b1b"/>'
      + '<path d="M32.6 24.6 Q36 27.6 39.4 24.2" stroke="#1b1b1b" stroke-width="1.25" fill="none" stroke-linecap="round"/>'
      + capa(adelante)
      + '</g></g></svg>';
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
