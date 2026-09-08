/* ============================================================
   lib/logistica-parse.js — Lectura de los exports de logística
   (envíos del depósito a sucursales e ingresos al depósito).

   Única fuente de verdad del parser. Tres consumidores, por eso es UMD
   isomórfico (sin build, sin package.json):
     - el browser  → <script src="../lib/logistica-parse.js"></script> ⇒ window.LogisticaParse
     - el script    → require('../lib/logistica-parse.js') (scripts/importar-logistica-csv.js)
     - los tests    → node --test lib/logistica-parse.test.js

   Formatos:
   · PIVOT del sistema («Estad transferencias <año>» / «Estad remitos <año>»):
     columnas de texto + una columna por mes (1..12) en la primera fila; en
     remitos cada mes trae el par (Cant.recibido · Costo) y una segunda fila
     de encabezado. El ORDEN de las columnas de texto no importa: se reconocen
     por su contenido (`inferirColumnas`) y se puede corregir a mano (mapa).
   · Por NOMBRE de columna (una fila por movimiento): Sucursal · Mes/Fecha ·
     Rubro · … · Cantidad/Ingresado.

   Salida de ambos parsers: { tipo:'envios'|'ingresos', hoja, arts:{clave:[rubro,
   sub, disc, marca, id, art, tipo, cod]}, porMes:{ 'YYYY-MM': Map(clave|suc ->
   [clave, suc, unidades, costo]) }, filas, desc (filas «Total»), sinMes }.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LogisticaParse = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const MES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  const norm = s => String(s == null ? '' : s).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, ' ').trim();
  const sinPrefijo = s => String(s == null ? '' : s).trim().replace(/^\d{2}-/, '');
  // clave Firebase del artículo: el código de barras sin los caracteres ilegales (. # $ [ ] /)
  const clave = cod => String(cod == null ? '' : cod).trim().replace(/[.#$\[\]\/]/g, '_') || '_';
  const numCell = v => { if (typeof v === 'number') return v; const n = parseFloat(String(v == null ? '' : v).trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
  const ym = (anio, mes) => `${anio}-${String(mes).padStart(2, '0')}`;

  const ALIAS = {
    suc:   ['SUCURSAL','SUC','LOCAL','DESTINO','SUCURSAL DESTINO'],
    mes:   ['MES','PERIODO','PERÍODO'],
    fecha: ['FECHA','FECHA MOVIMIENTO','FECHA ENVIO','FECHA INGRESO','FECHA COMPROBANTE','FECHA REMITO'],
    rubro: ['RUBRO'],
    sub:   ['SUBRUBRO','SUB RUBRO','SUB-RUBRO','GENERO','GÉNERO'],
    disc:  ['DISCIPLINA','DEPORTE'],
    marca: ['MARCA'],
    tipo:  ['TIPO','TIPO DE ARTICULO','TIPO DE ARTÍCULO','TIPO ARTICULO','CATEGORIA','CATEGORÍA'],
    cod:   ['CODIGO DE BARRAS','CÓDIGO DE BARRAS','CODIGO','CÓDIGO','SKU','COD','COD. BARRAS'],
    id:    ['ID ITEM','IDITEM','ID.ITEM','ID','ITEM','ID ARTICULO','ID ARTÍCULO'],
    art:   ['ARTICULO','ARTÍCULO','DESCRIPCION','DESCRIPCIÓN','DETALLE','PRODUCTO'],
    q:     ['CANTIDAD','ENVIADO','ENVIADAS','UNIDADES','CANT','CANT.','INGRESADO','INGRESADAS','INGRESO','RECIBIDO','UNID','CANT.RECIBIDO'],
    costo: ['COSTO','IMPORTE','VALOR'],
  };
  const ALIAS_ING = ['INGRESADO','INGRESADAS','INGRESO','RECIBIDO','CANT.RECIBIDO'];
  // Campos asignables a una columna de texto del pivot (valor, rótulo del selector).
  const CAMPOS = [
    ['', '— ignorar —'], ['suc','Sucursal destino'], ['rubro','Rubro'], ['sub','Subrubro'], ['disc','Disciplina'],
    ['marca','Marca'], ['tipo','Tipo de artículo'], ['cod','Código de barras'], ['id','ID ITEM'], ['art','Artículo'],
  ];

  function nuevoParse(tipo, hoja) { return { tipo, hoja, arts: {}, porMes: {}, filas: 0, desc: 0, sinMes: 0 }; }
  function sumarFila(p, ymk, k, suc, q, costo) {
    const b = p.porMes[ymk] = p.porMes[ymk] || new Map();
    const kk = k + '|' + suc, prev = b.get(kk) || [k, suc, 0, 0];
    prev[2] += Math.round(q); prev[3] += Math.round(costo || 0); b.set(kk, prev); p.filas++;
  }
  function setArt(p, cod, a) {
    const id = a.id == null || a.id === '' ? '' : (typeof a.id === 'number' ? String(Math.round(a.id)) : String(a.id).trim());
    p.arts[clave(cod)] = [sinPrefijo(a.rubro), String(a.sub || '').trim(), String(a.disc || '').trim(), String(a.marca || '').trim(), id, String(a.art || '').trim(), String(a.tipo || '').trim(), String(cod || '').trim()];
  }

  /* --- pivot: columnas de mes y fila de arranque --- */
  function detectarPivot(m) {
    const h = m[0] || []; if (!h.length) return null;
    const meses = [], vistos = new Set();
    h.forEach((c, i) => { const s = String(c == null ? '' : c).trim(); if (/^\d{1,2}$/.test(s) && +s >= 1 && +s <= 12 && !vistos.has(+s)) { vistos.add(+s); meses.push({ i, mes: +s }); } });
    if (meses.length < 1 || meses[0].i < 6) return null;   // los meses arrancan tras varias columnas de texto
    const esRemito = !!(m[1] && m[1].some(c => /cant\.?\s*recib/i.test(String(c))));
    const textCols = []; for (let i = 0; i < meses[0].i; i++) textCols.push(i);
    return { pivot: true, meses, esRemito, ini: esRemito ? 2 : 1, textCols };
  }

  /* --- valores conocidos (del maestro ya cargado) + semilla --- */
  function conocidosDesde(arts) {
    const K = {
      rubro: new Set(['CALZADO','INDUMENTARIA','ACCESORIOS','VARIOS','OTROS']),
      sub:   new Set(['02-HOMBRE','03-DAMA','04-NIÑO','05-INFANTE','06-UNISEX','UNISEX','INFANTE','VARIOS','HOMBRE','DAMA','NIÑO','OTROS']),
      disc:  new Set(['CASUAL','RUNNING','TRAINING','ORIGINALS','FUTBOL 5','FUTBOL 11','FUTBOL','FUTSAL','ADVENTURE','BASQUET','TENIS','PADDLE','RUGBY','HOCKEY','VOLEY','NATACION','HANDBALL','CALZADO VERANO']),
      marca: new Set(['ADIDAS','NIKE','PUMA','REEBOK','UNDER ARMOUR','FILA','TOPPER','WILSON','ASICS','NEW BALANCE','CONVERSE','VANS','UMBRO','KAPPA','AURELIUS']),
      tipo:  new Set(['CALZADO ADULTO','CALZADO NIÑO','CALZADO INFANTS','CHINELAS','SANDALIAS','OJOTAS','CAMPERAS','REMERAS','PANTALONES','MEDIAS','MOCHILAS','GORRAS','PELOTAS','SHORTS','BUZOS','CONJUNTOS']),
    };
    (arts || []).forEach(a => { if (a.rubro) K.rubro.add(a.rubro); if (a.sub) K.sub.add(a.sub); if (a.disc) K.disc.add(a.disc); if (a.marca) K.marca.add(a.marca); if (a.tipo) K.tipo.add(a.tipo); });
    Object.keys(K).forEach(k => { K[k] = new Set([...K[k]].map(norm)); });
    return K;
  }

  /* --- reconocer cada columna de texto por su contenido --- */
  function inferirColumnas(m, det, K) {
    K = K || conocidosDesde([]);
    const filas = []; const paso = Math.max(1, Math.floor((m.length - det.ini) / 600));
    for (let r = det.ini; r < m.length && filas.length < 600; r += paso) { const f = m[r]; if (f && f.length >= det.textCols.length) filas.push(f); }
    const stats = det.textCols.map(i => {
      const vals = filas.map(f => String(f[i] == null ? '' : f[i]).trim()).filter(v => v !== '');
      const n = vals.length || 1, distinct = new Set(vals).size;
      const frac = pred => vals.filter(pred).length / n;
      const esTotal = frac(v => /^total$/i.test(v));
      const sinTotal = vals.filter(v => !/^total$/i.test(v));
      const conocido = set => sinTotal.filter(v => set.has(norm(sinPrefijo(v))) || set.has(norm(v))).length / (sinTotal.length || 1);
      return { i, n: vals.length, distinct, esTotal,
        rubro: conocido(K.rubro), sub: conocido(K.sub), disc: conocido(K.disc), marca: conocido(K.marca), tipo: conocido(K.tipo),
        id: frac(v => /^\d{4,8}(\.0+)?$/.test(v)),
        remito: frac(v => /^\d{4}-\d{6,}$/.test(v)),
        pref: frac(v => /^\d{2}-\S/.test(v)),
        cod: frac(v => /^[A-Z0-9][A-Z0-9._-]{4,}$/i.test(v) && /[A-Z]/i.test(v) && /\d/.test(v) && !/^\d{2}-/.test(v)),
        espacio: frac(v => /\s/.test(v)),
        largo: vals.reduce((s, v) => s + v.length, 0) / n,
        prov: frac(v => /S\.?\s?A\.?$|S\.?R\.?L|SRL|S\.A\.|LTDA|INC\b/i.test(v)),
        camp: frac(v => /^\*\*\*|NO TIENE|CAMPAÑA|DISCONTINUO|PROMO/i.test(v)),
        mixto: frac(v => /[a-z]/.test(v) && /[A-Z]/.test(v)),
      };
    });
    const map = {}, usados = new Set();
    const tomar = (campo, score) => {
      let mejor = null; stats.forEach(s => { if (usados.has(s.i)) return; const v = score(s); if (v != null && v >= 0.5 && (!mejor || v > mejor.v)) mejor = { i: s.i, v }; });
      if (mejor) { map[campo] = mejor.i; usados.add(mejor.i); }
    };
    // 1) por valores conocidos (los más inequívocos primero)
    tomar('rubro', s => s.rubro);
    tomar('sub',   s => s.sub);
    tomar('disc',  s => s.disc);
    tomar('tipo',  s => s.tipo);
    // 2) por forma
    tomar('id',    s => s.id);
    stats.forEach(s => { if (!usados.has(s.i) && s.remito >= 0.5) usados.add(s.i); });                   // nro de remito: se ignora
    stats.forEach(s => { if (!usados.has(s.i) && (s.prov >= 0.3 || s.camp >= 0.3)) usados.add(s.i); });   // proveedor / campaña: se ignoran
    tomar('cod',   s => s.cod >= 0.7 && s.espacio < 0.2 ? s.cod + s.distinct / 1e6 : null);
    // sucursal destino: prefijo NN- que no es rubro; si hay dos (origen y destino), la de más valores distintos / con «Total»
    tomar('suc',   s => s.pref >= 0.5 || (s.pref + s.esTotal) >= 0.8 ? (s.pref + s.esTotal) + Math.min(s.distinct, 60) / 100 : null);
    // artículo: texto con espacios y muchos valores distintos
    tomar('art',   s => s.espacio >= 0.5 && s.largo >= 10 ? 0.5 + Math.min(s.distinct, 5000) / 5000 : null);
    // marca: lo que queda con pocos valores distintos y mayúsculas/minúsculas mezcladas (o conocido a medias)
    tomar('marca', s => (s.marca >= 0.15 || s.mixto >= 0.3) && s.distinct < 400 ? 0.5 + s.marca + s.mixto / 2 : null);
    return { map, stats };
  }

  /* --- lectura del pivot con un mapa de columnas --- */
  function parsearPivot(m, anio, det, map) {
    const p = nuevoParse(det.esRemito ? 'ingresos' : 'envios', 'pivot ' + (det.esRemito ? 'remitos' : 'transferencias'));
    const g = (f, k) => map[k] != null ? f[map[k]] : '';
    for (let r = det.ini; r < m.length; r++) {
      const f = m[r]; if (!f || f.length < det.textCols.length) continue;
      const suc = det.esRemito ? '05-Depósito' : String(g(f, 'suc') || '').trim();
      const cod = g(f, 'cod') !== '' ? g(f, 'cod') : g(f, 'id');
      if (/^total$/i.test(suc) || /^total$/i.test(String(g(f, 'marca') || '')) || /^total$/i.test(String(g(f, 'art') || ''))) { p.desc++; continue; }
      if (cod == null || String(cod).trim() === '') continue;
      if (!det.esRemito && !suc) continue;
      setArt(p, cod, { rubro: g(f, 'rubro'), sub: g(f, 'sub'), disc: g(f, 'disc'), marca: g(f, 'marca'), id: g(f, 'id'), art: g(f, 'art'), tipo: g(f, 'tipo') });
      det.meses.forEach(({ i, mes }) => { const c = numCell(f[i]); if (c) sumarFila(p, ym(anio, mes), clave(cod), suc, c, det.esRemito ? numCell(f[i + 1]) : 0); });
    }
    return p;
  }

  /* --- formato por nombre de columna --- */
  function mapearEncabezado(row) {
    const map = {};
    (row || []).forEach((c, i) => { const n = norm(c); if (!n) return; for (const k of Object.keys(ALIAS)) { if (map[k] != null) continue; if (ALIAS[k].some(a => norm(a) === n)) { map[k] = i; break; } } });
    return map;
  }
  function serialAFecha(v) {
    if (v instanceof Date) return v;
    if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400 * 1000));
    const s = String(v || '').trim();
    let m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/); if (m) { const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return new Date(y, +m[2] - 1, +m[1]); }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    return null;
  }
  function ymDeCelda(v, anio) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') {
      if (v >= 1 && v <= 12) return ym(anio, v);
      const d = serialAFecha(v); return d ? ym(d.getFullYear(), d.getMonth() + 1) : null;
    }
    const s = String(v).trim(); let m;
    if ((m = s.match(/^(\d{4})[-\/](\d{1,2})$/))) return ym(m[1], +m[2]);
    if ((m = s.match(/^(\d{1,2})[-\/](\d{4})$/))) return ym(m[2], +m[1]);
    if (/^\d{1,2}$/.test(s) && +s >= 1 && +s <= 12) return ym(anio, +s);
    const tok = norm(s).split(' ')[0]; const idx = tok.length >= 3 ? MESES.findIndex((x, i) => norm(x) === tok || norm(MES_CORTO[i]) === tok || norm(x).startsWith(tok)) : -1;
    if (idx >= 0) { const y = (s.match(/(\d{4})/) || [])[1] || (s.match(/\b(\d{2})$/) ? 2000 + +s.match(/\b(\d{2})$/)[1] : anio); return ym(y, idx + 1); }
    const d = serialAFecha(s); return d ? ym(d.getFullYear(), d.getMonth() + 1) : null;
  }
  function detectarPorNombre(m) {
    for (let h = 0; h < Math.min(m.length, 30); h++) {
      const map = mapearEncabezado(m[h]);
      if (map.q == null || (map.art == null && map.cod == null) || Object.keys(map).length < 4) continue;
      return { pivot: false, h, map, tipoIng: ALIAS_ING.some(a => norm(m[h][map.q]) === norm(a)) };
    }
    return null;
  }
  function parsearPorNombre(m, anio, det, map, hoja) {
    const p = nuevoParse(det.tipoIng ? 'ingresos' : 'envios', hoja);
    for (let i = det.h + 1; i < m.length; i++) {
      const r = m[i]; if (!r || !r.length) continue;
      const suc = map.suc != null ? String(r[map.suc] || '').trim() : '';
      const q = numCell(r[map.q]); if (!q) continue;
      if (norm(suc) === 'TOTAL' || (map.art != null && norm(r[map.art]) === 'TOTAL')) { p.desc++; continue; }
      let ymk = null;
      if (map.fecha != null) ymk = ymDeCelda(r[map.fecha], anio);
      if (!ymk && map.mes != null) ymk = ymDeCelda(r[map.mes], anio);
      if (!ymk) { p.sinMes++; continue; }
      const cod = map.cod != null ? r[map.cod] : (map.id != null ? r[map.id] : r[map.art]);
      setArt(p, cod, { rubro: r[map.rubro], sub: r[map.sub], disc: r[map.disc], marca: r[map.marca], id: map.id != null ? r[map.id] : '', art: map.art != null ? r[map.art] : '', tipo: map.tipo != null ? r[map.tipo] : '' });
      sumarFila(p, ymk, clave(cod), det.tipoIng ? '05-Depósito' : suc, q, map.costo != null ? numCell(r[map.costo]) : 0);
    }
    return p;
  }

  /* --- CSV en texto → matriz --- */
  function csvAMatriz(txt) {
    const lineas = String(txt || '').split(/\r?\n/).filter(l => l.length);
    const sep = ((lineas[0] || '').match(/;/g) || []).length >= ((lineas[0] || '').match(/,/g) || []).length ? ';' : ',';
    return lineas.map(l => l.split(sep).map(c => c.trim().replace(/^"(.*)"$/, '$1')));
  }
  // Filas compactas para Firebase a partir de un porMes: envíos [clave, suc, u] · ingresos [clave, u, costo]
  function filasMes(tipo, b) { return [...b.values()].map(x => tipo === 'envios' ? [x[0], x[1], x[2]] : [x[0], x[2], x[3]]); }
  function unidadesDe(b) { let s = 0; b.forEach(x => { s += x[2]; }); return s; }
  // Resumen por sucursal (slug) de un mes de envíos, para que cada local baje solo lo suyo.
  // slugDe(nombreSucursal) -> slug o null. Devuelve { slug: {u, rubros:{}, marcas:{}, top:[[art,marca,u]…]} }
  function resumenPorSucursal(b, arts, slugDe) {
    const out = {};
    b.forEach(x => {
      const slug = slugDe(x[1]); if (!slug) return;
      const a = arts[x[0]] || [], o = out[slug] = out[slug] || { u: 0, rubros: {}, marcas: {}, _t: [] };
      o.u += x[2];
      const r = a[0] || 'Sin rubro', mk = a[3] || 'Sin marca';
      o.rubros[r] = (o.rubros[r] || 0) + x[2]; o.marcas[mk] = (o.marcas[mk] || 0) + x[2];
      o._t.push([a[5] || x[0], mk, x[2], a[7] || x[0]]);
    });
    Object.values(out).forEach(o => { o.top = o._t.sort((p, q) => q[2] - p[2]).slice(0, 12); delete o._t; });
    return out;
  }

  return { MESES, MES_CORTO, ALIAS, ALIAS_ING, CAMPOS, norm, sinPrefijo, clave, numCell, ym, detectarPivot, conocidosDesde, inferirColumnas, parsearPivot,
    mapearEncabezado, serialAFecha, ymDeCelda, detectarPorNombre, parsearPorNombre, csvAMatriz, filasMes, unidadesDe, resumenPorSucursal };
}));
