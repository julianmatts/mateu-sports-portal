/* ============================================================
 * functions/api/[[route]].js
 * API del módulo Control de Recepciones (Cloudflare Pages Functions + D1).
 *
 * Binding D1 = env.DB (ver wrangler.toml → database_name "mateu_recepciones").
 * Es el primer módulo del portal con backend D1; el resto usa Firebase.
 *
 * Rutas:
 *   GET  /api/dimensiones                          → valores para los filtros
 *   GET  /api/pedidos     [?marca]                 → pedidos con sus líneas
 *   POST /api/pedidos                              → alta/import de un pedido
 *   GET  /api/remitos     [?marca&semana]          → remitos con sus líneas
 *   POST /api/remitos                              → alta/import de un remito
 *   GET  /api/control     [?marca&rubro&disciplina&tipo] → v_control + pct + estado
 *   GET  /api/mappings                             → mapeos guardados
 *   POST /api/mappings                             → guardar un mapeo {marca,tipo_doc,config}
 * ============================================================ */

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
function err(msg, status) { return json({ ok: false, error: msg }, status || 400); }

function isUniqueViolation(e) {
  return /UNIQUE|constraint/i.test(String(e && e.message || e));
}

// Prepara y (si hay binds) bindea una sola vez.
function stmt(env, sql, binds) {
  var s = env.DB.prepare(sql);
  return (binds && binds.length) ? s.bind.apply(s, binds) : s;
}

/* ---------- validación de líneas ---------- */
function normLineas(lineas) {
  if (!Array.isArray(lineas) || !lineas.length) throw new Error('El documento no tiene líneas.');
  return lineas.map(function (l, i) {
    var cantidad = Number(l.cantidad);
    var costo = Number(l.costo_unitario);
    if (!isFinite(cantidad)) throw new Error('Línea ' + (i + 1) + ': cantidad inválida.');
    if (!isFinite(costo)) throw new Error('Línea ' + (i + 1) + ': costo_unitario inválido.');
    return {
      rubro: String(l.rubro || '').trim(),
      disciplina: String(l.disciplina || '').trim(),
      tipo: String(l.tipo || '').trim(),
      cantidad: cantidad,
      costo_unitario: costo
    };
  });
}

/* ============================================================
 * GET /api/dimensiones
 * ============================================================ */
async function getDimensiones(env) {
  var q = function (sql) { return env.DB.prepare(sql).all(); };
  var [marcasP, marcasR, rubrosP, rubrosR, discP, discR, tiposP, tiposR, semanas] = await Promise.all([
    q("SELECT DISTINCT marca AS v FROM pedido WHERE marca <> ''"),
    q("SELECT DISTINCT marca AS v FROM remito WHERE marca <> ''"),
    q("SELECT DISTINCT rubro AS v FROM pedido_linea WHERE rubro <> ''"),
    q("SELECT DISTINCT rubro AS v FROM remito_linea WHERE rubro <> ''"),
    q("SELECT DISTINCT disciplina AS v FROM pedido_linea WHERE disciplina <> ''"),
    q("SELECT DISTINCT disciplina AS v FROM remito_linea WHERE disciplina <> ''"),
    q("SELECT DISTINCT tipo AS v FROM pedido_linea WHERE tipo <> ''"),
    q("SELECT DISTINCT tipo AS v FROM remito_linea WHERE tipo <> ''"),
    q("SELECT DISTINCT semana AS v FROM remito WHERE semana IS NOT NULL ORDER BY v")
  ]);
  var uniq = function () {
    var set = {};
    for (var a = 0; a < arguments.length; a++) (arguments[a].results || []).forEach(function (r) { if (r.v) set[r.v] = 1; });
    return Object.keys(set).sort(function (x, y) { return x.localeCompare(y, 'es'); });
  };
  return json({
    ok: true,
    marcas: uniq(marcasP, marcasR),
    rubros: uniq(rubrosP, rubrosR),
    disciplinas: uniq(discP, discR),
    tipos: uniq(tiposP, tiposR),
    semanas: (semanas.results || []).map(function (r) { return r.v; })
  });
}

/* ============================================================
 * PEDIDOS
 * ============================================================ */
