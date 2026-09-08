#!/usr/bin/env node
/* Siembra / actualiza el módulo «Envíos e Ingresos» (logistica/) desde los dos
   exports pivot del sistema (CSV ; latin1, una columna por mes):
     · «Estad transferencias 2026.csv» → envíos del depósito a cada sucursal
     · «Estad remitos 2026.csv»        → ingresos al depósito (Cant.recibido · Costo)
   Uso: node scripts/importar-logistica-csv.js <año> ["transferencias.csv"] ["remitos.csv"] [--dry]
   Mismas reglas que `parsearPivot` del módulo (mantener en sintonía). Escribe
   recepciones-mateu/logistica/arts/<clave> (maestro compartido de artículos) y
   logistica/meses/<YYYY-MM>/{envios|ingresos, meta}. Self-contained: fs + fetch. */
const fs = require('fs');
const args = process.argv.slice(2), dry = args.includes('--dry');
const [anio, ...archivos] = args.filter(a => a !== '--dry');
if(!anio || !archivos.length){ console.error('Uso: node scripts/importar-logistica-csv.js <año> <csv…> [--dry]'); process.exit(1); }
const FB = 'https://recepciones-mateu-default-rtdb.firebaseio.com/logistica';

const sinPrefijo = s => String(s||'').trim().replace(/^\d{2}-/, '');
const clave = cod => String(cod||'').trim().replace(/[.#$\[\]\/]/g, '_') || '_';
const num = v => { const n = parseFloat(String(v||'').replace(',', '.')); return isFinite(n) ? n : 0; };

function leerCsv(ruta){
  return fs.readFileSync(ruta, 'latin1').split(/\r?\n/).filter(l => l.length).map(l => l.split(';').map(c => c.trim()));
}
// Detecta el layout por contenido de la primera fila de datos.
function parsearPivot(m){
  const h = m[0];
  // En remitos cada mes aparece dos veces (Cant.recibido · Costo): se toma la primera columna y el costo es la siguiente.
  const meses = [], vistos = new Set(); h.forEach((c, i) => { if(/^\d{1,2}$/.test(c) && +c >= 1 && +c <= 12 && !vistos.has(+c)){ vistos.add(+c); meses.push({i, mes:+c}); } });
  if(!meses.length) throw new Error('No encontré columnas de mes (1..12) en la primera fila');
  const esRemito = m[1] && m[1].some(c => /cant\.?\s*recib/i.test(c));
  const ini = esRemito ? 2 : 1;
  const out = { tipo: esRemito ? 'ingresos' : 'envios', arts:{}, porMes:{}, filas:0, desc:0 };
  for(let r = ini; r < m.length; r++){
    const f = m[r]; if(!f || f.length < 12) continue;
    let a, suc = '', cod, q = {}, costo = {};
    if(esRemito){
      // marca · rubro · subrubro · disciplina · remito · tipo art. · campaña · línea · artículo · código · id item · (cant, costo)×mes · total
      if(!f[0] || /^total$/i.test(f[0])) { out.desc++; continue; }
      cod = f[9]; a = { rubro:sinPrefijo(f[1]), sub:f[2], disc:f[3], marca:f[0], id:f[10], art:f[8], tipo:f[5] };
      meses.forEach(({i, mes}) => { const c = num(f[i]), $ = num(f[i+1]); if(c){ q[mes] = c; costo[mes] = $; } });
    } else {
      // origen · rubro · subrubro · marca · proveedor · disciplina · tipo art. · campaña · línea · código · artículo · id item · destino · mes…
      suc = f[12]; if(!suc || /^total$/i.test(suc)) { out.desc++; continue; }
      cod = f[9]; a = { rubro:sinPrefijo(f[1]), sub:f[2], disc:f[5], marca:f[3], id:f[11], art:f[10], tipo:f[6] };
      meses.forEach(({i, mes}) => { const c = num(f[i]); if(c) q[mes] = c; });
    }
    const k = clave(cod);
    out.arts[k] = [a.rubro, a.sub, a.disc, a.marca, String(a.id||''), a.art, a.tipo, String(cod||'')];
    Object.keys(q).forEach(mes => {
      const ym = `${anio}-${String(mes).padStart(2,'0')}`;
      const b = out.porMes[ym] = out.porMes[ym] || new Map();
      const kk = k + '|' + suc;
      const prev = b.get(kk) || [k, suc, 0, 0];
      prev[2] += Math.round(q[mes]); prev[3] += Math.round(costo[mes]||0);
      b.set(kk, prev); out.filas++;
    });
  }
  return out;
}

(async () => {
  const hoy = new Date().toISOString().slice(0,10);
  const upd = {};
  for(const ruta of archivos){
    const p = parsearPivot(leerCsv(ruta));
    const nombre = require('path').basename(ruta);
    Object.entries(p.arts).forEach(([k, a]) => { upd[`arts/${k}`] = a; });
    Object.entries(p.porMes).sort().forEach(([ym, b]) => {
      const filas = [...b.values()].map(x => p.tipo === 'envios' ? [x[0], x[1], x[2]] : [x[0], x[2], x[3]]);
      const unidades = filas.reduce((s, x) => s + (p.tipo === 'envios' ? x[2] : x[1]), 0);
      upd[`meses/${ym}/${p.tipo}`] = filas;
      upd[`meses/${ym}/meta/${p.tipo}`] = { archivo:nombre, hoja:'csv', subido:hoy, por:'importar-logistica-csv.js', filas:filas.length, unidades };
      console.log(nombre, '→', p.tipo, ym, 'filas', filas.length, 'unidades', unidades);
    });
    console.log(nombre, 'artículos', Object.keys(p.arts).length, 'filas totales', p.filas, 'descartadas (Total)', p.desc);
  }
  const yms = Object.keys(upd).filter(k => /^meses\//.test(k)).map(k => k.split('/')[1]).sort();
  upd.ultimo = yms[yms.length-1];
  const body = JSON.stringify(upd);
  console.log('payload', (body.length/1024/1024).toFixed(2), 'MB', '· claves', Object.keys(upd).length, '· último', upd.ultimo);
  if(dry) return;
  const r = await fetch(`${FB}.json`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body });
  console.log('PATCH', r.status);
})();
