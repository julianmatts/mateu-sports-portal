/* ============================================================
   Descargas del F8 (11/09/2026, pedido de Juli) — window.F8Descargas
   Las usan Mi Sucursal («F8 para armar», indicadores/) y la pestaña F8s del Buscador de
   Artículos (ubicaciones/), que es donde lo ve la cuenta de depósito de la sucursal.

   · descargarF8(doc, opts): la planilla OFICIAL del operador —Daniel: calzado, «F / 8» con
     7 curvas y columna MARCA; David: «F8 ACCESORIOS» con 6 curvas— solo con las líneas de
     la sucursal (ExcelJS por cdnjs, carga perezosa).
   · abrirRecorrido(doc, opts): la planilla de recorrido de armado (hoja imprimible en una
     ventana nueva): cada artículo agrupado por estantería/módulo según las ubicaciones del
     Buscador, con destino, cantidad y talles; desde ahí «Descargar Excel».
   · recorridoExcel(doc, opts): el mismo recorrido en Excel.

   doc = equipo/f8suc/<slug>/<id> tal cual lo reparte equipo/: lineas [{o,d,c,a,t,todo?, m, ds,
   cv, k, x, q:[[índice de talle, unidades]]}] + curvas [{n, t:[rótulos]}] + hdr {nro, titulo}.
   Los F8 repartidos sin curvas usan las del operador (F8_CURVAS_DEF).
   opts = {slug, sucursal (nombre para mostrar), alDescargar(), datos?:{arts, ests}} — con
   `datos` (el Buscador ya los tiene en memoria) no se vuelve a bajar el stock.
   Se incluye SIN defer (el render de la tabla usa tallesDe/tallesTxt).
   ============================================================ */
