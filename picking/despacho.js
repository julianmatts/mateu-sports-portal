/* ============================================================================
   DESPACHO — cargas por sucursal → remito interno → despacho (23/09/2026)
   Pedido de Juli tras probar el picking con Marce: el control final no aporta si
   termina ahí. Ahora, al cerrar el control de una tarea, lo que va a cada sucursal
   se suma a una CARGA ABIERTA de esa sucursal, separada por rubro (calzado ·
   indumentaria · accesorios). La carga junta varias tareas —remitos del Reparto
   inicial y barridas, mezclados— porque quien pasa mercadería no manda remito por
   remito. Cuando el encargado decide (siempre a mano) se genera el REMITO INTERNO
   (R-00001…, correlativo del portal) y la carga queda vacía. Al llegar a TOPE
   unidades o con artículos de más de HS horas en la carga NO se cierra sola: sale
   una alerta. El que pasa mercadería solo controla ese remito y lo prepara
   (cajas / ensunchado) → «Despachado». El Nº de transferencia del sistema se
   anota aparte (el portal no toca el stock del sistema).
   Lo usan el módulo picking/ (pestaña Despacho) y la tablet recepciones/control/.
   Firebase (recepciones-mateu):
     picking/cargas/<slug>/<fam>/lineas/<pick>_<iid>_<talle> = {cod,id,desc,marca,rubro,t,u,pick,tipo,titulo,ts,por}
     picking/cargas/<slug>/<fam>/aviso300 | aviso48  (alerta ya mandada; se borran al generar el remito)
     picking/remitoSeq  (contador; se incrementa en el servidor, no se repite)
     picking/remitos/<R-00001> = {nro,n,slug,fam,estado:'para_despachar'|'despachado',lineas:[…],u,arts,picks,
        desde,generado_por,generado_en,generado_ms,nro_sistema,despacho:{por,en,ms,cajas,sunchos,nota,arts:{<cod>:{ok,motivo,aj}},dif}}
   ============================================================================ */
