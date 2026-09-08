#!/usr/bin/env node
/* Siembra el módulo «Envíos e Ingresos» (logistica/) desde el informe HTML
   «Dashboard Gerencial — Envíos e Ingresos» (arrays SENT / RECEIVED embebidos).
   Uso: node scripts/importar-logistica-informe.js "Informe de envíos corregido.html" 2026
   Escribe recepciones-mateu/logistica/meses/<YYYY-MM> (envios + ingresos + meta) y logistica/ultimo.
   Self-contained: solo fs + fetch (node ≥ 18). */
const fs = require('fs');
const [,, archivo, anioArg] = process.argv;
if(!archivo){ console.error('Uso: node scripts/importar-logistica-informe.js <informe.html> [año]'); process.exit(1); }
const ANIO = anioArg || String(new Date().getFullYear());
const FB = 'https://recepciones-mateu-default-rtdb.firebaseio.com/logistica';
const lineas = fs.readFileSync(archivo, 'utf8').split(/\r?\n/);
const grab = n => { const l = lineas.find(x => x.startsWith('const ' + n + '=')); if(!l) throw new Error('No encontré ' + n); return JSON.parse(l.slice(n.length + 7).replace(/;\s*$/, '').replace(/:NaN/g, ':null')); };
const SENT = grab('SENT'), RECEIVED = grab('RECEIVED');
const fila = (r, q) => [String(r.SUCURSAL||''), String(r.RUBRO||''), String(r.SUBRUBRO||''), String(r.DISCIPLINA||''), String(r.MARCA||''), String(r['CODIGO DE BARRAS']||''), r['ID ITEM']==null?'':String(Math.round(r['ID ITEM'])), String(r.ARTICULO||''), Math.round(Number(q)||0)];
const meses = {};
const ym = m => `${ANIO}-${String(m).padStart(2,'0')}`;
SENT.forEach(r => { if(!r.MES || r.SUCURSAL==='Total') return; (meses[ym(r.MES)] = meses[ym(r.MES)] || {envios:[], ingresos:[]}).envios.push(fila(r, r.CANTIDAD)); });
RECEIVED.forEach(r => { if(!r.MES || r.SUCURSAL==='Total') return; (meses[ym(r.MES)] = meses[ym(r.MES)] || {envios:[], ingresos:[]}).ingresos.push(fila(r, r.INGRESADO)); });
const hoy = new Date().toISOString().slice(0,10), nombre = require('path').basename(archivo);
(async () => {
  const keys = Object.keys(meses).sort();
  for(const k of keys){
    const m = meses[k];
    const meta = {};
    if(m.envios.length) meta.envios = { archivo:nombre, hoja:'SENT', subido:hoy, por:'importar-logistica-informe.js', filas:m.envios.length, unidades:m.envios.reduce((s,x)=>s+x[8],0) };
    if(m.ingresos.length) meta.ingresos = { archivo:nombre, hoja:'RECEIVED', subido:hoy, por:'importar-logistica-informe.js', filas:m.ingresos.length, unidades:m.ingresos.reduce((s,x)=>s+x[8],0) };
    const r = await fetch(`${FB}/meses/${k}.json`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ meta, envios:m.envios, ingresos:m.ingresos }) });
    console.log(k, r.status, 'envíos', m.envios.length, meta.envios && meta.envios.unidades, '· ingresos', m.ingresos.length, meta.ingresos && meta.ingresos.unidades);
  }
  const r = await fetch(`${FB}/ultimo.json`, { method:'PUT', body: JSON.stringify(keys[keys.length-1]) });
  console.log('ultimo', keys[keys.length-1], r.status);
})();
