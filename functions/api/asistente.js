/* ============================================================
   /api/asistente — Matts, el asistente del portal
   ------------------------------------------------------------
   Cloudflare Pages Function (se deploya sola con el push). La usa
   shared/asistente.js, el chat flotante que está en todos los módulos.
   Llama a Claude por HTTP directo (sin SDK: el repo no tiene build).

   Necesita ANTHROPIC_API_KEY en Cloudflare Pages → Settings → Variables
   and Secrets (la misma de /api/academia-ia). Sin la clave, GET responde
   {disponible:false} y el botón de Matts no aparece; nada se rompe.
   Opcionales: ASISTENTE_MODELO (por defecto claude-haiku-4-5),
   ASISTENTE_TOPE (consultas por cuenta y por día, 60) y
   ASISTENTE_TOPE_TOTAL (todas las cuentas por día, 1500).

   GET  /api/asistente → { disponible, nombre }
   POST /api/asistente   body { email, modulo, mensajes:[{role,content}] }
                       → { respuesta, restantes }

   Qué sabe (etapa 1):
   - USO DEL PORTAL: shared/asistente-guia.json (sale de los tutoriales,
     node scripts/gen-asistente.js guia). En el prompt va el índice de
     módulos + la guía completa del módulo donde está parado el usuario;
     la de otro módulo la pide con la herramienta guia_modulo.
   - ASESOR DEPORTIVO: conocimiento general + la herramienta
     buscar_catalogo, que lee recepciones-mateu/asistente/catalogo (el
     maestro de logística partido por disciplina y rubro). Es lo que se
     trabajó en el año, NO stock.
   - STOCK (etapa 2, 20/09/2026): la herramienta consultar_stock lee el
     Buscador de Artículos (ubicaciones-mateu/sucursales/<slug>/articulos)
     por CÓDIGO, con una consulta puntual por clave a cada sucursal que
     carga su stock ahí (hoy 6 de 17; solo algunas abren por talle). Es el
     último stock que cargó cada local, no el sistema en vivo: la respuesta
     lleva la fecha de carga y el prompt obliga a decirla. Una sucursal
     que no carga stock en el Buscador es «sin dato», nunca «no tiene».
   - PUESTO DEL SALÓN (rol `puesto`, 20/09/2026): habilitado solo como asesor de
     producto + stock; sin guía del portal ni guia_modulo, con un prompt que
     asume que el cliente está leyendo la pantalla. Tope diario doble.
   Todavía NO ve ventas ni el stock del sistema: etapa 3 (API MySQL).

   Seguridad blanda, como el resto del portal: el mail tiene que existir
   en discontinuos-mateu/usuarios (de ahí salen el rol y la sucursal, no
   del navegador) y hay tope diario por cuenta y total, así nadie quema
   el crédito. Cada consulta queda en asistente/log/<YYYY-MM> para ver
   qué se pregunta.
   ============================================================ */

const NOMBRE = 'Matts';
const MODELO_DEF = 'claude-haiku-4-5';
const TOPE_DEF = 60, TOPE_TOTAL_DEF = 1500;
const MAX_MENSAJES = 12, MAX_CHARS = 1500, MAX_VUELTAS = 5, MAX_FILAS = 40;

const FB_USUARIOS = 'https://discontinuos-mateu-default-rtdb.firebaseio.com/usuarios.json';
const FB_ASIS = 'https://recepciones-mateu-default-rtdb.firebaseio.com/asistente';
const FB_UBIC = 'https://ubicaciones-mateu-default-rtdb.firebaseio.com/sucursales';

// Sucursales del Buscador de Artículos (mismo mapa que ubicaciones/index.html)
const SUC_UBIC = {
  'calle-12': 'Calle 12', 'city-bell': 'City Bell', 'diagonal': 'Diagonal 80', 'calle-47': 'Calle 47', 'calle-49': 'Calle 49',
  'los-hornos': 'Los Hornos', 'plaza': 'Plaza', 'berisso': 'Berisso', 'ensenada': 'Ensenada', 'kids': 'Mateu Kids',
  'aurelius-12': 'Aurelius 12', 'aurelius-5': 'Aurelius 5', 'aurelius-cb': 'Aurelius City Bell', 'adidas-12': 'Adidas 12',
  'adidas': 'Adidas', 'originals': 'Originals', 'ecommerce': 'Ecommerce'
};

