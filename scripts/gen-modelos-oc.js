#!/usr/bin/env node
/* ============================================================================
   Generador de los MODELOS DE PEDIDO por marca  ·  Portal Mateu Sports
   ----------------------------------------------------------------------------
   Recorre la carpeta donde Juli guarda los pedidos de compra (una subcarpeta por
   marca, y adentro carpetas por mes/año — no siempre igual de prolijo), toma el
   archivo MÁS RECIENTE de cada marca como "modelo de pedido de la marca", lo
   pasa por el mismo motor de detección que usa el conversor del módulo y escribe

       recepciones/modelos-oc.js   ->   window.OC_MODELOS_SEED

   con, por marca: la hoja y el NOMBRE de cada columna (código, descripción,
   unidades confirmadas, costo, rubro, disciplina, género, empresa/banner). El
   conversor arranca con ese mapeo en vez de adivinar; si la marca manda otra
   planilla, la detección automática y el mapeo a mano siguen estando.

   Uso:
     node scripts/gen-modelos-oc.js "G:/Soporte/Julian Mateu/Mateu sports/Pedidos de compras"

   Self-contained: solo 'fs', 'zlib' y 'path' (un .xlsx es un zip con XML), y el
   motor se lee del propio recepciones/index.html — así el generador y el módulo
   nunca se desincronizan. Los .xls viejos (BIFF) no se leen acá (sí en el
   navegador, con SheetJS): esas marcas quedan sin modelo.
   ========================================================================== */
'use strict';
const fs   = require('fs');
const zlib = require('zlib');
const path = require('path');

const MAX_MB = 45;      // más que esto no se escanea (hay pedidos de 95 MB)
const MAX_ROWS = 4000;  // alcanza de sobra para detectar el formato

