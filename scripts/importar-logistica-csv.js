#!/usr/bin/env node
/* Siembra / actualiza el «Panel General» de logística (logistica/) desde los dos
   exports pivot del sistema (CSV ; latin1, una columna por mes):
     · «Estad transferencias 2026.csv» → envíos del depósito a cada sucursal
     · «Estad remitos 2026.csv»        → ingresos al depósito (Cant.recibido · Costo)
   Uso: node scripts/importar-logistica-csv.js <año> ["transferencias.csv"] ["remitos.csv"] [--dry]
   Usa el MISMO parser que el módulo (lib/logistica-parse.js): detecta el pivot,
   reconoce las columnas por contenido y suma por artículo × sucursal × mes.
   Escribe recepciones-mateu/logistica/arts/<clave> (maestro compartido),
   logistica/meses/<YYYY-MM>/{envios|ingresos, meta} y logistica/porSuc/<slug>/<YYYY-MM>
   (resumen por sucursal para Mi Sucursal). Self-contained: fs + fetch. */
const fs = require('fs');
const path = require('path');
const LP = require('../lib/logistica-parse.js');
const args = process.argv.slice(2), dry = args.includes('--dry');
const [anio, ...archivos] = args.filter(a => a !== '--dry');
if(!anio || !archivos.length){ console.error('Uso: node scripts/importar-logistica-csv.js <año> <csv…> [--dry]'); process.exit(1); }
const FB = 'https://recepciones-mateu-default-rtdb.firebaseio.com/logistica';
// prefijo NN del nombre de la sucursal → slug del Portal (mismo mapa que objetivos/)
const PREFIJO_SLUG = { '01':'plaza','02':'kids','03':'calle-55','04':'aurelius-12','06':'city-bell','07':'aurelius-10','08':'calle-47','09':'adidas','10':'diagonal','11':'ensenada','12':'calle-12','13':'los-hornos','14':'gonnet','15':'originals','16':'berisso','17':'aurelius-cb','18':'aurelius-5','19':'calle-49','20':'av-44','21':'adidas-12','99':'ecommerce' };
const slugDe = n => { const m = String(n||'').match(/^(\d{2})-/); return m ? (PREFIJO_SLUG[m[1]] || null) : null; };

(async () => {
  const hoy = new Date().toISOString().slice(0,10);
  const upd = {};
  let arts = {};
  try{ arts = (await fetch(`${FB}/arts.json`).then(r=>r.json())) || {}; }catch(e){}
  const K = LP.conocidosDesde(Object.values(arts).map(a => ({ rubro:a[0], sub:a[1], disc:a[2], marca:a[3], tipo:a[6] })));
  for(const ruta of archivos){
    const m = LP.csvAMatriz(fs.readFileSync(ruta, 'latin1'));
    const det = LP.detectarPivot(m);
    if(!det){ console.error(ruta, ': no es un export pivot del sistema'); process.exit(1); }
    const { map } = LP.inferirColumnas(m, det, K);
    const p = LP.parsearPivot(m, anio, det, map);
    const nombre = path.basename(ruta);
    console.log(nombre, '→', p.tipo, '· columnas', JSON.stringify(map));
    Object.assign(arts, p.arts);
    Object.entries(p.arts).forEach(([k, a]) => { upd[`arts/${k}`] = a; });
    Object.entries(p.porMes).sort().forEach(([ym, b]) => {
      const filas = LP.filasMes(p.tipo, b), unidades = LP.unidadesDe(b);
      upd[`meses/${ym}/${p.tipo}`] = filas;
      upd[`meses/${ym}/meta/${p.tipo}`] = { archivo:nombre, hoja:p.hoja, subido:hoy, por:'importar-logistica-csv.js', filas:filas.length, unidades };
      if(p.tipo === 'envios'){ const r = LP.resumenPorSucursal(b, p.arts, slugDe); Object.entries(r).forEach(([slug, o]) => { upd[`porSuc/${slug}/${ym}`] = o; }); }
      console.log('  ', ym, 'filas', filas.length, 'unidades', unidades);
    });
    console.log('  artículos', Object.keys(p.arts).length, '· movimientos', p.filas, '· filas Total descartadas', p.desc);
  }
  const yms = Object.keys(upd).filter(k => /^meses\//.test(k)).map(k => k.split('/')[1]).sort();
  upd.ultimo = yms[yms.length-1];
  const body = JSON.stringify(upd);
  console.log('payload', (body.length/1024/1024).toFixed(2), 'MB · claves', Object.keys(upd).length, '· último', upd.ultimo);
  if(dry) return;
  const r = await fetch(`${FB}.json`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body });
  console.log('PATCH', r.status);
})();