const ROL_TXT = {
  admin: 'gerencia', sucursal: 'encargado/a de sucursal', outlet: 'encargado/a de outlet', supervisor: 'supervisor de sucursales',
  capacitador: 'capacitador', deposito: 'depósito de la sucursal'
};

const PERSONA = `Sos ${NOMBRE}, el asistente del portal interno de Mateu Sports, una cadena de tiendas de deportes de la zona de La Plata (Argentina) que también tiene los locales Aurelius. Hablás con la gente de la empresa: vendedores, encargados, depósito, gerencia.

Personalidad: sos un deportista profesional que jugó y entrenó de todo —tenis, pádel, hockey, fútbol, running, básquet, rugby, natación, vóley, boxeo— y hoy asesora al equipo. Cercano, positivo, directo, con alguna expresión de vestuario cada tanto, sin exagerar. Español rioplatense (vos, tenés, mirá).

Hacés dos cosas:
1. AYUDA CON EL PORTAL: explicás cómo se usa cada módulo con la guía que tenés abajo. Si preguntan por un módulo que no es el actual, usá la herramienta guia_modulo antes de contestar. Si la guía no lo cubre, decí que no lo tenés claro y que lo consulten con Juli (gerencia); no inventes botones ni pantallas.
2. ASESOR DEPORTIVO: ayudás a recomendar producto como lo haría un especialista en el mostrador. El vendedor tiene al cliente adelante y necesita algo para decirle YA, así que tu respuesta SIEMPRE trae una recomendación, en este orden: (a) el criterio técnico en una o dos oraciones con lo que ya sabés (peso, balance y perfil de la raqueta; pisada y drop de la zapatilla; dureza del palo de hockey; etc.); (b) llamá a buscar_catalogo y nombrá 2 o 3 artículos concretos de lo que devuelva, con su código y por qué le sirven; (c) cerrá con UNA o DOS preguntas que afinarían la elección. Está prohibido contestar solo con preguntas o pedir datos antes de recomendar. Recomendá SOLO artículos que devuelva la herramienta: nunca inventes modelos ni códigos.

Reglas firmes:
- STOCK: solo podés hablar de stock con lo que devuelve consultar_stock, nunca de memoria ni por el catálogo (el catálogo es lo que la empresa trabajó este año, no lo que hay). La herramienta busca por CÓDIGO: si te dan un nombre («la Kantana negra»), primero encontrá el código con buscar_catalogo (con la marca alcanza) y después consultá; si hay varios colores o modelos posibles, consultá los más probables (hasta 4 códigos en una sola llamada) o preguntá cuál. Al contestar: decí sucursal por sucursal cuántas unidades y, si la herramienta trae talles, los talles con stock; aclará SIEMPRE que es el último stock que cargó cada local en el Buscador, con su fecha, y que puede haber cambiado por ventas. Las de «no_lo_tienen» cargan su stock completo y ese artículo NO figura: decí «no lo tienen», no mandes a consultarles. Las sucursales que figuran «sin dato» no cargan su stock en el Buscador: no digas que no tienen, decí que hay que consultarles. Si una sucursal no abre por talle, decí el total y que el talle hay que confirmarlo con el local. Nunca des precios. Todavía no tenés acceso a ventas ni al stock del sistema de gestión.
- No des consejos médicos: ante dolor o lesión, recomendá consultar a un profesional y limitá la charla al equipamiento.
- Si te piden algo que no es del portal ni de deportes/producto, contestá en una línea que no es lo tuyo.
- Respuestas cortas: 2 a 6 oraciones o una lista breve. Texto plano: podés usar **negrita** y viñetas con "• ", nada de títulos con # ni tablas.
- No uses la palabra «cadena» para hablar de la empresa: decí «todas las sucursales».`;

