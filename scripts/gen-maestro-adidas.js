#!/usr/bin/env node
/* ============================================================================
   Generador del maestro EAN de Adidas  ·  Portal Mateu Sports
   ----------------------------------------------------------------------------
   Convierte el Excel "Lista Codigos Ean<...>.XLSX" (catálogo EAN de Adidas,
   ~280k filas) en el asset compacto que consume el módulo Ingreso de Mercadería
   para traducir lo que escanea el operario (EAN) al SKU (material+talle) y así
   cruzarlo contra el remito declarado.

   Uso:
     node scripts/gen-maestro-adidas.js "ruta/Lista Codigos Ean126.XLSX"

   Escribe recepciones/maestro-adidas.json con la forma:
     {
       marca: "ADIDAS", generado, fuente, n,
       ean:  { "<EAN>": "<MATERIAL>\t<SIZE>" },   // SKU = MATERIAL+SIZE (concat)
       desc: { "<MATERIAL>": "<Descripción>" }     // una por material
     }

   El separador \t permite reconstruir MATERIAL, SIZE y SKU desde el EAN; la
   descripción va aparte por material (mucho más chica que por SKU).

   Self-contained: solo 'fs' y 'zlib' (un .xlsx es un zip con XML). Sin npm.
   Columnas del Excel: A=Material · C=Material Description · L=Size · N=EAN Code.
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

function main(){
  const xlsxPath = process.argv[2];
  if(!xlsxPath){
    console.error('Uso: node scripts/gen-maestro-adidas.js "ruta/Lista Codigos Ean126.XLSX"');
    process.exit(1);
  }
  console.error('Leyendo', xlsxPath, '…');
  const zip = readZip(fs.readFileSync(xlsxPath));
  const shared = parseSharedStrings(extract(zip, 'xl/sharedStrings.xml').toString('utf8'));
  console.error('sharedStrings:', shared.length);

  // primera (única) hoja
  const sheetName = Object.keys(zip.files).find(n => /^xl\/worksheets\/sheet1\.xml$/.test(n))
                 || Object.keys(zip.files).find(n => /^xl\/worksheets\/.*\.xml$/.test(n));
  const sheet = extract(zip, sheetName).toString('utf8');

  const ean = {};   // EAN -> "MATERIAL\tSIZE"
  const desc = {};  // MATERIAL -> descripción
  let n = 0, sinEan = 0, dupEan = 0, header = true;

  sheet.replace(/<row\b[^>]*>([\s\S]*?)<\/row>/g, (m, cells) => {
    const rec = {};
    cells.replace(/<c\b[^>]*r="([A-Z]+)\d+"(?:[^>]*t="([^"]*)")?[^>]*>(?:<v>([\s\S]*?)<\/v>|<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>)?<\/c>/g,
      (x, col, typ, val, inl) => {
        let v = inl !== undefined ? decode(inl) : val;
        if(typ === 's' && val !== undefined) v = shared[parseInt(val, 10)];
        rec[col] = v; return x;
      });
    if(header){ header = false; return m; } // saltear encabezados
    const mat = clean(rec.A), size = clean(rec.L), e = clean(rec.N), d = clean(rec.C);
    if(!e){ sinEan++; return m; }
    if(!mat){ return m; }
    if(ean[e] !== undefined) dupEan++;
    ean[e] = mat + '\t' + size;
    if(d && !desc[mat]) desc[mat] = d;
    n++;
    return m;
  });

  const out = {
    marca: 'ADIDAS',
    generado: new Date().toISOString().slice(0,10),
    fuente: path.basename(xlsxPath),
    n,
    ean,
    desc
  };
  const outPath = path.join(__dirname, '..', 'recepciones', 'maestro-adidas.json');
  const json = JSON.stringify(out);
  fs.writeFileSync(outPath, json);

  const mb = b => (b/1024/1024).toFixed(2)+' MB';
  console.error('---');
  console.error('EAN cargados      :', n);
  console.error('materiales (desc) :', Object.keys(desc).length);
  console.error('filas sin EAN     :', sinEan);
  console.error('EAN duplicados    :', dupEan);
  console.error('salida            :', outPath);
  console.error('tamaño JSON       :', mb(Buffer.byteLength(json)));
  console.error('tamaño gzip (aprox):', mb(zlib.gzipSync(json).length));
}
main();
