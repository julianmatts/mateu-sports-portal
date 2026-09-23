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
   No se monta sin sesión ni en los informes públicos (?pres=).
   En el PUESTO del salón (rol puesto) va como asesor de producto: sube
   arriba del pie del quiosco, la charla se borra a los 90 s sin uso (la
   pantalla es compartida) y una pasada de la lectora con el chat enfocado
   no se manda como pregunta: se deriva al buscador.

   Cada respuesta lleva «¿Te sirvió? Sí / No»: el voto va al log de la
   Function y se ve en el panel de uso (asistente/).

   La charla vive en sessionStorage (se borra al cerrar la pestaña) y se
   manda recortada a las últimas vueltas. Clases con prefijo mat-.
   ============================================================ */
(function(){
  'use strict';
  if(window.__mattsCargado) return; window.__mattsCargado = true;

  var NOMBRE = 'Matts';
  var SESSION = null;
  try{ var s = localStorage.getItem('mateu_portal_session'); SESSION = s ? JSON.parse(s) : null; }catch(e){}
  if(!SESSION || !SESSION.email) return;
  var PUESTO = SESSION.rol === 'puesto';   // quiosco del salón: solo asesor de producto, y la charla se borra sola
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
  +'#mattsWidget.mat-puesto{bottom:86px}'   // arriba del pie fijo del quiosco
  +'#mattsWidget *{box-sizing:border-box}'
  +'.mat-fab{height:54px;padding:0 18px 0 5px;border-radius:27px;border:none;border-bottom:3px solid var(--marca-red,#CC0000);cursor:pointer;background:var(--marca-navy,#0B1527);color:#fff;display:flex;align-items:center;gap:9px;box-shadow:0 8px 30px rgba(11,21,39,.22);transition:transform .15s}'
  +'.mat-fab:hover{transform:translateY(-2px)}'
  +'.mat-av{width:44px;height:44px;border-radius:50%;overflow:hidden;background:var(--marca-navy,#0B1527);box-shadow:0 0 0 2px var(--marca-red,#CC0000);color:#fff;display:flex;align-items:center;justify-content:center;font-family:\'Bebas Neue\',sans-serif;font-size:21px;line-height:1;flex:none}'
  // avatar: silueta atlética articulada, animada por JS (ver avatarSvg / animarAvatares)
  +'.mat-av svg{width:100%;height:100%;display:block}'
  +'.mat-av .c-red{fill:var(--marca-red,#CC0000)}.mat-av .s-red{stroke:var(--marca-red,#CC0000)}'
  +'.mat-fab span{font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:15px;letter-spacing:.6px;text-transform:uppercase}'
  +'.mat-panel{position:absolute;left:0;bottom:66px;width:372px;max-width:calc(100vw - 32px);height:min(70vh,560px);background:#fff;border:1px solid #dce3f0;border-radius:14px;box-shadow:0 12px 40px rgba(11,21,39,.25);overflow:hidden;display:none;flex-direction:column}'
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
  +'.mat-voto{align-self:flex-start;display:flex;gap:6px;margin:-4px 0 2px 4px;font-size:11.5px;color:#7b86a0;align-items:center}'
  +'.mat-voto button{background:none;border:1px solid #d5dcea;border-radius:12px;padding:3px 9px;font-family:Barlow,sans-serif;font-size:11.5px;color:#56627c;cursor:pointer}'
  +'.mat-voto button:hover{border-color:var(--marca-navy,#0B1527);color:var(--marca-navy,#0B1527)}'
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

  /* Avatar de Matts: SILUETA ATLÉTICA ARTICULADA (estética de gráfica deportiva: blanca sobre navy, acentos
     rojos, líneas de velocidad, leve inclinación). Tiene esqueleto de verdad —torso, hombro+codo, cadera+
     rodilla— y un motor chico (animarAvatares) interpola entre poses clave 30 veces por segundo, así
     corre con ciclo de carrera real, pega el drive, patea, pica la pelota y emboca en el aro, y tira
     jab-cross, y PASA de un deporte al otro transformando la pose (sin fundidos). Con
     «reducir movimiento» queda fija en la zancada. Historia: 1.º pictograma de palitos («el colgado») y 2.º
     muñeco cabezón («dibujito de bebé»), los dos rechazados por Juli el 20/09/2026: no volver a eso. */
  function seg(largo, ancho, color){ return '<path d="M0 0 L0 '+largo+'" stroke="'+color+'" stroke-width="'+ancho+'" stroke-linecap="round" fill="none"/>'; }
  function avatarSvg(){
    var F = '#ffffff', B = '#aab6cf';   // lado de adelante / lado de atrás (más apagado: da profundidad)
    function pierna(lado, c){
      return '<g data-j="h'+lado+'">'+seg(17, 7.6, c)+'<g transform="translate(0 17)"><g data-j="k'+lado+'">'+seg(16.5, 5.4, c)
        + '<path class="s-red" d="M0 16.5 L6.2 18.2" stroke-width="3.6" stroke-linecap="round" fill="none"/></g></g></g>';
    }
    function brazo(lado, c, extra){
      return '<g data-j="s'+lado+'">'+seg(12.5, 5.2, c)+'<g transform="translate(0 12.5)"><g data-j="e'+lado+'">'+seg(11.5, 4, c)
        + '<g transform="translate(0 11.5)"><circle r="2.5" fill="'+c+'"/><circle data-p="guante" class="c-red" r="4.3" cy="1" opacity="0"/>'+(extra||'')+'</g></g></g></g>';
    }
    var RAQ = '<g data-p="raq" opacity="0"><path d="M0 1 L0 8" stroke="#fff" stroke-width="2" stroke-linecap="round"/><ellipse cx="0" cy="15" rx="5.2" ry="7" fill="rgba(255,255,255,.16)" stroke="#fff" stroke-width="1.7"/></g>';
    var PALO = '<g data-p="palo" opacity="0" transform="rotate(34)"><path class="s-red" d="M0 -5 L0 33 L6 35.5" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>';
    return '<svg viewBox="0 0 100 100" aria-hidden="true">'
      // fondo: piso con filo rojo + líneas de velocidad (el piso NO va relleno de rojo: tapaba las zapatillas y el palo)
      + '<path d="M-5 84 Q45 74 105 88 L105 105 L-5 105Z" fill="#fff" opacity=".07"/><path class="s-red" d="M-5 84 Q45 74 105 88" stroke-width="2.4" fill="none"/>'
      + '<g stroke="#fff" stroke-linecap="round" opacity=".22"><path d="M4 34 H24" stroke-width="2.2"/><path d="M0 46 H17" stroke-width="2.2"/><path d="M7 58 H21" stroke-width="2.2"/></g>'
      + '<g transform="translate(50 50) scale(1.02) skewX(-7) translate(-47 -50)">'
      + '<g data-j="raiz" transform="translate(46 54)">'
      +   '<g data-j="torsoB">' + '<g transform="translate(-1 -23)">'+brazo('L', B)+'</g></g>'     // brazo de atrás (cuelga del torso)
      +   '<g transform="translate(-1.5 0)">'+pierna('L', B)+'</g>'
      +   '<g data-j="torso"><path d="M-4.6 1 L4.6 1 L7.4 -22 Q7.6 -25.6 3 -25.6 L-3.6 -25.6 Q-7.4 -25.4 -6.4 -21Z" fill="'+F+'" stroke="'+F+'" stroke-width="2" stroke-linejoin="round"/>'
      +     '<path class="s-red" d="M-5.6 -13 L6.6 -15.2" stroke-width="2.4"/>'                        // franja de la camiseta
      +     '<path d="M1 -25 L2.2 -30" stroke="'+F+'" stroke-width="4.2" stroke-linecap="round"/><ellipse cx="3.2" cy="-34.6" rx="4.7" ry="5.5" fill="'+F+'"/></g>'
      +   '<g transform="translate(1.5 0)">'+pierna('R', F)+'</g>'
      +   '<g data-j="torsoF">' + '<g transform="translate(1 -23)">'+brazo('R', F, RAQ + PALO)+'</g></g>'
      + '</g>'
      + '<g data-p="aro" opacity="0" transform="translate(-10 3)"><path d="M93 8 V27" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M79.5 23 L81.5 32 M85 23.6 L85 33 M90.5 23 L88.5 32 M80.6 27.5 H89.4" stroke="#fff" stroke-width=".9" opacity=".75" fill="none"/><ellipse class="s-red" cx="85" cy="22.5" rx="6.6" ry="1.9" stroke-width="2" fill="none"/><path class="s-red" d="M91.6 22.5 H93" stroke-width="2"/></g>'
      + '<g data-j="pelota" opacity="0"><circle data-p="b" r="3" fill="#fff"/></g>'
      + '</g></svg>';
  }

  /* Poses clave. Ángulos en grados, positivo = hacia ADELANTE (el atleta mira a la derecha); rodilla y codo
     son flexión. Campos: [inclinación del torso, altura, homL, codoL, homR, codoR, cadL, rodL, cadR, rodR,
     pelotaX, pelotaY, pelotaVisible]. L = lado de atrás, R = lado de adelante (el que lleva raqueta y palo).
     Los hombros cuelgan del torso: su ángulo es relativo a la inclinación. */
  var DEPORTES = [
    { n:'running', loops:4, k:[
      [[16, 0,   62,95, -40,75,  -30,14,  58,82,  0,0,0], 135],
      [[16,-3,   18,95,   2,88,    2,98,  24,22,  0,0,0], 135],
      [[16, 0,  -40,75,  62,95,   58,82, -30,14,  0,0,0], 135],
      [[16,-3,    2,88,  18,95,   24,22,   2,98,  0,0,0], 135] ]},
    { n:'tenis', prop:'raq', pel:[2.7,'#d9f20a'], loops:2, k:[
      [[ 8, 1,   50,55, -78,28,   30,30, -24,24,  100,30,1], 430],
      [[12, 0,   22,65,  66, 6,   32,26, -26,18,   86,47,1], 150],
      [[ 5,-1,  -12,75, 140,58,   26,20, -20,26,  118,14,1], 250],
      [[ 8, 1,   45,55, -25,45,   30,30, -24,24,  118,14,0], 330] ]},
    { n:'futbol', pel:[4.2,'#ffffff'], loops:2, k:[
      [[ -2, 0,  58,28, -62,32,    8,12, -52,88,   80,84,1], 400],
      [[-10, 0, -32,32,  52,22,    5, 8,  54, 5,   81,83,1], 140],
      [[-15,-2, -52,32,  72,22,    3, 5,  84,10,  120,46,1], 290],
      [[  0, 0,  22,32, -22,32,    8,12, -15,30,  120,46,0], 360] ]},
    { n:'basquet', prop:'aro', pel:[4.6,'#ff7a2f'], loops:1, k:[
      [[15, 3,   35,45,  42,62,   26,38, -16,32,   71,60,1], 300],   // pica: la mano empuja…
      [[15, 4,   35,45,  55,28,   26,38, -16,32,   73,88,1], 170],   // …la pelota va al piso
      [[15, 3,   35,45,  42,62,   26,38, -16,32,   71,60,1], 190],
      [[15, 4,   35,45,  55,28,   26,38, -16,32,   73,88,1], 170],
      [[15, 3,   35,45,  42,62,   26,38, -16,32,   71,60,1], 190],
      [[10, 6,   78,112, 82,116,  38,68,  32,62,   66,41,1], 300],   // se agrupa con la pelota al pecho
      [[ 2,-5,  150,28, 162,16,    5, 8,  -8,22,   62, 4,1], 230],   // salta y suelta
      [[ 3,-5,  142,30, 140,55,    6, 9,  -6,18,   67, 0,1], 150],   // la pelota sube
      [[ 4,-3,  140,32, 128,72,    8,10,  -5,16,   75,24,1], 230],   // entra al aro
      [[10, 4,   62,82,  62,82,   26,46,  22,40,   75,39,1], 230],   // cae por la red mientras aterriza
      [[12, 3,   40,50,  40,55,   26,38, -16,32,   75,39,0], 260] ]},
    { n:'box', prop:'guante', loops:2, k:[
      [[10, 0,   58,128, 68,132,  18,18, -22,28,  0,0,0], 260],
      [[15,-1,   58,128,104, 4,   20,20, -24,24,  0,0,0], 110],
      [[10, 1,   58,128, 68,132,  18,18, -22,28,  0,0,0], 170],
      [[19, 0,  110, 4,  62,132,  22,22, -26,22,  0,0,0], 120],
      [[10, 1,   58,128, 68,132,  18,18, -22,28,  0,0,0], 220] ]}
  ];
  var CAMBIO_MS = 360;   // cuánto tarda en transformarse de un deporte al siguiente

  function animarAvatares(raiz){
    var svgs = raiz.querySelectorAll('.mat-av svg'), inst = [];
    for(var i=0;i<svgs.length;i++){
      var o = { j:{}, p:{} }, ns = svgs[i].querySelectorAll('[data-j]'), ps = svgs[i].querySelectorAll('[data-p]');
      for(var a=0;a<ns.length;a++) o.j[ns[a].getAttribute('data-j')] = ns[a];
      for(var b=0;b<ps.length;b++){ var k = ps[b].getAttribute('data-p'); (o.p[k] = o.p[k] || []).push(ps[b]); }
      inst.push(o);
    }
    function aplicar(P, dep){
      for(var i=0;i<inst.length;i++){
        var J = inst[i].j, Pp = inst[i].p;
        J.raiz.setAttribute('transform', 'translate(46 '+(54 + P[1]).toFixed(2)+')');
        var t = 'rotate('+P[0].toFixed(1)+')';
        J.torso.setAttribute('transform', t); J.torsoB.setAttribute('transform', t); J.torsoF.setAttribute('transform', t);
        J.sL.setAttribute('transform', 'rotate('+(-P[2]).toFixed(1)+')'); J.eL.setAttribute('transform', 'rotate('+(-P[3]).toFixed(1)+')');
        J.sR.setAttribute('transform', 'rotate('+(-P[4]).toFixed(1)+')'); J.eR.setAttribute('transform', 'rotate('+(-P[5]).toFixed(1)+')');
        J.hL.setAttribute('transform', 'rotate('+(-P[6]).toFixed(1)+')'); J.kL.setAttribute('transform', 'rotate('+P[7].toFixed(1)+')');
        J.hR.setAttribute('transform', 'rotate('+(-P[8]).toFixed(1)+')'); J.kR.setAttribute('transform', 'rotate('+P[9].toFixed(1)+')');
        J.pelota.setAttribute('transform', 'translate('+P[10].toFixed(1)+' '+P[11].toFixed(1)+')');
        J.pelota.setAttribute('opacity', P[12].toFixed(2));
        if(dep){
          ['raq','palo','guante','aro'].forEach(function(k){ (Pp[k]||[]).forEach(function(n){ n.setAttribute('opacity', dep.prop === k ? 1 : 0); }); });
          if(dep.pel) (Pp.b||[]).forEach(function(n){ n.setAttribute('r', dep.pel[0]); n.setAttribute('fill', dep.pel[1]); });
        }
      }
    }
    var quieto = false;
    try{ quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
    aplicar(DEPORTES[0].k[0][0], DEPORTES[0]);
    if(quieto || !inst.length) return;

    var d = 0, ki = 0, vueltas = 0, desde = DEPORTES[0].k[0][0].slice(), hasta = DEPORTES[0].k[1][0], dur = DEPORTES[0].k[1][1], t0 = 0;
    ki = 1;
    function suave(x){ return x < .5 ? 2*x*x : 1 - Math.pow(-2*x + 2, 2) / 2; }
    function ahora(){ return (window.performance && performance.now) ? performance.now() : new Date().getTime(); }
    function cuadro(){
      if(document.hidden) return;
      var ts = ahora();
      if(!t0) t0 = ts;
      var x = Math.min(1, (ts - t0) / dur), e = suave(x), P = [];
      for(var n=0;n<13;n++) P[n] = desde[n] + (hasta[n] - desde[n]) * e;
      // la pelota no «vuelve volando»: si aparece, nace en destino; si se va, se apaga donde estaba
      if(desde[12] === 0){ P[10] = hasta[10]; P[11] = hasta[11]; }
      else if(hasta[12] === 0){ P[10] = desde[10]; P[11] = desde[11]; }
      else { P[10] = desde[10] + (hasta[10]-desde[10]) * x; P[11] = desde[11] + (hasta[11]-desde[11]) * x; }   // vuelo parejo
      aplicar(P, null);
      if(x >= 1){
        desde = hasta.slice(); t0 = ts;
        var K = DEPORTES[d].k;
        ki++;
        if(ki >= K.length){ ki = 0; vueltas++; }
        if(vueltas >= DEPORTES[d].loops && ki === 0){
          d = (d + 1) % DEPORTES.length; vueltas = 0;
          hasta = DEPORTES[d].k[0][0]; dur = CAMBIO_MS;
          aplicar(desde, DEPORTES[d]);   // cambia raqueta / palo / guantes / pelota en el momento del pase
        } else { hasta = K[ki][0]; dur = K[ki][1]; }
      }
    }
    // reloj propio (30 cuadros/s) en vez de requestAnimationFrame: anda igual en navegadores viejos y en
    // vistas embebidas donde rAF no dispara; con la pestaña oculta no hace nada
    setInterval(cuadro, 33);
  }

  var SUGERENCIAS = {
    _puesto: ['Zapatilla para empezar a correr', 'Paleta de pádel para principiante', '¿En qué sucursal hay stock de …'],
    _def: ['¿Cómo se usa este módulo?', '¿En qué sucursal hay stock de …', 'Un cliente quiere empezar a correr, ¿qué zapatilla le recomiendo?', '¿Qué raquetas de tenis trabajamos?'],
    ubicaciones: ['¿Cómo cargo el stock del día?', '¿Cómo vinculo una etiqueta que no encuentra?', 'Un cliente busca paleta de pádel para principiante'],
    indicadores: ['¿Cómo venimos esta semana?', '¿Qué tengo pendiente hoy?', '¿Cómo viene el equipo?'],
    portal: ['¿Cómo venimos esta semana?', '¿En qué sucursal hay stock de …', '¿Cómo se usa este módulo?'],
    'gestion-stock': ['¿Cómo comento un discontinuo?', '¿Cómo se lee meses de stock?'],
    barrida: ['¿Qué archivos necesito para la barrida?', '¿Qué hace «Abrir a más sucursales»?'],
    tareas: ['¿Cómo registro un cambio de vidriera?', '¿Cómo cargo el checklist de limpieza?']
  };

  var $log, $txt, $send, $panel, W_BASE = '';

  function guardar(){ ssSet(K_CHAT, JSON.stringify(CHAT.slice(-30))); }
  function bajar(){ if($log) $log.scrollTop = $log.scrollHeight; }

  function pintar(){
    var h = '';
    if(!CHAT.length){
      var nom = (SESSION.nombre || '').split(' ')[0];
      h += PUESTO
        ? '<div class="mat-m bot">¡Buenas! Soy <b>' + NOMBRE + '</b>. Contame qué busca el cliente y te ayudo a recomendarle, o pasame un artículo y te digo en qué sucursal hay.</div>'
        : '<div class="mat-m bot">¡Buenas' + (nom ? ', ' + esc(nom) : '') + '! Soy <b>' + NOMBRE + '</b>. Preguntame cómo se usa el portal o pedime una mano para asesorar a un cliente en cualquier deporte.</div>';
      var sug = PUESTO ? SUGERENCIAS._puesto : (SUGERENCIAS[modulo()] || []).concat(SUGERENCIAS._def).slice(0, 3);
      h += '<div class="mat-sug">' + sug.map(function(t){ return '<button type="button" data-sug="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div>';
    }
    CHAT.forEach(function(m){
      h += '<div class="mat-m ' + (m.err ? 'err' : m.role === 'user' ? 'yo' : 'bot') + '">' + (m.role === 'user' ? esc(m.content).replace(/\n/g,'<br>') : formato(m.content)) + '</div>';
      if(m.id && !m.err) h += m.voto ? '<div class="mat-voto">' + (m.voto > 0 ? '✓ Gracias, anotado.' : '✓ Anotado: lo vamos a mejorar.') + '</div>'
        : '<div class="mat-voto">¿Te sirvió? <button type="button" data-voto="1" data-vid="' + esc(m.id) + '">Sí</button><button type="button" data-voto="-1" data-vid="' + esc(m.id) + '">No</button></div>';
    });
    if(ESPERANDO) h += '<div class="mat-m bot mat-dots"><i></i><i></i><i></i></div>';
    $log.innerHTML = h;
    bajar();
  }

  // Puesto: una pasada de la lectora con el chat enfocado (todo el texto entró en un instante, sin
  // espacios) no es una pregunta: se limpia, se cierra el chat y se le pasa al buscador de la página.
  var T_PRIMERA = 0;
  function pareceEscaneo(texto){
    return PUESTO && T_PRIMERA && texto.length >= 6 && !/\s/.test(texto) && (Date.now() - T_PRIMERA) < 60 * texto.length && (Date.now() - T_PRIMERA) < 900;
  }
  var T_OCIO = null;
  function tocarOcio(){
    if(!PUESTO) return;
    clearTimeout(T_OCIO);
    T_OCIO = setTimeout(function(){ if(ESPERANDO) return tocarOcio(); CHAT = []; guardar(); if(ABIERTO) abrir(false); }, 90000);
  }

  function enviar(texto){
    texto = (texto || '').replace(/^\s+|\s+$/g, '');
    if(!texto || ESPERANDO) return;
    if(pareceEscaneo(texto)){
      $txt.value = ''; T_PRIMERA = 0; abrir(false);
      try{ if(typeof window.procesarEscaneo === 'function') window.procesarEscaneo(texto); }catch(e){}
      return;
    }
    T_PRIMERA = 0; tocarOcio();
    CHAT = CHAT.filter(function(m){ return !m.err; });
    CHAT.push({ role:'user', content:texto });
    ESPERANDO = true; $send.disabled = true; $txt.value = ''; $txt.style.height = '40px';
    guardar(); pintar();
    var mensajes = CHAT.slice(-12).map(function(m){ return { role:m.role, content:m.content }; });
    // memoria: lo que las últimas respuestas ya mostraron (artículos con stock), para que «de hombre» o «¿y en 42?» sigan el hilo
    var contexto = [];
    for(var i = CHAT.length - 1; i >= 0 && contexto.length < 2; i--) if(CHAT[i].role === 'assistant' && CHAT[i].ctx) contexto.unshift(CHAT[i].ctx);
    pedir('POST', { email:SESSION.email, tok:SESSION.tok||'', modulo:modulo(), mensajes:mensajes, contexto:contexto }, function(st, d){
      ESPERANDO = false; $send.disabled = false;
      if(st === 200 && d && d.respuesta) CHAT.push({ role:'assistant', content:d.respuesta, id:d.id || '', ctx:d.ctx || '' });
      else CHAT.push({ role:'assistant', err:true, content:(d && d.error) || 'No me pude conectar. Revisá internet y probá de nuevo.' });
      guardar(); pintar();
      try{ $txt.focus(); }catch(e){}
    });
  }

  function votar(id, voto){
    for(var i=0;i<CHAT.length;i++) if(CHAT[i].id === id) CHAT[i].voto = voto;
    guardar(); pintar();
    pedir('POST', { accion:'voto', email:SESSION.email, id:id, voto:voto }, function(){});
  }

  function abrir(si){
    ABIERTO = si;
    $panel.className = 'mat-panel' + (si ? ' on' : '');
    $panel.parentNode.className = (W_BASE + (si ? ' abierto' : '')).replace(/^\s+/, '');
    if(si) tocarOcio();
    if(si){ pintar(); setTimeout(function(){ try{ $txt.focus(); }catch(e){} }, 60); }
  }

  function montar(){
    if(document.getElementById('mattsWidget')) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var w = document.createElement('div'); w.id = 'mattsWidget'; W_BASE = PUESTO ? 'mat-puesto' : '';
    w.className = W_BASE;
    w.innerHTML = ''
      +'<div class="mat-panel" role="dialog" aria-label="' + NOMBRE + ', asistente del portal">'
      +  '<div class="mat-head"><div class="mat-av">' + avatarSvg() + '</div><div><b>' + NOMBRE + '</b><small>' + (PUESTO ? 'Asesor deportivo' : 'Asistente del portal · asesor deportivo') + '</small></div><div class="mat-sp"></div>'
      +    '<button type="button" class="mat-hb" data-act="nueva" title="Empezar una charla nueva">Nueva</button>'
      +    '<button type="button" class="mat-hb" data-act="cerrar" aria-label="Cerrar">✕</button></div>'
      +  '<div class="mat-log"></div>'
      +  '<div class="mat-form"><textarea placeholder="Escribile a ' + NOMBRE + '…" maxlength="1500" rows="1"></textarea><button type="button" class="mat-send">Enviar</button></div>'
      +  '<div class="mat-pie">El stock es el último que cargó cada sucursal en el Buscador. Puede equivocarse: ante la duda, consultá.</div>'
      +'</div>'
      +'<button type="button" class="mat-fab" aria-label="Abrir a ' + NOMBRE + '"><div class="mat-av">' + avatarSvg() + '</div><span>' + NOMBRE + '</span></button>';
    document.body.appendChild(w);
    try{ animarAvatares(w); }catch(e){}
    $panel = w.querySelector('.mat-panel'); $log = w.querySelector('.mat-log');
    $txt = w.querySelector('textarea'); $send = w.querySelector('.mat-send');

    w.querySelector('.mat-fab').onclick = function(){ abrir(!ABIERTO); };
    $send.onclick = function(){ enviar($txt.value); };
    $txt.onkeydown = function(e){
      e = e || window.event;
      if((e.key === 'Enter' || e.keyCode === 13) && !e.shiftKey){ if(e.preventDefault) e.preventDefault(); enviar($txt.value); return false; }
    };
    $txt.oninput = function(){ if(!$txt.value) T_PRIMERA = 0; else if(!T_PRIMERA) T_PRIMERA = Date.now(); tocarOcio(); $txt.style.height = '40px'; $txt.style.height = Math.min(110, $txt.scrollHeight) + 'px'; };
    w.onclick = function(e){
      var t = (e || window.event).target;
      while(t && t !== w){
        if(t.getAttribute){
          var sug = t.getAttribute('data-sug'), act = t.getAttribute('data-act');
          if(sug){ if(/…$/.test(sug)){ $txt.value = sug.replace(/…$/, ''); try{ $txt.focus(); }catch(e){} } else enviar(sug); return; }   // «… » = deja la frase escrita para completar
          var vid = t.getAttribute('data-vid');
          if(vid){ votar(vid, t.getAttribute('data-voto') === '-1' ? -1 : 1); return; }
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
