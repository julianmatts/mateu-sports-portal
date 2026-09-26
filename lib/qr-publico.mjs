/* lib/qr-publico.mjs — lógica de la página pública de las etiquetas QR (26/09/2026).
   La usa functions/api/qr.js (Pages Function). Todo lo que sale de acá lo ve UN CLIENTE con su
   celular, sin sesión del Portal: por eso devuelve solo producto, precio, talles por sucursal y los
   datos de contacto del local; nunca ubicaciones del depósito, comentarios, costos ni nada interno.

   Fuentes (todas Firebase por REST, con las mismas URLs que el resto del portal):
   - Índice compacto del Buscador: ubicaciones-mateu/sucursales/<slug>/indice = {ts, n, a:{clave:[stock,
     "talle:cant,…", ubicación, idItem, descripción]}} (lo escribe el Buscador en cada carga de stock; es lo
     mismo que lee Matts). Cuando esté la API de stock del sistema (docs/API-STOCK-BUSCADOR.md), `stockDe`
     cambia de fuente y el resto no se toca.
   - Catálogo de Matts: recepciones-mateu/asistente/catalogo/porCod/<clave> = [código, artículo, marca,
     disciplina, rubro, género, tipo] (el orden lo fija scripts/gen-asistente.js; verificado 26/09 contra la base).
   - Config de la página: recepciones-mateu/qr/config = {global:{ecommerce, promoTexto}, sucursales:{<slug>:
     {resena, whatsapp, promoTexto}}} (se edita desde el Buscador → 🏷 Etiqueta QR → ⚙).
   - Precio: hoy NO existe en ninguna fuente (`precioDe` devuelve null hasta que la API lo traiga, §8 del doc).
   Escrituras: qr/scans/<slug>/<ym> (registro de escaneos), qr/avisos/<slug> («avisame cuando llegue mi
   talle»), qr/pedidos/<slug> («pedir que lo traigan») y un directo por la Bandeja a las cuentas del local.
   Tests: node --test lib/qr-publico.test.mjs (fetch simulado). */

import { tablaDe } from './asistente-talles.mjs';

export const FB_UBIC = 'https://ubicaciones-mateu-default-rtdb.firebaseio.com';
export const FB_REC = 'https://recepciones-mateu-default-rtdb.firebaseio.com';
export const FB_USUARIOS = 'https://discontinuos-mateu-default-rtdb.firebaseio.com/usuarios.json';
export const FB_MENSAJES = 'https://mensajes-mateu-default-rtdb.firebaseio.com';
export const REMITENTE = 'etiquetas-qr@mateu.com.ar';   // «de» de los directos que manda la página (no es una cuenta real)

/* Sucursales: slug del Portal, NN del sistema, nombre para el cliente, zona (para ordenar «otras
   sucursales» por cercanía) y marca visual. Solo las que pueden tener etiqueta. */
