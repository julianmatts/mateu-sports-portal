/* Prueba de punta a punta del PUENTE DEL ESCÁNER (scripts/puente-escaner/)
   del lado del Buscador de Artículos, sin tocar Firebase ni una PC del salón.
   Levanta ubicaciones/ en Chromium, intercepta la base con datos de prueba y
   simula lo que publica el programita de la PC en scanBridge/<slug>.

   Cómo correrla (en el sandbox; Chromium ya está instalado):
     npx --yes http-server -p 8777 -s .            # servir el repo
     node scripts/probar-puente-escaner.mjs sse puesto
     node scripts/probar-puente-escaner.mjs poll puesto      # sin EventSource
     node scripts/probar-puente-escaner.mjs sse sucursal
     PRUEBA=1 node scripts/probar-puente-escaner.mjs sse puesto   # «Probar el puente»

   Espera ver: toast «📡 Escaneado en el sistema», el EAN resuelto al artículo
   y la tarjeta con su ubicación del depósito. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://127.0.0.1:8777';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const MODO = process.argv[2] || 'sse';        // sse | poll (poll = navegador sin EventSource)
const ROL  = process.argv[3] || 'puesto';     // puesto | sucursal

const ART = {
  'AB123': { codigo:'AB123', descripcion:'ZAPATILLA TEST RUN', articulo:'233282', stock:4,
             eans:[{e:'7791234567890', t:'41'}], ubicaciones:[{estanteriaId:'e1', modulo:1}] },
  'CD999': { codigo:'CD999', descripcion:'CAMPERA TEST', stock:2 }
};
const EST = { e1:{ nombre:'EST 3', modulos:6 } };

// lo que hay en scanBridge/<slug>: al abrir, un escaneo viejo
let scan = { codigo:'AB123', ts: 1000, pc:'PC-SALON' };

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport:{width:1280,height:900} });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', e=> errores.push('pageerror: '+e.message));

await ctx.route('**/*firebaseio.com/**', async route=>{
  const p = new URL(route.request().url()).pathname;
  const json = o => route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(o) });
  if(p.startsWith('/scanBridge/')){
    if(route.request().headers()['accept'] === 'text/event-stream'){
      if(MODO !== 'sse') return route.fulfill({ status:404, contentType:'text/plain', body:'no' });
      const ev = d => 'event: put\ndata: '+JSON.stringify({path:'/', data:d})+'\n\n';
      return route.fulfill({ status:200, contentType:'text/event-stream', body: ev(scan) });
    }
    return json(scan);
  }
  if(p.endsWith('/articulos.json'))   return json(ART);
  if(p.endsWith('/estanterias.json')) return json(EST);
  if(p.endsWith('/config.json'))      return json({nombre:'Casa Matriz Diagonal 80'});
  if(p.endsWith('/perfiles.json'))    return json({ p1:{nombre:'Ana Vendedora', rol:'vendedor'} });
  if(p.endsWith('/meta.json'))        return json({ rev:1 });
  return json(null);
});

await page.addInitScript(rol=>{
  localStorage.setItem('mateu_portal_session', JSON.stringify({
    email: rol==='puesto' ? '10-consulta@mateu.com.ar' : '10-diagonal@mateu.com.ar',
    rol, sucursal:'diagonal', herramientas:['ubicaciones']
  }));
}, ROL);

await page.goto(BASE + '/ubicaciones/', { waitUntil:'domcontentloaded' });
await page.waitForFunction(()=> document.getElementById('app')?.style.display==='block' ||
                               document.getElementById('profileScreen')?.style.display==='flex',
                           null, {timeout:15000}).catch(()=>{});
await page.evaluate(()=>{ document.querySelector('.mtu-scrim')?.remove(); });   // tutorial del shell
if(await page.locator('#profileScreen').isVisible().catch(()=>false)){
  await page.locator('.pss-item').first().click();
  await page.waitForTimeout(500);
}
await page.evaluate(()=>{ window.__toasts=[]; const o=window.toast; window.toast=m=>{ window.__toasts.push(m); o(m); }; });

// ahora el vendedor escanea PARADO EN EL SISTEMA: el puente publica el código
scan = process.env.PRUEBA ? { codigo:'PUENTE-TEST', ts:Date.now(), pc:'PC-SALON', test:true }
                          : { codigo:'7791234567890', ts:Date.now(), pc:'PC-SALON' };  // EAN del talle 41
await page.waitForTimeout(MODO==='sse' ? 5000 : 12000);

const r = await page.evaluate(()=>({
  toasts: window.__toasts,
  busqueda: document.getElementById('searchInput').value,
  tarjetas: Array.from(document.querySelectorAll('#searchResults .art-card')).map(c=>c.dataset.art),
  texto: (document.getElementById('searchResults')||{}).innerText || ''
}));
console.log(JSON.stringify({ MODO, ROL, ...r, errores }, null, 1));
await browser.close();

const ok = process.env.PRUEBA
  ? r.toasts.some(t=>t.includes('Puente del escáner conectado'))
  : (r.busqueda==='7791234567890' && r.tarjetas.includes('AB123'));
console.log(ok ? '\n✔ el puente llegó al Buscador' : '\n✘ NO llegó');
process.exit(ok && !errores.length ? 0 : 1);
