#!/usr/bin/env node
/* ============================================================================
   Generador de datos-meses-stock.js  ·  Portal Mateu Sports
   ----------------------------------------------------------------------------
   Convierte el reporte "RATIO <año> ok.xlsx" (hoja "Ratios") en el archivo
   gestion-stock/datos-meses-stock.js que consume el dashboard de Meses de Stock.

   Uso:
     node gestion-stock/generar-datos-meses-stock.js "ruta/RATIO 2026 ok.xlsx" [año]

   Escribe/overwrite gestion-stock/datos-meses-stock.js (al lado de este script).

   Self-contained: solo usa 'fs' y 'zlib' de node (un .xlsx es un zip con XML
   adentro). Sin dependencias de npm, sin build.

   ⚠️ REGLA CLAVE (acá estuvo un bug histórico): las cantidades salen TAL CUAL
   del Excel. NO dividir las marcas por 2. El Excel es el ground truth:
     - rubro.serie[mes]     = fila (Marca="Total", Segmento="Total")
     - marca.serie[mes]     = fila (Marca=<marca>, Segmento="Total")   ← sin /2
     - segmentos[S].serie   = fila (Marca=<marca>, Segmento=S)         (S≠"Total")
     - suc.serie[mes]       = Σ rubro.serie de la sucursal
   La pseudo-marca "Total" y las sucursales basura ("Total"/"Sucursal") se
   excluyen. Ver CLAUDE.md → "Meses de Stock — cómo regenerar…".
   ========================================================================== */
'use strict';
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const MES_ORDER = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO',
  'AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const THRESHOLDS = {CALZADO:[4,6], INDUMENTARIA:[3,5], ACCESORIOS:[3,5], PRODUCTO:[4,6]};
const SUC_BASURA = new Set(['Total','Sucursal','TOTAL','']); // filas que no son sucursal

// ---------- mini-unzip (central directory + inflate raw) --------------------
function readZip(buf){
  // localizar End Of Central Directory (firma 0x06054b50), buscando desde el final
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
  // header local: firma(4) ... fnLen@26, exLen@28, data@30+fnLen+exLen
  const fnLen = b.readUInt16LE(f.localOff + 26);
  const exLen = b.readUInt16LE(f.localOff + 28);
  const start = f.localOff + 30 + fnLen + exLen;
  const comp  = b.subarray(start, start + f.compSize);
  if(f.method === 0) return comp;                 // stored
  if(f.method === 8) return zlib.inflateRawSync(comp); // deflate
  throw new Error('Método de compresión no soportado: '+f.method);
}