export const SUCS = {
  'plaza':       { nn: '01', nombre: 'Plaza Italia',        zona: 'centro',    marca: 'mateu' },
  'kids':        { nn: '02', nombre: 'Mateu Kids',          zona: 'centro',    marca: 'mateu' },
  'calle-55':    { nn: '03', nombre: 'Outlet Calle 55',     zona: 'centro',    marca: 'mateu', outlet: true },
  'aurelius-12': { nn: '04', nombre: 'Aurelius 12',         zona: 'centro',    marca: 'aurelius' },
  'city-bell':   { nn: '06', nombre: 'City Bell',           zona: 'city-bell', marca: 'mateu' },
  'aurelius-10': { nn: '07', nombre: 'Aurelius 10',         zona: 'centro',    marca: 'aurelius', outlet: true },
  'calle-47':    { nn: '08', nombre: 'Calle 47',            zona: 'centro',    marca: 'mateu' },
  'adidas':      { nn: '09', nombre: 'Adidas Av. 7',        zona: 'centro',    marca: 'mateu' },
  'diagonal':    { nn: '10', nombre: 'Diagonal 80',         zona: 'centro',    marca: 'mateu' },
  'ensenada':    { nn: '11', nombre: 'Ensenada',            zona: 'ensenada',  marca: 'mateu' },
  'calle-12':    { nn: '12', nombre: 'Calle 12',            zona: 'centro',    marca: 'mateu' },
  'los-hornos':  { nn: '13', nombre: 'Los Hornos',          zona: 'los-hornos', marca: 'mateu' },
  'gonnet':      { nn: '14', nombre: 'Outlet Gonnet',       zona: 'gonnet',    marca: 'mateu', outlet: true },
  'originals':   { nn: '15', nombre: 'Adidas Originals',    zona: 'centro',    marca: 'mateu' },
  'berisso':     { nn: '16', nombre: 'Berisso',             zona: 'berisso',   marca: 'mateu' },
  'aurelius-cb': { nn: '17', nombre: 'Aurelius City Bell',  zona: 'city-bell', marca: 'aurelius' },
  'aurelius-5':  { nn: '18', nombre: 'Aurelius 5',          zona: 'centro',    marca: 'aurelius' },
  'calle-49':    { nn: '19', nombre: 'Calle 49',            zona: 'centro',    marca: 'mateu' },
  'av-44':       { nn: '20', nombre: 'Outlet Av. 44',       zona: 'centro',    marca: 'mateu', outlet: true },
  'adidas-12':   { nn: '21', nombre: 'Adidas Calle 12',     zona: 'centro',    marca: 'mateu' },
  'ecommerce':   { nn: '99', nombre: 'Tienda online',       zona: 'web',       marca: 'mateu', web: true }
};
// Sucursales que cargan su stock en el Buscador de Artículos (mismo mapa que Matts / ubicaciones/index.html)
export const SUC_BUSCADOR = ['calle-12', 'city-bell', 'diagonal', 'calle-47', 'calle-49', 'los-hornos', 'plaza', 'berisso', 'ensenada', 'kids', 'aurelius-12', 'aurelius-5', 'aurelius-cb', 'adidas-12', 'adidas', 'originals', 'ecommerce'];

