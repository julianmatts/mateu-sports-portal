/* ============================================================
 * cargar-pedido-nike.mjs
 *
 * Carga una OC (pedido de compra) de Nike calzado a la base Firebase del módulo
 * Control de Recepciones. Reforma la hoja "Resumen Pedido" del Excel de Nike
 * (modelo × talles) a un documento de pedido con líneas por dimensión.
 *
 *   node scripts/cargar-pedido-nike.mjs <archivo.xlsx> <FIREBASE_DB_URL> [--commit] [--rubro CALZADO]
 *
 * Sin --commit hace dry-run. Necesita: npm i xlsx
 *
 * - Toma las filas con Total Unidades > 0 de la hoja "Resumen Pedido".
 * - cantidad = Total Unidades · costo_unitario = Precio Whsl.
 * - TRADUCE la taxonomía de Nike a la nuestra (para que cruce con los ingresos):
 *     rubro     = CALZADO (fijo; --rubro para cambiarlo)
 *     disciplina = DISC_MAP[Categoria]   (Nike Categoria -> nuestra disciplina)
 *     tipo       = TIPO_MAP[Genero]      (MEN/WOMEN/UNISEX -> CALZADO ADULTO, KIDS -> NIÑO)
 *   Ajustá DISC_MAP / TIPO_MAP si algún valor no cruza con los ingresos.
 * - nº de OC y fecha se derivan del NOMBRE DEL ARCHIVO (ej. "...Nike Calzado
 *   julio 26..." -> nro "Nike Calzado julio 26", fecha 2026-07-01).
 * - Agrega líneas por (rubro,disciplina,tipo) y hace PATCH en recepciones/pedidos.
 * ============================================================ */
import XLSX from 'xlsx';
import path from 'node:path';

// ---- Tablas de traducción (EDITAR acá si algo no cruza) ----
const DISC_MAP = {
  'RUNNING':'RUNNING',
  'FOOTBALL/SOCCER':'FUTBOL 11',   // Nike no separa 11/5/futsal; se asume FUTBOL 11
  'NIKE BASKETBALL':'BASQUET',
  'MEN TRAINING':'TRAINING',
  'SPORTSWEAR':'CASUAL',
  'TENNIS':'TENIS',
  'JORDAN BRAND':'JORDAN',
  'YOUNG ATHLETES':'CASUAL',       // línea de chicos; disciplina incierta
};
const TIPO_MAP = { 'MEN':'CALZADO ADULTO','WOMEN':'CALZADO ADULTO','UNISEX':'CALZADO ADULTO','KIDS':'CALZADO NIÑO' };
const MESES = { enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12 };

const [,, FILE, DBURL, ...flags] = process.argv;
const COMMIT = flags.includes('--commit');
const RUBRO = (flags.includes('--rubro') ? flags[flags.indexOf('--rubro')+1] : 'CALZADO');
if(!FILE || !DBURL){ console.error('uso: node scripts/cargar-pedido-nike.mjs <xlsx> <FIREBASE_DB_URL> [--commit] [--rubro CALZADO]'); process.exit(1); }