// ---------- XML helpers -----------------------------------------------------
function decode(s){
  return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
          .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#10;/g,'\n')
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

// ---------- main ------------------------------------------------------------
function main(){
  const xlsxPath = process.argv[2];
  if(!xlsxPath){
    console.error('Uso: node gestion-stock/generar-datos-meses-stock.js "ruta/RATIO 2026 ok.xlsx" [año]');
    process.exit(1);
  }
  const anio = process.argv[3] ? parseInt(process.argv[3], 10) : null;
  const zip = readZip(fs.readFileSync(xlsxPath));

  // resolver la hoja "Ratios" vía workbook + rels
  const wb = extract(zip, 'xl/workbook.xml').toString('utf8');
  const rels = extract(zip, 'xl/_rels/workbook.xml.rels').toString('utf8');
  let rid = null;
  wb.replace(/<sheet\b[^>]*name="([^"]*)"[^>]*r:id="([^"]*)"[^>]*\/>/g, (m, nm, id) => {
    if(nm === 'Ratios') rid = id; return m;
  });
  if(!rid) throw new Error('No encuentro la hoja "Ratios" en el workbook.');
  let target = null;
  rels.replace(new RegExp('<Relationship\\b[^>]*Id="'+rid+'"[^>]*Target="([^"]*)"', 'g'),
    (m, t) => { target = t; return m; });
  if(!target) throw new Error('No resuelvo el rId de la hoja Ratios.');
  const sheetName = 'xl/' + target.replace(/^\/?xl\//, '').replace(/^\//, '');

  const shared = parseSharedStrings(extract(zip, 'xl/sharedStrings.xml').toString('utf8'));
  const sheet = extract(zip, sheetName).toString('utf8');

  const num = v => (v === undefined || v === '' || isNaN(+v)) ? null : (+v);
  const r2  = x => (x === null || x === undefined) ? null : Math.round(x * 100) / 100;

  // parsear filas → registros {A..K}
  const recs = [];
  sheet.replace(/<row\b[^>]*>([\s\S]*?)<\/row>/g, (m, cells) => {
    const rec = {};
    cells.replace(/<c\b[^>]*r="([A-Z]+)\d+"(?:[^>]*t="([^"]*)")?[^>]*>(?:<v>([\s\S]*?)<\/v>|<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>)?<\/c>/g,
      (x, col, typ, val, inl) => {
        let v = inl !== undefined ? decode(inl) : val;
        if(typ === 's' && val !== undefined) v = shared[parseInt(val, 10)];
        rec[col] = v; return x;
      });
    recs.push(rec); return m;
  });
  const header = recs.shift(); // fila de encabezados
  if(!header || header.C !== 'Sucursal') console.warn('Aviso: el encabezado no arranca en "Sucursal" — revisar columnas.');

  // meses presentes, en orden calendario
  const mesesSet = new Set();
  for(const r of recs) if(r.B) mesesSet.add(r.B);
  const meses = MES_ORDER.filter(m => mesesSet.has(m));
  const lastMes = meses[meses.length - 1];

  const D = {meses, thresholds: THRESHOLDS, sucursales: {}};
  if(anio) D.anio = anio;
  const ensure = (o, k, v) => o[k] || (o[k] = v);

  // Pass 1: total del rubro (Marca=Total, Seg=Total) y total de cada marca
  // (Marca, Seg=Total). Una marca SOLO existe si tiene fila Seg="Total": así
  // PRODUCTO (cuyos tipos de producto no traen fila Total) queda con su total
  // de rubro pero sin marcas fantasma, igual que el resto del dashboard.
  for(const r of recs){
    const suc = r.C, rub = r.D, mar = r.E, seg = r.F, mes = r.B;
    if(!suc || !rub || !mar || !seg || !mes) continue;
    if(SUC_BASURA.has(suc)) continue;
    if(seg !== 'Total') continue;
    const S = ensure(D.sucursales, suc, {rubros: {}, serie: {}});
    const rn = ensure(S.rubros, rub, {serie: {}, marcas: {}, status: null});
    const e = {stock: num(r.G), ventas: num(r.H), ratio: r2(num(r.I))};
    if(mar === 'Total') rn.serie[mes] = e;                                       // total real del rubro
    else ensure(rn.marcas, mar, {serie: {}, segmentos: {}, status: null}).serie[mes] = e; // marca (sin /2)
  }
  // Pass 2: desglose por segmento, solo para marcas ya creadas (con fila Total)
  for(const r of recs){
    const suc = r.C, rub = r.D, mar = r.E, seg = r.F, mes = r.B;
    if(!suc || !rub || !mar || !seg || !mes) continue;
    if(SUC_BASURA.has(suc) || mar === 'Total' || seg === 'Total') continue;
    const rn = D.sucursales[suc] && D.sucursales[suc].rubros[rub];
    const mc = rn && rn.marcas[mar];
    if(!mc) continue;
    const e = {stock: num(r.G), ventas: num(r.H), ratio: r2(num(r.I))};
    ensure(mc.segmentos, seg, {stock: null, ventas: null, ratio: null, serie: {}}).serie[mes] = e;
  }

  // derivados: status, top-level de segmento, suc.serie
  function statusOf(rub, e){
    if(!e) return 'sindato';
    const th = THRESHOLDS[rub] || [4, 6];
    if(e.ventas === null || e.ventas <= 0) return (e.stock && e.stock > 0) ? 'muerto' : 'sindato';
    if(e.ratio === null || e.ratio < 0) return 'sindato';
    if(e.ratio < th[0]) return 'faltante';
    if(e.ratio <= th[1]) return 'sano';
    return 'exceso';
  }
  for(const s in D.sucursales){
    const S = D.sucursales[s];
    for(const rub in S.rubros){
      const rn = S.rubros[rub];
      for(const mar in rn.marcas){
        const mc = rn.marcas[mar];
        for(const seg in mc.segmentos){
          const sg = mc.segmentos[seg];
          const le = sg.serie[lastMes];
          if(le){ sg.stock = le.stock; sg.ventas = le.ventas; sg.ratio = le.ratio; }
          else  { sg.stock = 0; sg.ventas = 0; sg.ratio = null; }
        }
        mc.status = statusOf(rub, mc.serie[lastMes]);
      }
      rn.status = statusOf(rub, rn.serie[lastMes]);
    }
    const suc = {};
    for(const mo of meses) suc[mo] = {stock: 0, ventas: 0, ratio: null};
    for(const rub in S.rubros){
      const rn = S.rubros[rub];
      for(const mo of meses){ const e = rn.serie[mo]; if(!e) continue; suc[mo].stock += e.stock || 0; suc[mo].ventas += e.ventas || 0; }
    }
    for(const mo of meses){ const o = suc[mo]; o.ratio = o.ventas > 0 ? r2(o.stock / o.ventas) : null; }
    S.serie = suc;
  }

  // comentarios: una entrada por fila con col J (Encargados) no vacía
  const comments = [];
  let id = 0;
  for(const r of recs){
    const j = r.J && String(r.J).trim();
    if(!j) continue;
    if(!r.C || SUC_BASURA.has(r.C) || !r.D) continue;
    const k = r.K && String(r.K).trim();
    const c = {mes: r.B, suc: r.C, rubro: r.D, marca: r.E, seg: r.F,
      ratio: r2(num(r.I)) || 0, texto: j, id: id++,
      estado: k ? 'resuelto' : 'pendiente', respuesta: k || null};
    if(k) c.fecha = String(anio || (D.anio) || '');
    comments.push(c);
  }

  const out = 'window.STOCK_DATA = ' + JSON.stringify(D) + ';\n'
            + 'window.STOCK_COMMENTS = ' + JSON.stringify(comments) + ';';
  const dest = path.join(__dirname, 'datos-meses-stock.js');
  fs.writeFileSync(dest, out);

  const nSuc = Object.keys(D.sucursales).length;
  let nMar = 0, nSeg = 0;
  for(const s in D.sucursales) for(const rub in D.sucursales[s].rubros){
    const rn = D.sucursales[s].rubros[rub];
    nMar += Object.keys(rn.marcas).length;
    for(const m in rn.marcas) nSeg += Object.keys(rn.marcas[m].segmentos).length;
  }
  console.log('OK → ' + dest);
  console.log('  meses:', meses.join(', '));
  console.log('  sucursales:', nSuc, '· marcas:', nMar, '· segmentos:', nSeg, '· comentarios:', comments.length);
}
main();
