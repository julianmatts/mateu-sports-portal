// Genera la presentación del Reporte Mensual de stock (el deck de
// gestion-stock/?pres=YYYY-MM) como un HTML estático, sin navegador ni sesión.
// Sirve para probar el diseño del deck: ejecuta el script de
// gestion-stock/index.html con un DOM simulado y llama a gsPresHtml() con los
// datos reales de Firebase (el mes pedido + hasta 5 anteriores para la tendencia).
//
//   node scripts/gen-presentacion-stock.js 2026-09 salida.html
//
// Self-contained (fs + fetch de Node 18+). Correr desde la raíz del repo.
const fs=require('fs');
const [,, ym, out] = process.argv;
const src=fs.readFileSync('gestion-stock/index.html','utf8');
const i=src.lastIndexOf('\n<script>')+9; const j=src.indexOf('\n</script>', i);
const code=src.slice(i,j);
const mk=()=>new Proxy(function(){}, {get:(t,k)=>{
  if(k==='addEventListener'||k==='removeEventListener'||k==='setAttribute'||k==='appendChild'||k==='insertBefore'||k==='focus') return ()=>{};
  if(k==='style'||k==='dataset') return {};
  if(k==='classList') return {add(){},remove(){},toggle(){},contains(){return false}};
  if(k==='querySelectorAll') return ()=>[];
  if(k==='querySelector'||k==='getElementById'||k==='createElement'||k==='closest') return ()=>mk();
  if(k==='children'||k==='childNodes') return [];
  if(k==='innerHTML'||k==='textContent'||k==='value'||k==='src') return '';
  if(k==='then') return undefined;
  return mk();
}, set:()=>true, apply:()=>mk()});
global.window=global; global.document=mk(); global.navigator={userAgent:'node'};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.location={href:'',search:'',hash:'',pathname:'/gestion-stock/'};
global.history={replaceState(){},pushState(){}};
global.requestAnimationFrame=fn=>setTimeout(fn,0);
global.alert=()=>{}; global.confirm=()=>false; global.prompt=()=>null;
global.matchMedia=()=>({matches:false,addEventListener(){}});
global.IntersectionObserver=class{observe(){}};
const api=new Function(code+'\n;return {gsPresHtml, gsPresTot};')();
(async()=>{
  const FB='https://discontinuos-mateu-default-rtdb.firebaseio.com';
  const get=async u=>(await fetch(u)).json();
  const meses=Object.keys(await get(FB+'/gestionStock.json?shallow=true')).filter(m=>m<=ym).sort().slice(-6);
  const datos=await Promise.all(meses.map(m=>get(FB+'/gestionStock/'+m+'.json')));
  const data=datos[meses.indexOf(ym)];
  const hist=meses.map((m,k)=>({ym:m, tot:api.gsPresTot(datos[k])}));
  const logo=(fs.readFileSync('shared/header.js','utf8').match(/LOGO = '([^']+)'/)||[])[1]||'';
  fs.writeFileSync(out, api.gsPresHtml(ym, data, logo, hist));
  console.log('ok', out, fs.statSync(out).size);
})().catch(e=>{ console.error('ERR', e); process.exit(1); });