const num = x => { const n=Number(x); return isFinite(n)?n:0; };
function fbKey(nro){ return String(nro||'').trim().replace(/[.#$/\[\]]/g,'~'); }

// ---- nro / fecha / marca desde el nombre de archivo ----
function fromFilename(fp){
  let base = path.basename(fp).replace(/\.[^.]+$/,'');
  const low = base.toLowerCase();
  let mes=0, anio=0;
  for(const [k,v] of Object.entries(MESES)){ if(low.includes(k)){ mes=v; const m=low.slice(low.indexOf(k)).match(/(\d{2,4})/); if(m){ anio = m[1].length===2 ? 2000+ +m[1] : +m[1]; } break; } }
  const fecha = (mes&&anio) ? anio+'-'+String(mes).padStart(2,'0')+'-01' : '';
  const marca = /adidas/i.test(low) ? 'adidas' : (/nike/i.test(low) ? 'Nike' : base.split(/\s+/)[0]);
  // nro = nombre de archivo (sin "Copia de" ni extensión). Se conserva el resto
  // —incluido cualquier "(002)"— para que dos OCs del mismo mes no colisionen.
  const nro = base.replace(/^\s*copia de\s*/i,'').replace(/\s+/g,' ').trim();
  return { nro, fecha, marca };
}

const wb = XLSX.readFile(FILE);
const sheet = wb.SheetNames.includes('Resumen Pedido') ? 'Resumen Pedido' : wb.SheetNames[0];
const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheet], {header:1, defval:''});
const H = raw[1];
const col = n => H.indexOf(n);
const iMat=col('Material Nike'), iCat=col('Categoria'), iGen=col('Genero'), iPw=col('Precio Whsl'), iTot=col('Total Unidades');
if(iTot<0){ console.error('No encontré la columna "Total Unidades" (headerRow=2). Hoja:', sheet); process.exit(1); }

const meta = fromFilename(FILE);
const lineasAgg = {}; const transCat={}, transGen={}, sinMapCat=new Set(), sinMapGen=new Set();
let srcUnid=0, srcVal=0;
for(let i=2;i<raw.length;i++){
  const r=raw[i]; const tot=num(r[iTot]); if(tot<=0) continue;
  if(/^total/i.test(String(r[iMat]||'').trim())) continue;   // saltear la fila de totales de la hoja
  const cat=String(r[iCat]||'').trim().toUpperCase(), gen=String(r[iGen]||'').trim().toUpperCase();
  const disciplina = DISC_MAP[cat] || cat || 'SIN DISCIPLINA';
  const tipo = TIPO_MAP[gen] || 'CALZADO ADULTO';
  if(!DISC_MAP[cat] && cat) sinMapCat.add(cat);
  if(!TIPO_MAP[gen] && gen) sinMapGen.add(gen);
  transCat[cat+' -> '+disciplina]=(transCat[cat+' -> '+disciplina]||0)+tot;
  transGen[gen+' -> '+tipo]=(transGen[gen+' -> '+tipo]||0)+tot;
  const pw=num(r[iPw]); srcUnid+=tot; srcVal+=tot*pw;
  const k=RUBRO+'|'+disciplina+'|'+tipo;
  const L=lineasAgg[k]||(lineasAgg[k]={rubro:RUBRO,disciplina,tipo,_cant:0,_val:0});
  L._cant+=tot; L._val+=tot*pw;
}
const lineas = Object.values(lineasAgg).map(L=>({ rubro:L.rubro, disciplina:L.disciplina, tipo:L.tipo, cantidad:L._cant, costo_unitario: L._cant>0?L._val/L._cant:0 }));

const doc = { nro:meta.nro, fecha:meta.fecha, comprador:'', proveedor:'Nike Argentina', marca:meta.marca, moneda:'ARS', creado_en:'import '+new Date().toISOString().slice(0,10), lineas };

console.log('=== OC detectada (del nombre de archivo) ===');
console.log('nro:', doc.nro, '| fecha:', doc.fecha || '(no detectada)', '| marca:', doc.marca);
console.log('líneas (agregadas por rubro/disciplina/tipo):', lineas.length, '| unidades:', srcUnid, '| valorizado:', Math.round(srcVal));
console.log('\n--- traducción Categoria -> disciplina (unidades) ---'); Object.entries(transCat).sort().forEach(([k,v])=>console.log('  '+k+': '+v));
console.log('--- traducción Genero -> tipo (unidades) ---'); Object.entries(transGen).sort().forEach(([k,v])=>console.log('  '+k+': '+v));
if(sinMapCat.size) console.log('⚠ Categorias sin mapeo (quedaron tal cual):', [...sinMapCat].join(', '));
if(sinMapGen.size) console.log('⚠ Generos sin mapeo (-> CALZADO ADULTO):', [...sinMapGen].join(', '));
console.log('\n--- líneas resultantes ---'); lineas.forEach(l=>console.log('  '+l.rubro+' / '+l.disciplina+' / '+l.tipo+': '+l.cantidad+' u · costo '+Math.round(l.costo_unitario)));

if(!doc.fecha){ console.error('\n✗ No pude detectar la fecha del nombre. Renombrá con el mes (ej. "... julio 26 ...").'); process.exit(1); }
if(!COMMIT){ console.log('\n(dry-run — no se escribió nada. Agregá --commit para cargar.)'); process.exit(0); }

const url = DBURL.replace(/\/+$/,'')+'/recepciones/pedidos/'+fbKey(doc.nro)+'.json';
console.log('\nEscribiendo (PUT) a', url, '…');
const res = await fetch(url, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(doc) });
if(!res.ok){ console.error('ERROR Firebase HTTP', res.status, await res.text()); process.exit(1); }
console.log('✓ OC cargada OK.');
