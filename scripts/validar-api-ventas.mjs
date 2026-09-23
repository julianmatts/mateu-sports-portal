#!/usr/bin/env node
/* Validación de la API de Ventas (fase 1) contra el Portal y contra el export del sistema.
   La key NO va en el código: variable de entorno VENTAS_API_KEY (base opcional VENTAS_API_BASE).
     node scripts/validar-api-ventas.mjs semana   <lunesISO>                  → tabla Portal (ventaEquipo) vs. API, 21 sucursales
     node scripts/validar-api-ventas.mjs sucursal <lunesISO> <slug>           → vendedor por vendedor, día por día, rubro por rubro
     node scripts/validar-api-ventas.mjs lineas   <desde> <hasta> <NN> [csv]  → recalcula la semana desde /v1/ventas/lineas con el
                                                                                criterio EXACTO del Portal y, con el CSV del sistema
                                                                                («Ventas agosto portal.csv»: ;-separado, latin1, sin
                                                                                rótulos), cruza comprobante por comprobante.
   Ver docs/API-VENTAS-VALIDACION-2026-09-23.md. */
import fs from 'node:fs';
const BASE = (process.env.VENTAS_API_BASE || 'https://66-97-37-173.sslip.io').replace(/\/+$/, '');
const KEY = process.env.VENTAS_API_KEY || '';
const FB = 'https://recepciones-mateu-default-rtdb.firebaseio.com';
const SLUGS = { '01':'plaza','02':'kids','03':'calle-55','04':'aurelius-12','06':'city-bell','07':'aurelius-10','08':'calle-47','09':'adidas','10':'diagonal','11':'ensenada','12':'calle-12','13':'los-hornos','14':'gonnet','15':'originals','16':'berisso','17':'aurelius-cb','18':'aurelius-5','19':'calle-49','20':'av-44','21':'adidas-12','99':'ecommerce' };
if (!KEY) { console.error('Falta VENTAS_API_KEY'); process.exit(1); }

// GET a la API con hasta 3 intentos (la API tira 500 intermitentes)
async function api(path) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + KEY } });
    const j = await r.json().catch(() => null);
    if (r.ok && j) return j;
    console.error('  API', r.status, path, JSON.stringify(j).slice(0, 80), i < 2 ? '→ reintento' : '');
  }
  return null;
}
const fb = path => fetch(FB + path).then(r => (r.ok ? r.json() : null)).catch(() => null);
const n = v => (v == null ? '—' : Number(v).toLocaleString('es-AR'));
const pct = (d, base) => (base ? (100 * d / base).toFixed(1).replace('.', ',') + ' %' : '—');
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const [,, cmd, ...args] = process.argv;

if (cmd === 'semana') {
  const [sem] = args;
  const A = await api(`/v1/ventas/semana/${sem}`); if (!A) process.exit(1);
  console.log(`\n### Semana ${sem} · API actualizado ${A.actualizado}`);
  console.log('| Sucursal | Venta Portal | Venta API | Dif. | % | Tickets P/A | Unid. P/A |\n|---|---:|---:|---:|---:|:--:|:--:|');
  let tp = 0, ta = 0;
  for (const s of Object.values(SLUGS).sort()) {
    const x = A.sucursales[s];
    const f = await fb(`/ventaEquipo/${s}/${sem}/total.json`);
    if (!x) { console.log(`| ${s} | ${n(f && f.venta)} | (sin venta en la API) | | | | |`); continue; }
    if (!f || !f.venta || !f.tickets) { console.log(`| ${s} | (sin carga) | ${n(x.venta)} | | | —/${x.tickets} | —/${x.unidades} |`); continue; }
    const d = x.venta - f.venta; tp += f.venta; ta += x.venta;
    console.log(`| ${s} | ${n(f.venta)} | ${n(x.venta)} | ${d > 0 ? '+' : ''}${n(d)} | ${pct(d, f.venta)} | ${f.tickets}/${x.tickets}${f.tickets === x.tickets ? ' ✓' : ''} | ${f.unidades}/${x.unidades}${f.unidades === x.unidades ? ' ✓' : ''} |`);
  }
  console.log(`| **Total comparable** | ${n(tp)} | ${n(ta)} | ${n(ta - tp)} | ${pct(ta - tp, tp)} | | |`);
}