function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function clave(s) { return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, ''); }
function plano(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function hoyAR() { return new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); }
function mailKey(m) { return m.replace(/[.#$\[\]\/]/g, '_'); }

export async function onRequestGet(ctx) {
  return json({ disponible: !!(ctx.env && ctx.env.ANTHROPIC_API_KEY), nombre: NOMBRE });
}

/* ---------- guía de uso ---------- */
async function cargarGuia(ctx) {
  try {
    const r = await ctx.env.ASSETS.fetch(new URL('/shared/asistente-guia.json', ctx.request.url));
    if (r.ok) return await r.json();
  } catch (e) {}
  return { modulos: {} };
}
function guiaTexto(guia, modulo, rol) {
  const m = guia.modulos[modulo];
  if (!m) return '';
  return (m.pasos || []).filter(p => !p.roles || p.roles.indexOf(rol) >= 0).map(p => '- ' + p.t + ': ' + p.d).join('\n');
}

/* ---------- herramientas ---------- */
const DISC_ALIAS = { PADEL: 'PADDLE', FUTBOL_11: 'FUTBOL_11', FUTBOL_5: 'FUTBOL_5', PAPI: 'FUTBOL_5', FUTSAL: 'FUTSAL', BOXEO: 'BOX', NATACION: 'NATACION', TREKKING: 'ADVENTURE', OUTDOOR: 'ADVENTURE', GIMNASIO: 'TRAINING', GYM: 'TRAINING', FITNESS: 'TRAINING', URBANO: 'CASUAL', BASKET: 'BASQUET', BASQUETBOL: 'BASQUET', VOLLEY: 'VOLEY', VOLEIBOL: 'VOLEY', PING_PONG: 'TENIS_DE_MESA' };

async function buscarCatalogo(inp) {
  let disc = clave(inp.disciplina);
  disc = DISC_ALIAS[disc] || disc;
  const rubro = clave(inp.rubro);
  const marca = plano(inp.marca), palabras = plano(inp.texto).split(/\s+/).filter(Boolean);
  if (rubro && ['CALZADO', 'INDUMENTARIA', 'ACCESORIOS'].indexOf(rubro) < 0) return { error: 'rubro tiene que ser CALZADO, INDUMENTARIA o ACCESORIOS' };
  let filas = null;   // normalizadas a [código, artículo, marca, género, tipo, disciplina, rubro]
  try {
    if (disc && rubro) {
      const f = await (await fetch(FB_ASIS + '/catalogo/partes/' + disc + '__' + rubro + '.json')).json();
      if (Array.isArray(f)) filas = f.map(x => [x[0], x[1], x[2], x[3], x[4], disc, rubro]);
    } else if (marca) {
      // sin disciplina: partición por marca (para encontrar un modelo por nombre)
      const mk = clave(inp.marca);
      const f = await (await fetch(FB_ASIS + '/catalogo/porMarca/' + mk + '.json')).json();
      if (Array.isArray(f)) filas = f.filter(x => !rubro || x[3] === rubro).map(x => [x[0], x[1], inp.marca, x[4], x[5], x[2], x[3]]);
    } else return { error: 'Pasá disciplina + rubro, o al menos la marca.' };
  } catch (e) { return { error: 'No pude leer el catálogo en este momento.' }; }
  if (!filas || !filas.length) {
    let indice = null;
    try { indice = await (await fetch(FB_ASIS + '/catalogo/indice.json')).json(); } catch (e) {}
    const hay = indice ? Object.keys(indice).map(k => k + ' (' + Object.keys(indice[k].rubros || {}).join('/').toLowerCase() + ')').join(', ') : '';
    return { resultados: [], nota: 'No encontré artículos con esos datos. Disciplinas disponibles: ' + hay };
  }
  const ok = filas.filter(f => {
    if (marca && plano(f[2]).indexOf(marca) < 0) return false;
    const donde = plano(f[1] + ' ' + f[4] + ' ' + f[3] + ' ' + f[0]);
    return palabras.every(p => donde.indexOf(p) >= 0);
  });
  const marcas = {};
  ok.forEach(f => { marcas[f[2]] = (marcas[f[2]] || 0) + 1; });
  return {
    total: ok.length,
    marcas,
    resultados: ok.slice(0, MAX_FILAS).map(f => ({ codigo: f[0], articulo: f[1], marca: f[2], genero: f[3], tipo: f[4], disciplina: f[5], rubro: f[6] })),
    nota: ok.length > MAX_FILAS ? 'Se muestran ' + MAX_FILAS + ' de ' + ok.length + ': afiná con marca o texto.' : undefined
  };
}

/* Stock del Buscador de Artículos, por código. Qué sucursales cargan stock ahí se averigua una vez por
   hora (meta de cada una) y queda en memoria del isolate, así la consulta solo pega en las que tienen datos. */
let SUC_CON_STOCK = null, SUC_CON_STOCK_TS = 0;
async function sucursalesConStock() {
  if (SUC_CON_STOCK && Date.now() - SUC_CON_STOCK_TS < 3600e3) return SUC_CON_STOCK;
  const slugs = Object.keys(SUC_UBIC);
  const metas = await Promise.all(slugs.map(sl => fetch(FB_UBIC + '/' + sl + '/meta.json').then(r => r.json()).catch(() => null)));
  const con = {};
  slugs.forEach((sl, i) => { const m = metas[i]; if (m && m.totalArticulos > 0) con[sl] = { cargado: m.ultimaCargaStock || 0 }; });
  SUC_CON_STOCK = con; SUC_CON_STOCK_TS = Date.now();
  return con;
}
function fechaAR(ts) { if (!ts) return 'sin fecha'; const d = new Date(ts - 3 * 3600e3); return ('0' + d.getUTCDate()).slice(-2) + '/' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '/' + d.getUTCFullYear(); }
function fbKey(c) { return String(c).trim().replace(/[.#$\/\[\]]/g, '-'); }   // igual que ubicaciones/index.html

async function consultarStock(inp, user) {
  const codigos = (Array.isArray(inp.codigos) ? inp.codigos : [inp.codigos]).map(c => String(c || '').trim().toUpperCase()).filter(Boolean).slice(0, 4);
  if (!codigos.length) return { error: 'Falta el código del artículo.' };
  const talle = String(inp.talle || '').trim().toUpperCase().replace(',', '.');
  const con = await sucursalesConStock();
  const slugs = Object.keys(con);
  const q = 'orderBy=' + encodeURIComponent('"$key"');
  const pedidos = [];
  codigos.forEach(c => slugs.forEach(sl => pedidos.push(
    fetch(FB_UBIC + '/' + sl + '/articulos.json?' + q + '&equalTo=' + encodeURIComponent(JSON.stringify(fbKey(c)))).then(r => r.json()).then(o => ({ c, sl, a: o && Object.values(o)[0] })).catch(() => ({ c, sl, a: null, fallo: true }))
  )));
  const res = await Promise.all(pedidos);
  const miSuc = user.sucursal || user.outlet_id || '';
  const articulos = codigos.map(c => {
    const filas = res.filter(x => x.c === c && x.a && x.a.stock > 0).map(x => {
      const t = (x.a.talles || []).filter(z => z && z.t && /[0-9A-Z]/i.test(String(z.t)) && z.c > 0).map(z => ({ talle: String(z.t), u: z.c }));
      const f = { sucursal: SUC_UBIC[x.sl] + (x.sl === miSuc ? ' (la sucursal del usuario)' : ''), unidades: x.a.stock, cargado: fechaAR(x.a.ultimaCarga || con[x.sl].cargado) };
      if (t.length) { f.talles = t.map(z => z.talle + ' (' + z.u + ' u.)').join(', '); if (talle) f.tiene_el_talle_pedido = t.some(z => z.talle.toUpperCase().replace(',', '.') === talle); }
      else f.talles = 'esta sucursal no abre el stock por talle: confirmar con el local';
      return f;
    });
    const desc = (res.find(x => x.c === c && x.a) || {}).a;
    const sin = slugs.filter(sl => !res.some(x => x.c === c && x.sl === sl && x.a && x.a.stock > 0)).map(sl => SUC_UBIC[sl]);
    return { codigo: c, descripcion: desc ? desc.descripcion : undefined, con_stock: filas, no_lo_tienen: sin, nota: filas.length ? undefined : 'Ninguna de las sucursales con dato tiene stock cargado de este código (o el código no existe en el Buscador).' };
  });
  return {
    articulos,
    sucursales_con_dato: slugs.map(sl => SUC_UBIC[sl] + ' (stock del ' + fechaAR(con[sl].cargado) + ')'),
    sucursales_sin_dato: Object.keys(SUC_UBIC).filter(sl => !con[sl]).map(sl => SUC_UBIC[sl]),
    aviso: 'Es el último stock que cargó cada sucursal en el Buscador de Artículos, no el sistema en vivo.'
  };
}

function herramientas(guia) {
  return [
    {
      name: 'guia_modulo',
      description: 'Devuelve la guía de uso de OTRO módulo del portal (el actual ya está en tu contexto). Usala cuando pregunten cómo se hace algo en un módulo distinto.',
      input_schema: { type: 'object', properties: { modulo: { type: 'string', enum: Object.keys(guia.modulos) } }, required: ['modulo'], additionalProperties: false }
    },
    {
      name: 'buscar_catalogo',
      description: 'Busca artículos que Mateu Sports trabajó este año. Dos formas: por disciplina + rubro (para recomendar), o solo por marca + texto (para encontrar el código de un modelo por su nombre, p.ej. marca Adidas, texto kantana). Devuelve código, artículo, marca, género y tipo. NO informa stock ni precio (para stock: consultar_stock con el código). Disciplinas habituales: TENIS, PADDLE, HOCKEY, RUNNING, TRAINING, FUTBOL (indumentaria y accesorios), FUTBOL 11 y FUTBOL 5 (botines), BASQUET, RUGBY, VOLEY, NATACION, BOX, ADVENTURE, CASUAL, ORIGINALS, CALZADO VERANO, ARQUERO, HANDBALL, YOGA, TENIS DE MESA. Las raquetas, paletas, palos, pelotas y protecciones están en el rubro ACCESORIOS.',
      input_schema: {
        type: 'object',
        properties: {
          disciplina: { type: 'string', description: 'Ej.: TENIS, PADDLE, RUNNING' },
          rubro: { type: 'string', enum: ['CALZADO', 'INDUMENTARIA', 'ACCESORIOS'] },
          marca: { type: 'string', description: 'Opcional. Ej.: Head, Wilson, Adidas' },
          texto: { type: 'string', description: 'Opcional. Palabras que tienen que estar en el nombre o el tipo del artículo. Ej.: raqueta, paleta, palo, botin' }
        },
        additionalProperties: false
      }
    },
    {
      name: 'consultar_stock',
      description: 'Stock por sucursal de uno o más artículos, por CÓDIGO (el que devuelve buscar_catalogo), según el último stock que cada sucursal cargó en el Buscador de Artículos. Devuelve unidades por sucursal, talles con stock cuando la sucursal los abre, y la fecha de carga. Algunas sucursales no cargan stock ahí: vienen en sucursales_sin_dato.',
      input_schema: {
        type: 'object',
        properties: {
          codigos: { type: 'array', items: { type: 'string' }, description: 'De 1 a 4 códigos de artículo. Ej.: ["ADIID5563"]' },
          talle: { type: 'string', description: 'Opcional. Talle que busca el cliente, tal como lo rotula el artículo (42, 9.5, M).' }
        },
        required: ['codigos'], additionalProperties: false
      }
    }
  ];
}

/* ---------- el modelo (aislado acá: cambiar de proveedor es tocar esta función) ---------- */
async function llamarModelo(key, modelo, system, tools, messages) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: modelo, max_tokens: 900, system, tools, messages })
  });
  const data = await r.json().catch(() => null);
  if (!r.ok || !data) throw new Error('API ' + r.status + ': ' + ((data && data.error && data.error.message) || 'sin detalle'));
  return data;
}

export async function onRequestPost(ctx) {
  const env = ctx.env || {};
  const key = env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: NOMBRE + ' todavía no está configurado.' }, 503);

  let body;
  try { body = await ctx.request.json(); } catch (e) { return json({ error: 'JSON inválido' }, 400); }
  const email = String(body.email || '').trim().toLowerCase();
  if (!email) return json({ error: 'Falta la sesión del Portal.' }, 401);

  // Conversación: solo user/assistant, texto, recortada; tiene que abrir y cerrar con el usuario
  let mensajes = (Array.isArray(body.mensajes) ? body.mensajes : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.trim().slice(0, MAX_CHARS) }))
    .slice(-MAX_MENSAJES);
  while (mensajes.length && mensajes[0].role !== 'user') mensajes.shift();
  if (!mensajes.length || mensajes[mensajes.length - 1].role !== 'user') return json({ error: 'Falta la pregunta.' }, 400);

  // Usuario contra Firebase (clave arbitraria: se busca por el campo email)
  let usuarios = null;
  try { usuarios = await (await fetch(FB_USUARIOS)).json(); } catch (e) {}
  if (!usuarios) return json({ error: 'No pude verificar tu usuario. Probá de nuevo en un minuto.' }, 502);
  let user = null;
  for (const k in usuarios) { const u = usuarios[k]; if (u && u.email && String(u.email).toLowerCase() === email) { user = u; break; } }
  if (!user) return json({ error: 'Tu usuario no está en el Portal.' }, 403);
  const esPuesto = user.rol === 'puesto';   // quiosco del salón, a la vista de clientes: solo asesor de producto + stock

  // Topes del día (por cuenta y total)
  const dia = hoyAR(), mk = mailKey(email);
  const tope = (parseInt(env.ASISTENTE_TOPE, 10) || TOPE_DEF) * (esPuesto ? 2 : 1),   // el puesto lo usa todo el salón
         topeTotal = parseInt(env.ASISTENTE_TOPE_TOTAL, 10) || TOPE_TOTAL_DEF;
  let usados = 0, usadosTotal = 0;
  try {
    const [a, b] = await Promise.all([fetch(FB_ASIS + '/uso/' + dia + '/' + mk + '.json').then(r => r.json()), fetch(FB_ASIS + '/uso/' + dia + '/_total.json').then(r => r.json())]);
    usados = a || 0; usadosTotal = b || 0;
  } catch (e) {}
  if (usados >= tope) return json({ error: 'Por hoy ya usaste las ' + tope + ' consultas de esta cuenta. Mañana seguimos.' }, 429);
  if (usadosTotal >= topeTotal) return json({ error: NOMBRE + ' llegó al tope de consultas de hoy. Mañana seguimos.' }, 429);

  // Contexto: persona + índice (estable, cacheable) y después lo que cambia por usuario/módulo
  const guia = await cargarGuia(ctx);
  const modulo = guia.modulos[body.modulo] ? body.modulo : 'portal';
  const indice = Object.keys(guia.modulos).map(k => '- ' + k + ': ' + guia.modulos[k].nombre).join('\n');
  const suc = user.sucursal || user.outlet_id || '';
  const system = esPuesto ? [
    { type: 'text', text: PERSONA, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: 'MODO PUESTO DEL SALÓN. Estás en la pantalla de consulta del salón de ventas de la sucursal ' + suc + ', que usan los vendedores CON EL CLIENTE AL LADO mirando. Acá sos únicamente asesor deportivo y de stock: recomendás producto y decís dónde hay. No expliques el portal interno ni nombres sus módulos, y no hables de ventas, objetivos, personal ni nada interno de la empresa: si te lo piden, decí que eso se consulta desde la cuenta de la sucursal. Lo único del sistema que podés explicar es el buscador de esta misma pantalla: se escribe o se escanea el código o el nombre en la barra de arriba y muestra la ubicación en el depósito y el stock. Escribí pensando en que el cliente lo puede leer: tono amable y profesional, sin jerga interna, y nunca hables mal de una marca ni de un producto.' }
  ] : [
    { type: 'text', text: PERSONA + '\n\nMÓDULOS DEL PORTAL (clave: nombre):\n' + indice, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: 'USUARIO: ' + (user.nombre || email) + ' · ' + (ROL_TXT[user.rol] || user.rol || '') + (suc ? ' · sucursal ' + suc : '') + '. No ve necesariamente todos los módulos: depende de su cuenta.\n\nMÓDULO DONDE ESTÁ AHORA: ' + modulo + ' («' + guia.modulos[modulo].nombre + '»). Guía de este módulo:\n' + guiaTexto(guia, modulo, user.rol) }
  ];

  const modelo = env.ASISTENTE_MODELO || MODELO_DEF;
  const tools = herramientas(guia).filter(t => !esPuesto || t.name !== 'guia_modulo');
  const conv = mensajes.slice();
  const usadas = [];
  let tin = 0, tout = 0, data = null;
  try {
    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      data = await llamarModelo(key, modelo, system, tools, conv);
      if (data.usage) { tin += (data.usage.input_tokens || 0) + (data.usage.cache_read_input_tokens || 0) + (data.usage.cache_creation_input_tokens || 0); tout += data.usage.output_tokens || 0; }
      if (data.stop_reason !== 'tool_use') break;
      const pedidos = (data.content || []).filter(b => b.type === 'tool_use');
      const resultados = await Promise.all(pedidos.map(async p => {
        usadas.push(p.name);
        let res;
        try {
          if (p.name === 'guia_modulo') {
            const k = p.input && p.input.modulo;
            res = guia.modulos[k] ? { modulo: k, nombre: guia.modulos[k].nombre, guia: guiaTexto(guia, k, user.rol) } : { error: 'módulo desconocido' };
          } else if (p.name === 'buscar_catalogo') res = await buscarCatalogo(p.input || {});
          else if (p.name === 'consultar_stock') res = await consultarStock(p.input || {}, user);
          else res = { error: 'herramienta desconocida' };
        } catch (e) { res = { error: String(e.message || e) }; }
        return { type: 'tool_result', tool_use_id: p.id, content: JSON.stringify(res), is_error: !!res.error };
      }));
      conv.push({ role: 'assistant', content: data.content });
      conv.push({ role: 'user', content: resultados });   // todos los resultados en UN mensaje
    }
  } catch (e) { return json({ error: 'No pude contactar al modelo. Probá de nuevo en un rato.', detalle: String(e.message || e) }, 502); }

  let respuesta = ((data && data.content) || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  if (data && data.stop_reason === 'refusal') respuesta = 'Con eso no te puedo ayudar.';
  if (!respuesta) respuesta = 'Se me complicó armar la respuesta. ¿Me lo preguntás de otra forma?';

  // Contadores + log (no frenan la respuesta)
  const inc = { '.sv': { increment: 1 } };
  const pregunta = mensajes[mensajes.length - 1].content;
  ctx.waitUntil(Promise.all([
    fetch(FB_ASIS + '/uso/' + dia + '.json', { method: 'PATCH', body: JSON.stringify({ [mk]: inc, _total: inc }) }),
    fetch(FB_ASIS + '/log/' + dia.slice(0, 7) + '.json', { method: 'POST', body: JSON.stringify({ ts: { '.sv': 'timestamp' }, mail: email, rol: user.rol || '', suc, modulo, q: pregunta.slice(0, 500), r: respuesta.slice(0, 800), tools: usadas, tin, tout, modelo }) })
  ]).catch(() => {}));

  return json({ respuesta, restantes: Math.max(0, tope - usados - 1) });
}