(function(){
  'use strict';
  var DB='https://recepciones-mateu-default-rtdb.firebaseio.com';
  var MENSAJES='https://mensajes-mateu-default-rtdb.firebaseio.com';
  var TOPE=300, HS=48;
  var FAM_LBL={calz:'Calzado',ind:'Indumentaria',acc:'Accesorios'}, FAM_ORD=['calz','ind','acc'];

  function num(x){ var n=Number(x); return isFinite(n)?n:0; }
  function esc(s){ return (s==null?'':String(s)).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function key(s){ return String(s==null?'':s).trim().replace(/[.#$/\[\]]/g,'~')||'_'; }
  function vals(o){ return o?Object.keys(o).map(function(k){ return o[k]; }):[]; }
  function url(p){ return DB+'/'+p.split('/').map(encodeURIComponent).join('/')+'.json'; }
  function req(m,p,d){ return fetch(url(p),{method:m,headers:{'Content-Type':'application/json'},body:d===undefined?undefined:JSON.stringify(d)})
    .then(function(r){ if(!r.ok) throw new Error('Firebase '+r.status); return r.json(); }); }
  function get(p){ return fetch(url(p)).then(function(r){ if(!r.ok) throw new Error('Firebase '+r.status); return r.json(); }); }
  function nowISO(){ return new Date().toISOString().slice(0,19).replace('T',' '); }
  function nombreSuc(slug){ return String(slug||'').split('-').map(function(w){ return !w?w:(w.length<=2?w.toUpperCase():w.charAt(0).toUpperCase()+w.slice(1)); }).join(' '); }
  function famDe(rubro){ var r=String(rubro||'').toUpperCase(); return /CALZ/.test(r)?'calz':(/ACCES/.test(r)?'acc':'ind'); }
  function aviso(texto,de){ try{ fetch(MENSAJES+'/avisos.json',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({de:de||'deposito@mateu.com.ar',texto:texto,ts:Date.now()})}).catch(function(){}); }catch(e){} }

  var ORD_LETRA=['XXS','XS','S','M','L','XL','XXL','2XL','XXXL','3XL'];
  function ordT(a,b){ var na=parseFloat(String(a).replace(',','.')), nb=parseFloat(String(b).replace(',','.')), ea=isFinite(na), eb=isFinite(nb);
    if(ea&&eb) return na-nb; if(ea!==eb) return ea?-1:1;
    var ia=ORD_LETRA.indexOf(String(a).toUpperCase()), ib=ORD_LETRA.indexOf(String(b).toUpperCase());
    if(ia>=0&&ib>=0) return ia-ib; if((ia>=0)!==(ib>=0)) return ia>=0?-1:1; return String(a).localeCompare(String(b)); }
  function curvaTxt(t){ return Object.keys(t).sort(ordT).filter(function(k){ return num(t[k])>0; }).map(function(k){ return k+(t[k]>1?'×'+t[k]:''); }).join(' · '); }

  /* ---- lo que va a cada sucursal de un pick ya controlado ----
     Cantidad por talle = lo controlado (o lo preparado); los destinos se llenan en orden, igual que en la
     tablet, y los ajustes del control por sucursal (✗ Hay diferencia, `control_suc[s].aj=[{i,t,u}]`) pisan. */
  function items(P){ return Object.keys(P.items||{}).map(function(iid){ return {iid:iid,it:P.items[iid]}; }).sort(function(a,b){ return num(a.it.sequence)-num(b.it.sequence); }); }
  function qTalle(t){ return (t.controlled!=null&&t.controlled!=='')?num(t.controlled):num(t.picked); }
  function repartoDePick(P){
    var out={}, CS=P.control_suc||{};
    items(P).forEach(function(x){ var it=x.it, r={};
      (it.talles||[]).forEach(function(t){ var q=qTalle(t);
        if((t.dest||[]).length){ var acc=0; t.dest.forEach(function(d){ var ini=acc; acc+=num(d.u); var h=Math.max(0,Math.min(num(d.u),q-ini)); if(h>0){ (r[d.s]=r[d.s]||{})[t.t]=h; } }); }
        else if(P.destino && q>0){ (r[P.destino]=r[P.destino]||{})[t.t]=q; } });
      Object.keys(CS).forEach(function(s){ ((CS[s]&&CS[s].aj)||[]).forEach(function(a){ if(a&&a.i===x.iid){ (r[s]=r[s]||{})[a.t]=Math.max(0,num(a.u)); } }); });
      Object.keys(r).forEach(function(s){ var o=out[s]||(out[s]={}); o[x.iid]={it:it,t:r[s]}; }); });
    return out; }

  /* ---- suma un pick controlado a las cargas abiertas ---- (idempotente: la clave es pick+ítem+talle) */
  function aCargas(P, opt){ opt=opt||{};
    var R=repartoDePick(P), patch={}, toc={}, ts=Date.now(), u=0, titulo=P.titulo||nombreSuc(P.destino);
    Object.keys(R).forEach(function(s){ Object.keys(R[s]).forEach(function(iid){ var o=R[s][iid], it=o.it, fam=famDe(it.rubro);
      Object.keys(o.t).forEach(function(t){ var q=num(o.t[t]), k=key(s)+'/'+fam+'/lineas/'+key(P.nro)+'_'+key(iid)+'_'+key(t);
        if(q>0){ patch[k]={cod:it.codigo||'',id:it.id||'',desc:it.desc||'',marca:it.marca||'',rubro:it.rubro||'',t:String(t),u:q,pick:P.nro,tipo:P.tipo||'',titulo:titulo,ts:ts,por:opt.por||P.controlado_por||''}; u+=q; toc[key(s)+'/'+fam]=1; }
        else patch[k]=null; }); }); });
    if(!Object.keys(patch).length) return Promise.resolve({u:0,cargas:[]});
    return req('PATCH','picking/cargas',patch).catch(function(e){
      if(opt.enqueue){ Object.keys(patch).forEach(function(k){ opt.enqueue('picking/cargas/'+k, patch[k]); }); return null; } throw e; })
      .then(function(){ revisarCargas(Object.keys(toc)); return {u:u,cargas:Object.keys(toc)}; }); }

  /* ---- resumen de una carga ---- */
  function resumen(slug, fam, c){ var L=(c&&c.lineas)||{}, ks=Object.keys(L).filter(function(k){ return L[k]&&num(L[k].u)>0; });
    var u=0, arts={}, picks={}, desde=0, viejas=0, lim=Date.now()-HS*3600000;
    ks.forEach(function(k){ var l=L[k]; u+=num(l.u); arts[l.cod||l.id]=1; picks[l.pick]=1; var ts=num(l.ts); if(ts&&(!desde||ts<desde)) desde=ts; if(ts&&ts<lim) viejas+=num(l.u); });
    return {slug:slug, fam:fam, lineas:ks.length, u:u, arts:Object.keys(arts).length, picks:Object.keys(picks), desde:desde, viejas:viejas,
      tope:u>=TOPE, alerta48:viejas>0, aviso300:c&&c.aviso300||null, aviso48:c&&c.aviso48||null}; }
  function resumenes(todo){ var out=[]; Object.keys(todo||{}).forEach(function(s){ var f=todo[s]||{}; FAM_ORD.forEach(function(fam){ if(f[fam]){ var r=resumen(s,fam,f[fam]); if(r.lineas) out.push(r); } }); });
    return out.sort(function(a,b){ return (b.tope||b.alerta48?1:0)-(a.tope||a.alerta48?1:0) || nombreSuc(a.slug).localeCompare(nombreSuc(b.slug),'es') || FAM_ORD.indexOf(a.fam)-FAM_ORD.indexOf(b.fam); }); }
  function fecha(ms){ if(!ms) return '—'; var d=new Date(ms), p=function(n){ return String(n).padStart(2,'0'); }; return p(d.getDate())+'/'+p(d.getMonth()+1)+' '+p(d.getHours())+':'+p(d.getMinutes()); }
  function esHoy(ms){ return !!ms && new Date(ms).toDateString()===new Date().toDateString(); }
  function pl(n,s,p){ return n+' '+(n===1?s:(p||s+'s')); }
  function horas(ms){ if(!ms) return '—'; var h=(Date.now()-ms)/3600000; if(h<1) return Math.max(1,Math.round(h*60))+' min'; if(h<48) return Math.round(h)+' h'; return Math.floor(h/24)+' días'; }

  /* ---- alertas: una sola vez por carga (se reinician al generar el remito). No cierran nada. ---- */
  function revisarCargas(paths){ (paths||[]).forEach(function(p){ get('picking/cargas/'+p).then(function(c){ if(!c) return; var sf=p.split('/'), r=resumen(sf[0],sf[1],c);
      if(r.tope && !r.aviso300){ req('PUT','picking/cargas/'+p+'/aviso300',nowISO()).catch(function(){}); aviso('🚚 La carga de '+nombreSuc(r.slug)+' · '+FAM_LBL[r.fam]+' llegó a '+r.u+' unidades (tope '+TOPE+'). Generá el remito cuando puedas: la carga sigue abierta.'); }
      if(r.alerta48 && !r.aviso48){ req('PUT','picking/cargas/'+p+'/aviso48',nowISO()).catch(function(){}); aviso('⏱ La carga de '+nombreSuc(r.slug)+' · '+FAM_LBL[r.fam]+' tiene '+r.viejas+' unidades esperando hace más de '+HS+' h. Conviene generar el remito.'); }
    }).catch(function(){}); }); }
  function revisarTodas(todo){ var ps=[]; Object.keys(todo||{}).forEach(function(s){ Object.keys(todo[s]||{}).forEach(function(f){ ps.push(s+'/'+f); }); }); revisarCargas(ps); }

  /* ---- remito ---- */
  function artsDe(lineas){ var m={}; (lineas||[]).forEach(function(l){ var k=l.cod||l.id; var a=m[k]||(m[k]={cod:l.cod,id:l.id,desc:l.desc,marca:l.marca,rubro:l.rubro,t:{},u:0,picks:{}}); a.t[l.t]=(a.t[l.t]||0)+num(l.u); a.u+=num(l.u); a.picks[l.pick]=1; });
    return vals(m).sort(function(a,b){ return String(a.marca).localeCompare(String(b.marca),'es')||String(a.desc).localeCompare(String(b.desc),'es')||String(a.cod).localeCompare(String(b.cod)); }); }
  function generarRemito(slug, fam, por){
    var sf=key(slug)+'/'+fam;
    return get('picking/cargas/'+sf).then(function(c){
      var L=(c&&c.lineas)||{}, ks=Object.keys(L).filter(function(k){ return L[k]&&num(L[k].u)>0; });
      if(!ks.length) throw new Error('La carga está vacía');
      return req('PUT','picking/remitoSeq',{'.sv':{increment:1}}).catch(function(){ return null; }).then(function(n){
        n=num(n); var nro=n?('R-'+String(n).padStart(5,'0')):('R-'+Date.now().toString(36).toUpperCase());
        var lineas=ks.map(function(k){ var l=L[k]; return {k:k,cod:l.cod||'',id:l.id||'',desc:l.desc||'',marca:l.marca||'',rubro:l.rubro||'',t:l.t,u:num(l.u),pick:l.pick,tipo:l.tipo||'',titulo:l.titulo||'',ts:num(l.ts),por:l.por||''}; })
          .sort(function(a,b){ return String(a.marca).localeCompare(String(b.marca),'es')||String(a.desc).localeCompare(String(b.desc),'es')||ordT(a.t,b.t); });
        var r=resumen(slug,fam,c), picks={}; lineas.forEach(function(l){ picks[l.pick]=1; });
        var doc={nro:nro,n:n||0,slug:slug,fam:fam,estado:'para_despachar',lineas:lineas,u:r.u,arts:r.arts,picks:Object.keys(picks),desde:r.desde,
          generado_por:por||'',generado_en:nowISO(),generado_ms:Date.now(),nro_sistema:''};
        return req('PUT','picking/remitos/'+key(nro),doc).then(function(){
          var del={aviso300:null,aviso48:null}; ks.forEach(function(k){ del['lineas/'+k]=null; });   // solo lo que entró: lo que se sumó mientras tanto queda
          return req('PATCH','picking/cargas/'+sf,del); }).then(function(){ return doc; }); }); }); }
  // anular un remito que todavía no salió: sus líneas vuelven a la carga
  function deshacerRemito(doc){ if(!doc||doc.estado==='despachado') return Promise.reject(new Error('Ya se despachó'));
    // las alertas de esa carga ya salieron antes: no se repiten por volver las líneas
    var patch={}; patch[key(doc.slug)+'/'+doc.fam+'/aviso300']='anulado '+doc.nro; patch[key(doc.slug)+'/'+doc.fam+'/aviso48']='anulado '+doc.nro;
    (doc.lineas||[]).forEach(function(l){ var o={}; Object.keys(l).forEach(function(k){ if(k!=='k') o[k]=l[k]; }); patch[key(doc.slug)+'/'+doc.fam+'/lineas/'+l.k]=o; });
    return req('PATCH','picking/cargas',patch).then(function(){ return req('DELETE','picking/remitos/'+key(doc.nro)); }); }
  function despachar(doc, d){ var dif=vals(d.arts||{}).some(function(a){ return a&&a.ok===false; });
    var dd={por:d.por||'',en:nowISO(),ms:Date.now(),cajas:num(d.cajas),sunchos:num(d.sunchos),nota:d.nota||'',arts:d.arts||{},dif:dif};
    return req('PATCH','picking/remitos/'+key(doc.nro),{estado:'despachado',despacho:dd}).then(function(){
      if(dif) aviso('⚠️ Remito '+doc.nro+' ('+nombreSuc(doc.slug)+' · '+FAM_LBL[doc.fam]+') despachado CON DIFERENCIAS'+(d.por?(' — '+d.por):'')+'. Revisalo en Picking → Despacho.');
      doc.estado='despachado'; doc.despacho=dd; return doc; }); }

  /* ---- impresiones ---- */
  var CSS='body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:22px}h1{font-size:22px;margin:0}.sub{color:#444;font-size:13px;margin:4px 0 12px}'
    +'.bar{margin:0 0 14px}.bar a,.bar button{font:inherit;font-size:13px;padding:7px 12px;border:1px solid #0B1527;border-radius:7px;background:#fff;color:#0B1527;text-decoration:none;cursor:pointer;margin-right:8px}'
    +'.cab{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;border:2px solid #0B1527;border-radius:6px;padding:10px;margin-bottom:12px}.cab div{font-size:12px;color:#555}.cab b{display:block;font-size:16px;color:#111}'
    +'table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;border-bottom:2px solid #0B1527;padding:5px 7px;font-size:11px;text-transform:uppercase;color:#333}td{border-bottom:1px solid #ddd;padding:6px 7px}'
    +'.chk{width:26px}td.chk{border:1px solid #999;width:22px;height:20px}.q{text-align:right;font-weight:700;width:60px}.tot td{font-weight:700;border-top:2px solid #0B1527}'
    +'.firmas{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:40px}.firmas div{border-top:1px solid #333;padding-top:6px;font-size:12px;text-align:center}'
    +'.et{border:3px solid #0B1527;border-radius:10px;padding:18px;margin:0 0 14px;page-break-inside:avoid;height:88mm;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between}'
    +'.et .s{font-size:40px;font-weight:800;text-transform:uppercase}.et .r{font-size:22px}.et .b{font-size:54px;font-weight:800;text-align:right}'
    +'@media print{body{margin:8mm}.bar{display:none}.et{margin:0 0 6mm}}';
  function ventana(titulo, body, csv, csvNombre){ var w=window.open('','_blank'); if(!w) return false;
    w.document.write('<html><head><title>'+esc(titulo)+'</title><meta charset="utf-8"><style>'+CSS+'</style></head><body>'+body+'</body></html>'); w.document.close();
    if(csv){ try{ var a=w.document.getElementById('csv'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download=csvNombre; }catch(e){} }
    w.focus(); return true; }
  function imprimirRemito(doc, gondola){
    var arts=artsDe(doc.lineas), fGen=fecha(doc.generado_ms);
    // si al despachar se corrigió una cantidad, el remito y el CSV llevan lo que realmente salió
    var M=(doc.despacho&&doc.despacho.arts)||{}, filas=[], tot=0;
    arts.forEach(function(a){ var m=M[key(a.cod||a.id)], aj={}; ((m&&m.ok===false&&m.aj)||[]).forEach(function(j){ aj[j.t]=num(j.u); });
      Object.keys(a.t).sort(ordT).forEach(function(t){ var u=(aj[t]!=null)?aj[t]:a.t[t]; tot+=u; filas.push({a:a,t:t,u:u,orig:(aj[t]!=null&&aj[t]!==a.t[t])?a.t[t]:null}); }); });
    var body='<h1>REMITO INTERNO '+esc(doc.nro)+'</h1><div class="sub">Depósito Central → '+esc(nombreSuc(doc.slug))+' · '+esc(FAM_LBL[doc.fam]||doc.fam)+'</div>'
      +'<div class="bar"><button onclick="window.print()">🖨 Imprimir</button><a id="csv" href="#">⇩ CSV para el sistema</a></div>'
      +'<div class="cab"><div>Destino<b>'+esc(nombreSuc(doc.slug))+'</b></div><div>Rubro<b>'+esc(FAM_LBL[doc.fam]||doc.fam)+'</b></div><div>Generado<b>'+esc(fGen)+'</b></div><div>Nº en el sistema<b>'+(doc.nro_sistema?esc(doc.nro_sistema):'&nbsp;______________')+'</b></div>'
      +'<div>Unidades<b>'+tot+'</b></div><div>Artículos<b>'+arts.length+'</b></div><div>Góndola<b>'+esc(gondola||'—')+'</b></div><div>Generó<b>'+esc(doc.generado_por||'—')+'</b></div></div>'
      +'<table><tr><th class="chk">✓</th><th>Código</th><th>ID item</th><th>Descripción</th><th>Marca</th><th>Talle</th><th class="q">Cant.</th></tr>'
      +filas.map(function(f){ return '<tr><td class="chk"></td><td><b>'+esc(f.a.cod)+'</b></td><td>'+esc(f.a.id)+'</td><td>'+esc(f.a.desc)+'</td><td>'+esc(f.a.marca)+'</td><td><b>'+esc(f.t)+'</b></td><td class="q">'+(f.orig!=null?'<s style="color:#999;font-weight:400">'+f.orig+'</s> ':'')+f.u+'</td></tr>'; }).join('')
      +'<tr class="tot"><td colspan="6">Total'+(tot!==doc.u?' (se generó con '+doc.u+')':'')+'</td><td class="q">'+tot+'</td></tr></table>'
      +(doc.despacho?'<div class="sub" style="margin-top:12px">Despachado por '+esc(doc.despacho.por||'—')+' · '+esc(fecha(doc.despacho.ms))+' · '+pl(num(doc.despacho.cajas),'caja')+' · '+pl(num(doc.despacho.sunchos),'ensunchado')+(doc.despacho.nota?(' · '+esc(doc.despacho.nota)):'')+'</div>':'')
      +'<div class="firmas"><div>Preparó</div><div>Despachó</div><div>Recibió (sucursal)</div></div>';
    var csv='﻿Sucursal;Codigo;Id item;Descripcion;Talle;Cantidad\r\n'+filas.filter(function(f){ return f.u>0; }).map(function(f){ return [nombreSuc(doc.slug),f.a.cod,f.a.id,String(f.a.desc||'').replace(/;/g,','),f.t,f.u].join(';'); }).join('\r\n');
    return ventana('Remito '+doc.nro, body, csv, 'remito-'+doc.nro+'-'+doc.slug+'.csv'); }
  function imprimirEtiquetas(doc, n){ n=Math.max(1,num(n)); var b='<div class="bar"><button onclick="window.print()">🖨 Imprimir etiquetas</button></div>';
    for(var i=1;i<=n;i++) b+='<div class="et"><div class="s">'+esc(nombreSuc(doc.slug))+'</div><div class="r">Remito <b>'+esc(doc.nro)+'</b> · '+esc(FAM_LBL[doc.fam]||'')+(doc.nro_sistema?(' · Sist. '+esc(doc.nro_sistema)):'')+'</div><div class="b">Bulto '+i+' / '+n+'</div></div>';
    return ventana('Etiquetas '+doc.nro, b); }

  window.Despacho={ TOPE:TOPE, HS:HS, FAM_LBL:FAM_LBL, FAM_ORD:FAM_ORD, famDe:famDe, ordT:ordT, curvaTxt:curvaTxt, horas:horas, fecha:fecha, esHoy:esHoy, pl:pl, nombreSuc:nombreSuc,
    repartoDePick:repartoDePick, aCargas:aCargas, resumen:resumen, resumenes:resumenes, revisarTodas:revisarTodas, artsDe:artsDe,
    generarRemito:generarRemito, deshacerRemito:deshacerRemito, despachar:despachar, imprimirRemito:imprimirRemito, imprimirEtiquetas:imprimirEtiquetas };
})();
