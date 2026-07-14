/* ============================================================
   Calendario Retail — componente del SHELL del portal Mateu.
   Vanilla JS, cero dependencias. Se auto-monta en el header.

   Config opcional (definir ANTES de cargar este script):
     window.CALENDARIO_RETAIL_CONFIG = {
       mount: '.top-right',   // selector del contenedor del header
       dataUrl: '...'         // override de la ruta del JSON
     }

   Motor de fechas — tres formas de evento en el JSON:
     1. fija:   { "fecha": "2026-05-01" }
     2. rango:  { "fecha_inicio": "...", "fecha_fin": "..." }
     3. movil:  { "regla": { "mes":10, "semana":3, "dia":0 } }
                = 3er domingo de octubre (dia 0=domingo..6=sabado),
                  resuelta en runtime para el anio que se este viendo.
   ============================================================ */
(function(){
  'use strict';

  // ---- ruta base: el JSON vive en shared/data relativo a este script ----
  var THIS = document.currentScript ||
    (function(){ var s=document.querySelectorAll('script'); return s[s.length-1]; })();
  var CFG = window.CALENDARIO_RETAIL_CONFIG || {};
  var DATA_URL = CFG.dataUrl ||
    (THIS ? new URL('../../data/calendario-2026.json', THIS.src).href : 'shared/data/calendario-2026.json');
  var MOUNT_SEL = CFG.mount || '.top-right';
  var LS_FILTROS = 'cr_filtros';

  // ---- meta de tipos ----
  var TIPOS = ['feriado','comercial','interno'];
  var TIPO_LBL = { feriado:'Feriado', comercial:'Comercial', interno:'Interno' };
  function colorDe(ev){
    if(ev.tipo==='feriado') return '#D32F2F';
    if(ev.tipo==='interno') return '#9CA3AF';
    return ev.impacto==='alto' ? '#F59E0B' : '#38BDF8'; // comercial
  }

  // ---- helpers de fecha (todo a medianoche local) ----
  var MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  var MESES_L = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var DOW = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  function soloDia(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function hoy(){ return soloDia(new Date()); }
  function parseYMD(s){ var p=String(s).split('-'); return new Date(+p[0], +p[1]-1, +p[2]); }
  function addDias(d,n){ var x=new Date(d); x.setDate(x.getDate()+n); return x; }
  function diffDias(a,b){ return Math.round((soloDia(b)-soloDia(a))/86400000); }
  function mismoDia(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
  function claveDia(d){ return d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate(); }

  // n-esimo dia de la semana del mes (regla movil). Devuelve null si no existe.
  function nEsimoDiaSemana(anio, mes/*1-12*/, semana/*1-5*/, dia/*0-6*/){
    var primero = new Date(anio, mes-1, 1);
    var offset = (dia - primero.getDay() + 7) % 7;
    var numDia = 1 + offset + (semana-1)*7;
    var diasMes = new Date(anio, mes, 0).getDate();
    if(numDia > diasMes) return null;
    return new Date(anio, mes-1, numDia);
  }

  // Expande un evento del JSON a { inicio, fin } para un anio dado.
  function expandir(ev, anio){
    var o = { id:ev.id, titulo:ev.titulo, tipo:ev.tipo, impacto:ev.impacto||'medio' };
    if(ev.regla){
      var d = nEsimoDiaSemana(anio, ev.regla.mes, ev.regla.semana, ev.regla.dia);
      if(!d) return null;
      o.inicio = d; o.fin = d;
    } else if(ev.fecha_inicio && ev.fecha_fin){
      o.inicio = parseYMD(ev.fecha_inicio); o.fin = parseYMD(ev.fecha_fin);
    } else if(ev.fecha){
      o.inicio = parseYMD(ev.fecha); o.fin = o.inicio;
    } else {
      return null;
    }
    o.color = colorDe(o);
    return o;
  }

  // Todas las ocurrencias para una lista de anios (rangos/fijos caen por su fecha real;
  // las reglas moviles se resuelven para cada anio pedido).
  function ocurrencias(anios){
    var out = [];
    anios.forEach(function(anio){
      RAW.forEach(function(ev){
        var o = expandir(ev, anio);
        if(!o) return;
        // fijos/rangos: solo incluirlos una vez (cuando su anio coincide)
        if(!ev.regla && o.inicio.getFullYear() !== anio) return;
        out.push(o);
      });
    });
    return out;
  }

  // ---- estado ----
  var RAW = [];                 // eventos crudos del JSON
  var abierto = false;
  var hoyD = hoy();
  var verAnio = hoyD.getFullYear();
  var verMes = hoyD.getMonth();  // 0-11
  var seleccion = null;          // Date | null (filtro por dia)
  var foco = new Date(hoyD);     // dia con foco de teclado
  var filtros = leerFiltros();

  function leerFiltros(){
    try{
      var s = JSON.parse(localStorage.getItem(LS_FILTROS));
      if(s) return { feriado:s.feriado!==false, comercial:s.comercial!==false, interno:s.interno!==false };
    }catch(e){}
    return { feriado:true, comercial:true, interno:true };
  }
  function guardarFiltros(){ try{ localStorage.setItem(LS_FILTROS, JSON.stringify(filtros)); }catch(e){} }
  function pasaFiltro(o){ return filtros[o.tipo]; }

  // ---- refs de DOM ----
  var elTrigger, elPop, elDot;

  function fmtHoyCorto(){
    return DOW[hoyD.getDay()]+' '+hoyD.getDate()+' '+MESES[hoyD.getMonth()];
  }

  // Hay algun evento hoy o en <=3 dias? (para el dot de notificacion)
  function hayProximo(){
    var win = ocurrencias([hoyD.getFullYear(), hoyD.getFullYear()+1]);
    return win.some(function(o){
      if(!pasaFiltro(o)) return false;
      // activo entre hoy y hoy+3, o rango en curso
      var d = diffDias(hoyD, o.inicio);
      var enCurso = soloDia(o.inicio) <= hoyD && hoyD <= soloDia(o.fin);
      return enCurso || (d >= 0 && d <= 3);
    });
  }

  // ================= RENDER =================
  function construir(){
    // --- trigger ---
    elTrigger = document.createElement('button');
    elTrigger.className = 'cr-trigger';
    elTrigger.type = 'button';
    elTrigger.setAttribute('aria-haspopup','dialog');
    elTrigger.setAttribute('aria-expanded','false');
    elTrigger.setAttribute('aria-label','Calendario retail');
    elTrigger.innerHTML = '<span class="cr-cal-ico">📅</span>'+
      '<span class="cr-today-lbl">'+fmtHoyCorto()+'</span>'+
      '<span class="cr-dot" hidden></span>';
    elDot = elTrigger.querySelector('.cr-dot');

    // --- popover (va al body para no ser recortado por el header) ---
    elPop = document.createElement('div');
    elPop.className = 'cr cr-pop';
    elPop.setAttribute('role','dialog');
    elPop.setAttribute('aria-modal','false');
    elPop.setAttribute('aria-label','Calendario retail');
    document.body.appendChild(elPop);

    elTrigger.addEventListener('click', function(e){ e.stopPropagation(); toggle(); });
  }

  function render(){
    if(elDot) elDot.hidden = !hayProximo();
    if(!abierto) return;
    elPop.innerHTML =
      '<div class="cr-body">'+
        renderMes()+
        renderLista()+
        renderFooter()+
      '</div>';
    cablearPop();
  }

  function renderMes(){
    var primero = new Date(verAnio, verMes, 1);
    var arranque = primero.getDay(); // 0=domingo
    var diasMes = new Date(verAnio, verMes+1, 0).getDate();
    var ocs = ocurrencias([verAnio]).filter(pasaFiltro);

    var celdas = '';
    for(var i=0;i<arranque;i++) celdas += '<div class="cr-day cr-empty"></div>';
    for(var dia=1; dia<=diasMes; dia++){
      var fecha = new Date(verAnio, verMes, dia);
      var delDia = ocs.filter(function(o){ return soloDia(o.inicio)<=fecha && fecha<=soloDia(o.fin); });
      var cls = 'cr-day';
      if(mismoDia(fecha, hoyD)) cls += ' cr-today';
      if(seleccion && mismoDia(fecha, seleccion)) cls += ' cr-selected';
      // marcado de rango continuo
      var rango = delDia.find(function(o){ return diffDias(o.inicio,o.fin) > 0; });
      if(rango){
        cls += ' cr-range';
        if(mismoDia(fecha, soloDia(rango.inicio)) || dia===1) cls += ' cr-range-start';
        if(mismoDia(fecha, soloDia(rango.fin)) || dia===diasMes) cls += ' cr-range-end';
      }
      var tab = mismoDia(fecha, foco) ? '0' : '-1';
      var dots = delDia.slice(0,3).map(function(o){
        return '<i style="background:'+o.color+'"></i>';
      }).join('');
      celdas += '<button class="'+cls+'" type="button" data-dia="'+dia+'" tabindex="'+tab+'" '+
        'aria-label="'+dia+' de '+MESES_L[verMes]+(delDia.length?', '+delDia.length+' evento(s)':'')+'">'+
        '<span class="cr-day-num">'+dia+'</span>'+
        (dots ? '<span class="cr-dots">'+dots+'</span>' : '')+
      '</button>';
    }

    var dowRow = DOW.map(function(d){ return '<span>'+d[0]+'</span>'; }).join('');
    return '<div class="cr-cal">'+
      '<div class="cr-cal-head">'+
        '<button class="cr-nav" type="button" data-nav="-1" aria-label="Mes anterior">‹</button>'+
        '<div class="cr-month-lbl">'+MESES_L[verMes]+' '+verAnio+'</div>'+
        '<button class="cr-nav" type="button" data-nav="1" aria-label="Mes siguiente">›</button>'+
      '</div>'+
      '<div class="cr-dow">'+dowRow+'</div>'+
      '<div class="cr-days" role="grid">'+celdas+'</div>'+
    '</div>';
  }

  function textoCuando(o){
    // rango en curso
    if(soloDia(o.inicio) <= hoyD && hoyD <= soloDia(o.fin) && diffDias(o.inicio,o.fin)>0) return {t:'en curso', soon:true};
    var d = diffDias(hoyD, o.inicio);
    if(d===0) return {t:'hoy', soon:true};
    if(d===1) return {t:'mañana', soon:true};
    return {t:'en '+d+' días', soon:d<=3};
  }

  function renderLista(){
    var lista, titulo, hayFiltroDia = !!seleccion;
    var pool = ocurrencias([hoyD.getFullYear(), hoyD.getFullYear()+1]).filter(pasaFiltro);

    if(seleccion){
      titulo = DOW[seleccion.getDay()]+' '+seleccion.getDate()+' '+MESES[seleccion.getMonth()];
      lista = pool.filter(function(o){ return soloDia(o.inicio)<=seleccion && seleccion<=soloDia(o.fin); });
    } else {
      titulo = 'Próximas fechas';
      var limite = addDias(hoyD, 30);
      lista = pool.filter(function(o){ return soloDia(o.fin)>=hoyD && soloDia(o.inicio)<=limite; });
    }
    lista.sort(function(a,b){ return a.inicio - b.inicio; });

    var items;
    if(!lista.length){
      items = '<div class="cr-empty-msg">'+(seleccion ? 'Sin eventos este día.' : 'Sin fechas en los próximos 30 días.')+'</div>';
    } else {
      items = '<ul class="cr-list">'+lista.map(function(o){
        var w = textoCuando(o);
        return '<li class="cr-item'+(o.impacto==='alto'?' cr-alto':'')+'">'+
          '<span class="cr-bar" style="background:'+o.color+'"></span>'+
          '<div class="cr-item-main">'+
            '<div class="cr-item-title">'+esc(o.titulo)+'</div>'+
            '<div class="cr-item-meta">'+
              '<span class="cr-chip" style="background:'+o.color+'">'+TIPO_LBL[o.tipo]+'</span>'+
              '<span class="cr-when'+(w.soon?' cr-soon':'')+'">'+w.t+'</span>'+
            '</div>'+
          '</div>'+
        '</li>';
      }).join('')+'</ul>';
    }

    return '<div class="cr-list-wrap">'+
      '<div class="cr-list-head">'+
        '<div class="cr-list-title">'+titulo+'</div>'+
        '<button class="cr-clear'+(hayFiltroDia?' cr-show':'')+'" type="button" data-clear>Ver próximas</button>'+
      '</div>'+
      items+
    '</div>';
  }

  function renderFooter(){
    var btns = TIPOS.map(function(t){
      var color = t==='feriado' ? '#D32F2F' : (t==='comercial' ? '#F59E0B' : '#9CA3AF');
      return '<button class="cr-filtro" type="button" data-filtro="'+t+'" aria-pressed="'+(filtros[t]?'true':'false')+'">'+
        '<span class="cr-sw" style="background:'+color+'"></span>'+TIPO_LBL[t]+
      '</button>';
    }).join('');
    return '<div class="cr-foot"><span class="cr-foot-lbl">Filtrar</span>'+btns+'</div>';
  }

  // ---- cableado de eventos del popover (re-cableado en cada render) ----
  function cablearPop(){
    elPop.querySelectorAll('[data-nav]').forEach(function(b){
      b.addEventListener('click', function(){ navegarMes(+b.dataset.nav); });
    });
    elPop.querySelectorAll('.cr-day:not(.cr-empty)').forEach(function(b){
      b.addEventListener('click', function(){ elegirDia(+b.dataset.dia); });
    });
    var clr = elPop.querySelector('[data-clear]');
    if(clr) clr.addEventListener('click', function(){ seleccion=null; render(); });
    elPop.querySelectorAll('[data-filtro]').forEach(function(b){
      b.addEventListener('click', function(){
        var t=b.dataset.filtro; filtros[t]=!filtros[t]; guardarFiltros(); render();
      });
    });
    var grid = elPop.querySelector('.cr-days');
    if(grid) grid.addEventListener('keydown', navTeclado);
  }

  function navegarMes(delta){
    verMes += delta;
    if(verMes<0){ verMes=11; verAnio--; }
    else if(verMes>11){ verMes=0; verAnio++; }
    // llevar el foco a un dia valido del nuevo mes
    var diasMes = new Date(verAnio, verMes+1, 0).getDate();
    foco = new Date(verAnio, verMes, Math.min(foco.getDate(), diasMes));
    render();
    var f = elPop.querySelector('.cr-day[tabindex="0"]'); if(f) f.focus();
  }

  function elegirDia(dia){
    var f = new Date(verAnio, verMes, dia);
    seleccion = (seleccion && mismoDia(seleccion,f)) ? null : f; // toggle
    foco = f;
    render();
  }

  function navTeclado(e){
    var delta = 0;
    if(e.key==='ArrowLeft') delta=-1;
    else if(e.key==='ArrowRight') delta=1;
    else if(e.key==='ArrowUp') delta=-7;
    else if(e.key==='ArrowDown') delta=7;
    else if(e.key==='Enter' || e.key===' '){ e.preventDefault(); elegirDia(foco.getDate()); enfocarDiaFoco(); return; }
    else return;
    e.preventDefault();
    var nueva = addDias(foco, delta);
    foco = nueva;
    if(nueva.getMonth()!==verMes || nueva.getFullYear()!==verAnio){
      verMes = nueva.getMonth(); verAnio = nueva.getFullYear();
    }
    render();
    enfocarDiaFoco();
  }
  function enfocarDiaFoco(){
    var f = elPop.querySelector('.cr-day[tabindex="0"]'); if(f) f.focus();
  }

  // ================= ABRIR / CERRAR =================
  function posicionar(){
    var r = elTrigger.getBoundingClientRect();
    var w = Math.min(520, window.innerWidth - 24);
    var esMobile = window.innerWidth <= 767;
    if(esMobile){
      elPop.style.left = ''; elPop.style.right = '';
      elPop.style.top = (r.bottom + 8) + 'px';
      return;
    }
    var left = Math.min(r.left, window.innerWidth - w - 12);
    left = Math.max(12, left);
    elPop.style.left = left + 'px';
    elPop.style.right = 'auto';
    elPop.style.top = (r.bottom + 8) + 'px';
  }

  function abrir(){
    abierto = true;
    // resetear vista a hoy al abrir
    hoyD = hoy(); verAnio = hoyD.getFullYear(); verMes = hoyD.getMonth();
    foco = new Date(hoyD); seleccion = null;
    render();
    posicionar();
    requestAnimationFrame(function(){ elPop.classList.add('cr-open'); });
    elTrigger.setAttribute('aria-expanded','true');
    document.addEventListener('click', afueraClick, true);
    document.addEventListener('keydown', escClose);
    window.addEventListener('resize', posicionar);
    window.addEventListener('scroll', posicionar, true);
  }
  function cerrar(){
    abierto = false;
    elPop.classList.remove('cr-open');
    elTrigger.setAttribute('aria-expanded','false');
    document.removeEventListener('click', afueraClick, true);
    document.removeEventListener('keydown', escClose);
    window.removeEventListener('resize', posicionar);
    window.removeEventListener('scroll', posicionar, true);
    render(); // refresca el dot con los filtros actuales
  }
  function toggle(){ abierto ? cerrar() : abrir(); }
  function afueraClick(e){ if(!elPop.contains(e.target) && !elTrigger.contains(e.target)) cerrar(); }
  function escClose(e){ if(e.key==='Escape'){ cerrar(); elTrigger.focus(); } }

  // ---- util ----
  function esc(s){ return (s==null?'':String(s)).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  // ================= MONTAJE =================
  function montar(){
    var host = document.querySelector(MOUNT_SEL);
    if(!host){ return; } // si el shell no tiene ese contenedor, no hacemos nada
    construir();
    host.insertBefore(elTrigger, host.firstChild); // a la izquierda del avatar/usuario
    fetch(DATA_URL)
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){ RAW = (j && j.eventos) ? j.eventos : []; render(); })
      .catch(function(){ RAW = []; render(); });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