async function getPedidos(env, url) {
  var marca = url.searchParams.get('marca');
  var sql = 'SELECT * FROM pedido';
  var binds = [];
  if (marca) { sql += ' WHERE marca = ?'; binds.push(marca); }
  sql += ' ORDER BY fecha DESC, id DESC';
  var cab = await stmt(env, sql, binds).all();
  var pedidos = cab.results || [];
  if (!pedidos.length) return json({ ok: true, pedidos: [] });
  var ids = pedidos.map(function (p) { return p.id; });
  var placeholders = ids.map(function () { return '?'; }).join(',');
  var lin = await stmt(env, 'SELECT * FROM pedido_linea WHERE pedido_id IN (' + placeholders + ')', ids).all();
  var byPed = {};
  (lin.results || []).forEach(function (l) { (byPed[l.pedido_id] = byPed[l.pedido_id] || []).push(l); });
  pedidos.forEach(function (p) { p.lineas = byPed[p.id] || []; });
  return json({ ok: true, pedidos: pedidos });
}

async function postPedido(env, body) {
  var nro = String(body.nro || '').trim();
  var fecha = String(body.fecha || '').trim();
  if (!nro) return err('Falta el nº de pedido (nro).');
  if (!fecha) return err('Falta la fecha del pedido.');
  var lineas;
  try { lineas = normLineas(body.lineas); } catch (e) { return err(e.message); }

  var stmts = [];
  stmts.push(env.DB.prepare(
    'INSERT INTO pedido (nro, fecha, comprador, proveedor, marca, moneda) VALUES (?,?,?,?,?,?)'
  ).bind(nro, fecha, String(body.comprador || ''), String(body.proveedor || ''), String(body.marca || ''), String(body.moneda || 'ARS')));
  lineas.forEach(function (l) {
    stmts.push(env.DB.prepare(
      'INSERT INTO pedido_linea (pedido_id, rubro, disciplina, tipo, cantidad, costo_unitario) ' +
      'VALUES ((SELECT id FROM pedido WHERE nro = ?), ?, ?, ?, ?, ?)'
    ).bind(nro, l.rubro, l.disciplina, l.tipo, l.cantidad, l.costo_unitario));
  });
  stmts.push(env.DB.prepare(
    'INSERT INTO import_log (archivo, tipo_doc, marca, filas) VALUES (?,?,?,?)'
  ).bind(String(body.archivo || 'manual'), 'pedido', String(body.marca || ''), lineas.length));

  try {
    await env.DB.batch(stmts);
  } catch (e) {
    if (isUniqueViolation(e)) return err('Ya existe un pedido con nº ' + nro + '.', 409);
    return err('No se pudo guardar el pedido: ' + (e.message || e), 500);
  }
  return json({ ok: true, nro: nro, lineas: lineas.length }, 201);
}

/* ============================================================
 * REMITOS
 * ============================================================ */
async function getRemitos(env, url) {
  var marca = url.searchParams.get('marca');
  var semana = url.searchParams.get('semana');
  var sql = 'SELECT * FROM remito WHERE 1=1';
  var binds = [];
  if (marca) { sql += ' AND marca = ?'; binds.push(marca); }
  if (semana) { sql += ' AND semana = ?'; binds.push(semana); }
  sql += ' ORDER BY fecha DESC, id DESC';
  var cab = await stmt(env, sql, binds).all();
  var remitos = cab.results || [];
  if (!remitos.length) return json({ ok: true, remitos: [] });
  var ids = remitos.map(function (r) { return r.id; });
  var ph = ids.map(function () { return '?'; }).join(',');
  var lin = await stmt(env, 'SELECT * FROM remito_linea WHERE remito_id IN (' + ph + ')', ids).all();
  var by = {};
  (lin.results || []).forEach(function (l) { (by[l.remito_id] = by[l.remito_id] || []).push(l); });
  remitos.forEach(function (r) { r.lineas = by[r.id] || []; });
  return json({ ok: true, remitos: remitos });
}

async function postRemito(env, body) {
  var nro = String(body.nro || '').trim();
  var fecha = String(body.fecha || '').trim();
  if (!nro) return err('Falta el nº de remito (nro).');
  if (!fecha) return err('Falta la fecha del remito.');
  var lineas;
  try { lineas = normLineas(body.lineas); } catch (e) { return err(e.message); }
  var pedidoNro = body.pedido_nro ? String(body.pedido_nro).trim() : null;

  var stmts = [];
  stmts.push(env.DB.prepare(
    'INSERT INTO remito (nro, fecha, proveedor, marca, pedido_nro) VALUES (?,?,?,?,?)'
  ).bind(nro, fecha, String(body.proveedor || ''), String(body.marca || ''), pedidoNro));
  lineas.forEach(function (l) {
    stmts.push(env.DB.prepare(
      'INSERT INTO remito_linea (remito_id, rubro, disciplina, tipo, cantidad, costo_unitario) ' +
      'VALUES ((SELECT id FROM remito WHERE nro = ?), ?, ?, ?, ?, ?)'
    ).bind(nro, l.rubro, l.disciplina, l.tipo, l.cantidad, l.costo_unitario));
  });
  stmts.push(env.DB.prepare(
    'INSERT INTO import_log (archivo, tipo_doc, marca, filas) VALUES (?,?,?,?)'
  ).bind(String(body.archivo || 'manual'), 'ingreso', String(body.marca || ''), lineas.length));

  try {
    await env.DB.batch(stmts);
  } catch (e) {
    if (isUniqueViolation(e)) return err('Ya existe un remito con nº ' + nro + '.', 409);
    return err('No se pudo guardar el remito: ' + (e.message || e), 500);
  }
  return json({ ok: true, nro: nro, lineas: lineas.length }, 201);
}

