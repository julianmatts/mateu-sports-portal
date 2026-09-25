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
     lineas(desde, hasta, {sucursal:'NN', onPagina}) → Promise<Array de líneas crudas | null>
                             (25/09/2026) recorre todas las páginas del proxy (10.000 por página, cursor);
                             solo gerencia. `sucursal` es el código de dos dígitos del sistema; `onPagina(n,
                             acumuladas)` avisa el avance. Cada línea: {fecha, hora, sucursal, vendedor,
                             comprobante, articulo, rubro, cantidad, importe, idItem, talle, codigo,
                             codigoArticulo (= código de barras), cliente, clienteCuit}.
     lunesHoyISO() · lunesDe(iso) · semanasDelMes(ym)
   Sin sesión, sin proxy o abierto como archivo suelto → todo devuelve null y
   el módulo sigue con su fuente de siempre. Indicadores tiene su propia copia
   inline de esta lógica (bloque «API de ventas del sistema»).
   ============================================================ */
(function(){
  var API = '/api/ventas', SS = 'ventas_api_disp', DIEZ_MIN = 10 * 60 * 1000;
  var _disp = null, _sem = {}, _suc = {}, _lin = {};
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
  function getCrudo(qs){
    var s = sesion() || {};
    return fetch(API + '?' + qs, { headers: { 'X-Mateu-Email': s.email || '', 'X-Mateu-Tok': s.tok || '' } })
      .then(function(r){ return r.json().then(function(j){ if (!r.ok) throw new Error((j && j.error) || ('El proxy respondió ' + r.status)); return j; }); });
  }
  // Las líneas crudas del sistema entre dos fechas (inclusive), todas las páginas juntas.
  function lineas(desde, hasta, opts){
    opts = opts || {};
    var k = desde + '|' + hasta + '|' + (opts.sucursal || '');
    if (_lin[k]) return _lin[k];
    _lin[k] = disponible().then(function(ok){
      if (!ok) return null;
      var todas = [], n = 0;
      // la base del sistema se bloquea ~20 s cada tanto y la API devuelve 500: se reintenta la página
      // hasta 3 veces esperando 5 s entre intentos
      function conReintento(qs, intento){
        return getCrudo(qs).catch(function(e){
          if (intento >= 3) throw e;
          return new Promise(function(r){ setTimeout(r, 5000); }).then(function(){ return conReintento(qs, intento + 1); });
        });
      }
      function pagina(cursor){
        var qs = 'lineas=1&desde=' + encodeURIComponent(desde) + '&hasta=' + encodeURIComponent(hasta)
          + (opts.sucursal ? '&sucursal=' + encodeURIComponent(opts.sucursal) : '') + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
        return conReintento(qs, 1).then(function(j){
          var ls = (j && j.lineas) || []; n++;
          for (var i = 0; i < ls.length; i++) todas.push(ls[i]);
          if (typeof opts.onPagina === 'function') { try { opts.onPagina(n, todas.length); } catch (e) {} }
          if (j && j.cursor && ls.length && n < 40) return pagina(j.cursor);
          return todas;
        });
      }
      return pagina(null);
    }).catch(function(e){ delete _lin[k]; throw e; });
    return _lin[k];
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
  window.VentasApi = { disponible: disponible, semana: semana, sucursal: sucursal, lineas: lineas, totalesMes: totalesMes, lunesHoyISO: lunesHoyISO, lunesDe: lunesDe, semanasDelMes: semanasDelMes };
})();
