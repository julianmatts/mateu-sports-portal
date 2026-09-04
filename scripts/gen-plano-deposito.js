#!/usr/bin/env node
/* ============================================================================
   Generador del plano del depósito central  ·  Portal Mateu Sports
   ----------------------------------------------------------------------------
   Convierte "plano deposito.xlsx" (dos hojas: Planta baja / Planta alta, donde
   cada área o góndola es una celda combinada ubicada por posición) en el asset
   picking/plano-deposito.js que consume el módulo de Picking para:
     - dibujar el mapa físico del depósito (mini-mapa por planta), y
     - sembrar las ZONAS de recorrido reales (góndolas + áreas de reserva) con
       su rectángulo en el plano y un orden de recorrido por defecto.

   Uso:
     node scripts/gen-plano-deposito.js "C:/Users/julia/Downloads/plano deposito.xlsx"

   Escribe picking/plano-deposito.js con:
     window.PLANO_DEPOSITO = {
       generado, fuente,
       plantas: [ {id,nombre,filas,cols, celdas:[{label,tipo,r0,r1,c0,c1}]} ],
       zonas:   [ {id,nombre,planta,tipo,r0,r1,c0,c1,orden} ]   // reserva, pickeables
     }

   Self-contained: solo 'fs' y 'zlib' (un .xlsx es un zip con XML). Sin npm.
   ========================================================================== */
'use strict';
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

