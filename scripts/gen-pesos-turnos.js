#!/usr/bin/env node
/* ============================================================================
   Generador de pesos por turno-día  ·  Portal Mateu Sports
   ----------------------------------------------------------------------------
   Convierte el Excel "PESOS TURNOS PMS ..." (hoja "Pesos turnos", bloque
   "Detalle completo") en el asset que consume Indicadores para DISTRIBUIR el
   objetivo semanal de la sucursal entre el equipo según las horas asignadas
   (reemplaza el circuito del Excel PMS).

   Uso:
     node scripts/gen-pesos-turnos.js "ruta/PESOS TURNOS PMS A JULIO 2026 - Venta 01.05 al 05.07.xlsx"

   Escribe indicadores/pesos-turnos.js con la forma:
     window.PESOS_TURNOS = {
       generado, fuente,
       pesos: { "01-MS Plaza Italia": { t1:[Lu..Do], t2:[...], t3:[...] }, ... }
     }
   Los valores son PUNTOS PORCENTUALES de la venta semanal (la matriz de una
   sucursal suma ~100). Turno 1 = 9-13 · Turno 2 = 13-16 · Turno 3 = 16-20.

   Self-contained: solo 'fs' y 'zlib' (mismo mini-lector XLSX que el generador
   del maestro Adidas). Sin npm. Regenerar cuando Juli actualice los pesos
   (trimestral, con la venta del último período).
   ========================================================================== */
'use strict';
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

// ---------- mini-unzip (central directory + inflate raw) --------------------
function readZip(buf){
  let eocd = -1;
  for(let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--){
    if(buf.readUInt32LE(i) === 0x06054b50){ eocd = i; break; }
  }
  if(eocd < 0) throw new Error('No es un .xlsx válido (no encuentro el EOCD del zip).');
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
  if(!f) throw new Error('Falta la entrada '+name+' en el .xlsx');
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
  return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
          .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#10;/g,' ')
          .replace(/&#13;/g,'').replace(/&apos;/g,"'");
}
function parseSharedStrings(xml){
  const out = [];
  xml.replace(/<si>([\s\S]*?)<\/si>/g, (m, inner) => {
    let t = '';
    inner.replace(/<t[^>]*>([\s\S]*?)<\/t>/g, (x, y) => { t += y; return x; });
    out.push(decode(t));
    return m;
  });
  return out;
}
const clean = s => (s||'').replace(/\s+/g,' ').trim();

// hoja por NOMBRE (workbook.xml → rId → workbook.xml.rels → worksheets/…)
function sheetXmlByName(zip, wanted){
  const wb = extract(zip, 'xl/workbook.xml').toString('utf8');
  let rid = null;
  wb.replace(/<sheet[^>]*name="([^"]*)"[^>]*r:id="([^"]*)"[^>]*\/>/g, (m, name, id) => {
    if(clean(decode(name)).toLowerCase() === wanted.toLowerCase()) rid = id;
    return m;
  });
  if(!rid) throw new Error('No encuentro la hoja "'+wanted+'" en el workbook.');
  const rels = extract(zip, 'xl/_rels/workbook.xml.rels').toString('utf8');
  let target = null;
  rels.replace(/<Relationship[^>]*Id="([^"]*)"[^>]*Target="([^"]*)"[^>]*\/>/g, (m, id, t) => {
    if(id === rid) target = t;
    return m;
  });
  if(!target) throw new Error('No encuentro el target de la hoja "'+wanted+'".');
  return extract(zip, 'xl/' + target.replace(/^\//,'').replace(/^xl\//,'')).toString('utf8');
}

function main(){
  const xlsxPath = process.argv[2];
  if(!xlsxPath){
    console.error('Uso: node scripts/gen-pesos-turnos.js "ruta/PESOS TURNOS ....xlsx"');
    process.exit(1);
  }
  console.error('Leyendo', xlsxPath, '…');
  const zip = readZip(fs.readFileSync(xlsxPath));
  const shared = zip.files['xl/sharedStrings.xml']
    ? parseSharedStrings(extract(zip, 'xl/sharedStrings.xml').toString('utf8')) : [];
  const sheet = sheetXmlByName(zip, 'Pesos turnos');

  // filas → objetos {colLetra: valor}. Las celdas pueden traer <f>fórmula</f>
  // antes del <v> cacheado, así que se parsea celda por celda.
  const rows = [];
  sheet.replace(/<row\b[^>]*>([\s\S]*?)<\/row>/g, (m, cells) => {
    const rec = {};
    cells.replace(/<c\b([^>]*)>([\s\S]*?)<\/c>/g, (x, attrs, inner) => {
      const mr = /r="([A-Z]+)\d+"/.exec(attrs); if(!mr) return x;
      const mt = /t="([^"]*)"/.exec(attrs);
      const mv = /<v>([\s\S]*?)<\/v>/.exec(inner);
      const mi = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(inner);
      let v = mi ? decode(mi[1]) : (mv ? mv[1] : undefined);
      if(mt && mt[1] === 's' && mv) v = shared[parseInt(mv[1], 10)];
      if(v !== undefined) rec[mr[1]] = v;
      return x;
    });
    rows.push(rec);
    return m;
  });

  // bloque "Detalle completo". Por las celdas combinadas de Sucursal, el rótulo
  // "Turno N" cae en col B en la primera fila de cada sucursal y en col A en las
  // siguientes. Días Lu..Do siempre en C..I.
  const DIA_COLS = ['C','D','E','F','G','H','I'];
  const pesos = {};
  let suc = '';
  for(const r of rows){
    const a = clean(r.A), b = clean(r.B);
    const mTa = /^Turno\s*([123])$/i.exec(a), mTb = /^Turno\s*([123])$/i.exec(b);
    if(a && !mTa && !/^(A PASAR|Seleccioná|Turno|Total|Detalle completo|Sucursal|Elegí)/i.test(a)) suc = a;
    const mT = mTb || mTa;
    if(!mT || !suc) continue;
    const serie = DIA_COLS.map(c => {
      const n = parseFloat(r[c]);
      return isFinite(n) ? Math.round(n * 10000) / 10000 : 0;
    });
    (pesos[suc] = pesos[suc] || {})['t' + mT[1]] = serie;
  }

  // sanity: cada sucursal con t1+t2+t3 y suma ~100
  const sucs = Object.keys(pesos);
  let warn = 0;
  for(const s of sucs){
    const p = pesos[s];
    if(!p.t1 || !p.t2 || !p.t3){ console.error('⚠ '+s+': faltan turnos'); warn++; continue; }
    const tot = ['t1','t2','t3'].reduce((a,t)=>a+p[t].reduce((x,y)=>x+y,0),0);
    if(Math.abs(tot - 100) > 0.5){ console.error('⚠ '+s+': la matriz suma '+tot.toFixed(2)+' (esperaba ~100)'); warn++; }
  }

  const out = 'window.PESOS_TURNOS = ' + JSON.stringify({
    generado: new Date().toISOString().slice(0,10),
    fuente: path.basename(xlsxPath),
    pesos
  }) + ';\n';
  const outPath = path.join(__dirname, '..', 'indicadores', 'pesos-turnos.js');
  fs.writeFileSync(outPath, out);

  console.error('---');
  console.error('sucursales :', sucs.length, '·', sucs.join(', '));
  console.error('avisos     :', warn);
  console.error('salida     :', outPath, '('+(Buffer.byteLength(out)/1024).toFixed(1)+' KB)');
}
main();