else if (cmd === 'sucursal') {
  const [sem, slug] = args;
  const A = await api(`/v1/ventas/semana/${sem}/sucursal/${slug}`);
  const F = await fb(`/ventaEquipo/${slug}/${sem}.json`);
  if (!A || !F) { console.log('falta un lado — API:', !!A, 'Portal:', !!F); process.exit(1); }
  console.log('Portal actualizado', F.actualizado, 'por', F.por, '| API actualizado', A.actualizado);
  console.log('TOTAL Portal', JSON.stringify(F.total), 'API', JSON.stringify(A.total));
  const idx = L => { const m = {}; (L || []).forEach(v => { m[norm(v.nombre)] = v; }); return m; };
  const AV = idx(A.vendedores), FV = idx(F.vendedores);
  const names = [...new Set([...Object.keys(AV), ...Object.keys(FV)])].sort((x, y) => (FV[y] || AV[y]).venta - (FV[x] || AV[x]).venta);
  console.log('\n| Vendedor | Venta Portal | Venta API | Dif. | Tickets P/A | Unid. P/A |\n|---|---:|---:|---:|:--:|:--:|');
  for (const k of names) { const f = FV[k] || {}, x = AV[k] || {}; console.log(`| ${k} | ${n(f.venta)} | ${n(x.venta)} | ${n((x.venta || 0) - (f.venta || 0))} | ${f.tickets || 0}/${x.tickets || 0} | ${f.unidades || 0}/${x.unidades || 0} |`); }
  const acc = (L, get) => { const m = {}; (L || []).forEach(v => get(v).forEach(([k, val]) => { m[k] = (m[k] || 0) + val; })); return m; };
  const dF = acc(F.vendedores, v => (v.dias || []).map(d => [d.d, d.v]));
  const dA = acc(A.vendedores, v => (v.dias || []).map(d => [d.d, d.v != null ? d.v : d.venta]));
  console.log('\nPor día (Portal / API (dif)):', ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].filter(d => dF[d] || dA[d]).map(d => `${d} ${n(dF[d] || 0)} / ${n(dA[d] || 0)} (${n((dA[d] || 0) - (dF[d] || 0))})`).join(' · '));
  const rF = acc(F.vendedores, v => Object.entries(v.rubros || {})), rA = acc(A.vendedores, v => Object.entries(v.rubros || {}));
  console.log('Por rubro:', [...new Set([...Object.keys(rF), ...Object.keys(rA)])].map(r => `${r} ${n(rF[r] || 0)} / ${n(rA[r] || 0)} (${n((rA[r] || 0) - (rF[r] || 0))})`).join(' · '));
}

