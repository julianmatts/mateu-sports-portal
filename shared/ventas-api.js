/* ============================================================
   shared/ventas-api.js — la venta del sistema en vivo para los módulos
   (24/09/2026). Lee el proxy /api/ventas (functions/api/ventas.js →
   lib/ventas-proxy.mjs), que es el único que conoce la key de la API.

   Se incluye con una línea en el <head>, SIN defer:
     <script src="../shared/ventas-api.js"></script>
   y expone window.VentasApi:
     disponible()          → Promise<bool>  (¿el proxy tiene la key? se recuerda 10 min)
     semana(lunes)         → Promise<{semana, actualizado, sucursales:{slug:{venta,tickets,unidades}}}|null>
     sucursal(slug, lunes) → Promise<payload con shape ventaEquipo + fuente:'api' | null>
     totalesMes(ym)        → Promise<{porSlug:{slug:{venta,tickets,unidades}}, semanas:[lunes…], completo}|null>
                             suma las semanas del mes RETAIL (la semana es del mes de su domingo),
                             solo las que ya empezaron
     lunesHoyISO() · lunesDe(iso) · semanasDelMes(ym)
   Sin sesión, sin proxy o abierto como archivo suelto → todo devuelve null y
   el módulo sigue con su fuente de siempre. Indicadores tiene su propia copia
   inline de esta lógica (bloque «API de ventas del sistema»).
   ============================================================ */
(function(){
  var API = '/api/ventas', SS = 'ventas_api_disp', DIEZ_MIN = 10 * 60 * 1000;
  var _disp = null, _sem = {}, _suc = {};
  function sesion(){ try{ return JSON.parse(localStorage.getItem('mateu_portal_session') || 'null'); }catch(e){ return null; } }
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function iso(d){ return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function lunesDe(s){ var d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); }
  function lunesHoyISO(){ return lunesDe(iso(new Date())); }
  // semanas retail del mes: las que tienen el domingo dentro del mes
  function semanasDelMes(ym){
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7), out = [];
    var d = new Date(y, m - 1, 1); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));   // lunes de la semana del día 1
    for (var i = 0; i < 6; i++){
      var dom = new Date(d); dom.setDate(dom.getDate() + 6);
      if (dom.getFullYear() === y && dom.getMonth() === m - 1) out.push(iso(d));
      d.setDate(d.getDate() + 7);
    }
    return out;
  }
  function disponible(){
    if (_disp) return _disp;
    if (!/^https?:$/.test(location.protocol) || !sesion()) return (_disp = Promise.resolve(false));
    try{ var c = JSON.parse(sessionStorage.getItem(SS) || 'null'); if (c && Date.now() - c.ts < DIEZ_MIN) return (_disp = Promise.resolve(!!c.ok)); }catch(e){}
    _disp = fetch(API).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){ return !!(j && j.disponible); }).catch(function(){ return false; })
      .then(function(ok){ try{ sessionStorage.setItem(SS, JSON.stringify({ ok: ok, ts: Date.now() })); }catch(e){} return ok; });
    return _disp;
  }
  function get(qs){
    var s = sesion() || {};
    return fetch(API + '?' + qs, { headers: { 'X-Mateu-Email': s.email || '', 'X-Mateu-Tok': s.tok || '' } })
      .then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
  }
  function semana(lunes){
    if (!_sem[lunes]) _sem[lunes] = disponible().then(function(ok){ return ok ? get('semana=' + encodeURIComponent(lunes)) : null; })
      .then(function(j){ return (j && j.sucursales && typeof j.sucursales === 'object') ? j : null; });
    return _sem[lunes];
  }
  function sucursal(slug, lunes){
    var k = slug + '|' + lunes;
    if (!_suc[k]) _suc[k] = disponible().then(function(ok){ return ok ? get('semana=' + encodeURIComponent(lunes) + '&sucursal=' + encodeURIComponent(slug)) : null; })
      .then(function(j){ if (!j || !Array.isArray(j.vendedores)) return null; j.fuente = 'api'; j.semana = j.semana || lunes; return j; });
    return _suc[k];
  }
  function totalesMes(ym){
    var hoy = iso(new Date()), sems = semanasDelMes(ym).filter(function(l){ return l <= hoy; });
    if (!sems.length) return Promise.resolve(null);
    return Promise.all(sems.map(semana)).then(function(rs){
      var por = {}, n = 0;
      rs.forEach(function(j){
        if (!j) return; n++;
        Object.keys(j.sucursales).forEach(function(sl){
          var t = j.sucursales[sl] || {}, o = por[sl] = por[sl] || { venta: 0, tickets: 0, unidades: 0 };
          o.venta += +t.venta || 0; o.tickets += +t.tickets || 0; o.unidades += +t.unidades || 0;
        });
      });
      if (!n) return null;
      var ult = sems[sems.length - 1], fin = new Date(ult + 'T00:00:00'); fin.setDate(fin.getDate() + 6);
      return { porSlug: por, semanas: sems, completo: n === sems.length && iso(fin) < hoy && semanasDelMes(ym).length === sems.length };
    });
  }
  window.VentasApi = { disponible: disponible, semana: semana, sucursal: sucursal, totalesMes: totalesMes, lunesHoyISO: lunesHoyISO, lunesDe: lunesDe, semanasDelMes: semanasDelMes };
})();
