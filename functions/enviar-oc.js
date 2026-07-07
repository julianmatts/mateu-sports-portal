// Cloudflare Pages Function: POST /enviar-oc
// Recibe la OC armada por managment/ y la manda por mail via Resend (https://resend.com).
// La API key NO va en el codigo: se configura en Cloudflare Pages > Settings >
// Environment variables como RESEND_API_KEY. Opcionalmente RESEND_FROM para
// cambiar el remitente (default: oc@mateu.com.ar, requiere dominio verificado en Resend).

const MAX_DESTINATARIOS = 15;
const MAX_ADJUNTOS = 4;

function json(data, status = 200){
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost({ request, env }){
  if(!env.RESEND_API_KEY){
    return json({ ok:false, error:'Falta configurar RESEND_API_KEY en las variables de entorno de Cloudflare Pages.' }, 500);
  }

  let body;
  try{
    body = await request.json();
  }catch(e){
    return json({ ok:false, error:'El cuerpo del pedido no es JSON valido.' }, 400);
  }

  const asunto = String(body.asunto || '').trim();
  const texto = String(body.texto || '').trim();
  const destinatarios = Array.isArray(body.destinatarios) ? body.destinatarios.map(d => String(d).trim()).filter(Boolean) : [];
  const adjuntos = Array.isArray(body.adjuntos) ? body.adjuntos : [];

  if(!asunto || !texto || !destinatarios.length){
    return json({ ok:false, error:'Faltan asunto, texto o destinatarios.' }, 400);
  }
  if(destinatarios.length > MAX_DESTINATARIOS || adjuntos.length > MAX_ADJUNTOS){
    return json({ ok:false, error:'Demasiados destinatarios o adjuntos.' }, 400);
  }
  for(const a of adjuntos){
    if(!a || !a.filename || !a.content){
      return json({ ok:false, error:'Cada adjunto necesita filename y content (base64).' }, 400);
    }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + env.RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.RESEND_FROM || 'Mateu Sports <oc@mateu.com.ar>',
      to: destinatarios,
      subject: asunto,
      text: texto,
      attachments: adjuntos.map(a => ({ filename: String(a.filename), content: String(a.content) }))
    })
  });

  if(!res.ok){
    let detalle = '';
    try{ detalle = (await res.json()).message || ''; }catch(e){}
    return json({ ok:false, error:'Resend rechazo el envio' + (detalle ? ': ' + detalle : '.') }, 502);
  }

  const data = await res.json();
  return json({ ok:true, id: data.id || null });
}
