// Vara de convergencia del Reparto inicial (Juli 23/09/2026): por cada reparto guardado en
// `recepciones-mateu/barrida/repartos`, cuántas líneas (artículo × sucursal) y unidades quedaron
// distintas de la propuesta automática. Desde el 23/09 cada artículo editado guarda `auto` y `dif`
// (repDifAuto en barrida/index.html); los repartos anteriores solo dicen si el artículo se editó.
//   node scripts/editados-reparto.mjs            → últimos 30 días
//   node scripts/editados-reparto.mjs 90         → últimos 90 días
const ROOT='https://recepciones-mateu-default-rtdb.firebaseio.com/barrida';
const dias=parseInt(process.argv[2],10)||30;
const desde=new Date(Date.now()-dias*864e5).toISOString().slice(0,10);
const get=async p=>{ const r=await fetch(ROOT+p); if(!r.ok) throw new Error(r.status+' '+p); return r.json(); };
const keys=Object.keys(await get('/repartos.json?shallow=true')||{}).filter(k=>k.slice(0,10)>=desde).sort();
const pct=(a,b)=>b?(100*a/b).toFixed(0)+'%':'—';
console.log('Repartos guardados desde el '+desde+': '+keys.length+'\n');
const filas=[]; let tot={ lin:0, linEd:0, u:0, uEd:0, arts:0, artsEd:0 };
for(const k of keys){
  const b=await get('/repartos/'+k+'.json'); const m=b.meta||{}, rms=Object.values(b.remitos||{});
  let arts=0, artsEd=0, lin=0, linEd=0, u=0, uEd=0, conAuto=0; const marcas=new Set();
  rms.forEach(rm=>{ if(rm.marca) marcas.add(rm.marca); (rm.arts||[]).forEach(x=>{
    arts++; const ls=x.lineas||[]; lin+=ls.length; u+=ls.reduce((s,l)=>s+(l.t||[]).reduce((a,p)=>a+(p[1]||0),0),0);
    if(x.editado){ artsEd++; if(x.dif){ conAuto++; linEd+=x.dif.lineas||0; uEd+=x.dif.u||0; } else linEd+=ls.length; } }); });
  const f={ fecha:(m.fecha||k).slice(0,16).replace('T',' '), por:(m.por||'').split('@')[0], marcas:[...marcas].join(', ').slice(0,28), arts, artsEd, lin, linEd, u, uEd, medida: conAuto===artsEd ? 'línea a línea' : 'por artículo' };
  filas.push(f); tot.lin+=lin; tot.linEd+=linEd; tot.u+=u; tot.uEd+=uEd; tot.arts+=arts; tot.artsEd+=artsEd;
}
const cab=['fecha','por','marcas','arts','arts ed.','líneas','distintas','% líneas','unid.','u. movidas','% u.','medida'];
const rows=filas.map(f=>[f.fecha,f.por,f.marcas,f.arts,f.artsEd,f.lin,f.linEd,pct(f.linEd,f.lin),f.u,f.medida==='línea a línea'?f.uEd:'—',f.medida==='línea a línea'?pct(f.uEd,f.u):'—',f.medida]);
rows.push(['TOTAL','','',tot.arts,tot.artsEd,tot.lin,tot.linEd,pct(tot.linEd,tot.lin),tot.u,tot.uEd,pct(tot.uEd,tot.u),'']);
const w=cab.map((c,i)=>Math.max(c.length,...rows.map(r=>String(r[i]).length)));
console.log(cab.map((c,i)=>c.padEnd(w[i])).join('  ')); rows.forEach(r=>console.log(r.map((c,i)=>String(c).padEnd(w[i])).join('  ')));
console.log('\n«por artículo» = reparto anterior al 23/09: sin la propuesta guardada, un artículo editado cuenta con todas sus líneas.');
