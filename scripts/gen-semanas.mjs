/* ============================================================
   gen-semanas.mjs — injerta el desglose SEMANA A SEMANA (semanas
   retail Lu-Do) en los JSON ya generados de data/indicadores/.

   Es un helper self-contained (solo fs+zlib, sin Python ni npm; mismo
   truco que gestion-stock/generar-datos-meses-stock.js) para poblar el
   campo `semanas` sin tener que reejecutar todo el ETL de Python. Lee los
   Excel de ventas (los mismos que come el ETL) y agrega por semana; el
   resto de los números (mensuales) los toma como están en el repo.

   La regla de semana (lunes a domingo, la que contiene el 1° del mes es la
   Semana 1 de ese mes) es la misma que scripts/etl_indicadores.py.

   Uso:
     node scripts/gen-semanas.mjs            # dry-run: valida contra el mensual
     node scripts/gen-semanas.mjs --write    # escribe los JSON
   Rutas de los Excel: por defecto en ~/Downloads (editar PERIODOS si cambia).
   ============================================================ */
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';
import url from 'url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const DL = 'C:/Users/julia/Downloads';
const WRITE = process.argv.includes('--write');

const PERIODOS = {
  '2026-05': { xlsx: DL + '/Ventas por sucursal y vendedores mayo 26.xlsx', desde: '2026-04-27', hasta: '2026-05-31' },
  '2026-06': { xlsx: DL + '/Venta por vendedores y sucursales.xlsx',        desde: '2026-06-01', hasta: '2026-06-28' },
};
const DOW = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const sinAcento = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

// ---------- xlsx (fs+zlib) ----------
function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--) { if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('xlsx inválido (no EOCD)');
  const cdCount = buf.readUInt16LE(eocd + 10); let off = buf.readUInt32LE(eocd + 16); const files = {};
  for (let n = 0; n < cdCount; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10), compSize = buf.readUInt32LE(off + 20), fnLen = buf.readUInt16LE(off + 28),
      exLen = buf.readUInt16LE(off + 30), cmLen = buf.readUInt16LE(off + 32), localOff = buf.readUInt32LE(off + 42),
      name = buf.toString('utf8', off + 46, off + 46 + fnLen);
    files[name] = { method, compSize, localOff }; off += 46 + fnLen + exLen + cmLen;
  }
  return { buf, files };
}
function extract(zip, name) {
  const f = zip.files[name]; if (!f) throw new Error('falta ' + name);
  const b = zip.buf, fnLen = b.readUInt16LE(f.localOff + 26), exLen = b.readUInt16LE(f.localOff + 28),
    start = f.localOff + 30 + fnLen + exLen, comp = b.subarray(start, start + f.compSize);
  if (f.method === 0) return comp; if (f.method === 8) return zlib.inflateRawSync(comp); throw new Error('method ' + f.method);
}
function decode(s) { return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'"); }
function parseShared(xml) { const out = []; xml.replace(/<si>([\s\S]*?)<\/si>/g, (m, inner) => { let t = ''; inner.replace(/<t[^>]*>([\s\S]*?)<\/t>/g, (x, y) => { t += y; return x; }); out.push(decode(t)); return m; }); return out; }
function* filas(xlsxPath) {
  const zip = readZip(fs.readFileSync(xlsxPath));
  const shared = zip.files['xl/sharedStrings.xml'] ? parseShared(extract(zip, 'xl/sharedStrings.xml').toString('utf8')) : [];
  const sheet = extract(zip, 'xl/worksheets/sheet1.xml').toString('utf8');
  const re = /<row\b[^>]*>([\s\S]*?)<\/row>/g; let m;
  while ((m = re.exec(sheet))) {
    const rec = {};
    m[1].replace(/<c\b[^>]*r="([A-Z]+)\d+"(?:[^>]*t="([^"]*)")?[^>]*>(?:<v>([\s\S]*?)<\/v>|<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>)?<\/c>/g,
      (x, col, typ, val, inl) => { let v = inl !== undefined ? decode(inl) : val; if (typ === 's' && val !== undefined) v = shared[+val]; rec[col] = v; return x; });
    yield rec;
  }
}

// ---------- fechas / semanas ----------
const dateUTC = s => new Date(s + 'T00:00:00Z');
const dow = d => (d.getUTCDay() + 6) % 7;                 // 0 = lunes
function mondayOf(d) { const x = new Date(d); x.setUTCDate(x.getUTCDate() - dow(x)); return x; }
function idxFechas(desde, hasta) {                        // (día, dow-normalizado) -> fecha
  const idx = {}; const f = new Date(desde);
  while (f <= hasta) { idx[f.getUTCDate() + '|' + sinAcento(DOW[dow(f)])] = new Date(f); f.setUTCDate(f.getUTCDate() + 1); }
  return idx;
}
function semRetail(f, desde) { return Math.round((mondayOf(f) - mondayOf(desde)) / (7 * 86400000)) + 1; }
function rangoSem(s, desde, hasta) {
  const lun0 = mondayOf(desde), ini = new Date(lun0); ini.setUTCDate(ini.getUTCDate() + (s - 1) * 7);
  const fin = new Date(ini); fin.setUTCDate(fin.getUTCDate() + 6);
  const iniV = ini < desde ? desde : ini, finV = fin > hasta ? hasta : fin;
  const fmt = d => String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0');
  return fmt(iniV) + '–' + fmt(finV);
}

