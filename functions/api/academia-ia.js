/* ============================================================
   /api/academia-ia — ayudante con IA de la Academia de Ventas
   ------------------------------------------------------------
   Cloudflare Pages Function (se deploya sola con el push, como el
   resto del sitio). Llama a Claude por HTTP directo (sin SDK: el
   repo no tiene build ni npm) y devuelve JSON validado por schema.

   Necesita la variable de entorno ANTHROPIC_API_KEY en Cloudflare
   Pages → Settings → Environment variables (Production). Sin la
   clave, GET responde {disponible:false} y la Academia esconde el
   botón; nada se rompe.

   GET  /api/academia-ia            → { disponible: true|false }
   POST /api/academia-ia            → body { accion:'curso', titulo, modulos:[{titulo,contenido}], nPreguntas }
                                      → { titulo, desc, frase, modulos:[{titulo,contenido}], quiz:{aprueba, preguntas:[{q,ops,ok}]} }
                                      body { accion:'quiz', titulo, modulos, nPreguntas }
                                      → { quiz:{aprueba, preguntas:[...]} }
   ============================================================ */

const MODELO = 'claude-opus-5';
const MAX_CHARS_ENTRADA = 60000;   // ~15k tokens de contenido; más que eso se recorta por módulo

const SISTEMA = `Sos el asistente de contenido de la Academia de Ventas de Mateu Sports, una cadena de tiendas de deportes de La Plata (Argentina). Ayudás al capacitador (Iván) a convertir material crudo —texto extraído de un PDF o PowerPoint, a veces con columnas mezcladas, membretes o líneas cortadas— en un curso corto y claro para vendedores, cajeras y encargados de sucursal.

Reglas:
- Escribí en español rioplatense (vos, tenés), tono cercano y concreto, como le hablaría un capacitador a su equipo en el mostrador. Nada de relleno.
- NO inventes datos de producto, precios ni características que no estén en el material. Si algo está cortado o ambiguo, dejalo fuera antes que adivinar.
- Conservá toda la información útil del material; solo reordená, limpiá y separá en módulos con sentido (entre 3 y 10). Un módulo = un tema que se lee en 3-6 minutos.
- Formato del contenido de cada módulo: bloques separados por una línea en blanco. Un bloque puede empezar con "Título:" (en su propia línea) para que sea una tarjeta con título. Para destacar, empezá el bloque con [[dato]] Título, [[tip]] Título, [[evitar]] Título o [[ejemplo]] Título. Usá viñetas con "•" para listas. Sin markdown (nada de #, **, tablas).
- Las tarjetas [[evitar]] son para lo que NO hay que decir o hacer; [[tip]] para el consejo práctico de venta; [[dato]] para el dato duro que conviene recordar; [[ejemplo]] para frases textuales de mostrador.
- El quiz: preguntas de opción múltiple sobre lo que el vendedor necesita para recomendar bien, planteadas como situaciones de mostrador cuando se pueda ("un cliente te dice X, ¿qué le recomendás?"). 3 o 4 opciones, una sola correcta, distractores plausibles. Variá la posición de la correcta. ok es el índice (desde 0) de la opción correcta dentro de ops.
- La frase gancho es una sola oración corta y motivadora para la portada, sin signos de exclamación dobles.`;

const SCHEMA_CURSO = {
  type: 'object',
  properties: {
    titulo: { type: 'string' },
    desc: { type: 'string' },
    frase: { type: 'string' },
    modulos: { type: 'array', items: { type: 'object', properties: { titulo: { type: 'string' }, contenido: { type: 'string' } }, required: ['titulo', 'contenido'], additionalProperties: false } },
    quiz: { type: 'object', properties: {
      aprueba: { type: 'integer' },
      preguntas: { type: 'array', items: { type: 'object', properties: { q: { type: 'string' }, ops: { type: 'array', items: { type: 'string' } }, ok: { type: 'integer' } }, required: ['q', 'ops', 'ok'], additionalProperties: false } }
    }, required: ['aprueba', 'preguntas'], additionalProperties: false }
  },
  required: ['titulo', 'desc', 'frase', 'modulos', 'quiz'],
  additionalProperties: false
};
const SCHEMA_QUIZ = {
  type: 'object',
  properties: { quiz: SCHEMA_CURSO.properties.quiz },
  required: ['quiz'],
  additionalProperties: false
};

