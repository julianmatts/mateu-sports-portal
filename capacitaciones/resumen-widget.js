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
    fetch(RESUMEN_URL).then(function(r){ return r.ok?r.json():null; }).then(function(j){ R=j||{}; cb(); }).catch(function(){ R={}; cb(); });
  }

  /* ---------- Mi Sucursal: estado por persona EN VIVO ----------
     Para el encargado el resumen del staff (que se refresca solo cuando entra Iván o gerencia)
     no alcanza: acá se calcula al momento con cursos + programas + avances de la sucursal +
     los recomendados por el supervisor, sobre el padrón (shared/equipo.js). Copia mínima de
     programasDe/cursosDe/estadoCurso de la Academia: mantener en sintonía. */
  var CAP = 'https://recepciones-mateu-default-rtdb.firebaseio.com/capacitaciones';
  var ROLES = ['encargado','vendedor','cajera','deposito'];
  var ROL_LBL = { encargado:'Encargado/a', vendedor:'Vendedor/a', cajera:'Cajera', deposito:'Depósito' };
  var _vivo = null, _vivoTs = 0, _vivoCargando = false;
  function fj(p){ return fetch(CAP+'/'+p+'.json').then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; }); }
  function estadoCurso(a,c){
    a=a||{}; var nm=(c.modulos||[]).length; var modsOk=Object.keys(a.mods||{}).length;
    var hayQuiz=!!(c.quiz&&(c.quiz.preguntas||[]).length); var quizOk=!hayQuiz||!!(a.quiz&&a.quiz.ok);
    var total=nm+(hayQuiz?1:0); var hecho=Math.min(modsOk,nm)+((hayQuiz&&quizOk)?1:0);
    return { completo:!!a.fin||(total>0&&hecho>=total), empezado:modsOk>0||!!(a.quiz&&a.quiz.int) };
  }
  function calcularSucursal(slug, cb){
    if(_vivo && Date.now()-_vivoTs<60000){ cb(_vivo); return; }
    if(_vivoCargando) return; _vivoCargando=true;
    var padronP = window.Equipo ? Equipo.cargar(slug).then(function(x){ return Equipo.activos(x); }).catch(function(){ return []; }) : Promise.resolve([]);
    Promise.all([fj('cursos'),fj('programas'),fj('avances/'+slug),fj('asignaciones/'+slug),padronP]).then(function(res){
      var cursos=res[0]||{}, progs=res[1]||{}, avs=res[2]||{}, asig=res[3]||{};
      var padron=(res[4]||[]).filter(function(p){ return ROLES.indexOf(p.rol)>=0; });
      var personas=padron.map(function(p){ return {id:p.id,nombre:p.nombre,rol:p.rol}; });
      if(!personas.length){ var pers=(R&&R.personas||{})[slug]||{}; personas=Object.keys(pers).map(function(k){ return {id:k,nombre:pers[k].nombre,rol:pers[k].rol}; }); }
      function visible(p){ return (p.cursos||[]).some(function(cid){ return cursos[cid]&&cursos[cid].activo!==false; }); }
      function cursosDe(rol){
        var vistos={}, out=[];
        Object.keys(progs).forEach(function(pid){ var p=progs[pid]; if(!p||p.activo===false||!visible(p)) return;
          if(p.roles&&p.roles.length&&p.roles.indexOf(rol)<0) return; if(p.sucursales&&p.sucursales.length&&p.sucursales.indexOf(slug)<0) return;
          (p.cursos||[]).forEach(function(cid){ var c=cursos[cid]; if(!c||c.activo===false||vistos[cid]) return; vistos[cid]=1; out.push({c:c,prog:p.nombre}); }); });
        Object.keys(asig).forEach(function(cid){ var c=cursos[cid]; if(!c||c.activo===false||vistos[cid]) return; vistos[cid]=1; out.push({c:c,prog:'Recomendado por el supervisor',motivo:(asig[cid]||{}).motivo}); });
        return out;
      }
      var filas=personas.map(function(per){
        var lista=cursosDe(per.rol), avP=avs[per.id]||{}, done=0, emp=false, pend=[];
        lista.forEach(function(x){ var e=estadoCurso(avP[x.c.id],x.c); if(e.completo) done++; else pend.push(x.c.titulo); if(e.empezado||e.completo) emp=true; });
        return { per:per, asig:lista.length, done:done, pend:pend, empezado:emp, pct:lista.length?Math.round(100*done/lista.length):0 };
      }).sort(function(a,b){ return b.pct-a.pct || a.per.nombre.localeCompare(b.per.nombre); });
      var recomendados=Object.keys(asig).filter(function(cid){ return cursos[cid]&&cursos[cid].activo!==false; }).map(function(cid){ return {titulo:cursos[cid].titulo, motivo:(asig[cid]||{}).motivo||''}; });
      _vivo={filas:filas, recomendados:recomendados, sinPadron:!padron.length}; _vivoTs=Date.now(); _vivoCargando=false;
      cb(_vivo);
    }).catch(function(){ _vivoCargando=false; });
  }
  function textoRecordatorio(slug, v){
    var sin=v.filas.filter(function(f){ return f.asig>0 && !f.empezado; });
    var enCurso=v.filas.filter(function(f){ return f.asig>0 && f.empezado && f.pct<100; });
    var lineas=['🎓 *Academia de Ventas · '+(SUC_LABEL[slug]||slug)+'*'];
    if(sin.length){ lineas.push('', 'Todavía no empezaron:'); sin.forEach(function(f){ lineas.push('• '+f.per.nombre+': '+f.pend.slice(0,3).join(', ')+(f.pend.length>3?' y '+(f.pend.length-3)+' más':'')); }); }
    if(enCurso.length){ lineas.push('', 'Les falta terminar:'); enCurso.forEach(function(f){ lineas.push('• '+f.per.nombre+' ('+f.pct+'%): '+f.pend.slice(0,3).join(', ')+(f.pend.length>3?' y '+(f.pend.length-3)+' más':'')); }); }
    if(!sin.length && !enCurso.length) lineas.push('', '¡Están todos al día! 🙌');
    lineas.push('', 'Entrá desde el Portal → Capacitaciones, elegí tu nombre y arrancá. Desde el celular también:', location.origin+location.pathname.replace(/indicadores\/.*$/,'capacitaciones/'));
    return lineas.join('\n');
  }
  function copiar(txt){
    return (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).catch(function(){
      var ta=document.createElement('textarea'); ta.value=txt; ta.style.cssText='position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); }catch(e){} ta.remove();
    });
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
      if(!MI_SLUG) return;
      html = '<div id="acwVivo" style="color:#6b7280">Calculando el avance del equipo…</div>';
    }
    var sec = document.createElement('section');
    sec.className = anchor.className || 'sec'; sec.id = 'secAcademia';
    sec.innerHTML = '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px">'+
      '<h2 style="margin:0;font-family:\'Bebas Neue\',\'Barlow Condensed\',sans-serif;font-size:22px;letter-spacing:.6px;color:#0B1527">🎓 Academia de Ventas</h2>'+LINK+'</div>'+
      '<div style="background:#fff;border:1px solid #e2e4e8;border-radius:8px;padding:14px 16px">'+html+
      (ES_STAFF&&R.ts?'<div style="font-size:11.5px;color:#9aa0a8;margin-top:8px">Actualizado '+tiempoRel(R.ts)+' (se refresca cada vez que entra el capacitador o gerencia a la Academia).</div>':'')+'</div>';
    anchor.parentNode.insertBefore(sec, anchor.nextSibling);
    if(!ES_STAFF) calcularSucursal(MI_SLUG, pintarVivo);
  }
  /* Panel del encargado: quién está al día, quién no empezó, qué le falta a cada uno, y un
     recordatorio listo para pegar en el WhatsApp del equipo (la adopción la empuja el encargado). */
  function pintarVivo(v){
    var el=document.getElementById('acwVivo'); if(!el) return;
    var con=v.filas.filter(function(f){ return f.asig>0; });
    if(!con.length){ el.innerHTML='<div style="color:#6b7280">Tu sucursal todavía no tiene cursos asignados.'+(v.sinPadron?' Armá el equipo en «Mi equipo» para que cada persona pueda entrar con su nombre.':'')+'</div>'; return; }
    var sin=con.filter(function(f){ return !f.empezado; }), alDia=con.filter(function(f){ return f.pct>=100; });
    var pctEq=Math.round(con.reduce(function(a,f){ return a+f.pct; },0)/con.length);
    var kpi=function(n,l,col){ return '<div><div style="font-size:30px;font-weight:800;line-height:1;color:'+(col||'#0B1527')+'">'+n+'</div><div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.8px">'+l+'</div></div>'; };
    var h='<div style="display:flex;gap:26px;flex-wrap:wrap;align-items:center">'+kpi(pctEq+'%','avance del equipo')+kpi(alDia.length+'/'+con.length,'al día',alDia.length===con.length?'#178a50':'#0B1527')+kpi(sin.length,'sin empezar',sin.length?'#CC0000':'#178a50')+
      '<div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap"><button type="button" id="acwCopiar" style="background:#0B1527;color:#fff;border:0;border-radius:6px;padding:8px 12px;font:600 13px Barlow,sans-serif;cursor:pointer">⧉ Copiar recordatorio para WhatsApp</button></div></div>';
    if(v.recomendados.length) h+='<div style="margin-top:12px;padding:10px 12px;background:#e7effa;border-radius:6px;font-size:13.5px;color:#0057b8"><b>🎯 Recomendado por el supervisor:</b> '+v.recomendados.map(function(r){ return esc(r.titulo)+(r.motivo?' <span style="color:#4b5158">('+esc(r.motivo)+')</span>':''); }).join(' · ')+'</div>';
    h+='<div style="overflow-x:auto;margin-top:12px"><table style="width:100%;border-collapse:collapse;font-size:13.5px"><thead><tr>'+
      ['Persona','Avance','Estado','Le falta'].map(function(t,i){ return '<th style="text-align:'+(i===1?'left':'left')+';padding:5px 8px;font-size:11.5px;text-transform:uppercase;letter-spacing:.8px;color:#6b7280;border-bottom:2px solid #e2e4e8">'+t+'</th>'; }).join('')+'</tr></thead><tbody>'+
      con.map(function(f){
        var est = f.pct>=100 ? '<span style="color:#178a50;font-weight:700">✓ Al día</span>' : (f.empezado ? '<span style="color:#8a6d00;font-weight:700">En curso</span>' : '<span style="color:#CC0000;font-weight:700">Sin empezar</span>');
        return '<tr><td style="padding:6px 8px;border-bottom:1px solid #eef0f3"><b>'+esc(f.per.nombre)+'</b> <span style="color:#9aa0a8;font-size:12px">· '+esc(ROL_LBL[f.per.rol]||f.per.rol)+'</span></td>'+
          '<td style="padding:6px 8px;border-bottom:1px solid #eef0f3;white-space:nowrap">'+barra(f.pct, f.pct>=100?'#178a50':'#CC0000')+' <b>'+f.pct+'%</b></td>'+
          '<td style="padding:6px 8px;border-bottom:1px solid #eef0f3;white-space:nowrap">'+est+'</td>'+
          '<td style="padding:6px 8px;border-bottom:1px solid #eef0f3;color:#4b5158">'+(f.pend.length?esc(f.pend.slice(0,3).join(', '))+(f.pend.length>3?' <span style="color:#9aa0a8">y '+(f.pend.length-3)+' más</span>':''):'—')+'</td></tr>';
      }).join('')+'</tbody></table></div>'+
      '<div style="font-size:11.5px;color:#9aa0a8;margin-top:8px">Calculado ahora con el avance real de cada persona. Cada uno entra a la Academia con su nombre y su PIN.</div>';
    el.innerHTML=h;
    var b=document.getElementById('acwCopiar'); if(b) b.addEventListener('click', function(){
      copiar(textoRecordatorio(MI_SLUG, v)).then(function(){ b.textContent='✓ Copiado, pegalo en el WhatsApp del equipo'; setTimeout(function(){ b.textContent='⧉ Copiar recordatorio para WhatsApp'; },3000); });
    });
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