// ---------- proceso de un período ----------
function procesar(per) {
  const cfg = PERIODOS[per], desde = dateUTC(cfg.desde), hasta = dateUTC(cfg.hasta);
  const idx = idxFechas(desde, hasta);
  const nSem = semRetail(hasta, desde);
  // acumuladores por (suc|vend|sem)
  const vend = {};     // key suc|vend -> {sem -> {tickComp:Set, u, i}}
  let huerfanas = 0, dowSet = new Set();
  let first = true;
  for (const r of filas(cfg.xlsx)) {
    if (first) { first = false; continue; }              // header
    const suc = r.A, ds = r.B, dia = parseInt(r.C, 10), vendedor = r.D, comp = r.F || '';
    const cant = +r.G, imp = +r.H;
    if (!suc || suc === 'Total' || suc === '05-Depósito' || r.C === 'Total') continue;
    dowSet.add(ds);
    const fecha = idx[dia + '|' + sinAcento(ds)];
    if (!fecha) { huerfanas++; continue; }
    const sem = semRetail(fecha, desde);
    const esNC = /^Nc/i.test(comp);
    const key = suc + '|' + vendedor;
    const b = (vend[key] = vend[key] || {});
    const w = (b[sem] = b[sem] || { comp: new Set(), u: 0, i: 0 });
    if (esNC) { w.u += (isFinite(cant) ? cant : 0); w.i += (isFinite(imp) ? imp : 0); }         // NC: suma dev (negativo)
    else if (cant > 0) { w.comp.add(comp); w.u += cant; w.i += (isFinite(imp) ? imp : 0); }     // venta real
  }
  return { vend, nSem, desde, hasta, huerfanas, dows: [...dowSet] };
}

function semanasLista(byS, nSem, desde, hasta) {
  const out = [];
  for (let s = 1; s <= nSem; s++) {
    const w = byS[s]; if (!w) continue;
    out.push({ n: s, rango: rangoSem(s, desde, hasta), tickets: w.comp.size,
      unidades_netas: Math.round(w.u * 100) / 100, importe_neto: Math.round(w.i * 100) / 100 });
  }
  return out;
}

function main() {
  let totalWrites = 0;
  for (const per of Object.keys(PERIODOS)) {
    const dir = path.join(REPO, 'data', 'indicadores', per);
    if (!fs.existsSync(dir)) { console.log('sin carpeta ' + dir + ', salteo'); continue; }
    const { vend, nSem, desde, hasta, huerfanas, dows } = procesar(per);
    console.log(`\n=== ${per} (${nSem} semanas · ${huerfanas} filas huérfanas · dows=${dows.join(',')}) ===`);

    const archivos = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'cadena.json');
    let okSuc = 0, warnSuc = 0;
    for (const arch of archivos) {
      const fp = path.join(dir, arch);
      const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
      const suc = d.sucursal;
      // per-vendedor
      const sucSemAgg = {};   // sem -> {comp:Set, u, i}  solo medibles (horas_contr>0)
      const todoMedible = suc === '99-Ecommerce';   // Ecommerce no tiene piso: se suma completo (como el ETL)
      for (const v of (d.vendedores || [])) {
        const byS = vend[suc + '|' + v.vendedor] || {};
        v.semanas = semanasLista(byS, nSem, desde, hasta);
        if (todoMedible || v.horas_contr > 0) {
          for (const s of Object.keys(byS)) {
            const w = byS[s], a = (sucSemAgg[s] = sucSemAgg[s] || { comp: new Set(), u: 0, i: 0 });
            for (const c of w.comp) a.comp.add(c); a.u += w.u; a.i += w.i;
          }
        }
      }
      d.summary.semanas = semanasLista(sucSemAgg, nSem, desde, hasta);
      // validación: suma semanal (medible) vs mensual del summary
      const sumT = d.summary.semanas.reduce((x, w) => x + w.tickets, 0);
      const difT = sumT - d.summary.tickets;
      if (Math.abs(difT) > 2) { warnSuc++; console.log(`  ⚠ ${suc}: Σsem tickets=${sumT} vs mensual=${d.summary.tickets} (dif ${difT})`); }
      else okSuc++;
      if (WRITE) { fs.writeFileSync(fp, JSON.stringify(d)); totalWrites++; }
    }
    console.log(`  sucursales OK ${okSuc} · con aviso ${warnSuc}`);
  }
  console.log(WRITE ? `\n✔ escritos ${totalWrites} archivos` : `\n(dry-run — usar --write para escribir)`);
}
main();
