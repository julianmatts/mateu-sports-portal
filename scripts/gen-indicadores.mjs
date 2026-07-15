/* ============================================================
   gen-indicadores.mjs — genera la SALIDA PARTICIONADA de Indicadores
   de Sucursal a partir del dataset combinado.

   Contexto: el cálculo de los tres KPIs (UPT, tickets/hora, ticket
   promedio) y de las secciones vive en el ETL (scripts/etl_indicadores.py,
   pendiente de subir al repo). Este script hace la parte (a) del pedido:
   toma el dataset combinado que hoy emite el ETL —embebido en el HTML
   prototipo `indicadores_sucursales_mateu.html`, o un .json suelto— y lo
   parte en un archivo por sucursal + uno de cadena por período. Así el
   navegador de un usuario de sucursal SOLO se baja el JSON de su sucursal
   (+ el de cadena, sin personas), nunca el de las 20 juntas.

   Uso:
     node scripts/gen-indicadores.mjs <dataset...>
   Acepta:
     - uno o varios JSON de la salida del ETL (indicadores-<periodo>.json), o
     - el JSON combinado (mapa {periodo: {...}}), o
     - el HTML prototipo con la data embebida en <script id="data">.
   Si no se pasa nada, busca ../indicadores_sucursales_mateu.html relativo
   a la raíz del repo (la ubicación por defecto en Descargas).

   Nota: el propio ETL (scripts/etl_indicadores.py) ya emite esta salida
   particionada; este generador sirve para rehacerla en el repo a partir del
   JSON del ETL sin tener que reejecutar Python.

   Salida (bajo data/indicadores/):
     objetivos.json                 targets por formato (fijo, ver ABAJO)
     periodos.json                  lista de períodos disponibles
     <periodo>/cadena.json          agregados de las 20 sucursales, SIN personas
     <periodo>/<NN-Nombre>.json     KPIs + personas de esa sucursal
   ============================================================ */
import fs from 'fs';
import path from 'path';
import url from 'url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const OUT = path.join(REPO, 'data', 'indicadores');

// Objetivos por formato — provistos por Producto. El cumplimiento de cada
// sucursal se mide SIEMPRE contra el objetivo de SU formato, nunca contra el
// promedio de la cadena.
const OBJETIVOS = {
  MS:       { tickets_hora: 1.30, upt: 1.85, ticket_promedio: 118000 },
  Adidas:   { tickets_hora: 1.75, upt: 1.55, ticket_promedio: 185000 },
  Outlet:   { tickets_hora: 1.45, upt: 2.00, ticket_promedio: 95000  },
  Aurelius: { tickets_hora: 0.80, upt: 1.60, ticket_promedio: 155000 },
  Kids:     { tickets_hora: 1.10, upt: 1.55, ticket_promedio: 80000  },
};

// Mes retail (id de período AAAA-MM) -> mes del dataset de Meses de Stock.
const MES_STOCK = { '01':'ENERO','02':'FEBRERO','03':'MARZO','04':'ABRIL','05':'MAYO',
  '06':'JUNIO','07':'JULIO','08':'AGOSTO','09':'SEPTIEMBRE','10':'OCTUBRE','11':'NOVIEMBRE','12':'DICIEMBRE' };
const MES_NOMBRE = { '01':'Enero','02':'Febrero','03':'Marzo','04':'Abril','05':'Mayo','06':'Junio',
  '07':'Julio','08':'Agosto','09':'Septiembre','10':'Octubre','11':'Noviembre','12':'Diciembre' };

const ECOM = '99-Ecommerce';
const GRUPOS_PISO = ['Ventas', 'Caja', 'Jefatura', 'Refuerzos'];

// Formato deducido del nombre de la sucursal.
export function formatoDe(nombre) {
  const n = (nombre || '').toLowerCase();
  if (n.includes('ecommerce')) return 'Ecommerce';
  if (n.includes('aurelius')) return 'Aurelius';
  if (n.includes('adidas'))   return 'Adidas';
  if (n.includes('outlet'))   return 'Outlet';
  if (n.includes('kids'))     return 'Kids';
  return 'MS';
}
// Nombre de sucursal -> nombre de archivo. "01-MS Plaza Italia" -> "01-MS-Plaza-Italia".
export function archivoDe(nombre) {
  return nombre.replace(/\./g, '').replace(/\s+/g, '-');
}