(function(){
'use strict';
const LOGO='data:image/jpeg;base64,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';
const UBIC_SUC_URL='https://ubicaciones-mateu-default-rtdb.firebaseio.com/sucursales/';
// Sucursales con dos depósitos: copia de DEPOSITOS_SUC de ubicaciones/ (mantener en sintonía)
const DEPOSITOS={diagonal:[{nombre:'Subsuelo',desde:1,hasta:26},{nombre:'2° piso',desde:27,hasta:Infinity}]};

function esc(s){ return (s==null?'':String(s)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function nums(a,b,paso){ const o=[]; for(let v=a; v<=b+1e-9; v+=paso) o.push(String(v)); return o; }
const C1=['10','10-','11','11-','12','12-','13','13-','1','1-','2','2-','3','3-','4','4-','5','5-','6','6-','7'];
// Curvas de las planillas reales (F8 19-08-2026 de Daniel y 14-08-2026 de David)
const F8_CURVAS_DEF={
  calzado:[{n:1,t:C1},{n:2,t:nums(3,14.5,.5)},{n:3,t:nums(17,42,1)},{n:4,t:nums(30,50,1).concat(['52','54','56'])},
    {n:5,t:nums(30.5,47.5,1)},{n:6,t:nums(0,14,1).concat(['16','18','20','22','24','26','80','85','90','95','100'])},
    {n:7,t:['UNI','XXS','XS','S','M','L','XL','XXL','3XL','4XL','CHI','MED','GDE','KD','JR','SR','XSS','SM','ML','LXL','XLXX','PRO']}],
  indumentaria:[{n:1,t:C1},{n:2,t:nums(3,13,.5).concat(['14','15','16'])},{n:3,t:nums(18,39,1)},{n:4,t:nums(33,50,1)},
    {n:5,t:['8','10','12','14','16','18','20','22','24'].concat(nums(0,7,1))},
    {n:6,t:['XXS','XS','S','M','L','XL','XXL','3XL','XSS','SM','ML','LXL','CHI','MED','GDE','JR','SR']}]
};
function tipo(d){ return /daniel/i.test((d&&d.operador)||'') ? 'calzado' : 'indumentaria'; }
function curvasDe(d){
  const c = d && d.curvas ? Object.values(d.curvas).filter(x=>x && x.n!=null) : [];
  return c.length ? c.map(x=>({n:+x.n, t:Object.values(x.t||{}).map(v=>v==null?'':String(v))})).sort((a,b)=>a.n-b.n) : F8_CURVAS_DEF[tipo(d)];
}
function qDe(L){ return L && L.q ? Object.values(L.q).filter(p=>p && +p[1]>0) : []; }
// Talles de una línea: [[rótulo, unidades]] en el orden de la curva ('UNI' = talle único).
// Sin curva conocida no se inventan talles (como la lista de retiro del Buscador).
function tallesDe(d,L){
  const q=qDe(L); if(!q.length) return [];
  const curvas=curvasDe(d);
  const cur = L.k!=null ? curvas.find(x=>x.n===+L.k) : null;
  const unico = String(L.cv||'').toUpperCase()==='UNI' ||
    (!cur && q.length===1 && +q[0][0]===0 && curvas.some(x=>String(x.t[0]||'').toUpperCase()==='UNI'));
  if(!cur && !unico) return [];
  const out=[], pos={};
  q.forEach(([i,v])=>{ const lb = unico ? 'UNI' : (cur.t[+i]||''); if(!lb) return;
    if(pos[lb]==null){ pos[lb]=out.length; out.push([lb,0]); } out[pos[lb]][1]+= +v; });
  return out;
}
function tallesTxt(p){ return (p||[]).map(([t,n])=>t+(n>1?'×'+n:'')).join(' · '); }
function fechaTxt(f,sep){ const p=String(f||'').split('-'); return p.length===3 ? [p[2],p[1],p[0]].join(sep||'/') : String(f||''); }
// número si la celda es un número pelado (Id.item, destino «44», talle «8.5»); si no, texto
function num(v){ const s=String(v==null?'':v).trim(); return /^\d+(\.\d+)?$/.test(s) && !/^0\d/.test(s) ? Number(s) : s; }
function nombreSuc(opts){ return (opts&&opts.sucursal) || (opts&&opts.slug) || ''; }
function marcar(opts){ try{ opts && opts.alDescargar && opts.alDescargar(); }catch(e){} }

let _exceljsP=null;
function loadExcelJS(){
  if(window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if(_exceljsP) return _exceljsP;
  _exceljsP=new Promise((res,rej)=>{ const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
    s.onload=()=>res(window.ExcelJS); s.onerror=()=>{ _exceljsP=null; rej(new Error('No se pudo cargar el generador de Excel')); };
    document.head.appendChild(s); });
  return _exceljsP;
}
async function excelJS(){
  try{ return await loadExcelJS(); }
  catch(e){ alert('No se pudo cargar el generador de Excel. Revisá la conexión y probá de nuevo.'); return null; }
}
async function bajarXlsx(wb,nombre){
  const buf=await wb.xlsx.writeBuffer();
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  a.download=nombre.replace(/[\\/:*?"<>|]/g,'-'); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
// Estilos de celda sin claves vacías (ExcelJS no quiere font.color / fill undefined)
function estilo(x,st){
  if(!st) return;
  ['font','fill','alignment','border','numFmt'].forEach(k=>{
    const v=st[k]; if(v===undefined || v===null) return;
    if(k==='font'){ const f=Object.assign({},v); Object.keys(f).forEach(z=>f[z]===undefined&&delete f[z]); x.font=f; }
    else x[k]=v;
  });
}

/* ───────────── F8 oficial ───────────── */
function armarF8(ExcelJS,d,opts){
  const calz=tipo(d)==='calzado', curvas=curvasDe(d), lineas=(Array.isArray(d.lineas)?d.lineas:Object.values(d.lineas||{})).filter(Boolean);
  // columnas de talle: las de la planilla real o más, si la curva o algún talle se pasa
  const nT=Math.max(calz?26:24, ...curvas.map(c=>c.t.length), ...lineas.map(L=>Math.max(0,...qDe(L).map(p=>+p[0]+1))));
  const lay = calz
    ? {hoja:'Hoja1', fuente:'Arial', c0:1, t0:9, fila0:0,
       cols:[['ORIGEN','o',20.7],['MARCA','m',16],['CODIGO','c',27.9],['ARTÍCULO','a',19],['DESCRIPCIÓN','ds',50.6],['DESTINO','d',21]]}
    : {hoja:'F8', fuente:'Calibri', c0:2, t0:8, fila0:2,
       cols:[['ORIGEN','o',21.7],['CÓDIGO','c',26.7],['ARTÍCULO','a',17.4],['DESCRIPCIÓN','ds',64.9],['DESTINO','d',21.6]]};
  const CV=7;                                               // columna G: número de curva
  const maxN=Math.max(...curvas.map(c=>c.n));
  const HR=Math.max(calz?7:9, lay.fila0+maxN+(calz?0:1));   // fila de encabezados
  const L1=lay.t0, L2=lay.t0+nT-1, TOT=lay.t0+nT;
  const wb=new ExcelJS.Workbook(); wb.creator='Portal Mateu Sports'; wb.created=new Date();
  const ws=wb.addWorksheet(lay.hoja,{views:[{state:'frozen',ySplit:HR,zoomScale:70}],
    pageSetup:{orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:'+HR,
      margins:{left:.25,right:.25,top:.4,bottom:.4,header:.2,footer:.2}}});
  const NEG='FF000000', BLA={argb:'FFFFFFFF'};
  const negro={type:'pattern',pattern:'solid',fgColor:{argb:NEG}};
  const lin=s=>({style:s,color:{argb:NEG}});
  const borde=(t,l,b,r)=>{ const o={}; if(t)o.top=lin(t); if(l)o.left=lin(l); if(b)o.bottom=lin(b); if(r)o.right=lin(r); return o; };
  const centro={horizontal:'center',vertical:'middle'};
  const put=(r,c,v,st)=>{ const x=ws.getCell(r,c); if(v!==undefined) x.value=v; estilo(x,st); return x; };
  const letra=c=>ws.getColumn(c).letter;
  // borde alrededor de un rango (antes de combinar: Excel dibuja el borde de cada celda del contorno)
  const marco=(r1,c1,r2,c2,s)=>{ for(let r=r1;r<=r2;r++) for(let c=c1;c<=c2;c++){
    const x=ws.getCell(r,c), b=Object.assign({},x.border||{});
    if(r===r1) b.top=lin(s); if(r===r2) b.bottom=lin(s); if(c===c1) b.left=lin(s); if(c===c2) b.right=lin(s);
    x.border=b; } };
  const p=String(d.fecha||'').split('-').map(Number);
  const fecha=p.length===3 ? new Date(Date.UTC(p[0],p[1]-1,p[2],12)) : new Date();
  const H=d.hdr||{};

  // ── columnas
  // en el de David la A es un margen vacío, pero tiene que existir: sin ninguna celda ahí, un lector
  // de Excel (SheetJS en equipo/ y en el Buscador) arranca la hoja en la B y corre todas las columnas
  if(!calz){ ws.getColumn(1).width=1.9; ws.getCell(1,1).value=''; }
  lay.cols.forEach(([,,w],i)=>{ ws.getColumn(lay.c0+i).width=w; });
  ws.getColumn(CV).width=calz?8.9:5.7;
  if(calz) ws.getColumn(8).width=5.4;
  for(let c=L1;c<=L2;c++) ws.getColumn(c).width=calz?7:5.6;
  ws.getColumn(TOT).width=calz?13:11.6;

  // ── membrete (logo + título + fecha), como en la planilla de cada operador
  const logo=wb.addImage({base64:LOGO, extension:'jpeg'});
  if(calz){
    for(let r=1;r<=HR;r++) ws.getRow(r).height = r===1?24 : r<6?21 : 21.75;
    marco(1,1,5,2,'medium'); ws.mergeCells(1,1,5,2);
    ws.addImage(logo,{tl:{col:0.2,row:0.35},ext:{width:245,height:94}});
    marco(2,3,6,6,'thin'); ws.mergeCells(2,3,6,6);
    put(2,3,'F / 8',{font:{name:'Bell MT',size:62,bold:true},alignment:centro});
    ws.mergeCells(1,4,1,5);
    put(1,4,fecha,{numFmt:'dd/mm/yyyy',fill:negro,font:{name:'OCR A Extended',size:16,bold:true,color:BLA},alignment:centro});
    // operador y número de F8 arriba a la derecha, si la curva de esa fila deja lugar
    const c1=curvas.find(x=>lay.fila0+x.n===1);
    if(!c1 || L1+c1.t.length-1 < TOT-5){
      ws.mergeCells(1,TOT-5,1,TOT-2);
      put(1,TOT-5,String(d.operador||'').toUpperCase(),{fill:negro,font:{name:'OCR A Extended',size:12,bold:true,color:BLA},alignment:centro});
      ws.mergeCells(1,TOT-1,1,TOT);
      put(1,TOT-1,H.nro||'',{fill:negro,font:{name:'OCR A Extended',size:14,bold:true,color:BLA},alignment:{horizontal:'right',vertical:'middle'}});
    }
    const c2=curvas.find(x=>lay.fila0+x.n===2);
    if(!c2 || L1+c2.t.length-1 < TOT)
      put(2,TOT,fecha,{numFmt:'dd/mm/yyyy',fill:negro,font:{name:'OCR A Extended',size:11,color:BLA},alignment:centro});
  }else{
    ws.getRow(3).height=46; ws.getRow(4).height=24;
    for(let r=5;r<HR;r++) ws.getRow(r).height=17;
    ws.getRow(HR).height=18;
    marco(3,2,8,3,'medium'); ws.mergeCells(3,2,8,3);
    ws.addImage(logo,{tl:{col:1.3,row:2.6},ext:{width:250,height:96}});
    marco(3,4,3,5,'medium'); ws.mergeCells(3,4,3,5);
    put(3,4,H.titulo||'F8 ACCESORIOS',{font:{name:'Bell MT',size:34,bold:true},alignment:{horizontal:'left',vertical:'middle'}});
    put(3,6,fecha,{numFmt:'dd/mm/yyyy',fill:negro,font:{name:'Eras Demi ITC',size:18,bold:true,color:BLA},alignment:centro,border:borde('medium','medium','medium','medium')});
    marco(4,4,8,6,'medium'); ws.mergeCells(4,4,8,6);
    put(4,4,'F8',{font:{name:'Calibri',size:48,bold:true},alignment:centro});
  }

  // ── curvas de talle: una fila por curva, con su número en la columna G
  curvas.forEach(cv=>{
    const r=lay.fila0+cv.n; if(r<1||r>HR) return;
    const enHdr=r===HR, neg=calz&&enHdr;
    if(calz){
      ws.mergeCells(r,CV,r,CV+1);
      put(r,CV,cv.n,{fill:negro,font:{name:'Calibri',size:16,bold:true,color:BLA},alignment:centro,border:borde('thin','thin','thin','medium')});
    }else put(r,CV,cv.n,{font:{name:'Calibri',size:11,bold:true},alignment:centro,border:borde('thin','thin','thin','thin')});
    cv.t.forEach((lb,i)=>{ if(lb==='') return;
      put(r,L1+i,num(lb),{fill:neg?negro:undefined,alignment:centro,border:borde('thin','thin','thin','thin'),
        font:{name:'Calibri',size:calz?(enHdr?12:10):11,bold:enHdr||(!calz&&cv.n===maxN),color:neg?BLA:undefined}});
    });
  });

  // ── encabezados
  if(calz){
    for(let c=1;c<=TOT;c++){ const x=ws.getCell(HR,c); x.fill=negro; if(x.value==null) x.font={name:'Arial',size:10,bold:true,color:BLA}; }
    if(!curvas.some(x=>lay.fila0+x.n===HR)){ try{ ws.mergeCells(HR,CV,HR,CV+1); }catch(e){} }
    lay.cols.forEach(([t],i)=>put(HR,lay.c0+i,t,{fill:negro,font:{name:'Arial',size:10,bold:true,color:BLA},
      alignment:{horizontal:'left',vertical:'middle'},border:borde('thin',i===0?'medium':'thin','thin','thin')}));
  }else{
    lay.cols.forEach(([t],i)=>put(HR,lay.c0+i,t,{font:{name:'Calibri',size:11,bold:true},alignment:centro,border:borde('medium','medium','medium','medium')}));
    put(HR,CV,null,{fill:negro,border:borde('thin','thin','thin','thin')});
    for(let c=L1;c<=L2;c++) put(HR,c,undefined,{border:borde('thin','thin','thin','thin')});
    marco(HR-2,TOT,HR,TOT,'medium'); ws.mergeCells(HR-2,TOT,HR,TOT);
    put(HR-2,TOT,'Total',{font:{name:'Calibri',size:11,bold:true},alignment:centro});
  }

  // ── líneas del F8 de la sucursal
  let r=HR, totalU=0, sinTalles=0;
  lineas.forEach(L=>{
    r++;
    ws.getRow(r).height=calz?18.75:15.75;
    lay.cols.forEach(([,k],i)=>{
      let v=L[k]; v=v==null?'':v;
      if(k==='o'||k==='d'||k==='a') v=num(v);
      const grande=calz&&(k==='m'||k==='c'||k==='a');
      put(r,lay.c0+i,v,{font:{name:lay.fuente,size:grande?14:(calz?12:11),bold:k==='a'},
        alignment:{horizontal:(k==='c'||k==='ds'||k==='m')?'left':'center',vertical:'middle'},
        border: calz ? borde('thin',i===0?'medium':'hair','thin','hair') : borde('thin','thin','thin',k==='d'?'medium':'thin')});
    });
    const cv = L.cv!=null && L.cv!=='' ? num(L.cv) : (L.k!=null ? +L.k : '');
    put(r,CV,cv,{font:{name:'Calibri',size:calz?12:11,bold:true},alignment:{horizontal:calz?'right':'center',vertical:'middle'},
      border:borde('hair',calz?'medium':'thin','hair',calz?'hair':'thin')});
    if(calz) put(r,8,L.x!=null?num(L.x):'',{font:{name:'Arial',size:14},alignment:centro,border:borde('hair','hair','hair','hair')});
    for(let c=L1;c<=L2;c++) put(r,c,undefined,{font:{name:lay.fuente,size:calz?10:11,bold:calz},alignment:centro,
      border:borde('thin',calz?'hair':'thin','thin',calz?'hair':'thin')});
    const q=qDe(L); let suma=0;
    q.forEach(([i,v])=>{ put(r,L1+(+i),+v); suma+=+v; });
    const totSt={font:{name:lay.fuente,size:calz?10:11,bold:calz},alignment:centro,
      border:calz?borde('thin','double','thin','medium'):borde('thin','medium','thin','medium')};
    const t=+L.t||0;
    if(!q.length && t>0){ put(r,TOT,t,totSt); sinTalles++; totalU+=t; }
    else { put(r,TOT,{formula:'SUM('+letra(L1)+r+':'+letra(L2)+r+')',result:suma},totSt); totalU+=suma; }
  });
  if(calz){
    const hc=curvas.find(x=>lay.fila0+x.n===HR);
    const libre=!hc || L1+hc.t.length-1 < TOT-2;
    put(HR,libre?TOT-2:TOT,'TOTAL',{fill:negro,font:{name:'Arial',size:10,bold:true,color:BLA},alignment:centro});
    if(libre && lineas.length) put(HR,TOT,{formula:'SUBTOTAL(9,'+letra(TOT)+(HR+1)+':'+letra(TOT)+r+')',result:totalU},
      {fill:negro,font:{name:'Arial',size:11,bold:true,color:BLA},alignment:centro});
    ws.autoFilter={from:{row:HR,column:1},to:{row:HR,column:6}};
  }
  if(sinTalles){
    r+=2; ws.mergeCells(r,lay.c0,r,lay.c0+lay.cols.length-1);
    put(r,lay.c0,'Nota: este F8 se repartió antes de que el portal guardara la curva de talles, así que '+sinTalles+
      (sinTalles===1?' línea lleva':' líneas llevan')+' solo el TOTAL. Los talles están en el F8 original de '+(d.operador||'Producto')+'.',
      {font:{name:'Calibri',size:10,italic:true,color:{argb:'FF6B7A99'}}});
  }
  return wb;
}
async function descargarF8(d,opts){
  if(!d) return;
  const ExcelJS=await excelJS(); if(!ExcelJS) return;
  const wb=armarF8(ExcelJS,d,opts);
  await bajarXlsx(wb,'F8 '+fechaTxt(d.fecha,'-')+' - '+nombreSuc(opts)+'.xlsx');
  marcar(opts);
}

/* ───────────── Planilla de recorrido ───────────── */
const _ubicP={};
function ubicaciones(opts){
  if(opts && opts.datos) return Promise.resolve({arts:opts.datos.arts||{}, ests:opts.datos.ests||{}});
  const slug=opts.slug;
  if(!_ubicP[slug]) _ubicP[slug]=Promise.all(['articulos','estanterias'].map(n=>
      fetch(UBIC_SUC_URL+encodeURIComponent(slug)+'/'+n+'.json').then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })))
    .then(([arts,ests])=>({arts:arts||{}, ests:ests||{}}))
    .catch(e=>{ delete _ubicP[slug]; throw e; });
  return _ubicP[slug];
}
async function datosRecorrido(d,opts){
  let U; try{ U=await ubicaciones(opts); }catch(e){ U={arts:{},ests:{},error:1}; }
  return armarRecorrido(d,opts.slug,U);
}
// Agrupa el F8 por artículo y lo ordena por estantería/módulo (misma lógica que la pestaña F8s del
// Buscador: cruce por Id.item y, de respaldo, por código; la primera ubicación en el orden de las estanterías)
function armarRecorrido(d,slug,U){
  const byId={}, byCod={};
  for(const k in U.arts){ const a=U.arts[k]; if(!a) continue;
    if(a.articulo) byId[String(a.articulo).trim()]=a;
    if(a.codigo) byCod[String(a.codigo).replace(/\s+/g,'').toUpperCase()]=a; }
  const zonas=DEPOSITOS[slug]||null;
  const numEst=e=>{ const n=parseInt(String((e&&e.nombre)||'').replace(/\D+/g,''),10); return isNaN(n)?9999:n; };
  const pisoDe=e=>{ if(!zonas) return ''; const n=numEst(e); const z=zonas.find(z=>n>=z.desde&&n<=z.hasta); return z?z.nombre:''; };
  const ord=v=>v!=null&&isFinite(+v)?+v:99;
  const porCod=new Map();
  (Array.isArray(d.lineas)?d.lineas:Object.values(d.lineas||{})).forEach(L=>{
    if(!L) return;
    const c=String(L.c||'').trim(); if(!c) return;
    const g=porCod.get(c)||{c, a:String(L.a||'').trim(), ds:L.ds||'', m:L.m||'', cant:0, todo:false, dest:[]};
    let de=g.dest.find(x=>x.d===String(L.d||''));
    if(!de){ de={d:String(L.d||''), n:0, todo:false, tt:[]}; g.dest.push(de); }
    if(L.todo){ de.todo=true; g.todo=true; } else { de.n+=+L.t||0; g.cant+=+L.t||0; }
    tallesDe(d,L).forEach(([t,n])=>{ const x=de.tt.find(p=>p[0]===t); if(x) x[1]+=n; else de.tt.push([t,n]); });
    if(!g.ds&&L.ds) g.ds=L.ds; if(!g.m&&L.m) g.m=L.m;
    porCod.set(c,g);
  });
  const grupos=new Map(), sinUbicar=[], noEsta=[];
  porCod.forEach(g=>{
    const art=(g.a&&byId[g.a])||byCod[g.c.replace(/\s+/g,'').toUpperCase()]||null;
    g.art=art;
    if(!art){ noEsta.push(g); return; }
    if(!g.ds) g.ds=art.descripcion||'';
    const ubs=Object.values(art.ubicaciones||{}).map(u=>{
      const e=u&&U.ests[u.estanteriaId]; if(!e) return null;
      const m=e.modulos&&e.modulos[u.moduloId];
      return {eid:u.estanteriaId, e, mod:m?m.nombre:'', oe:ord(e.orden), ne:numEst(e), om:ord(m&&m.orden), piso:pisoDe(e)};
    }).filter(Boolean).sort((x,y)=>x.oe-y.oe||x.ne-y.ne||x.om-y.om);
    if(!ubs.length){ sinUbicar.push(g); return; }
    g.u=ubs[0]; g.otras=ubs.slice(1).map(u=>u.e.nombre+(u.mod?' · '+u.mod:''));
    if(!grupos.has(g.u.eid)) grupos.set(g.u.eid,{e:g.u.e, piso:g.u.piso, oe:g.u.oe, ne:g.u.ne, items:[]});
    grupos.get(g.u.eid).items.push(g);
  });
  const lista=[...grupos.values()].sort((x,y)=>x.oe-y.oe||x.ne-y.ne);
  lista.forEach(gr=>gr.items.sort((x,y)=>x.u.om-y.u.om||x.c.localeCompare(y.c)));
  sinUbicar.sort((x,y)=>x.c.localeCompare(y.c)); noEsta.sort((x,y)=>x.c.localeCompare(y.c));
  const vals=[...porCod.values()];
  return {grupos:lista, sinUbicar, noEsta, zonas, error:!!U.error, conStock:Object.keys(U.arts).length>0,
    arts:vals.length, unidades:vals.reduce((s,g)=>s+g.cant,0), todos:vals.filter(g=>g.todo).length};
}
// Stock por talle de la última carga del Buscador, todos los talles y en el orden de la tarjeta en
// pantalla: [[talle, stock, lo pide el F8]]
function stockTalles(g){
  const pedidos=new Set(g.dest.flatMap(x=>x.tt.map(p=>p[0])));
  return Object.values((g.art&&g.art.talles)||{}).filter(x=>x&&x.t!=null&&!/^total$/i.test(String(x.t)))
    .map(x=>{ const t=String(x.t).trim(); return [t, +x.c||0, pedidos.has(t)]; });
}
function cantTxt(g){ return g.todo ? (g.cant>0 ? g.cant+' + Todo' : 'Todo') : String(g.cant); }
function destNombre(x){ return x.todo ? x.d.replace(/^todo\s+/i,'') : x.d; }
function ordenTxt(R){ return R.zonas ? ' — primero '+R.zonas.map(z=>z.nombre).join(', después ') : ''; }
function notaNoEsta(R){
  return R.error ? 'No se pudo leer el Buscador de Artículos (¿sin conexión?): el recorrido sale sin ubicaciones.'
    : R.conStock ? 'No aparecen en la última carga de stock de la sucursal en el Buscador: revisá si se vendieron o si el stock del sistema no coincide.'
    : 'La sucursal todavía no cargó su stock en el Buscador de Artículos, así que el recorrido sale sin ubicaciones.';
}

const _abiertos={};   // id → {d, opts}: el botón «Descargar Excel» de la ventana del recorrido vuelve acá
async function abrirRecorrido(d,opts){
  if(!d) return;
  // la ventana se abre YA (dentro del clic) para que el navegador no la bloquee
  const w=window.open('','_blank');
  if(!w){ alert('El navegador bloqueó la ventana nueva. Permití las ventanas emergentes para el portal y probá de nuevo.'); return; }
  w.document.write('<!doctype html><meta charset="utf-8"><title>Recorrido F8</title><body style="font-family:Arial,sans-serif;padding:40px;color:#0B1527">Armando el recorrido con las ubicaciones de tu depósito…</body>');
  const R=await datosRecorrido(d,opts);
  const clave=String(d.id||'').replace(/[^\w-]/g,'');
  _abiertos[clave]={d,opts};
  w.document.open(); w.document.write(recorridoHtml(d,opts,R,clave)); w.document.close();
  marcar(opts);
}
function recorridoHtml(d,opts,R,clave){
  const suc=nombreSuc(opts);
  // un renglón por destino con Destino · Cant. · Talles, como la tabla del F8; los datos del artículo
  // ocupan todos sus renglones (rowspan) y el bloque no se corta entre páginas
  const fila=(g,mod)=>{
    const st=stockTalles(g), dests=g.dest.length?g.dest:[{d:'—',n:0,todo:false,tt:[]}];
    const rs=dests.length>1?' rowspan="'+dests.length+'"':'';
    const art='<td class="chk"'+rs+'></td>'+(mod!==null?'<td class="mod"'+rs+'>'+esc(mod||'—')+'</td>':'')
      +'<td class="cod"'+rs+'>'+esc(g.c)+(g.a?'<div class="id">#'+esc(g.a)+'</div>':'')+'</td>'
      +'<td'+rs+'>'+esc(g.ds||'')+(g.m?' <span class="gris">'+esc(g.m)+'</span>':'')+(g.otras&&g.otras.length?'<div class="gris">También en: '+esc(g.otras.join(' / '))+'</div>':'')+'</td>'
      +'<td class="cant"'+rs+'>'+esc(cantTxt(g))+'</td>';
    const stk='<td class="stk"'+rs+'>'+(g.art?'<b>'+esc(String(g.art.stock==null?'':g.art.stock))+'</b>'+(st.length?'<div class="tchs">'+st.map(([t,n,p])=>'<span class="tch'+(n<=0?' cero':'')+(p?' ped':'')+'">'+esc(t)+' <b>'+n+'</b></span>').join('')+'</div>':''):'—')+'</td>';
    return '<tbody class="art">'+dests.map((x,i)=>'<tr>'+(i?'':art)
      +'<td class="dest">'+esc(destNombre(x))+'</td>'
      +'<td class="cant2">'+(x.todo&&!x.n?'Todo':x.n)+'</td>'
      +'<td class="tll">'+(x.todo?'<span class="todo">TODO lo que haya</span>':(x.tt.length?esc(tallesTxt(x.tt)):'<span class="gris">—</span>'))+'</td>'
      +(i?'':stk)+'</tr>').join('')+'</tbody>';
  };
  const thead=mod=>'<thead><tr><th class="chk">OK</th>'+(mod?'<th>Módulo</th>':'')+'<th>Código</th><th>Descripción</th><th>Retirar</th><th>Destino</th><th>Cant.</th><th>Talles</th><th>Stock</th></tr></thead>';
  let body='';
  R.grupos.forEach(gr=>{
    body+='<h2>'+esc(gr.e.nombre)+(gr.piso?' <span class="piso">'+esc(gr.piso)+'</span>':'')+' <span class="n">'+gr.items.length+' art.</span></h2>'
      +'<table>'+thead(true)+gr.items.map(g=>fila(g,g.u.mod)).join('')+'</table>';
  });
  if(R.sinUbicar.length) body+='<h2 class="alerta">Sin ubicar en el Buscador <span class="n">'+R.sinUbicar.length+' art.</span></h2>'
    +'<p class="nota">Están en tu stock pero no tienen estantería asignada: buscalos en el depósito.</p>'
    +'<table>'+thead(false)+R.sinUbicar.map(g=>fila(g,null)).join('')+'</table>';
  if(R.noEsta.length) body+='<h2 class="alerta">'+(R.conStock?'No están en el stock del Buscador':'Sin ubicaciones')+' <span class="n">'+R.noEsta.length+' art.</span></h2>'
    +'<p class="nota">'+esc(notaNoEsta(R))+'</p>'
    +'<table>'+thead(false)+R.noEsta.map(g=>fila(g,null)).join('')+'</table>';
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    +'<title>Recorrido F8 '+esc(fechaTxt(d.fecha,'-'))+' - '+esc(suc)+'</title><style>'
    +'body{font-family:Arial,Helvetica,sans-serif;color:#0B1527;margin:0;background:#f5f7fc}'
    +'.bar{position:sticky;top:0;z-index:2;background:#0B1527;border-bottom:3px solid #CC0000;padding:10px 16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}'
    +'.bar b{color:#fff;font-size:14px;margin-right:auto}'
    +'.bar button{border:0;border-radius:7px;padding:9px 14px;font-weight:700;font-size:13px;cursor:pointer;background:#fff;color:#0B1527}.bar button.pri{background:#CC0000;color:#fff}'
    +'.hoja{max-width:1120px;margin:0 auto;background:#fff;padding:22px 26px 30px}'
    +'.cab{display:flex;align-items:center;gap:18px;border-bottom:3px solid #0B1527;padding-bottom:10px}.cab img{height:58px}'
    +'h1{font-size:20px;margin:0}.sub{font-size:12px;color:#44506a;margin-top:3px}.ley{font-size:11px;color:#44506a;margin:8px 0 4px}'
    +'h2{font-size:14px;margin:18px 0 5px;padding:5px 8px;background:#0B1527;color:#fff;border-radius:4px;page-break-after:avoid}'
    +'h2 .n{font-weight:400;opacity:.75;font-size:12px}h2 .piso{background:#CC0000;border-radius:3px;padding:1px 6px;font-size:11px;margin-left:4px}h2.alerta{background:#8a5a00}'
    +'.nota{font-size:11px;color:#44506a;margin:0 0 5px}'
    +'table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #9aa3b5;padding:5px 7px;text-align:left;vertical-align:top}'
    +'th{background:#e9edf5;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px}tr,tbody.art{page-break-inside:avoid}tbody.art{border-top:2px solid #0B1527}'
    +'.dest{white-space:nowrap;font-weight:700}.cant2{text-align:center;font-weight:700;white-space:nowrap}.tll{font-weight:700;font-size:12.5px;white-space:nowrap}'
    +'.chk{width:28px;text-align:center}.mod{white-space:nowrap;font-weight:700}.cod{font-family:Consolas,monospace;white-space:nowrap}'
    +'.id,.gris{color:#6b7a99;font-size:10.5px}.cant{text-align:center;font-weight:700;font-size:14px;white-space:nowrap}.stk{min-width:90px;max-width:260px}.cero{color:#CC0000;font-weight:700}'
    +'.tchs{margin-top:3px;line-height:1.7}.tch{display:inline-block;border:1px solid #c5ccd9;border-radius:4px;padding:0 5px;margin:0 3px 2px 0;font-size:10.5px;white-space:nowrap;color:#44506a}.tch b{color:#0B1527}'
    +'.tch.cero{background:#fdf1f1;border-color:#efb9b9;color:#b45454}.tch.cero b{color:#CC0000}.tch.ped{border:2px solid #0B1527;padding:0 4px}'
    +'.pdest{line-height:1.4}.pdest+.pdest{border-top:1px dotted #c5ccd9;margin-top:2px;padding-top:2px}.ptall{color:#44506a;font-size:11px}.todo{color:#CC0000;font-weight:700;font-size:11px}'
    +'.firmas{display:flex;gap:30px;margin-top:28px;font-size:12px}.firmas div{flex:1;border-top:1px solid #0B1527;padding-top:4px}'
    +'@media print{body{background:#fff}.bar{display:none}.hoja{max-width:none;padding:0}@page{size:A4 landscape;margin:10mm}}'
    +'</style></head><body>'
    +'<div class="bar"><b>Recorrido de armado · F8 del '+esc(fechaTxt(d.fecha))+'</b>'
    +'<button class="pri" onclick="window.print()">Imprimir / guardar PDF</button>'
    +'<button onclick="try{opener.F8Descargas._excelAbierto(\''+clave+'\')}catch(e){alert(\'Volvé a la pestaña del portal para bajar el Excel.\')}">Descargar Excel</button></div>'
    +'<div class="hoja"><div class="cab"><img src="'+LOGO+'" alt="Mateu Sports"><div>'
    +'<h1>Recorrido de armado — '+esc(suc)+'</h1>'
    +'<div class="sub">F8 del '+esc(fechaTxt(d.fecha))+' · '+esc(d.operador||'')+(d.hdr&&d.hdr.nro?' · '+esc(d.hdr.nro):'')
    +' · '+R.arts+' artículo'+(R.arts===1?'':'s')+' · '+R.unidades+' unidad'+(R.unidades===1?'':'es')+(R.todos?' + '+R.todos+' «todo lo que haya»':'')
    +' · en orden de estantería'+esc(ordenTxt(R))+'</div></div></div>'
    +'<div class="ley">Marcá OK cada artículo al juntarlo. Un renglón por destino con la cantidad y los talles, como en la tabla del F8 (40×2 = dos del 40). «TODO lo que haya» = mandar todo el stock de ese artículo. «Stock»: lo de tu última carga en el Buscador, talle por talle como en la pantalla (en rojo los que están en cero; con borde grueso, los que pide el F8).</div>'
    +(body||'<p class="nota">El F8 no tiene artículos.</p>')
    +'<div class="firmas"><div>Armó</div><div>Controló</div><div>Fecha</div></div>'
    +'</div></body></html>';
}
function armarRecorridoExcel(ExcelJS,d,opts,R){
  const suc=nombreSuc(opts);
  const wb=new ExcelJS.Workbook(); wb.creator='Portal Mateu Sports'; wb.created=new Date();
  const HR=4;
  const ws=wb.addWorksheet('Recorrido',{views:[{state:'frozen',ySplit:HR}],
    pageSetup:{orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:HR+':'+HR,
      margins:{left:.3,right:.3,top:.4,bottom:.4,header:.2,footer:.2}}});
  const NAVY='FF0B1527', BLA={argb:'FFFFFFFF'}, GRIS={argb:'FF6B7A99'};
  const sol=c=>({type:'pattern',pattern:'solid',fgColor:{argb:c}});
  const fino={style:'thin',color:{argb:'FFC5CCD9'}}, todo4={top:fino,left:fino,bottom:fino,right:fino};
  const cols=[['OK',5],['Ubicación',24],['Módulo',12],['Código',22],['Id.item',10],['Descripción',42],['Retirar',9],['Destino',20],['Unid.',7],['Talles',30],['Stock',8],['Stock por talle',36]];
  const N=cols.length;
  cols.forEach(([,w],i)=>{ ws.getColumn(i+1).width=w; });
  ws.mergeCells(1,1,1,N);
  const t1=ws.getCell(1,1); t1.value='RECORRIDO DE ARMADO — '+suc.toUpperCase();
  t1.font={name:'Calibri',size:16,bold:true,color:BLA}; t1.fill=sol(NAVY); t1.alignment={vertical:'middle'}; ws.getRow(1).height=28;
  ws.mergeCells(2,1,2,N);
  const t2=ws.getCell(2,1);
  t2.value='F8 del '+fechaTxt(d.fecha)+' · '+(d.operador||'')+(d.hdr&&d.hdr.nro?' · '+d.hdr.nro:'')+' · '+R.arts+' artículos · '+R.unidades+' unidades · en orden de estantería'+ordenTxt(R);
  t2.font={name:'Calibri',size:10,color:GRIS};
  ws.getRow(HR).height=20;
  cols.forEach(([t],i)=>{ const x=ws.getCell(HR,i+1); x.value=t; x.fill=sol(NAVY); x.font={name:'Calibri',size:10,bold:true,color:BLA}; x.alignment={horizontal:'center',vertical:'middle'}; x.border=todo4; });
  let r=HR;
  const seccion=(titulo,color,items,ubicTxt)=>{
    if(!items.length) return;
    r++; ws.mergeCells(r,1,r,N);
    const x=ws.getCell(r,1); x.value=titulo; x.fill=sol(color); x.font={name:'Calibri',size:11,bold:true,color:BLA}; ws.getRow(r).height=19;
    items.forEach(g=>{
      const st=stockTalles(g);
      g.dest.forEach((de,j)=>{
        r++;
        const vals=[ '', ubicTxt(g), g.u?(g.u.mod||''):'', g.c, num(g.a), g.ds||'', j?'':cantTxt(g),
          destNombre(de), de.todo&&!de.n?'TODO':de.n, tallesTxt(de.tt), j?'':(g.art?(+g.art.stock||0):''),
          j?'':st.map(([t,n,p])=>(p?'['+t+' '+n+']':t+' '+n)).join(' · ') ];
        vals.forEach((v,i)=>{
          const c=ws.getCell(r,i+1); c.value=v; c.border=todo4;
          c.alignment={vertical:'top',wrapText:i===5||i===9||i===11,horizontal:[0,6,8,10].includes(i)?'center':'left'};
          const f={name:'Calibri',size:11,bold:i===3||i===6};
          if(j && i>=1 && i<=5) f.color=GRIS;     // renglones extra del mismo artículo: los datos repetidos en gris
          c.font=f;
        });
        // primera fila de cada artículo con línea arriba más marcada
        if(!j) for(let c=1;c<=N;c++){ const x2=ws.getCell(r,c); x2.border=Object.assign({},x2.border,{top:{style:'medium',color:{argb:NAVY}}}); }
      });
    });
  };
  R.grupos.forEach(gr=>seccion(gr.e.nombre+(gr.piso?' · '+gr.piso:'')+' — '+gr.items.length+' art.', NAVY, gr.items,
    g=>g.u.e.nombre+(g.u.piso?' · '+g.u.piso:'')+(g.otras.length?' (también: '+g.otras.join(' / ')+')':'')));
  seccion('SIN UBICAR EN EL BUSCADOR — '+R.sinUbicar.length+' art. (están en el stock pero no tienen estantería)', 'FF8A5A00', R.sinUbicar, ()=>'SIN UBICAR');
  seccion((R.conStock?'NO ESTÁN EN EL STOCK DEL BUSCADOR':'SIN UBICACIONES')+' — '+R.noEsta.length+' art. · '+notaNoEsta(R), 'FF8A5A00', R.noEsta, ()=>'—');
  ws.autoFilter={from:{row:HR,column:1},to:{row:HR,column:N}};
  r+=3;
  ['Armó','Controló','Fecha'].forEach((t,i)=>{ const c=ws.getCell(r,2+i*4); c.value=t+': ______________________'; c.font={name:'Calibri',size:11}; });
  return wb;
}
async function recorridoExcel(d,opts){
  if(!d) return;
  const ExcelJS=await excelJS(); if(!ExcelJS) return;
  const R=await datosRecorrido(d,opts);
  await bajarXlsx(armarRecorridoExcel(ExcelJS,d,opts,R),'Recorrido F8 '+fechaTxt(d.fecha,'-')+' - '+nombreSuc(opts)+'.xlsx');
  marcar(opts);
}

window.F8Descargas={
  curvasDe, tallesDe, tallesTxt, descargarF8, abrirRecorrido, recorridoExcel,
  // para pruebas y para el botón de la ventana del recorrido
  armarF8, armarRecorrido, armarRecorridoExcel, recorridoHtml, datosRecorrido, loadExcelJS,
  _excelAbierto(clave){ const x=_abiertos[clave]; if(x) return recorridoExcel(x.d,x.opts); }
};
})();