// El parámetro `s` del QR: slug del Portal o NN del sistema
export function slugDe(s) {
  const v = String(s || '').trim().toLowerCase();
  if (!v) return '';
  if (SUCS[v]) return v;
  const nn = v.length === 1 ? '0' + v : v;
  for (const k in SUCS) if (SUCS[k].nn === nn) return k;
  return '';
}
export function fbKey(c) { return String(c || '').trim().replace(/[.#$\/\[\]]/g, '-'); }
export function clave(s) { return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, ''); }
const plano = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export function ymDe(ts) { const d = new Date((ts || Date.now()) - 3 * 3600e3); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2); }

/* Orden humano de talles: números (y dobles «37/38») de menor a mayor, letras XS→S→M→L→XL, «UNI» al final. */
const LETRAS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL'];
export function cmpTalle(a, b) {
  const na = parseFloat(String(a).replace(',', '.')), nb = parseFloat(String(b).replace(',', '.'));
  const la = LETRAS.indexOf(String(a).toUpperCase()), lb = LETRAS.indexOf(String(b).toUpperCase());
  if (isFinite(na) && isFinite(nb)) return na - nb;
  if (isFinite(na)) return -1; if (isFinite(nb)) return 1;
  if (la >= 0 && lb >= 0) return la - lb;
  if (la >= 0) return -1; if (lb >= 0) return 1;
  return String(a).localeCompare(String(b));
}
/* «8.5:3,9:2,9.5:0» → [{t, c}] (conserva los ceros: en la página se ven tachados) */
export function parsearTalles(s) {
  if (!s) return [];
  return String(s).split(',').map(x => { const i = x.lastIndexOf(':'); if (i < 0) return null; const t = x.slice(0, i).trim(), c = parseInt(x.slice(i + 1), 10); return t ? { t, c: isFinite(c) ? c : 0 } : null; }).filter(Boolean);
}
/* Equivalencia AR/EU de cada rótulo de la marca (para «US 8.5 = 42 AR»), según la tabla de la casa. */
export function equivalencias(marca, genero) {
  const t = tablaDe(marca);
  const g = plano(genero);
  const filas = /dama|mujer|femen|wns|women/.test(g) ? t.dama : (/hombre|masc|men\b|varon/.test(g) ? t.hombre : t.hombre.concat(t.dama));
  const eq = {};
  // el AR/EU de la tabla viene con tercios (42.7 = 42 ⅔): al cliente se le muestra al medio punto
  (filas || []).forEach(f => { const k = String(f[0]).toUpperCase(); if (eq[k] === undefined) eq[k] = Math.round(f[1] * 2) / 2; });
  return { escala: t.escala, marca: t.marca, ar: t.escala === 'AR' ? {} : eq };
}

/* ===================== núcleo ===================== */
export function crear(deps) {
  const f = deps && deps.fetch ? deps.fetch : globalThis.fetch;
  const now = deps && deps.now ? deps.now : () => Date.now();
  const env = (deps && deps.env) || {};
  const CACHE = { idx: {}, cat: {}, cfg: null, cfgTs: 0, usuarios: null, usuariosTs: 0 };
  const TTL = (deps && deps.ttl) || 600e3;

  const gj = u => f(u).then(r => (r && r.ok === false ? null : r.json())).catch(() => null);
  const post = (u, d) => f(u, { method: 'POST', body: JSON.stringify(d), headers: { 'Content-Type': 'application/json' } }).then(r => r.json()).catch(() => null);
  const patch = (u, d) => f(u, { method: 'PATCH', body: JSON.stringify(d), headers: { 'Content-Type': 'application/json' } }).catch(() => null);

  async function indice(slug) {
    const c = CACHE.idx[slug];
    if (c && now() - c.ts < TTL) return c.i;
    const i = await gj(FB_UBIC + '/sucursales/' + slug + '/indice.json');
    CACHE.idx[slug] = { i: i && i.a ? i : null, ts: now() };
    return CACHE.idx[slug].i;
  }
  async function catalogo(codigo) {
    const k = clave(codigo); if (!k) return null;
    const c = CACHE.cat[k];
    if (c && now() - c.ts < TTL) return c.f;
    const fila = await gj(FB_REC + '/asistente/catalogo/porCod/' + k + '.json');
    CACHE.cat[k] = { f: Array.isArray(fila) ? fila : null, ts: now() };
    return CACHE.cat[k].f;
  }
  async function config() {
    if (CACHE.cfg && now() - CACHE.cfgTs < 300e3) return CACHE.cfg;
    CACHE.cfg = (await gj(FB_REC + '/qr/config.json')) || {}; CACHE.cfgTs = now();
    return CACHE.cfg;
  }
  async function configDe(slug) {
    const c = await config();
    const g = c.global || {}, s = (c.sucursales || {})[slug] || {};
    return { resena: s.resena || '', whatsapp: s.whatsapp || '', ecommerce: g.ecommerce || '', promoTexto: s.promoTexto || g.promoTexto || '', precioNota: g.precioNota || '' };
  }
  /* Precio de venta. Hoy ninguna fuente lo trae: cuando la API de stock lo entregue (docs/API-STOCK-BUSCADOR.md §8)
     se resuelve acá con env.STOCK_API_URL + env.STOCK_API_KEY. Mientras tanto null (la página dice «consultá en caja»). */
  async function precioDe(codigo, slug) {
    if (!env.STOCK_API_URL || !env.STOCK_API_KEY) return null;
    try {
      const r = await f(env.STOCK_API_URL.replace(/\/$/, '') + '/v1/stock/articulo/' + encodeURIComponent(codigo), { headers: { Authorization: 'Bearer ' + env.STOCK_API_KEY } });
      if (!r.ok) return null;
      const d = await r.json();
      const p = (d.sucursales && d.sucursales[SUCS[slug] && SUCS[slug].nn] && d.sucursales[SUCS[slug].nn].precio) || d.precio || null;
      return p && p.lista ? { lista: p.lista, promo: p.promo || null, listaNombre: p.listaNombre || '' } : null;
    } catch (e) { return null; }
  }

  /* Stock de un artículo en TODAS las sucursales que cargan en el Buscador (sin ubicaciones). */
  async function stockDe(codigo) {
    const k = fbKey(codigo);
    const idxs = await Promise.all(SUC_BUSCADOR.map(sl => indice(sl)));
    const out = {}, sinDato = [];
    SUC_BUSCADOR.forEach((sl, i) => {
      const idx = idxs[i];
      if (!idx) { sinDato.push(sl); return; }
      const e = idx.a[k];
      // stock absurdo (p.ej. Ensenada cargó el Id.item en la columna de stock: 224.015 u.) → se toma como sin dato
      const stock = e ? (+e[0] || 0) : 0, raro = stock > 9999 && !(e && e[1]);
      out[sl] = { stock: raro ? 0 : stock, talles: e && !raro ? parsearTalles(e[1]) : [], actualizado: idx.ts || 0, idItem: e ? (e[3] || '') : '', descripcion: e ? (e[4] || '') : '', figura: !!e && !raro };
    });
    return { por: out, sinDato };
  }

  function ordenarOtras(slug, por) {
    const zona = SUCS[slug] ? SUCS[slug].zona : '';
    return Object.keys(por).filter(sl => sl !== slug && por[sl].stock > 0)
      .map(sl => ({ slug: sl, nombre: SUCS[sl] ? SUCS[sl].nombre : sl, stock: por[sl].stock, talles: por[sl].talles.filter(x => x.c > 0).sort((a, b) => cmpTalle(a.t, b.t)), cerca: SUCS[sl] && SUCS[sl].zona === zona, web: !!(SUCS[sl] && SUCS[sl].web) }))
      .sort((a, b) => (b.cerca - a.cerca) || (a.web - b.web) || (b.stock - a.stock) || a.nombre.localeCompare(b.nombre));
  }

  /* GET ?c=&s= → lo que ve el cliente */
  async function articulo(q) {
    const slug = slugDe(q.s), codigo = String(q.c || '').trim().toUpperCase();
    if (!codigo || codigo.length > 40) return { error: 'Falta el código del artículo.', status: 400 };
    if (!slug) return { error: 'No reconozco la sucursal.', status: 400 };
    const [cat, st, cfg, precio] = await Promise.all([catalogo(codigo), stockDe(codigo), configDe(slug), precioDe(codigo, slug)]);
    const aca = st.por[slug];
    const desc = (cat && cat[1]) || (aca && aca.descripcion) || Object.values(st.por).map(x => x.descripcion).filter(Boolean)[0] || '';
    if (!cat && !desc) return { error: 'No encontramos ese artículo. Consultá a un vendedor.', status: 404, codigo };
    const marca = (cat && cat[2]) || marcaDePrefijo(codigo) || '';
    const genero = (cat && cat[5]) || '';
    // curva completa = todos los talles vistos en cualquier sucursal (así se puede tachar lo que acá no queda)
    const curva = {};
    Object.values(st.por).forEach(x => x.talles.forEach(t => { curva[t.t] = 1; }));
    const talles = Object.keys(curva).sort(cmpTalle).map(t => { const e = aca ? aca.talles.find(x => x.t === t) : null; return { t, c: e ? e.c : 0 }; });
    const eq = equivalencias(marca, genero);
    return {
      ok: true, codigo,
      articulo: { codigo, idItem: (aca && aca.idItem) || '', descripcion: desc, marca, genero, tipo: (cat && cat[6]) || '', disciplina: (cat && cat[3]) || '', rubro: (cat && cat[4]) || '' },
      sucursal: { slug, nombre: SUCS[slug].nombre, marca: SUCS[slug].marca, outlet: !!SUCS[slug].outlet, cargaStock: SUC_BUSCADOR.indexOf(slug) >= 0 && !st.sinDato.includes(slug) },
      aca: aca ? { stock: aca.stock, talles, actualizado: aca.actualizado, figura: aca.figura } : { stock: 0, talles, actualizado: 0, figura: false, sinDato: true },
      otras: ordenarOtras(slug, st.por),
      escala: eq.escala, ar: eq.ar,
      precio, config: cfg
    };
  }

  /* GET ?s=&q= → buscador de la sucursal (QR genérico del local): por código, Id.item, texto o código de barras */
  async function buscar(q) {
    const slug = slugDe(q.s);
    if (!slug) return { error: 'No reconozco la sucursal.', status: 400 };
    let texto = String(q.q || '').trim();
    if (texto.length < 3) return { error: 'Escribí al menos 3 letras.', status: 400 };
    const idx = await indice(slug);
    if (!idx) return { ok: true, resultados: [], sinDato: true };
    let porEan = '';
    const dig = texto.replace(/\D/g, '');
    if (dig.length >= 12 && dig.length <= 14 && dig.length >= texto.length - 2) {
      const g13 = dig.length === 12 ? '0' + dig : dig;
      let m = await gj(FB_UBIC + '/ean/' + g13 + '.json');
      if (!m) { const suf = await gj(FB_UBIC + '/ean/suf/' + g13.slice(-11) + '.json'); if (suf) m = await gj(FB_UBIC + '/ean/' + suf + '.json'); }
      if (m && m.codigo) { texto = m.codigo; porEan = m.codigo; }
    }
    const toks = plano(texto).split(/[^a-z0-9.]+/).filter(t => t.length >= 2);
    const res = [];
    for (const k in idx.a) {
      const e = idx.a[k];
      const hay = plano(k + ' ' + (e[3] || '') + ' ' + (e[4] || ''));
      if (porEan ? k === fbKey(porEan) : toks.every(t => hay.indexOf(t) >= 0)) {
        res.push({ codigo: k, descripcion: e[4] || '', idItem: e[3] || '', stock: +e[0] || 0, talles: parsearTalles(e[1]).filter(x => x.c > 0).sort((a, b) => cmpTalle(a.t, b.t)) });
        if (res.length >= 60) break;
      }
    }
    res.sort((a, b) => (b.stock > 0) - (a.stock > 0) || a.descripcion.localeCompare(b.descripcion));
    return { ok: true, resultados: res.slice(0, 20), total: res.length, porEan: porEan || undefined, actualizado: idx.ts || 0 };
  }

  /* Cuentas del Portal de una sucursal (para avisarle por la Bandeja) */
  async function mailsDe(slug) {
    if (!CACHE.usuarios || now() - CACHE.usuariosTs > 600e3) { CACHE.usuarios = (await gj(FB_USUARIOS)) || {}; CACHE.usuariosTs = now(); }
    const out = [];
    Object.values(CACHE.usuarios).forEach(u => { if (u && u.email && ((u.rol === 'sucursal' && u.sucursal === slug) || (u.rol === 'outlet' && u.outlet_id === slug))) out.push(String(u.email).toLowerCase()); });
    return out;
  }
  const mk = m => String(m || '').toLowerCase().trim().replace(/\./g, ',');
  async function directo(slug, texto) {
    const mails = await mailsDe(slug);
    await Promise.all(mails.map(a => post(FB_MENSAJES + '/directos/' + [mk(REMITENTE), mk(a)].sort().join('__') + '.json', { de: REMITENTE, texto, ts: now() })));
    return mails.length;
  }

  const limpiar = (s, n) => String(s || '').replace(/[<>]/g, '').trim().slice(0, n);
  const telOk = t => /^\+?[\d\s\-()]{8,20}$/.test(t);

  /* POST {accion:'aviso'} — «Avisame cuando llegue mi talle» */
  async function aviso(b) {
    const slug = slugDe(b.s), codigo = limpiar(b.c, 40).toUpperCase(), talle = limpiar(b.talle, 10).toUpperCase(), tel = limpiar(b.tel, 20), nombre = limpiar(b.nombre, 60);
    if (!slug || !codigo || !talle) return { error: 'Faltan datos.', status: 400 };
    if (!telOk(tel)) return { error: 'Dejanos un WhatsApp válido para avisarte.', status: 400 };
    const cat = await catalogo(codigo);
    const doc = { c: codigo, desc: (cat && cat[1]) || limpiar(b.desc, 80), marca: (cat && cat[2]) || '', talle, nombre, tel, ts: now(), estado: 'pendiente', origen: 'qr' };
    const r = await post(FB_REC + '/qr/avisos/' + slug + '.json', doc);
    if (!r || !r.name) return { error: 'No pudimos guardar el aviso. Probá de nuevo.', status: 502 };
    const n = await directo(slug, '👤 Un cliente espera el talle ' + talle + ' de ' + doc.desc + ' (' + codigo + ')' + (nombre ? ' · ' + nombre : '') + ' · WhatsApp ' + tel + '. Cuando entre, avisale desde el Buscador de Artículos → Actividad → «Clientes que esperan un talle».').catch(() => 0);
    return { ok: true, id: r.name, avisados: n };
  }
  /* POST {accion:'pedido'} — «Pedir que lo traigan a esta sucursal» (desde otra sucursal o el depósito) */
  async function pedido(b) {
    const slug = slugDe(b.s), desde = slugDe(b.desde), codigo = limpiar(b.c, 40).toUpperCase(), talle = limpiar(b.talle, 10).toUpperCase(), tel = limpiar(b.tel, 20), nombre = limpiar(b.nombre, 60);
    if (!slug || !codigo) return { error: 'Faltan datos.', status: 400 };
    if (!telOk(tel)) return { error: 'Dejanos un WhatsApp válido para coordinar.', status: 400 };
    const cat = await catalogo(codigo);
    const doc = { c: codigo, desc: (cat && cat[1]) || limpiar(b.desc, 80), marca: (cat && cat[2]) || '', talle, desde, nombre, tel, ts: now(), estado: 'pendiente', origen: 'qr' };
    const r = await post(FB_REC + '/qr/pedidos/' + slug + '.json', doc);
    if (!r || !r.name) return { error: 'No pudimos guardar el pedido. Probá de nuevo.', status: 502 };
    const n = await directo(slug, '📦 Un cliente pide que le traigan ' + doc.desc + ' (' + codigo + ')' + (talle ? ' talle ' + talle : '') + (desde && SUCS[desde] ? ' desde ' + SUCS[desde].nombre : '') + (nombre ? ' · ' + nombre : '') + ' · WhatsApp ' + tel + '. Coordinalo y avisale.').catch(() => 0);
    return { ok: true, id: r.name, avisados: n };
  }
  /* Registro del escaneo (no bloquea la respuesta) */
  function escaneo(slug, codigo, ua) {
    if (!slug || !codigo) return Promise.resolve();
    const ts = now();
    return post(FB_REC + '/qr/scans/' + slug + '/' + ymDe(ts) + '.json', { ts, c: codigo, m: /Mobile|Android|iPhone/i.test(ua || '') ? 1 : 0 });
  }

  return { articulo, buscar, aviso, pedido, escaneo, indice, catalogo, configDe, precioDe, _cache: CACHE };
}

// Marca por prefijo del código cuando el artículo no está en el catálogo (recién ingresado)
const PREFIJOS = { ADI: 'ADIDAS', NIK: 'NIKE', PUM: 'PUMA', NB: 'NEW BALANCE', ASI: 'ASICS', RUG: 'RUGE', GIV: 'GIVOVA', HFD: 'HEAD', ATM: 'ATOMIK', FIL: 'FILA', SAL: 'SALOMON', UND: 'UNDER ARMOUR', CON: 'CONVERSE', VAN: 'VANS', CRO: 'CROCS', HAV: 'HAVAIANAS', TOP: 'TOPPER', UMB: 'UMBRO', MON: 'MONTAGNE', SKE: 'SKECHERS', TIM: 'TIMBERLAND', REE: 'REEBOK', WIL: 'WILSON', OLY: 'OLYMPIKUS', LEC: 'LE COQ SPORTIF', MED: 'MATEU' };
export function marcaDePrefijo(codigo) {
  const c = String(codigo || '').toUpperCase();
  for (const p in PREFIJOS) if (c.startsWith(p)) return PREFIJOS[p];
  return '';
}

/* Tope de pedidos por IP en memoria del isolate (la página es pública). */
export function crearTope(max, ventanaMs, now) {
  const M = new Map(); const t = now || (() => Date.now());
  return function (ip) {
    const ahora = t();
    let e = M.get(ip);
    if (!e || ahora - e.desde > ventanaMs) { e = { desde: ahora, n: 0 }; M.set(ip, e); }
    e.n++;
    if (M.size > 5000) { for (const [k, v] of M) if (ahora - v.desde > ventanaMs) M.delete(k); }
    return e.n <= max;
  };
}
