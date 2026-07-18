/* ============================================================
 * cargar-remitos-estadistica.mjs
 *
 * Carga los ingresos del reporte "Estadistica de remitos" (formato matriz por
 * mes) a la base Firebase del módulo Control de Recepciones (recepciones/).
 *
 *   node scripts/cargar-remitos-estadistica.mjs <archivo.xlsx> <FIREBASE_DB_URL> [--commit]
 *
 * Sin --commit hace dry-run (previsualiza totales, no escribe). Necesita xlsx:
 *   npm i xlsx
 *
 * FORMATO DE ENTRADA (una hoja): una fila por artículo-en-remito. Columnas:
 *   Marca, Proveedor, Rubro, Subrubro, Disciplina, Grupo 1, Nro.remito,
 *   Artículo, Código barras, y pares por mes "MM-YY Cantidad" / "MM-YY Valorizado"
 *   (+ Total). Cada fila trae cantidad en la columna del mes del remito.
 *
 * REFORMA → documentos del módulo (recepciones/remitos/<key>):
 *   - Agrupa por (Nro.remito, Marca). Si un remito tiene varias marcas, se
 *     desdobla en un doc por marca (nro "· marca") para no perder ese corte.
 *   - Agrega las líneas por dimensión: rubro=Rubro, disciplina=Disciplina,
 *     tipo=Grupo 1 (validado con Juli). costo_unitario = Valorizado / Cantidad.
 *   - fecha = 1° del mes del remito (el reporte es mensual, no trae día).
 *   - semana = ISO de esa fecha. pedido_nro = '' (el reporte no trae OC).
 *   - Escribe con PATCH (merge) en recepciones/remitos: agrega/actualiza por
 *     clave (nº de remito) sin borrar lo existente.
 * ============================================================ */
import XLSX from 'xlsx';

const [,, FILE, DBURL, ...flags] = process.argv;
const COMMIT = flags.includes('--commit');
if(!FILE || !DBURL){ console.error('uso: node scripts/cargar-remitos-estadistica.mjs <xlsx> <FIREBASE_DB_URL> [--commit]'); process.exit(1); }

const num = x => { const n=Number(x); return isFinite(n)?n:0; };
function fbKey(nro){ return String(nro||'').trim().replace(/[.#$/\[\]]/g,'~'); }
function pad2(n){ return (n<10?'0':'')+n; }
function semanaISO(fecha){
  const p=String(fecha).split('-'); const d=new Date(Date.UTC(+p[0],+p[1]-1,+p[2]));
  const day=(d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-day+3); const jueves=d.getTime();
  d.setUTCMonth(0,1); if(d.getUTCDay()!==4) d.setUTCMonth(0,1+((4-d.getUTCDay())+7)%7);
  return 'Sem '+String(1+Math.round((jueves-d.getTime())/(7*864e5))).padStart(2,'0');
}

const wb = XLSX.readFile(FILE);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {raw:true, defval:''});
if(!rows.length){ console.error('El Excel no tiene filas.'); process.exit(1); }

// Detectar dinámicamente las columnas de mes: "MM-YY Cantidad" (excluye "Total").
const MESES = Object.keys(rows[0])
  .map(h => (h.match(/^(\d{2})-(\d{2}) Cantidad$/)||[])[0] ? h.replace(/ Cantidad$/,'') : null)
  .filter(Boolean);
if(!MESES.length){ console.error('No se detectaron columnas "MM-YY Cantidad".'); process.exit(1); }
function mesAFecha(m){ const [mm,yy]=m.split('-'); return '20'+yy+'-'+pad2(+mm)+'-01'; }
console.log('meses detectados:', MESES.join(', '));

// 1) marcas por remito (para desdoblar los multi-marca)
const marcasPorRemito = {};
for(const r of rows){ const n=r['Nro.remito']; (marcasPorRemito[n]=marcasPorRemito[n]||new Set()).add(r['Marca']); }

// 2) agrupar por (nro, marca), agregar líneas por (rubro, disciplina, tipo)
const docs = {}; let srcUnid=0, srcVal=0;
for(const r of rows){
  const nro=r['Nro.remito']; if(!nro) continue;
  const marca=String(r['Marca']||'Desconocida').trim();
  const mes=MESES.find(m=>num(r[m+' Cantidad'])>0); if(!mes) continue;
  const cant=num(r[mes+' Cantidad']), val=num(r[mes+' Valorizado']);
  srcUnid+=cant; srcVal+=val;
  const multi = marcasPorRemito[nro].size>1;
  const docNro = multi ? (nro+' · '+marca) : nro;
  const key = fbKey(docNro);
  let d = docs[key];
  if(!d){ const fecha=mesAFecha(mes); d = docs[key] = { nro:docNro, fecha, proveedor:String(r['Proveedor']||'').trim(), marca, pedido_nro:'', semana:semanaISO(fecha), creado_en:'import '+new Date().toISOString().slice(0,10), _lineas:{} }; }
  const cod=String(r['Código barras']||'').trim(), art=String(r['Artículo']||'').trim(); const lk = cod+'|'+art+'|'+(r['Rubro']||'')+'|'+(r['Disciplina']||'')+'|'+(r['Grupo 1']||'');
  const L = d._lineas[lk] || (d._lineas[lk]={ modelo:cod, descripcion:art, rubro:String(r['Rubro']||'').trim(), disciplina:String(r['Disciplina']||'').trim(), tipo:String(r['Grupo 1']||'').trim(), _cant:0, _val:0 });
  L._cant+=cant; L._val+=val;
}

// 3) materializar líneas (costo_unitario = valorizado / cantidad)
let outUnid=0, outVal=0, nLineas=0;
for(const d of Object.values(docs)){
  d.lineas = Object.values(d._lineas).map(L=>{ const cu=L._cant>0?L._val/L._cant:0; outUnid+=L._cant; outVal+=L._cant*cu; nLineas++; return { modelo:L.modelo, descripcion:L.descripcion, rubro:L.rubro, disciplina:L.disciplina, tipo:L.tipo, cantidad:L._cant, costo_unitario:cu }; });
  delete d._lineas;
}

console.log('=== RESUMEN ===');
console.log('remitos (docs):', Object.keys(docs).length, '| líneas:', nLineas);
console.log('unidades origen:', srcUnid, '| cargadas:', outUnid, srcUnid===outUnid?'✓':'✗');
console.log('valorizado origen:', Math.round(srcVal), '| reconstruido:', Math.round(outVal), Math.abs(srcVal-outVal)<1?'✓':'(dif '+Math.round(srcVal-outVal)+')');

if(!COMMIT){ console.log('\n(dry-run — no se escribió nada. Agregá --commit para cargar.)'); process.exit(0); }

const url = DBURL.replace(/\/+$/,'')+'/recepciones/remitos.json';
console.log('\nEscribiendo (PATCH) a', url, '…');
const res = await fetch(url, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(docs) });
if(!res.ok){ console.error('ERROR Firebase HTTP', res.status, await res.text()); process.exit(1); }
console.log('✓ Cargado OK (', Object.keys(docs).length, 'remitos ).');
