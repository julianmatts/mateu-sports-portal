/* ============================================================
   EQUIPO DE LA SUCURSAL — padrón único de personas (shell)
   ------------------------------------------------------------
   Fuente de verdad: `rrhh/legajos/<legajoId>` (base discontinuos-mateu).
   Índice por sucursal para que cada local baje SOLO lo suyo (seguridad
   blanda, como Objetivos/Barrida): `rrhh/equipo/<slug>/<legajoId>` =
   resumen del legajo {nombre, puesto, regimen, estado, alias[], pendiente…}.
   RRHH regenera el índice completo después de cada escritura a legajos
   (`Equipo.reconstruir`); las altas/bajas/alias hechas desde Mi Sucursal
   escriben legajo + índice juntos en un PATCH multi-path.

   IDENTIDAD: la clave de una persona es SIEMPRE el legajoId. Nunca se
   deriva del nombre. El nombre con que aparece en el sistema de ventas
   (p.ej. "CASAO KEVIN ARMANDO M.") se guarda como ALIAS del legajo la
   primera vez (con confirmación humana; `Equipo.resolver` sugiere el match
   con el algoritmo difuso) y de ahí en más el cruce es exacto.

   Uso (en cualquier módulo, después de incluir este script):
     const gente = await Equipo.cargar(slug);            // [{id, nombre, puesto, regimen, estado, alias:[], rol, grupo, pendiente}]
     const r = Equipo.resolver('GARCIA LAUTARO TOMAS', gente); // {persona, exacto, sugerida, score}
     await Equipo.vincular(slug, id, 'GARCIA LAUTARO TOMAS');
     await Equipo.alta(slug, {nombre, puesto, regimen, ingreso}, por);
     await Equipo.baja(slug, id, {fecha, motivo}, por);
   ============================================================ */