// ---------- mini-unzip + lector de .xlsx (igual que gen-maestro-adidas.js) ---
function readZip(buf){
  let eocd=-1;
  for(let i=buf.length-22;i>=0 && i>=buf.length-22-65536;i--){ if(buf.readUInt32LE(i)===0x06054b50){ eocd=i; break; } }
  if(eocd<0) throw new Error('no es un .xlsx válido (sin EOCD)');
  const cdCount=buf.readUInt16LE(eocd+10); let off=buf.readUInt32LE(eocd+16); const files={};
  for(let n=0;n<cdCount;n++){
    if(buf.readUInt32LE(off)!==0x02014b50) break;
    const method=buf.readUInt16LE(off+10), compSize=buf.readUInt32LE(off+20);
    const fnLen=buf.readUInt16LE(off+28), exLen=buf.readUInt16LE(off+30), cmLen=buf.readUInt16LE(off+32);
    const localOff=buf.readUInt32LE(off+42);
    files[buf.toString('utf8',off+46,off+46+fnLen)]={method,compSize,localOff};
    off+=46+fnLen+exLen+cmLen;
  }
  return {buf,files};
}
function extract(zip,name){
  const f=zip.files[name]; if(!f) throw new Error('falta '+name);
  const b=zip.buf, fnLen=b.readUInt16LE(f.localOff+26), exLen=b.readUInt16LE(f.localOff+28);
  const start=f.localOff+30+fnLen+exLen, comp=b.subarray(start,start+f.compSize);
  if(f.method===0) return comp;
  if(f.method===8) return zlib.inflateRawSync(comp);
  throw new Error('método de compresión '+f.method);
}
function decode(s){
  return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
          .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#10;/g,' ')
          .replace(/&#13;/g,'').replace(/&apos;/g,"'");
}
function parseShared(xml){
  const out=[];
  xml.replace(/<si>([\s\S]*?)<\/si>/g,(m,inner)=>{ let t=''; inner.replace(/<t[^>]*>([\s\S]*?)<\/t>/g,(x,y)=>{t+=y;return x;}); out.push(decode(t)); return m; });
  return out;
}
const colIdx = ref => { let n=0; for(const ch of ref) n=n*26+(ch.charCodeAt(0)-64); return n-1; };
function readXlsx(file, maxRows){
  const zip=readZip(fs.readFileSync(file));
  let shared=[]; try{ shared=parseShared(extract(zip,'xl/sharedStrings.xml').toString('utf8')); }catch(e){}
  const wbXml=extract(zip,'xl/workbook.xml').toString('utf8');
  const defs=[]; wbXml.replace(/<sheet[^>]*name="([^"]*)"[^>]*r:id="([^"]*)"/g,(m,n,r)=>{defs.push([decode(n),r]);return m;});
  const rel={};
  try{ extract(zip,'xl/_rels/workbook.xml.rels').toString('utf8').replace(/<Relationship[^>]*Id="([^"]*)"[^>]*Target="([^"]*)"/g,(m,id,t)=>{rel[id]=t.replace(/^\/?xl\//,'');return m;}); }catch(e){}
  const sheets=[];
  defs.forEach(([nm,rid])=>{
    let xml; try{ xml=extract(zip,'xl/'+rel[rid]).toString('utf8'); }catch(e){ return; }
    const rows=[]; let n=0;
    xml.replace(/<row\b[^>]*>([\s\S]*?)<\/row>/g,(m,cells)=>{
      if(maxRows && n>=maxRows) return m;
      const rec=[];
      cells.replace(/<c\b[^>]*r="([A-Z]+)\d+"(?:[^>]*t="([^"]*)")?[^>]*>(?:<v>([\s\S]*?)<\/v>|<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>)?<\/c>/g,
        (x,col,typ,val,inl)=>{
          let v = inl!==undefined ? decode(inl) : val;
          if(typ==='s' && val!==undefined) v=shared[parseInt(val,10)];
          else if(v!==undefined && typ!=='str' && typ!=='inlineStr'){ const f=parseFloat(v); if(isFinite(f) && String(f)===String(v)) v=f; }
          rec[colIdx(col)] = v===undefined?'':v; return x;
        });
      for(let i=0;i<rec.length;i++) if(rec[i]===undefined) rec[i]='';
      rows.push(rec); n++; return m;
    });
    sheets.push({name:nm, rows});
  });
  return sheets;
}

// ---------- el motor del conversor, leído del propio módulo ----------------
function cargarMotor(){
  const src=fs.readFileSync(path.join(__dirname,'..','recepciones','index.html'),'utf8');
  const trozo=(a,b)=>{ const i=src.indexOf(a), j=src.indexOf(b); if(i<0||j<0||j<i) throw new Error('no encontré el bloque del conversor en recepciones/index.html ('+a+')'); return src.slice(i,j); };
  const bloque = trozo('const OC_DISC_MAP','function ocFromFilename') + trozo('/* ---------- motor genérico','/* Lector propio de Nike');
  const cmp=(a,b)=>String(a).localeCompare(String(b),'es');
  const XLSX={ utils:{ sheet_to_json:(sheet,opt)=>{
    let rows=sheet.rows.map(r=>r.slice());
    if(opt && opt.blankrows===false) rows=rows.filter(r=>r.some(c=>String(c==null?'':c).trim()!==''));
    return rows;
  } } };
  const win={ OC_MODELOS:{}, OC_MODELOS_SEED:{} };
  const fn=new Function('cmp','XLSX','window','console', bloque+'\n; return {ocLeerTabla, ocArmarArts, ocNorm};');
  return fn(cmp, XLSX, win, console);
}

// ---------- recorrido de las carpetas --------------------------------------
function walk(dir, out, depth){
  if(depth>4) return;
  let ents=[]; try{ ents=fs.readdirSync(dir,{withFileTypes:true}); }catch(e){ return; }
  for(const e of ents){
    const p=path.join(dir,e.name);
    if(e.isDirectory()) walk(p,out,depth+1);
    else if(/\.(xlsx|xlsm)$/i.test(e.name) && !/^~\$/.test(e.name)){
      let st; try{ st=fs.statSync(p); }catch(err){ continue; }
      out.push({p, mtime:st.mtimeMs, size:st.size});
    }
  }
}

/* rubro a partir del nombre de la hoja/archivo (sólo cuando la planilla no lo
   trae en una columna): "Pedido Vans CALZADO 2do sem" -> CALZADO */
function rubroDeNombre(n){
  if(/calzado|botin|zapat|shoes|footwear|\bftw\b|chinela|sandalia|slide|ojota/.test(n)) return 'CALZADO';
  if(/indument|apparel|\bapp\b|remera|campera|buzo|short|pantalon|conjunto|media/.test(n)) return 'INDUMENTARIA';
  if(/accesorio|\bacc\b|pelota|mochila|bolso|gorra|guante|paleta|raqueta|termo/.test(n)) return 'ACCESORIOS';
  return '';
}

function main(){
  const raiz=process.argv[2];
  if(!raiz){ console.error('Uso: node scripts/gen-modelos-oc.js "G:/…/Pedidos de compras"'); process.exit(1); }
  const M=cargarMotor();
  const marcas=fs.readdirSync(raiz,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name)
    .filter(n=>!/^nueva carpeta/i.test(n));
  const modelos={}; const saltadas=[];

  marcas.forEach(marca=>{
    const files=[]; walk(path.join(raiz,marca), files, 0);
    if(!files.length){ saltadas.push([marca,'sin .xlsx']); return; }
    files.sort((a,b)=>b.mtime-a.mtime);
    const f=files.find(x=>x.size<=MAX_MB*1048576);
    if(!f){ saltadas.push([marca,'archivos muy grandes']); return; }
    let t, arts;
    try{
      const sheets=readXlsx(f.p, MAX_ROWS);
      const wb={ SheetNames:sheets.map(s=>s.name), Sheets:{} };
      sheets.forEach(s=>{ wb.Sheets[s.name]={rows:s.rows}; });
      t=M.ocLeerTabla(wb, marca);
      arts=M.ocArmarArts(t);
    }catch(e){ saltadas.push([marca, e.message.slice(0,60)]); return; }
    // solo guardamos el modelo si el mapeo es confiable: código + unidades + artículos
    if(!arts.length || t.cols.cod<0 || t.cols.cant<0){ saltadas.push([marca, 'mapeo poco confiable ('+arts.length+' art)']); return; }
    const nom=j=>(j>=0 && t.headers[j]) ? String(t.headers[j]).replace(/\s+/g,' ').trim() : '';
    const cols={}; ['cod','desc','cant','costo','rubro','disc','gen','talle','emp'].forEach(k=>{ const v=nom(t.cols[k]); if(v) cols[k]=v; });
    // si la planilla no trae rubro, lo deducimos del nombre de la hoja/archivo
    const rubro = t.cols.rubro>=0 ? '' : rubroDeNombre(M.ocNorm(t.hoja+' '+path.basename(f.p)));
    modelos[M.ocNorm(marca)] = {
      marca, hoja:t.hoja, hdr:t.hdrRow, cols, rubro,
      ref:{ archivo:path.basename(f.p), fecha:new Date(f.mtime).toISOString().slice(0,10), arts:arts.length, u:Math.round(arts.reduce((a,x)=>a+x.cantidad,0)) }
    };
  });

  const out = '/* ============================================================================\n'
    + '   Modelos de pedido por marca  ·  generado por scripts/gen-modelos-oc.js\n'
    + '   NO editar a mano: regenerar con\n'
    + '     node scripts/gen-modelos-oc.js "G:/…/Pedidos de compras"\n'
    + '   Cada entrada es el mapeo (hoja + nombre de cada columna) aprendido del\n'
    + '   ÚLTIMO pedido guardado de esa marca. El conversor de OC lo usa como punto\n'
    + '   de partida; lo que Juli guarde desde el modal manda por encima de esto.\n'
    + '   Generado: ' + new Date().toISOString().slice(0,10) + ' · ' + Object.keys(modelos).length + ' marcas\n'
    + '   ========================================================================== */\n'
    + 'window.OC_MODELOS_SEED = ' + JSON.stringify(modelos, null, 1) + ';\n';
  const dest=path.join(__dirname,'..','recepciones','modelos-oc.js');
  fs.writeFileSync(dest, out, 'utf8');

  console.error('---');
  console.error('modelos escritos :', Object.keys(modelos).length, '→', path.relative(process.cwd(), dest));
  Object.keys(modelos).sort().forEach(k=>{ const m=modelos[k]; console.error('  ', m.marca.padEnd(20), m.hoja.slice(0,18).padEnd(20), m.ref.arts+' art / '+m.ref.u+' u'); });
  console.error('sin modelo       :', saltadas.length);
  saltadas.forEach(([m,r])=>console.error('  ', m.padEnd(20), r));
}
main();
