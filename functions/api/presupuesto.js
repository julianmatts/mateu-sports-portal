// Cloudflare Pages Function: /api/presupuesto
//   GET  → devuelve el array de líneas del presupuesto de compras (o [] si no hay nada).
//   PUT  → recibe el array completo en el body y lo guarda.
//
// Persistencia: Cloudflare KV. Todo el dataset va bajo UNA sola key (documento
// chico, last-write-wins). El binding se llama PRESUPUESTO_KV y se configura en
// Cloudflare Pages > Settings > Functions > KV namespace bindings (y en
// wrangler.toml para `wrangler pages dev` local). Ver README.
//
// NOTA: si más adelante cargan varias personas en simultáneo y aparece pisado de
// datos (last-write-wins), conviene migrar a D1 con una fila por línea (id,
// proveedor, rubro, categoria, periodo, presupuestado, ejecutado) y hacer
// upsert/delete por línea en vez de reescribir el documento entero.

const KV_KEY = 'presupuesto:compras:v1';

function json(data, status = 200){
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Normaliza una línea cruda del body a la forma canónica, saneando tipos.
// Linea = { id, proveedor, rubro, categoria, periodo, presupuestado, ejecutado }
function sanitizarLinea(l){
  if(!l || typeof l !== 'object') return null;
  const num = v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    id:            String(l.id || ''),
    proveedor:     String(l.proveedor || '—'),
    rubro:         String(l.rubro || '—'),
    categoria:     String(l.categoria || '—'),
    periodo:       String(l.periodo || ''),   // "YYYY-MM"
    presupuestado: num(l.presupuestado),
    ejecutado:     num(l.ejecutado)
  };
}

export async function onRequestGet({ env }){
  if(!env.PRESUPUESTO_KV){
    return json({ error: 'Falta el binding PRESUPUESTO_KV (KV) en Cloudflare Pages.' }, 500);
  }
  const raw = await env.PRESUPUESTO_KV.get(KV_KEY);
  if(!raw) return json([]);
  try{
    const data = JSON.parse(raw);
    return json(Array.isArray(data) ? data : []);
  }catch(e){
    // Dato corrupto en KV: no romper la app, devolver vacío.
    return json([]);
  }
}

export async function onRequestPut({ request, env }){
  if(!env.PRESUPUESTO_KV){
    return json({ error: 'Falta el binding PRESUPUESTO_KV (KV) en Cloudflare Pages.' }, 500);
  }

  let body;
  try{
    body = await request.json();
  }catch(e){
    return json({ error: 'El cuerpo del pedido no es JSON válido.' }, 400);
  }

  if(!Array.isArray(body)){
    return json({ error: 'El body debe ser un array de líneas.' }, 400);
  }

  const limpio = body.map(sanitizarLinea).filter(Boolean);
  await env.PRESUPUESTO_KV.put(KV_KEY, JSON.stringify(limpio));
  return json({ ok: true, guardadas: limpio.length });
}