/* ============================================================
 * CONTROL — v_control + pct + estado
 * ============================================================ */
async function getControl(env, url) {
  var sql = 'SELECT * FROM v_control WHERE 1=1';
  var binds = [];
  ['marca', 'rubro', 'disciplina', 'tipo'].forEach(function (f) {
    var v = url.searchParams.get(f);
    if (v) { sql += ' AND ' + f + ' = ?'; binds.push(v); }
  });
  sql += ' ORDER BY marca, rubro, disciplina, tipo';
  var res = await stmt(env, sql, binds).all();
  var filas = (res.results || []).map(function (r) {
    var ped = r.cant_pedida || 0;
    var rec = r.cant_recibida || 0;
    var pct = ped > 0 ? Math.round((rec / ped) * 1000) / 10 : (rec > 0 ? 100 : 0);
    var estado = rec <= 0 ? 'pendiente' : (rec < ped ? 'parcial' : (rec > ped ? 'excedido' : 'completo'));
    r.pct = pct;
    r.estado = estado;
    return r;
  });
  return json({ ok: true, control: filas });
}

/* ============================================================
 * MAPPINGS (import_mapping)
 * ============================================================ */
async function getMappings(env) {
  var res = await env.DB.prepare('SELECT marca, tipo_doc, config FROM import_mapping').all();
  var mappings = (res.results || []).map(function (r) {
    var cfg;
    try { cfg = JSON.parse(r.config); } catch (e) { cfg = null; }
    return { marca: r.marca, tipo_doc: r.tipo_doc, config: cfg };
  });
  return json({ ok: true, mappings: mappings });
}
async function postMapping(env, body) {
  var marca = String(body.marca || '').trim();
  var tipoDoc = String(body.tipo_doc || '').trim();
  if (tipoDoc !== 'pedido' && tipoDoc !== 'ingreso') return err('tipo_doc debe ser "pedido" o "ingreso".');
  if (tipoDoc === 'pedido' && !marca) return err('Falta la marca para el mapeo de pedido.');
  if (!body.config || typeof body.config !== 'object') return err('Falta el config del mapeo.');
  try {
    await env.DB.prepare(
      'INSERT INTO import_mapping (marca, tipo_doc, config) VALUES (?,?,?) ' +
      'ON CONFLICT(marca, tipo_doc) DO UPDATE SET config = excluded.config'
    ).bind(marca, tipoDoc, JSON.stringify(body.config)).run();
  } catch (e) {
    return err('No se pudo guardar el mapeo: ' + (e.message || e), 500);
  }
  return json({ ok: true });
}

/* ============================================================
 * ROUTER
 * ============================================================ */
export async function onRequest(context) {
  var request = context.request;
  var env = context.env;
  var url = new URL(request.url);
  var parts = (context.params.route || []);
  if (typeof parts === 'string') parts = [parts];
  var head = parts[0] || '';
  var method = request.method.toUpperCase();

  if (!env.DB) return err('No está configurado el binding D1 "DB" (ver wrangler.toml).', 500);

  try {
    if (head === 'dimensiones' && method === 'GET') return await getDimensiones(env);

    if (head === 'pedidos') {
      if (method === 'GET') return await getPedidos(env, url);
      if (method === 'POST') return await postPedido(env, await request.json());
    }
    if (head === 'remitos') {
      if (method === 'GET') return await getRemitos(env, url);
      if (method === 'POST') return await postRemito(env, await request.json());
    }
    if (head === 'control' && method === 'GET') return await getControl(env, url);

    if (head === 'mappings') {
      if (method === 'GET') return await getMappings(env);
      if (method === 'POST') return await postMapping(env, await request.json());
    }

    return err('Ruta no encontrada: /api/' + parts.join('/'), 404);
  } catch (e) {
    if (e instanceof SyntaxError) return err('El cuerpo del pedido no es JSON válido.', 400);
    return err('Error del servidor: ' + (e.message || e), 500);
  }
}