// ---------- mini-unzip (igual que gen-maestro-adidas.js) --------------------
function readZip(buf){
  let eocd = -1;
  for(let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--){
    if(buf.readUInt32LE(i) === 0x06054b50){ eocd = i; break; }
  }
  if(eocd < 0) throw new Error('No es un .xlsx válido (no encuentro el EOCD).');
  const cdCount = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const files = {};
  for(let n = 0; n < cdCount; n++){
    if(buf.readUInt32LE(off) !== 0x02014b50) break;
    const method   = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const fnLen    = buf.readUInt16LE(off + 28);
    const exLen    = buf.readUInt16LE(off + 30);
    const cmLen    = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name     = buf.toString('utf8', off + 46, off + 46 + fnLen);
    files[name] = {method, compSize, localOff};
    off += 46 + fnLen + exLen + cmLen;
  }
  return {buf, files};
}
function extract(zip, name){
  const f = zip.files[name];
  if(!f) return null;
  const b = zip.buf;
  const fnLen = b.readUInt16LE(f.localOff + 26);
  const exLen = b.readUInt16LE(f.localOff + 28);
  const start = f.localOff + 30 + fnLen + exLen;
  const comp  = b.subarray(start, start + f.compSize);
  if(f.method === 0) return comp;
  if(f.method === 8) return zlib.inflateRawSync(comp);
  throw new Error('Método de compresión no soportado: '+f.method);
}
function decode(s){
  return (s||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#10;/g,' ')
    .replace(/&#13;/g,'').replace(/&apos;/g,"'");
}
function parseShared(xml){
  const out = [];
  (xml||'').replace(/<si>([\s\S]*?)<\/si>/g, (m, inner) => {
    let t = '';
    inner.replace(/<t[^>]*>([\s\S]*?)<\/t>/g, (x, y) => { t += y; return x; });
    out.push(decode(t));
    return m;
  });
  return out;
}
function colToNum(c){ let n=0; for(let i=0;i<c.length;i++) n=n*26+(c.charCodeAt(i)-64); return n-1; }
const clean = s => (s||'').replace(/\s+/g,' ').trim();

// ---------- clasificación de cada área --------------------------------------
// servicio  = no es depósito (baño, cocina, oficina, pc, mesa, archivo…)
// operacion = flujo de mercadería, no se pickea de ahí (recepción, apilado, box)
// reserva   = se pickea (góndolas, jaula, ruge, envío) -> zona de recorrido
function clasificar(label){
  const s = label.toUpperCase();
  if(/^\d+$/.test(s)) return 'servicio'; // marcas sueltas de columnas/escaleras
  if(/BA[ÑN]O|COCINA|ENTRADA|OFICINA|^PC$|MESA|ARCHIVO|LIMPIEZA/.test(s)) return 'servicio';
  if(/RECEPCI[ÓO]N|APILADO|^BOX/.test(s)) return 'operacion';
  return 'reserva';
}
// orden natural: góndolas por su número; el resto al final, por nombre
function numGondola(label){ const m = label.match(/GONDOLA\s+(\d+)/i); return m ? parseInt(m[1],10) : null; }

function leerHoja(zip, target, shared, plantaId){
  const p = 'xl/' + target.replace(/^\/?xl\//,'').replace(/^\//,'');
  const xml = (extract(zip, p) || extract(zip, 'xl/'+target) || Buffer.from('')).toString('utf8');
  // merges: mapa "r,c" (celda superior-izquierda) -> rango
  const merges = {};
  xml.replace(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g, (m,c0,r0,c1,r1)=>{
    merges[(+r0-1)+','+colToNum(c0)] = {r0:+r0-1, r1:+r1-1, c0:colToNum(c0), c1:colToNum(c1)};
    return m;
  });
  let filas = 0, cols = 0;
  const celdas = [];
  xml.replace(/<c\b[^>]*r="([A-Z]+)(\d+)"(?:[^>]*t="([^"]*)")?[^>]*>(?:<v>([\s\S]*?)<\/v>|<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>)?<\/c>/g,
    (x, col, row, typ, val, inl) => {
      let v = inl !== undefined ? decode(inl) : val;
      if(typ === 's' && val !== undefined) v = shared[parseInt(val,10)];
      v = clean(v);
      if(!v) return x;
      // En planta alta los números sueltos son góndolas (5 y 6 vienen sin la palabra "GONDOLA")
      if(plantaId === 'alta' && /^\d+$/.test(v)) v = 'GONDOLA ' + v;
      const c = colToNum(col), r = parseInt(row,10)-1;
      const mg = merges[r+','+c] || {r0:r, r1:r, c0:c, c1:c};
      celdas.push({label:v, tipo:clasificar(v), r0:mg.r0, r1:mg.r1, c0:mg.c0, c1:mg.c1});
      if(mg.r1+1 > filas) filas = mg.r1+1;
      if(mg.c1+1 > cols) cols = mg.c1+1;
      return x;
    });
  return {filas, cols, celdas};
}

function main(){
  const xlsxPath = process.argv[2] || 'C:/Users/julia/Downloads/plano deposito.xlsx';
  console.error('Leyendo', xlsxPath, '…');
  const zip = readZip(fs.readFileSync(xlsxPath));
  const shared = parseShared((extract(zip,'xl/sharedStrings.xml')||Buffer.from('')).toString('utf8'));
  const wb = (extract(zip,'xl/workbook.xml')||Buffer.from('')).toString('utf8');
  const rels = (extract(zip,'xl/_rels/workbook.xml.rels')||Buffer.from('')).toString('utf8');
  const relMap = {};
  rels.replace(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g, (m,id,t)=>{ relMap[id]=t; return m; });
  const hojas = [];
  wb.replace(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g, (m,name,rid)=>{ hojas.push({name, target:relMap[rid]}); return m; });

  const slugPlanta = n => /alta/i.test(n) ? 'alta' : (/baja/i.test(n) ? 'baja' : n.toLowerCase().replace(/[^a-z0-9]+/g,'-'));
  const plantas = hojas.map(h => {
    const id = slugPlanta(h.name);
    const {filas, cols, celdas} = leerHoja(zip, h.target, shared, id);
    return {id, nombre:h.name, filas, cols, celdas};
  });

  // Zonas pickeables (reserva): agrupadas por (planta,label) -> bounding box
  const grupos = {};
  plantas.forEach(pl => {
    pl.celdas.filter(c=>c.tipo==='reserva').forEach(c=>{
      const key = pl.id+'|'+c.label;
      if(!grupos[key]) grupos[key] = {planta:pl.id, nombre:c.label, tipo:c.tipo, r0:c.r0, r1:c.r1, c0:c.c0, c1:c.c1};
      else { const g=grupos[key]; g.r0=Math.min(g.r0,c.r0); g.r1=Math.max(g.r1,c.r1); g.c0=Math.min(g.c0,c.c0); g.c1=Math.max(g.c1,c.c1); }
    });
  });
  // orden de recorrido: primero planta baja (áreas de envío/ruge) por posición,
  // después planta alta por número de góndola. Juli lo puede reordenar en el módulo.
  const ordenPlanta = pl => pl==='baja' ? 0 : (pl==='alta' ? 1 : 2);
  const slugZona = (planta,nombre) => planta+'-'+nombre.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const zonas = Object.values(grupos).sort((a,b)=>{
    if(ordenPlanta(a.planta)!==ordenPlanta(b.planta)) return ordenPlanta(a.planta)-ordenPlanta(b.planta);
    const ga=numGondola(a.nombre), gb=numGondola(b.nombre);
    if(ga!==null && gb!==null) return ga-gb;      // góndolas por número
    if(ga!==null) return 1; if(gb!==null) return -1; // nombradas antes que las numeradas
    return a.r0-b.r0 || a.c0-b.c0;                 // el resto por posición
  }).map((z,i)=>({ id:slugZona(z.planta,z.nombre), nombre:z.nombre, planta:z.planta, tipo:z.tipo,
                   r0:z.r0, r1:z.r1, c0:z.c0, c1:z.c1, orden:(i+1)*10 }));

  const out = {
    generado: new Date().toISOString().slice(0,10),
    fuente: path.basename(xlsxPath),
    plantas: plantas.map(p=>({id:p.id, nombre:p.nombre, filas:p.filas, cols:p.cols, celdas:p.celdas})),
    zonas
  };
  const js = '/* Generado por scripts/gen-plano-deposito.js — NO editar a mano. Fuente: '+out.fuente+' ('+out.generado+') */\n'
    + 'window.PLANO_DEPOSITO = ' + JSON.stringify(out) + ';\n';
  const dest = path.join('picking','plano-deposito.js');
  fs.writeFileSync(dest, js);
  console.error('OK', dest, fs.statSync(dest).size, 'bytes');
  console.error('Plantas:', plantas.map(p=>p.nombre+' ('+p.celdas.length+' áreas)').join(' · '));
  console.error('Zonas de reserva:', zonas.length);
  zonas.forEach(z=>console.error('  '+String(z.orden).padStart(3)+'  ['+z.planta+']  '+z.nombre));
}
main();