else if (cmd === 'lineas') {
  const [desde, hasta, suc, csv] = args;
  let cur = null; const L = [];
  do {
    const j = await api(`/v1/ventas/lineas?desde=${desde}&hasta=${hasta}&sucursal=${suc}` + (cur ? '&cursor=' + encodeURIComponent(cur) : ''));
    if (!j) process.exit(1);
    L.push(...j.lineas); cur = j.cursor;
  } while (cur);
  const A = L.map(l => ({ fecha: l.fecha, nro: l.comprobante, art: l.articulo, rub: l.rubro, cant: +l.cantidad || 0, imp: +l.importe || 0, vend: l.vendedor || '' }));
  console.log('API líneas', A.length, '· fechas', [...new Set(A.map(l => l.fecha))].sort().join(' '), '· vendedor vacío:', A.filter(l => !l.vend).length, '· líneas %%%:', A.filter(l => /^%%%/.test(l.art)).length);
  const nc = A.filter(l => /^nc/i.test(l.nro));
  console.log('líneas Nc', nc.length, '· con importe positivo', nc.filter(l => l.imp > 0).length, '(en el export del sistema TODAS vienen negativas)');
  const esNc = nro => /^nc/i.test(nro);
  // criterio EXACTO del Portal (veAgregarSemana en indicadores/): todas las líneas, cada una a su
  // vendedor; ticket = comprobante que no es Nc, tenga o no unidades; total del local = comprobantes distintos
  function exacto(lineas, ncNegadas) {
    const comps = new Map();
    lineas.forEach(l => {
      let c = comps.get(l.nro); if (!c) { c = { nc: esNc(l.nro), vends: {} }; comps.set(l.nro, c); }
      let imp = l.imp, cant = l.cant;
      if (ncNegadas && c.nc) { imp = -Math.abs(imp); cant = -Math.abs(cant); }
      const v = l.vend || 'SIN ASIGNAR';
      c.vends[v] = c.vends[v] || { imp: 0, cant: 0 };
      c.vends[v].imp += imp; c.vends[v].cant += cant;
    });
    let venta = 0, unidades = 0, tickets = 0; const porV = {};
    for (const c of comps.values()) {
      if (!c.nc) tickets++;
      for (const [v, x] of Object.entries(c.vends)) {
        venta += x.imp; unidades += x.cant;
        porV[v] = porV[v] || { venta: 0, unidades: 0, tickets: 0 };
        porV[v].venta += x.imp; porV[v].unidades += x.cant; if (!c.nc) porV[v].tickets++;
      }
    }
    return { venta: Math.round(venta), unidades: Math.round(unidades), tickets, comprobantes: comps.size, porV };
  }
  for (const [nom, neg] of [['EXACTO con las líneas tal cual', false], ['EXACTO con las Nc negadas (como el export)', true]]) {
    const { porV, ...t } = exacto(A, neg);
    console.log(nom, JSON.stringify(t));
    Object.entries(porV).sort((x, y) => y[1].venta - x[1].venta).slice(0, 5).forEach(([v, x]) => console.log('   ', v, n(Math.round(x.venta)), 't' + x.tickets, 'u' + Math.round(x.unidades)));
  }
  if (!csv) process.exit(0);
  // cruce con el export del sistema (sin rótulos): Sucursal · Día semana · Día · Vendedor · Hora ·
  // Nro.comprobante · Artículo · Rubro · Cantidad · Importe. «Día» es el día del mes del archivo.
  const txt = new TextDecoder('latin1').decode(fs.readFileSync(csv));
  const rows = txt.split(/\r?\n/).filter(Boolean).map(l => l.split(';'));
  const mes = desde.slice(0, 7);
  const num = s => { s = String(s).trim(); if (/,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); return +s || 0; };
  const E = rows.filter(r => String(r[0]).trim().startsWith(suc + '-')).map(r => {
    const d = parseInt(r[2], 10);
    return { fecha: d >= 1 && d <= 31 ? mes + '-' + String(d).padStart(2, '0') : null, nro: String(r[5]).trim(), art: String(r[6]).trim(), rub: String(r[7]).trim(), cant: num(r[8]), imp: num(r[9]), vend: String(r[3]).trim() };
  }).filter(l => l.fecha && l.fecha >= desde && l.fecha <= hasta);
  const sum = Ls => ({ imp: Math.round(Ls.reduce((s, l) => s + l.imp, 0)), cant: Math.round(Ls.reduce((s, l) => s + l.cant, 0)) });
  console.log('\nExport del sistema: líneas', E.length, 'total', JSON.stringify(sum(E)), '| API total', JSON.stringify(sum(A)));
  const g = Ls => { const m = new Map(); Ls.forEach(l => { if (!m.has(l.nro)) m.set(l.nro, []); m.get(l.nro).push(l); }); return m; };
  const GE = g(E), GA = g(A);
  const soloE = [...GE.keys()].filter(k => !GA.has(k)), soloA = [...GA.keys()].filter(k => !GE.has(k)), dif = [];
  for (const k of GE.keys()) { if (!GA.has(k)) continue; const se = sum(GE.get(k)), sa = sum(GA.get(k)); if (se.imp !== sa.imp || se.cant !== sa.cant) dif.push({ k, se, sa }); }
  console.log('comprobantes export', GE.size, 'API', GA.size, '| solo export', soloE.length, soloE.slice(0, 5), '| solo API', soloA.length, soloA.slice(0, 5), '| con diferencia', dif.length, '| suma dif importe (API − export)', n(dif.reduce((s, d) => s + d.sa.imp - d.se.imp, 0)));
  for (const d of dif.slice(0, 8)) {
    console.log('\n#', d.k, 'export', JSON.stringify(d.se), 'API', JSON.stringify(d.sa));
    const key = l => norm(l.art) + ' | ' + norm(l.rub);
    const ke = new Map(), ka = new Map();
    GE.get(d.k).forEach(l => ke.set(key(l), (ke.get(key(l)) || []).concat(l)));
    GA.get(d.k).forEach(l => ka.set(key(l), (ka.get(key(l)) || []).concat(l)));
    for (const k of new Set([...ke.keys(), ...ka.keys()])) {
      const le = ke.get(k) || [], la = ka.get(k) || []; const se = sum(le), sa = sum(la);
      if (se.imp !== sa.imp || se.cant !== sa.cant) console.log('   ', k, '| export', le.map(l => l.cant + '×' + l.imp).join(', ') || '—', '| API', la.map(l => l.cant + '×' + l.imp).join(', ') || '—');
    }
  }
}

else { console.log('Uso: semana <lunes> | sucursal <lunes> <slug> | lineas <desde> <hasta> <NN> [csv]'); }
