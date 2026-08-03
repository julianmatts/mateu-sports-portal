/* ============================================================
   sesion.js — Personalización del prototipo con el usuario logueado
   ------------------------------------------------------------
   Las pantallas .dc.html salieron de Design con la identidad de demo
   horneada ("Iván Nicoloff · Capacitador · Admin"). Este script la
   reemplaza en el DOM por la del usuario real de la sesión del Portal,
   apenas el runtime (support.js) termina de renderizar.

   Es solo cosmético (prototipo): los datos de cursos/avances siguen
   siendo de demo. La versión funcional reemplaza esto por datos reales.
   ============================================================ */
(function () {
  'use strict';

  var s = null;
  try { var t = localStorage.getItem('mateu_portal_session'); s = t ? JSON.parse(t) : null; }
  catch (e) { s = window.__sess || null; }
  if (!s || !s.email) return;

  // Personas conocidas del módulo (mail → identidad). El resto se deriva del mail.
  var PERSONAS = {
    'capacitacion@mateu.com.ar':     { nombre: 'Iván Nicoloff',    rol: 'Capacitador · Admin' },
    'cristian.campion@mateu.com.ar': { nombre: 'Cristian Campion', rol: 'Supervisor · Admin' },
    'julian@mateu.com.ar':           { nombre: 'Julián Mateu',     rol: 'Gerencia · Admin' }
  };
  var ROL_LABEL = { admin: 'Gerencia · Admin', capacitador: 'Capacitador · Admin', supervisor: 'Supervisor · Admin', sucursal: 'Sucursal', outlet: 'Outlet' };

  var email = (s.email || '').toLowerCase();
  var p = PERSONAS[email];
  if (!p) {
    var base = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
    var nombre = base.replace(/\b\w/g, function (c) { return c.toUpperCase(); }) || email;
    p = { nombre: nombre, rol: ROL_LABEL[s.rol] || s.rol };
  }
  var corto = p.nombre.split(/\s+/)[0];
  var iniciales = p.nombre.split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();

  // Equipo real del módulo: el capacitador es Iván y el supervisor es Cristian.
  // Las firmas del certificado vienen de Design con nombres de demo distintos
  // ("Rocío Vega" / "Cristian Giménez"): se mapean acá a los reales.
  var CAPACITADOR = 'Iván Nicoloff';
  var SUPERVISOR = 'Cristian Campion';

  // [substring que viene de Design, reemplazo]
  var SUBS = [
    ['Iván Nicoloff', p.nombre],
    ['Cristian Supervisor', SUPERVISOR],
    ['Rocío Vega', CAPACITADOR],
    ['Cristian Giménez', SUPERVISOR],
    ['Capacitador · Admin', p.rol]
  ];
  // Tokens cortos: solo si el nodo de texto es exactamente ese valor
  // (evita pisar "IV"/"Iván" dentro de otras palabras o listas).
  var EXACTOS = { 'Iván': corto, 'IV': iniciales, 'CG': 'CC' };

  function reemplazarEn(root) {
    if (!root || root.nodeType !== 1) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var n;
    while ((n = walker.nextNode())) {
      var v = n.nodeValue, orig = v;
      for (var i = 0; i < SUBS.length; i++) {
        if (v.indexOf(SUBS[i][0]) >= 0) v = v.split(SUBS[i][0]).join(SUBS[i][1]);
      }
      var exacto = EXACTOS[v.trim()];
      if (exacto !== undefined) v = v.replace(v.trim(), exacto);
      if (v !== orig) n.nodeValue = v;
    }
  }

  function arrancar() {
    reemplazarEn(document.body);
    // El runtime renderiza async (React desde CDN): repasar lo que aparezca después.
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var añadidos = muts[i].addedNodes;
        for (var j = 0; j < añadidos.length; j++) reemplazarEn(añadidos[j]);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) arrancar();
  else document.addEventListener('DOMContentLoaded', arrancar);
})();
