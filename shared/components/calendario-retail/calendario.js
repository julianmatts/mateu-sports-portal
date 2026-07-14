/* ============================================================
   Calendario Retail — componente del SHELL del portal Mateu.
   Vanilla JS, cero dependencias. Se auto-monta en el header.

   Config opcional (definir ANTES de cargar este script):
     window.CALENDARIO_RETAIL_CONFIG = {
       mount: '.top-right',   // selector del contenedor del header
       dataUrl: '...'         // override de la ruta del JSON
     }

   Dos vistas (switch en la barra superior, se recuerda en localStorage):
     - TRADICIONAL: calendario gregoriano normal.
     - RETAIL: calendario 4-5-4 (NRF). Semanas domingo->sabado, el anio
       arranca la semana del 1 de febrero; muestra el n° de semana retail
       en el margen y el trimestre/periodo del mes.

   Boton "Ampliar": abre un modal grande con el mes entero y los titulos
   de los eventos dentro de cada dia.

   Motor de fechas — tres formas de evento en el JSON:
     1. fija:   { "fecha": "2026-05-01" }
     2. rango:  { "fecha_inicio": "...", "fecha_fin": "..." }
     3. movil:  { "regla": { "mes":10, "semana":3, "dia":0 } }
                = 3er domingo de octubre (dia 0=domingo..6=sabado).
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
  var LS_MODO = 'cr_modo';

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

  // n-esimo dia de la semana del mes (regla movil). Devuelve null si no existe.
  function nEsimoDiaSemana(anio, mes/*1-12*/, semana/*1-5*/, dia/*0-6*/){
    var primero = new Date(anio, mes-1, 1);
    var offset = (dia - primero.getDay() + 7) % 7;
    var numDia = 1 + offset + (semana-1)*7;
    var diasMes = new Date(anio, mes, 0).getDate();
    if(numDia > diasMes) return null;
    return new Date(anio, mes-1, numDia);
  }

  // ---- calendario retail 4-5-4 (NRF) ----
  // El anio retail arranca la semana (domingo) que contiene al 1 de feb.
  var PATRON_454 = [4,5,4, 4,5,4, 4,5,4, 4,5,4];
  var PERIODO_MES = ['Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic','Ene'];
  function inicioRetail(y){
    var feb1 = new Date(y,1,1);
    return addDias(feb1, -feb1.getDay()); // domingo en/antes del 1 feb
  }
  function infoRetail(fecha){
    var d = soloDia(fecha);
    var y = d.getFullYear();
    var ini = inicioRetail(y);
    if(d < ini){ y -= 1; ini = inicioRetail(y); }
    else { var sig = inicioRetail(y+1); if(d >= sig){ y += 1; ini = sig; } }
    var semana = Math.floor(diffDias(ini, d)/7) + 1;
    var cum=0, periodo=12;
    for(var i=0;i<12;i++){ cum += PATRON_454[i]; if(semana<=cum){ periodo=i+1; break; } }
    var trimestre = Math.ceil(periodo/3);
    return { ry:y, semana:semana, periodo:periodo, trimestre:trimestre, mes:PERIODO_MES[periodo-1] };
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

  // Todas las ocurrencias para una lista de anios.
  function ocurrencias(anios){
    var out = [];
    anios.forEach(function(anio){
      RAW.forEach(function(ev){
        var o = expandir(ev, anio);
        if(!o) return;
        if(!ev.regla && o.inicio.getFullYear() !== anio) return; // fijos/rangos: una sola vez
        out.push(o);
      });
    });
    return out;
  }

  // ---- estado ----
  var RAW = [];
  var abierto = false;
  var expandido = false;
  var hoyD = hoy();
  var verAnio = hoyD.getFullYear();
  var verMes = hoyD.getMonth();  // 0-11
  var seleccion = null;          // Date | null (filtro por dia)
  var foco = new Date(hoyD);
  var filtros = leerFiltros();
  var modo = leerModo();         // 'tradicional' | 'retail'

  function leerFiltros(){
    try{
      var s = JSON.parse(localStorage.getItem(LS_FILTROS));
      if(s) return { feriado:s.feriado!==false, comercial:s.comercial!==false, interno:s.interno!==false };
    }catch(e){}
    return { feriado:true, comercial:true, interno:true };
  }
  function guardarFiltros(){ try{ localStorage.setItem(LS_FILTROS, JSON.stringify(filtros)); }catch(e){} }
  function leerModo(){ try{ return localStorage.getItem(LS_MODO)==='retail' ? 'retail' : 'tradicional'; }catch(e){ return 'tradicional'; } }
  function guardarModo(){ try{ localStorage.setItem(LS_MODO, modo); }catch(e){} }
  function pasaFiltro(o){ return filtros[o.tipo]; }
  var esRetail = function(){ return modo==='retail'; };

  // ---- refs de DOM ----
  var elTrigger, elPop, elDot, elModal, elPanel;

  function fmtHoyCorto(){ return DOW[hoyD.getDay()]+' '+hoyD.getDate()+' '+MESES[hoyD.getMonth()]; }

  function hayProximo(){
    var win = ocurrencias([hoyD.getFullYear(), hoyD.getFullYear()+1]);
    return win.some(function(o){
      if(!pasaFiltro(o)) return false;
      var d = diffDias(hoyD, o.inicio);
      var enCurso = soloDia(o.inicio) <= hoyD && hoyD <= soloDia(o.fin);
      return enCurso || (d >= 0 && d <= 3);
    });
  }

  // ================= CONSTRUCCION =================
  function construir(){
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

    elPop = document.createElement('div');
    elPop.className = 'cr cr-pop';
    elPop.setAttribute('role','dialog');
    elPop.setAttribute('aria-modal','false');
    elPop.setAttribute('aria-label','Calendario retail');
    document.body.appendChild(elPop);

    elModal = document.createElement('div');
    elModal.className = 'cr cr-modal';
    elModal.innerHTML = '<div class="cr-panel" role="dialog" aria-modal="true" aria-label="Calendario ampliado"></div>';
    elPanel = elModal.querySelector('.cr-panel');
    document.body.appendChild(elModal);
    elModal.addEventListener('click', function(e){ if(e.target===elModal) cerrarModal(); });

    elTrigger.addEventListener('click', function(e){ e.stopPropagation(); toggle(); });
  }

  // ================= RENDER =================
  function render(){
    if(elDot) elDot.hidden = !hayProximo();
    if(abierto){ elPop.innerHTML = '<div class="cr-body">'+cuerpoHTML(false)+'</div>'; cablear(elPop, false); }
    if(expandido){ elPanel.innerHTML = '<div class="cr-body cr-big">'+cuerpoHTML(true)+'</div>'; cablear(elPanel, true); }
  }

  function cuerpoHTML(big){
    return renderTopbar(big) + renderMes(big) + renderLista(big) + renderFooter(big);
  }

  function renderTopbar(big){
    var retail = esRetail();
    var toggle =
      '<button class="cr-toggle" type="button" data-toggle role="switch" aria-checked="'+(retail?'true':'false')+'" aria-label="Cambiar entre calendario tradicional y retail">'+
        '<span class="cr-tg-lbl'+(!retail?' cr-on':'')+'">Tradicional</span>'+
        '<span class="cr-tg-track"><span class="cr-tg-thumb"></span></span>'+
        '<span class="cr-tg-lbl'+(retail?' cr-on':'')+'">Retail</span>'+
      '</button>';
    var expandBtn = big
      ? '<button class="cr-expand" type="button" data-expand aria-label="Reducir">⤡ <span>Reducir</span></button>'
      : '<button class="cr-expand" type="button" data-expand aria-label="Ampliar">⤢ <span>Ampliar</span></button>';
    return '<div class="cr-topbar">'+toggle+expandBtn+'</div>';
  }

  function renderMes(big){
    var retail = esRetail();
    var primero = new Date(verAnio, verMes, 1);
    var arranque = primero.getDay();
    var diasMes = new Date(verAnio, verMes+1, 0).getDate();
    var ocs = ocurrencias([verAnio]).filter(pasaFiltro);

    // arma la matriz de dias (con vacios de relleno)
    var celdas = [];
    for(var i=0;i<arranque;i++) celdas.push(null);
    for(var d=1; d<=diasMes; d++) celdas.push(d);
    while(celdas.length % 7 !== 0) celdas.push(null);

    var domInicio = addDias(primero, -arranque); // domingo de la primera fila
    var filasHTML = '';
    for(var f=0; f*7 < celdas.length; f++){
      var filaHTML = '';
      if(retail){
        var domFila = addDias(domInicio, f*7);
        filaHTML += '<span class="cr-wk" aria-hidden="true">S'+infoRetail(domFila).semana+'</span>';
      }
      for(var c=0;c<7;c++){
        var dia = celdas[f*7+c];
        if(dia==null){ filaHTML += '<div class="cr-day cr-empty"></div>'; continue; }
        filaHTML += celdaDia(dia, ocs, big);
      }
      filasHTML += filaHTML;
    }

    var dowRow = (retail?'<span class="cr-wk-h" aria-hidden="true"></span>':'') +
      DOW.map(function(x){ return '<span>'+(big?x:x[0])+'</span>'; }).join('');

    var subBadge = '';
    if(retail){
      var r1 = infoRetail(new Date(verAnio,verMes,1));
      var r2 = infoRetail(new Date(verAnio,verMes,diasMes));
      var rMid = infoRetail(new Date(verAnio,verMes,15)); // periodo representativo del mes
      subBadge = '<div class="cr-retail-badge">Retail T'+rMid.trimestre+' · P'+rMid.periodo+' '+rMid.mes+' · Sem '+r1.semana+'–'+r2.semana+'</div>';
    }

    return '<div class="cr-cal">'+
      '<div class="cr-cal-head">'+
        '<button class="cr-nav" type="button" data-nav="-1" aria-label="Mes anterior">‹</button>'+
        '<div class="cr-cal-title"><div class="cr-month-lbl">'+MESES_L[verMes]+' '+verAnio+'</div>'+subBadge+'</div>'+
        '<button class="cr-nav" type="button" data-nav="1" aria-label="Mes siguiente">›</button>'+
      '</div>'+
      '<div class="cr-dow'+(retail?' cr-retail':'')+'">'+dowRow+'</div>'+
      '<div class="cr-days'+(retail?' cr-retail':'')+(big?' cr-days-big':'')+'" role="grid">'+filasHTML+'</div>'+
    '</div>';
  }

  function celdaDia(dia, ocs, big){
    var fecha = new Date(verAnio, verMes, dia);
    var delDia = ocs.filter(function(o){ return soloDia(o.inicio)<=fecha && fecha<=soloDia(o.fin); });
    var cls = 'cr-day';
    if(mismoDia(fecha, hoyD)) cls += ' cr-today';
    if(seleccion && mismoDia(fecha, seleccion)) cls += ' cr-selected';
    var rango = delDia.find(function(o){ return diffDias(o.inicio,o.fin) > 0; });
    if(rango){
      cls += ' cr-range';
      if(mismoDia(fecha, soloDia(rango.inicio)) || dia===1) cls += ' cr-range-start';
      if(mismoDia(fecha, soloDia(rango.fin)) || dia===new Date(verAnio,verMes+1,0).getDate()) cls += ' cr-range-end';
    }
    var tab = mismoDia(fecha, foco) ? '0' : '-1';
    var extra;
    if(big){
      extra = delDia.slice(0,3).map(function(o){
        return '<span class="cr-ev-pill" style="background:'+o.color+'">'+esc(o.titulo)+'</span>';
      }).join('');
      extra = extra ? '<span class="cr-ev-pills">'+extra+'</span>' : '';
    } else {
      var dots = delDia.slice(0,3).map(function(o){ return '<i style="background:'+o.color+'"></i>'; }).join('');
      extra = dots ? '<span class="cr-dots">'+dots+'</span>' : '';
    }
    return '<button class="'+cls+'" type="button" data-dia="'+dia+'" tabindex="'+tab+'" '+
      'aria-label="'+dia+' de '+MESES_L[verMes]+(delDia.length?', '+delDia.length+' evento(s)':'')+'">'+
      '<span class="cr-day-num">'+dia+'</span>'+extra+
    '</button>';
  }

  function textoCuando(o){
    if(soloDia(o.inicio) <= hoyD && hoyD <= soloDia(o.fin) && diffDias(o.inicio,o.fin)>0) return {t:'en curso', soon:true};
    var d = diffDias(hoyD, o.inicio);
    if(d===0) return {t:'hoy', soon:true};
    if(d===1) return {t:'mañana', soon:true};
    if(d<0) return {t:'pasó', soon:false};
    return {t:'en '+d+' días', soon:d<=3};
  }

  function renderLista(big){
    var lista, titulo, hayFiltroDia = !!seleccion;
    var pool = ocurrencias([hoyD.getFullYear(), hoyD.getFullYear()+1]).filter(pasaFiltro);

    if(seleccion){
      titulo = DOW[seleccion.getDay()]+' '+seleccion.getDate()+' '+MESES[seleccion.getMonth()];
      lista = pool.filter(function(o){ return soloDia(o.inicio)<=seleccion && seleccion<=soloDia(o.fin); });
    } else {
      titulo = 'Próximas fechas';
      var limite = addDias(hoyD, big ? 90 : 30); // ampliado: horizonte mas largo
      lista = pool.filter(function(o){ return soloDia(o.fin)>=hoyD && soloDia(o.inicio)<=limite; });
    }
    lista.sort(function(a,b){ return a.inicio - b.inicio; });

    var items;
    if(!lista.length){
      items = '<div class="cr-empty-msg">'+(seleccion ? 'Sin eventos este día.' : 'Sin fechas próximas.')+'</div>';
    } else {
      items = '<ul class="cr-list">'+lista.map(function(o){
        var w = textoCuando(o);
        var ret = esRetail() ? ' · Sem '+infoRetail(o.inicio).semana : '';
        return '<li class="cr-item'+(o.impacto==='alto'?' cr-alto':'')+'">'+
          '<span class="cr-bar" style="background:'+o.color+'"></span>'+
          '<div class="cr-item-main">'+
            '<div class="cr-item-title">'+esc(o.titulo)+'</div>'+
            '<div class="cr-item-meta">'+
              '<span class="cr-chip" style="background:'+o.color+'">'+TIPO_LBL[o.tipo]+'</span>'+
              '<span class="cr-when'+(w.soon?' cr-soon':'')+'">'+w.t+ret+'</span>'+
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

  function renderFooter(big){
    var btns = TIPOS.map(function(t){
      var color = t==='feriado' ? '#D32F2F' : (t==='comercial' ? '#F59E0B' : '#9CA3AF');
      return '<button class="cr-filtro" type="button" data-filtro="'+t+'" aria-pressed="'+(filtros[t]?'true':'false')+'">'+
        '<span class="cr-sw" style="background:'+color+'"></span>'+TIPO_LBL[t]+
      '</button>';
    }).join('');
    var nota = esRetail()
      ? '<div class="cr-retail-note">Calendario retail 4-5-4 (NRF): semanas dom–sáb; el año arranca la semana del 1 feb.</div>'
      : '';
    return '<div class="cr-foot"><span class="cr-foot-lbl">Filtrar</span>'+btns+'</div>'+nota;
  }

  // ---- cableado (por contenedor) ----
  function cablear(cont, big){
    cont.querySelectorAll('[data-nav]').forEach(function(b){
      b.addEventListener('click', function(){ navegarMes(+b.dataset.nav); });
    });
    cont.querySelectorAll('.cr-day:not(.cr-empty)').forEach(function(b){
      b.addEventListener('click', function(){ elegirDia(+b.dataset.dia); });
    });
    var clr = cont.querySelector('[data-clear]');
    if(clr) clr.addEventListener('click', function(){ seleccion=null; render(); });
    cont.querySelectorAll('[data-filtro]').forEach(function(b){
      b.addEventListener('click', function(){ var t=b.dataset.filtro; filtros[t]=!filtros[t]; guardarFiltros(); render(); });
    });
    var tg = cont.querySelector('[data-toggle]');
    if(tg) tg.addEventListener('click', function(){ modo = esRetail()?'tradicional':'retail'; guardarModo(); render(); });
    var ex = cont.querySelector('[data-expand]');
    if(ex) ex.addEventListener('click', function(){ big ? cerrarModal() : abrirModal(); });
    var grid = cont.querySelector('.cr-days');
    if(grid) grid.addEventListener('keydown', navTeclado);
  }

  function navegarMes(delta){
    verMes += delta;
    if(verMes<0){ verMes=11; verAnio--; }
    else if(verMes>11){ verMes=0; verAnio++; }
    var diasMes = new Date(verAnio, verMes+1, 0).getDate();
    foco = new Date(verAnio, verMes, Math.min(foco.getDate(), diasMes));
    render(); enfocarDiaFoco();
  }
  function elegirDia(dia){
    var f = new Date(verAnio, verMes, dia);
    seleccion = (seleccion && mismoDia(seleccion,f)) ? null : f;
    foco = f; render();
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
    if(nueva.getMonth()!==verMes || nueva.getFullYear()!==verAnio){ verMes=nueva.getMonth(); verAnio=nueva.getFullYear(); }
    render(); enfocarDiaFoco();
  }
  function enfocarDiaFoco(){
    var cont = expandido ? elPanel : elPop;
    var f = cont.querySelector('.cr-day[tabindex="0"]'); if(f) f.focus();
  }

  // ================= ABRIR / CERRAR =================
  function posicionar(){
    var r = elTrigger.getBoundingClientRect();
    var w = Math.min(520, window.innerWidth - 24);
    if(window.innerWidth <= 767){
      elPop.style.left=''; elPop.style.right=''; elPop.style.top=(r.bottom+8)+'px'; return;
    }
    var left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
    elPop.style.left = left+'px'; elPop.style.right='auto'; elPop.style.top=(r.bottom+8)+'px';
  }

  function abrir(){
    abierto = true;
    hoyD = hoy(); verAnio = hoyD.getFullYear(); verMes = hoyD.getMonth();
    foco = new Date(hoyD); seleccion = null;
    render(); posicionar();
    void elPop.offsetWidth; // fuerza reflow para que la transicion arranque sin depender de rAF
    elPop.classList.add('cr-open');
    elTrigger.setAttribute('aria-expanded','true');
    document.addEventListener('click', afueraClick, true);
    document.addEventListener('keydown', escClose);
    window.addEventListener('resize', posicionar);
    window.addEventListener('scroll', posicionar, true);
  }
  function cerrar(){
    if(expandido) cerrarModal();
    abierto = false;
    elPop.classList.remove('cr-open');
    elTrigger.setAttribute('aria-expanded','false');
    document.removeEventListener('click', afueraClick, true);
    document.removeEventListener('keydown', escClose);
    window.removeEventListener('resize', posicionar);
    window.removeEventListener('scroll', posicionar, true);
    render();
  }
  function toggle(){ abierto ? cerrar() : abrir(); }
  function afueraClick(e){ if(expandido) return; if(!elPop.contains(e.target) && !elTrigger.contains(e.target)) cerrar(); }
  function escClose(e){
    if(e.key!=='Escape') return;
    if(expandido){ cerrarModal(); }
    else { cerrar(); elTrigger.focus(); }
  }

  function abrirModal(){
    expandido = true;
    render();
    void elModal.offsetWidth;
    elModal.classList.add('cr-open');
    enfocarDiaFoco();
  }
  function cerrarModal(){
    expandido = false;
    elModal.classList.remove('cr-open');
    elPanel.innerHTML = '';
  }

  // ---- util ----
  function esc(s){ return (s==null?'':String(s)).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  // ================= MONTAJE =================
  function montar(){
    var host = document.querySelector(MOUNT_SEL);
    if(!host){ return; }
    construir();
    host.insertBefore(elTrigger, host.firstChild);
    fetch(DATA_URL)
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){ RAW = (j && j.eventos) ? j.eventos : []; render(); })
      .catch(function(){ RAW = []; render(); });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
