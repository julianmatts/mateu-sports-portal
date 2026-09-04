/* ============================================================
   resumen-widget.js — la Academia de Ventas dentro de otros módulos
   ------------------------------------------------------------
   Lee el resumen precomputado que publica la Academia cada vez que
   entra alguien del staff (recepciones-mateu/capacitaciones/resumen:
   por sucursal y por persona) y lo muestra en:
     · Indicadores (Panel General / Mi Sucursal): sección «Academia de
       Ventas» con el % de avance por sucursal (gerencia) o el de la
       propia sucursal.
     · Evaluaciones de Supervisor: tarjeta con el avance de la sucursal
       que se está evaluando, debajo del formulario.
     · RRHH: chip «🎓 N cursos · %» en cada legajo (match por nombre).
   Se incluye con una línea en el <head> del módulo:
     <script src="../capacitaciones/resumen-widget.js" defer></script>
   Vanilla JS, sin dependencias. Clases con prefijo acw-. Si el
   resumen no existe todavía, no pinta nada.
   ============================================================ */
(function(){
  'use strict';
  var RESUMEN_URL = 'https://recepciones-mateu-default-rtdb.firebaseio.com/capacitaciones/resumen.json';
  var SUC_LABEL = {
    'calle-12':'MS Calle 12','city-bell':'MS City Bell','calle-47':'MS Calle 47','calle-49':'MS Calle 49','los-hornos':'MS Los Hornos',
    'plaza':'MS Plaza Italia','berisso':'MS Berisso','ensenada':'MS Ensenada','kids':'Mateu Kids','aurelius-12':'Aurelius Calle 12',
    'aurelius-5':'Aurelius Calle 5','aurelius-cb':'Aurelius City Bell','adidas-12':'Adidas Calle 12','adidas':'Adidas Av. 7','originals':'Adidas Originals'
  };

  var S = null;
  try{ S = JSON.parse(localStorage.getItem('mateu_portal_session')||'null'); }catch(e){ S = window.__sess||null; }
  if(!S || !S.rol) return;
  var ES_STAFF = S.rol==='admin' || S.rol==='supervisor' || S.rol==='capacitador';
  var MI_SLUG = S.sucursal || S.outlet_id || null;
  var m = location.pathname.match(/\/([^\/]+)\/(?:index\.html)?$/);
  var HOST = m ? m[1] : '';

  function esc(s){ return (s===null||s===undefined)?'':String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function idFromNombre(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
  function tiempoRel(ts){ var d=Date.now()-ts; if(d<3600000) return 'hace '+Math.max(1,Math.floor(d/60000))+' min'; if(d<86400000) return 'hace '+Math.floor(d/3600000)+' h'; return 'hace '+Math.floor(d/86400000)+' días'; }
  function barra(p, color){ return '<span style="display:inline-block;width:90px;height:6px;border-radius:3px;background:#e9eaee;vertical-align:middle;overflow:hidden"><span style="display:block;width:'+p+'%;height:100%;background:'+(color||'#CC0000')+'"></span></span>'; }
  var LINK = '<a href="../capacitaciones/" style="color:#CC0000;font-weight:700;text-decoration:none;font-size:13px">Abrir la Academia →</a>';

  var R = null;
  function cargar(cb){
    fetch(RESUMEN_URL).then(function(r){ return r.ok?r.json():null; }).then(function(j){ R=j; if(j) cb(); }).catch(function(){});
  }

  /* ---------- Indicadores ---------- */
  function montarIndicadores(){
    if(document.getElementById('secAcademia')) return;
    var anchor = document.getElementById('secPlantilla') || document.getElementById('secBarrida');
    if(!anchor) return;
    var html = '';
    if(ES_STAFF){
      var filas = Object.keys(R.porSlug||{}).map(function(s){ return Object.assign({slug:s}, R.porSlug[s]); })
        .filter(function(f){ return f.conCursos>0; }).sort(function(a,b){ return b.pct-a.pct; });
      html = filas.length
        ? '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr>'+
          '<th style="text-align:left;padding:6px 8px;font-size:12px;text-transform:uppercase;letter-spacing:.8px;color:#6b7280;border-bottom:2px solid #e2e4e8">Sucursal</th>'+
          '<th style="text-align:left;padding:6px 8px;font-size:12px;text-transform:uppercase;letter-spacing:.8px;color:#6b7280;border-bottom:2px solid #e2e4e8">Avance</th>'+
          '<th style="text-align:right;padding:6px 8px;font-size:12px;text-transform:uppercase;letter-spacing:.8px;color:#6b7280;border-bottom:2px solid #e2e4e8">Personas</th>'+
          '<th style="text-align:right;padding:6px 8px;font-size:12px;text-transform:uppercase;letter-spacing:.8px;color:#6b7280;border-bottom:2px solid #e2e4e8">Cursos aprobados</th>'+
          '<th style="text-align:right;padding:6px 8px;font-size:12px;text-transform:uppercase;letter-spacing:.8px;color:#6b7280;border-bottom:2px solid #e2e4e8">Sin actividad</th></tr></thead><tbody>'+
          filas.map(function(f,i){ return '<tr><td style="padding:7px 8px;border-bottom:1px solid #eef0f3;font-weight:700">'+(i===0&&f.pct>0?'🏆 ':'')+esc(SUC_LABEL[f.slug]||f.slug)+'</td>'+
            '<td style="padding:7px 8px;border-bottom:1px solid #eef0f3">'+barra(f.pct, f.pct>=100?'#178a50':'#CC0000')+' <b>'+f.pct+'%</b></td>'+
            '<td style="padding:7px 8px;border-bottom:1px solid #eef0f3;text-align:right">'+f.conCursos+'</td>'+
            '<td style="padding:7px 8px;border-bottom:1px solid #eef0f3;text-align:right">'+f.aprobados+'</td>'+
            '<td style="padding:7px 8px;border-bottom:1px solid #eef0f3;text-align:right;color:'+(f.sinActividad?'#CC0000':'#6b7280')+'">'+f.sinActividad+'</td></tr>'; }).join('')+
          '</tbody></table></div>'
        : '<div style="color:#6b7280">Todavía no hay programas asignados en la Academia.</div>';
    } else {
      var r = (R.porSlug||{})[MI_SLUG];
      if(!r || !r.conCursos){ html = '<div style="color:#6b7280">Tu sucursal todavía no tiene cursos asignados.</div>'; }
      else html = '<div style="display:flex;gap:26px;flex-wrap:wrap;align-items:center">'+
        '<div><div style="font-size:30px;font-weight:800;line-height:1">'+r.pct+'%</div><div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.8px">avance del equipo</div></div>'+
        '<div><div style="font-size:30px;font-weight:800;line-height:1">'+r.aprobados+'</div><div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.8px">cursos aprobados</div></div>'+
        '<div><div style="font-size:30px;font-weight:800;line-height:1;color:'+(r.sinActividad?'#CC0000':'#178a50')+'">'+r.sinActividad+'</div><div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.8px">sin empezar</div></div></div>';
    }
    var sec = document.createElement('section');
    sec.className = anchor.className || 'sec'; sec.id = 'secAcademia';
    sec.innerHTML = '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px">'+
      '<h2 style="margin:0;font-family:\'Bebas Neue\',\'Barlow Condensed\',sans-serif;font-size:22px;letter-spacing:.6px;color:#0B1527">🎓 Academia de Ventas</h2>'+LINK+'</div>'+
      '<div style="background:#fff;border:1px solid #e2e4e8;border-radius:8px;padding:14px 16px">'+html+
      (R.ts?'<div style="font-size:11.5px;color:#9aa0a8;margin-top:8px">Actualizado '+tiempoRel(R.ts)+' (se refresca cada vez que entra el capacitador o gerencia a la Academia).</div>':'')+'</div>';
    anchor.parentNode.insertBefore(sec, anchor.nextSibling);
  }

  /* ---------- Evaluaciones ---------- */
  function montarEvaluaciones(){
    var sel = document.getElementById('fSuc'); if(!sel) return;
    var card = document.getElementById('acwEval');
    if(!card){
      card = document.createElement('div'); card.id='acwEval';
      card.style.cssText = 'margin:10px 0 14px;background:#fff;border:1px solid #e2e4e8;border-left:4px solid #CC0000;border-radius:8px;padding:12px 16px;font-size:14px';
      var head = sel.closest('.card') || sel.parentNode;
      head.parentNode.insertBefore(card, head.nextSibling);
      sel.addEventListener('change', pintar);
    }
    pintar();
    function pintar(){
      var slug = sel.value; var r=(R.porSlug||{})[slug]; var pers=(R.personas||{})[slug]||{};
      var top = Object.keys(pers).map(function(k){ return pers[k]; }).filter(function(p){ return p.asig>0; }).sort(function(a,b){ return b.pct-a.pct; });
      var sinAct = top.filter(function(p){ return !p.ult; });
      card.innerHTML = '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><b style="font-size:15px">🎓 Academia de Ventas · '+esc(SUC_LABEL[slug]||slug)+'</b>'+
        (r&&r.conCursos ? '<span>'+barra(r.pct, r.pct>=100?'#178a50':'#CC0000')+' <b>'+r.pct+'%</b> de avance · '+r.aprobados+' cursos aprobados · <span style="color:'+(r.sinActividad?'#CC0000':'#178a50')+'">'+r.sinActividad+' sin empezar</span></span>' : '<span style="color:#6b7280">sin cursos asignados todavía</span>')+
        '<span style="margin-left:auto">'+LINK+'</span></div>'+
        (sinAct.length?'<div style="margin-top:6px;color:#6b7280;font-size:13px">Sin empezar: '+sinAct.slice(0,8).map(function(p){ return esc(p.nombre); }).join(', ')+(sinAct.length>8?' y '+(sinAct.length-8)+' más':'')+'</div>':'');
    }
  }

  /* ---------- RRHH ---------- */
  function montarRRHH(){
    if(typeof LEGAJOS==='undefined') return;
    var filas = document.querySelectorAll('tr[data-leg]');
    filas.forEach(function(tr){
      if(tr.querySelector('.acw-chip')) return;
      var l = LEGAJOS[tr.getAttribute('data-leg')]; if(!l) return;
      var legId = tr.getAttribute('data-leg');
      var pers = (R.personas||{})[l.sucursal]||{}; var p = pers[legId] || pers[idFromNombre(l.nombre)];   // id del padrón (legajoId); los resúmenes viejos van por nombre
      var sub = tr.querySelector('.sub'); if(!sub) return;
      var chip = document.createElement('span'); chip.className='acw-chip';
      if(p && p.asig){
        chip.style.cssText='display:inline-block;margin-left:8px;font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px;background:'+(p.pct>=100?'#e6f4ea':'#fdecea')+';color:'+(p.pct>=100?'#178a50':'#CC0000');
        chip.textContent='🎓 '+(p.aprobados||[]).length+'/'+p.asig+' cursos · '+p.pct+'%';
        chip.title='Academia de Ventas: '+((p.aprobados||[]).length?'aprobó '+(p.aprobados||[]).join(', '):'sin cursos aprobados')+(p.ult?' · última actividad '+tiempoRel(p.ult):' · sin actividad');
      } else { chip.style.cssText='display:inline-block;margin-left:8px;font-size:11px;color:#9aa0a8'; chip.textContent='🎓 —'; chip.title='Sin cursos asignados en la Academia'; }
      sub.appendChild(chip);
    });
  }

  function iniciar(){
    if(HOST==='indicadores'){ montarIndicadores(); var t=0; var ob=new MutationObserver(function(){ clearTimeout(t); t=setTimeout(montarIndicadores,200); }); ob.observe(document.body,{childList:true,subtree:true}); }
    else if(HOST==='evaluaciones' || HOST==='rrhh'){
      var fn = HOST==='evaluaciones'?montarEvaluaciones:montarRRHH; fn();
      var t2=0; var ob2=new MutationObserver(function(){ clearTimeout(t2); t2=setTimeout(fn,150); }); ob2.observe(document.body,{childList:true,subtree:true});
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ cargar(iniciar); });
  else cargar(iniciar);
})();