function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function onRequestGet(ctx) {
  return json({ disponible: !!(ctx.env && ctx.env.ANTHROPIC_API_KEY), modelo: MODELO });
}

export async function onRequestPost(ctx) {
  const key = ctx.env && ctx.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: 'El ayudante con IA no está configurado (falta ANTHROPIC_API_KEY en Cloudflare Pages).' }, 503);

  let body;
  try { body = await ctx.request.json(); } catch (e) { return json({ error: 'JSON inválido' }, 400); }
  const accion = body.accion === 'quiz' ? 'quiz' : 'curso';
  const titulo = String(body.titulo || '').slice(0, 200);
  const nPreguntas = Math.max(3, Math.min(12, parseInt(body.nPreguntas, 10) || 6));
  const modulos = Array.isArray(body.modulos) ? body.modulos.slice(0, 40) : [];
  if (!modulos.length) return json({ error: 'Sin contenido para procesar' }, 400);

  // Material crudo → texto plano para el modelo (recortado si es enorme)
  let material = modulos.map((m, i) => '=== Módulo ' + (i + 1) + (m.titulo ? ': ' + String(m.titulo) : '') + ' ===\n' + String(m.contenido || '')).join('\n\n');
  if (material.length > MAX_CHARS_ENTRADA) material = material.slice(0, MAX_CHARS_ENTRADA) + '\n\n[… material recortado por tamaño …]';

  const pedido = accion === 'quiz'
    ? 'Armá un quiz de ' + nPreguntas + ' preguntas para el curso «' + titulo + '» a partir de este contenido (no cambies el contenido, solo devolvé el quiz). Aprueba con 70.\n\n' + material
    : 'Convertí este material en un curso de la Academia. Título sugerido del capacitador: «' + titulo + '» (mejoralo solo si es claramente mejor). Devolvé título, descripción/objetivo (2-3 oraciones), frase gancho, los módulos limpios y ordenados con el formato indicado, y un quiz de ' + nPreguntas + ' preguntas (aprueba con 70).\n\n' + material;

  const req = {
    model: MODELO,
    max_tokens: 16000,
    system: SISTEMA,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: accion === 'quiz' ? SCHEMA_QUIZ : SCHEMA_CURSO } },
    fallbacks: 'default',   // si el clasificador de seguridad rechaza, la API re-rutea sola a otro modelo
    messages: [{ role: 'user', content: pedido }]
  };

  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
      body: JSON.stringify(req)
    });
  } catch (e) { return json({ error: 'No se pudo contactar a la API: ' + e.message }, 502); }

  const data = await r.json().catch(() => null);
  if (!r.ok || !data) return json({ error: 'API ' + r.status + ': ' + ((data && data.error && data.error.message) || 'sin detalle') }, 502);
  if (data.stop_reason === 'refusal') return json({ error: 'El modelo no pudo procesar este material.' }, 422);
  if (data.stop_reason === 'max_tokens') return json({ error: 'El material es demasiado largo para una sola pasada; dividilo en dos cursos.' }, 422);

  const texto = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  let salida;
  try { salida = JSON.parse(texto); } catch (e) { return json({ error: 'La respuesta no vino en el formato esperado.' }, 502); }

  // Saneo mínimo del quiz (índice de la correcta dentro de rango, opciones no vacías)
  if (salida.quiz && Array.isArray(salida.quiz.preguntas)) {
    salida.quiz.preguntas = salida.quiz.preguntas
      .map(p => ({ q: String(p.q || '').trim(), ops: (p.ops || []).map(o => String(o).trim()).filter(Boolean), ok: parseInt(p.ok, 10) || 0 }))
      .filter(p => p.q && p.ops.length >= 2)
      .map(p => ({ q: p.q, ops: p.ops, ok: Math.max(0, Math.min(p.ops.length - 1, p.ok)) }));
    salida.quiz.aprueba = Math.max(10, Math.min(100, parseInt(salida.quiz.aprueba, 10) || 70));
  }
  if (Array.isArray(salida.modulos)) salida.modulos = salida.modulos.filter(m => m && (m.titulo || m.contenido)).map(m => ({ titulo: String(m.titulo || '').trim(), contenido: String(m.contenido || '').trim() }));

  return json(Object.assign(salida, { uso: data.usage ? { entrada: data.usage.input_tokens, salida: data.usage.output_tokens } : null }));
}