(function(){
  'use strict';
  if(window.Equipo) return;

  const DB   = 'https://discontinuos-mateu-default-rtdb.firebaseio.com';
  const ROOT = 'rrhh';

  const PUESTOS   = ['Encargado/a','Subencargado/a','Vendedor/a','Cajero/a','Depósito','Administrativo/a','Gerencia','Otro'];
  const REGIMENES = ['Full Time','Part Time'];
  // orden de presentación por puesto (jefatura primero)
  const ORDEN_PUESTO = {'Encargado/a':1,'Subencargado/a':2,'Vendedor/a':3,'Cajero/a':4,'Depósito':5,'Administrativo/a':6,'Gerencia':7,'Otro':8};

  /* ---------- normalización de nombres ---------- */
  const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const titleCase = s => String(s||'').toLowerCase().replace(/(^|[\s'’.\-])([a-záéíóúñü])/g,(m,p,c)=>p+c.toUpperCase());
  const iniciales = n => { const w=String(n||'').trim().split(/\s+/).filter(Boolean); return w.length ? (w[0][0]+(w.length>1?w[w.length-1][0]:'')).toUpperCase() : '?'; };

  // match difuso por tokens (el mismo criterio que usaba Indicadores para pegar
  // la venta al equipo): tolera orden invertido, sufijos de rol y UNA letra de
  // diferencia por token. Acá solo SUGIERE: el vínculo lo confirma una persona.
  const STOP = ['full','cubre','cobertura','refuerzo','refuerzos','vend','vendedor','vendedora',
    'sub','enc','encargado','encargada','cajera','cajero','caja','deposito','pt','ft','hs','part',
    'parttime','manana','tarde','noche','medio','jornada','franco','vac','licencia'];
  const tokens = s => norm(s).split(' ').filter(t=>t.length>1 && !/^\d/.test(t) && !STOP.includes(t));
  function tokSim(a,b){
    if(a===b) return true;
    if(a.length<4 || b.length<4 || Math.abs(a.length-b.length)>1) return false;
    let i=0, j=0, dif=0;
    while(i<a.length && j<b.length){
      if(a[i]===b[j]){ i++; j++; continue; }
      if(++dif>1) return false;
      if(a.length>b.length) i++; else if(b.length>a.length) j++; else { i++; j++; }
    }
    return dif + (a.length-i) + (b.length-j) <= 1;
  }
  function score(a,b){
    const ta=tokens(a), tb=tokens(b);
    if(!ta.length || !tb.length) return 0;
    const comunes=ta.filter(t=>tb.some(u=>tokSim(t,u))).length;
    if(comunes>=2) return comunes + ((comunes===ta.length||comunes===tb.length)?1:0);
    if(comunes===1 && (ta.length===1||tb.length===1) && Math.max(...ta.map(t=>t.length))>=4) return 1;
    return 0;
  }

  /* ---------- puesto → rol / grupo (compatibilidad con los módulos) ---------- */
  function rolDe(puesto){
    const p=String(puesto||'');
    if(/encargad/i.test(p)) return 'encargado';
    if(/vended/i.test(p)) return 'vendedor';
    if(/cajer/i.test(p)) return 'cajera';
    if(/dep[oó]sito/i.test(p)) return 'deposito';
    return 'otro';
  }
  function grupoDe(puesto){
    const p=String(puesto||'');
    if(/encargad/i.test(p)) return 'Jefatura';
    if(/vended/i.test(p)) return 'Ventas';
    if(/cajer/i.test(p)) return 'Caja';
    if(/dep[oó]sito/i.test(p)) return 'Refuerzos';
    return 'Otros';
  }
  // texto tipo "Vend. Full Time" (el `sector` del ETL) para las pantallas que lo muestran
  function sectorDe(p){
    const r=rolDe(p.puesto);
    const pre = r==='encargado' ? (/sub/i.test(p.puesto||'')?'Sub Encargado':'Encargado')
      : r==='vendedor' ? 'Vend.' : r==='cajera' ? 'Caj.' : r==='deposito' ? 'Depósito' : (p.puesto||'');
    return (r==='vendedor'||r==='cajera') ? pre+' '+(p.regimen||'Full Time') : pre;
  }

  /* ---------- Firebase REST ---------- */
  const url = path => DB+'/'+path.split('/').map(encodeURIComponent).join('/')+'.json';
  async function get(path){ const r=await fetch(url(path)); if(!r.ok) throw new Error('Firebase HTTP '+r.status); return r.json(); }
  async function put(path, data){ const r=await fetch(url(path),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); if(!r.ok) throw new Error('Firebase HTTP '+r.status); return r.json(); }
  async function patch(path, data){ const r=await fetch(url(path),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); if(!r.ok) throw new Error('Firebase HTTP '+r.status); return r.json(); }
  async function post(path, data){ const r=await fetch(url(path),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); if(!r.ok) throw new Error('Firebase HTTP '+r.status); return r.json(); }
  const nowISO = () => { const d=new Date(), p=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes()); };
  const hoyISO = () => nowISO().slice(0,10);

  /* ---------- resumen de legajo → entrada del índice ---------- */
  const aliasArr = a => Array.isArray(a) ? a.filter(Boolean) : (a && typeof a==='object' ? Object.values(a).filter(Boolean) : []);
  function resumen(l){
    const o = {
      nombre: l.nombre||'', puesto: l.puesto||'Otro', regimen: l.regimen||'', estado: l.estado||'activo',
      sucursal: l.sucursal||null, alias: aliasArr(l.alias).map(norm).filter(Boolean),
      pendiente: !!l.pendiente, ingreso: l.ingreso||null, legajo_nro: l.legajo_nro||'',
    };
    if(o.estado==='baja') o.baja_fecha = l.baja_fecha||null;
    return o;
  }
  // índice completo {slug:{id:resumen}} desde el nodo de legajos
  function indice(legajos){
    const out={};
    Object.entries(legajos||{}).forEach(([id,l])=>{
      if(!l || !l.sucursal) return;   // sin sucursal no pertenece a ningún equipo
      (out[l.sucursal]=out[l.sucursal]||{})[id]=resumen(l);
    });
    return out;
  }
  // entrada del índice → persona para los módulos
  function persona(id, rec){
    const p = {id, ...rec, alias: aliasArr(rec.alias)};
    p.rol = rolDe(p.puesto); p.grupo = grupoDe(p.puesto); p.sector = sectorDe(p);
    return p;
  }
  function ordenar(list){
    return list.slice().sort((a,b)=> ((a.estado==='baja')-(b.estado==='baja'))
      || ((ORDEN_PUESTO[a.puesto]||9)-(ORDEN_PUESTO[b.puesto]||9))
      || String(a.nombre).localeCompare(String(b.nombre),'es'));
  }

  /* ---------- lectura ---------- */
  const _cache={};
  function cargar(slug, opts){
    if(!slug) return Promise.resolve([]);
    if(!(opts&&opts.fresh) && _cache[slug]) return _cache[slug];
    _cache[slug] = get(ROOT+'/equipo/'+slug).then(o=> ordenar(Object.entries(o||{}).map(([id,rec])=>persona(id,rec))))
      .catch(()=>[]);
    return _cache[slug];
  }
  async function cargarTodas(){
    const o = await get(ROOT+'/equipo').catch(()=>null);
    const out={};
    Object.entries(o||{}).forEach(([slug,m])=>{ out[slug]=ordenar(Object.entries(m||{}).map(([id,rec])=>persona(id,rec))); _cache[slug]=Promise.resolve(out[slug]); });
    return out;
  }
  const activos = list => (list||[]).filter(p=>p.estado!=='baja');
  const limpiar = slug => { if(slug) delete _cache[slug]; else Object.keys(_cache).forEach(k=>delete _cache[k]); };

  /* ---------- identidad: alias y match ---------- */
  // todas las formas normalizadas con que se conoce a la persona (nombre + alias)
  const clavesDe = p => { const s=new Set(); const n=norm(p.nombre); if(n) s.add(n); (p.alias||[]).forEach(a=>{ const k=norm(a); if(k) s.add(k); }); return s; };
  // mapa exacto clave→persona
  function mapa(list){
    const m=new Map();
    (list||[]).forEach(p=>clavesDe(p).forEach(k=>{ if(!m.has(k)) m.set(k,p); }));
    return m;
  }
  // Resuelve un nombre (del sistema de ventas, del Excel PMS, de un equipo viejo):
  //  · exacto por nombre/alias → {persona, exacto:true}
  //  · si no, la mejor sugerencia difusa → {persona:null, sugerida, score}
  // `usados` (Set de ids) evita sugerir dos veces a la misma persona.
  function resolver(nombre, list, usados){
    const k=norm(nombre);
    if(!k) return {persona:null, exacto:false, sugerida:null, score:0};
    const m = list._mapa || (list._mapa = mapa(list));
    const ex = m.get(k);
    if(ex && !(usados && usados.has(ex.id))) return {persona:ex, exacto:true, sugerida:null, score:99};
    let best=null, bs=0;
    (list||[]).forEach(p=>{
      if(usados && usados.has(p.id)) return;
      let sc=0; clavesDe(p).forEach(c=>{ const s=score(nombre, c); if(s>sc) sc=s; });
      if(p.estado==='baja') sc-=0.5;   // preferir activos ante empate
      if(sc>bs){ bs=sc; best=p; }
    });
    return {persona:null, exacto:false, sugerida: bs>0?best:null, score:bs};
  }
  // Pega una lista de nombres a las personas (cada persona a lo sumo una vez, los
  // exactos primero): devuelve [{nombre, persona|null, exacto, sugerida, score}]
  function resolverTodos(nombres, list){
    const usados=new Set(), out=nombres.map(n=>({nombre:n}));
    out.forEach(o=>{ const r=resolver(o.nombre, list, usados); if(r.exacto){ o.persona=r.persona; o.exacto=true; usados.add(r.persona.id); } });
    out.forEach(o=>{ if(o.persona) return; const r=resolver(o.nombre, list, usados); o.persona=null; o.exacto=false; o.sugerida=r.sugerida; o.score=r.score; });
    return out;
  }

  /* ---------- escrituras desde la sucursal (legajo + índice juntos) ---------- */
  async function vincular(slug, id, nombreVentas){
    const k=norm(nombreVentas); if(!k || !id || !slug) return null;
    const l = await get(ROOT+'/legajos/'+id);
    if(!l) throw new Error('No existe el legajo '+id);
    const alias = aliasArr(l.alias).map(norm).filter(Boolean);
    if(!alias.includes(k) && k!==norm(l.nombre)) alias.push(k);
    const upd={}; upd['legajos/'+id+'/alias']=alias; upd['legajos/'+id+'/actualizado']=nowISO();
    const s=l.sucursal||slug; upd['equipo/'+s+'/'+id]=resumen({...l, alias});
    await patch(ROOT, upd); limpiar(s); if(s!==slug) limpiar(slug);
    return alias;
  }
  async function desvincular(slug, id, aliasTxt){
    const k=norm(aliasTxt); const l = await get(ROOT+'/legajos/'+id); if(!l) return;
    const alias = aliasArr(l.alias).map(norm).filter(a=>a && a!==k);
    const upd={}; upd['legajos/'+id+'/alias']=alias; upd['legajos/'+id+'/actualizado']=nowISO();
    const s=l.sucursal||slug; upd['equipo/'+s+'/'+id]=resumen({...l, alias});
    await patch(ROOT, upd); limpiar(s);
  }
  // Alta hecha por el encargado: entra al padrón YA (para que el equipo semanal, el
  // Buscador y la Academia la vean), marcada `pendiente` hasta que RRHH la valide.
  async function alta(slug, datos, por){
    const nombre=titleCase(String(datos.nombre||'').trim()); if(!nombre||!slug) throw new Error('Falta el nombre');
    const data={ nombre, sucursal:slug, puesto:datos.puesto||'Vendedor/a', regimen:datos.regimen||'Full Time',
      ingreso:datos.ingreso||hoyISO(), estado:'activo', pendiente:true, origen:'sucursal', alta_por:por||'',
      alias: aliasArr(datos.alias).map(norm).filter(Boolean), creado:nowISO(), actualizado:nowISO() };
    const r=await post(ROOT+'/legajos', data); const id=r.name;
    await put(ROOT+'/equipo/'+slug+'/'+id, resumen(data)); limpiar(slug);
    return persona(id, resumen(data));
  }
  async function baja(slug, id, datos, por){
    const l=await get(ROOT+'/legajos/'+id); if(!l) throw new Error('No existe el legajo');
    const upd={};
    const nl={...l, estado:'baja', baja_fecha:(datos&&datos.fecha)||hoyISO(), baja_motivo:(datos&&datos.motivo)||'Otro', baja_obs:(datos&&datos.obs)||'', baja_por:por||'', actualizado:nowISO()};
    ['estado','baja_fecha','baja_motivo','baja_obs','baja_por','actualizado'].forEach(k=>upd['legajos/'+id+'/'+k]=nl[k]);
    const s=l.sucursal||slug; upd['equipo/'+s+'/'+id]=resumen(nl);
    await patch(ROOT, upd); limpiar(s);
  }
  // Edición acotada desde la sucursal (puesto / régimen / nombre): RRHH mantiene lo legal.
  async function editar(slug, id, datos, por){
    const l=await get(ROOT+'/legajos/'+id); if(!l) throw new Error('No existe el legajo');
    const nl={...l};
    if(datos.nombre) nl.nombre=titleCase(String(datos.nombre).trim());
    if(datos.puesto) nl.puesto=datos.puesto;
    if(datos.regimen) nl.regimen=datos.regimen;
    if(datos.ingreso!==undefined) nl.ingreso=datos.ingreso||null;
    nl.actualizado=nowISO(); nl.editado_por=por||'';
    const upd={};
    ['nombre','puesto','regimen','ingreso','actualizado','editado_por'].forEach(k=>upd['legajos/'+id+'/'+k]=nl[k]===undefined?null:nl[k]);
    const s=l.sucursal||slug; upd['equipo/'+s+'/'+id]=resumen(nl);
    await patch(ROOT, upd); limpiar(s);
    return persona(id, resumen(nl));
  }
  // Regenera el índice completo desde legajos (lo llama RRHH tras cada escritura).
  async function reconstruir(legajos){
    const full = legajos || (await get(ROOT+'/legajos')) || {};
    const idx = indice(full);
    await put(ROOT+'/equipo', idx); limpiar();
    return idx;
  }

  window.Equipo = { DB, ROOT, PUESTOS, REGIMENES, ORDEN_PUESTO,
    norm, titleCase, iniciales, tokens, score, rolDe, grupoDe, sectorDe,
    resumen, indice, persona, ordenar,
    cargar, cargarTodas, activos, limpiar,
    clavesDe, mapa, resolver, resolverTodos,
    vincular, desvincular, alta, baja, editar, reconstruir,
    _get:get, _put:put, _patch:patch };
})();