function leerDataset(ruta) {
  const txt = fs.readFileSync(ruta, 'utf8');
  let obj;
  if (ruta.endsWith('.json')) obj = JSON.parse(txt);
  else {
    const m = txt.match(/<script id="data"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) throw new Error('No encontré <script id="data"> en ' + ruta);
    obj = JSON.parse(m[1]);
  }
  // Un archivo puede ser un período suelto ({periodo, ...}) o el mapa combinado.
  return obj.periodo ? { [obj.periodo]: obj } : obj;
}

function agregarMix(vendedores) {
  const g = {};
  for (const v of vendedores) {
    if (v.horas_contr > 0 && GRUPOS_PISO.includes(v.grupo)) {
      g[v.grupo] = g[v.grupo] || { h: 0, t: 0 };
      g[v.grupo].h += v.horas_contr;
      g[v.grupo].t += v.tickets;
    }
  }
  return g;
}

function main() {
  const args = process.argv.slice(2);
  const rutas = args.length
    ? args.map(a => path.resolve(a))
    : [path.resolve(REPO, '..', 'indicadores_sucursales_mateu.html')];
  const RAW = {};
  for (const ruta of rutas) {
    if (!fs.existsSync(ruta)) {
      console.error('No existe el dataset: ' + ruta);
      console.error('Uso: node scripts/gen-indicadores.mjs <archivo.html|.json> [...]');
      process.exit(1);
    }
    Object.assign(RAW, leerDataset(ruta));
  }
  const periodos = Object.keys(RAW).sort();

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'objetivos.json'), JSON.stringify(OBJETIVOS, null, 2));

  const periodosMeta = [];
  const resumen = [];

  for (const p of periodos) {
    const d = RAW[p];
    const mm = p.slice(5);
    const dir = path.join(OUT, p);
    fs.mkdirSync(dir, { recursive: true });

    // Índices por sucursal.
    const porSuc = {};
    for (const s of d.sucursales) porSuc[s.sucursal] = { summary: s, vendedores: [], cobertura: [], heatmap: [] };
    for (const v of (d.vendedores || [])) (porSuc[v.sucursal] || (porSuc[v.sucursal] = { vendedores: [], cobertura: [], heatmap: [] })).vendedores.push(v);
    for (const c of (d.cobertura || [])) (porSuc[c.sucursal] || (porSuc[c.sucursal] = { vendedores: [], cobertura: [], heatmap: [] })).cobertura.push(c);
    for (const h of (d.heatmap || [])) (porSuc[h.sucursal] || (porSuc[h.sucursal] = { vendedores: [], cobertura: [], heatmap: [] })).heatmap.push(h);

    // cadena.json — agregados de todas las sucursales, SIN personas.
    const sucAgg = d.sucursales.map(s => ({ ...s, formato: formatoDe(s.sucursal) }));
    const mixCadena = agregarMix((d.vendedores || []).filter(v => v.sucursal !== ECOM));
    fs.writeFileSync(path.join(dir, 'cadena.json'), JSON.stringify({
      periodo: p, meta: d.meta, mesStock: MES_STOCK[mm], sucursales: sucAgg, mix: mixCadena,
    }));

    // Un archivo por sucursal, con su detalle de personas.
    let nArch = 0;
    for (const s of d.sucursales) {
      const bucket = porSuc[s.sucursal];
      const obj = {
        periodo: p, meta: d.meta, mesStock: MES_STOCK[mm],
        sucursal: s.sucursal, formato: formatoDe(s.sucursal),
        summary: s,
        vendedores: bucket.vendedores,
        cobertura: bucket.cobertura,
        heatmap: bucket.heatmap,
      };
      fs.writeFileSync(path.join(dir, archivoDe(s.sucursal) + '.json'), JSON.stringify(obj));
      nArch++;
    }

    periodosMeta.push({
      id: p,
      label: (MES_NOMBRE[mm] || mm) + ' ' + p.slice(0, 4),
      dias: d.meta && d.meta.dias || '',
      habiles: d.meta && d.meta.habiles || null,
      semanas: d.meta && d.meta.semanas || null,
      mesStock: MES_STOCK[mm],
    });
    resumen.push(p + ': ' + nArch + ' sucursales, ' + (d.vendedores || []).length + ' personas');
  }

  // periodos.json — más nuevo primero.
  periodosMeta.sort((a, b) => b.id.localeCompare(a.id));
  fs.writeFileSync(path.join(OUT, 'periodos.json'), JSON.stringify({ periodos: periodosMeta }, null, 2));

  console.log('OK. Salida en data/indicadores/');
  for (const r of resumen) console.log('  ' + r);
}

main();
