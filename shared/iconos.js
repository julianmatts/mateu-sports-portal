/* ============================================================
   iconos.js — Íconos SVG para reemplazar emojis (solo si hace falta)
   ------------------------------------------------------------
   Windows 7 (y navegadores viejos) no traen fuente de emoji a
   color: dibujan 📈 🎯 🧑‍💼 … como recuadros □ (tofu). Este script
   reemplaza cada emoji del DOM por un SVG inline equivalente, así
   los íconos se ven bien igual en cualquier navegador/SO.

   IMPORTANTE — desde 30/07/2026 es adaptativo: primero DETECTA si el
   equipo puede dibujar emojis a color (canvas: dibuja un 🟢 y mira si
   salió verde). Si puede (Windows moderno, Chrome/Firefox al día), NO
   reemplaza nada y se ven los emojis nativos a color (más lindos). Si
   NO puede (Windows 7 sin fuente de emoji), recién ahí hace el reemplazo
   a SVG. Cada equipo ve lo mejor que soporta, sin configurar nada.

   Override manual para probar (o forzar): agregar ?iconos=emoji o
   ?iconos=svg a la URL, o setear localStorage 'ms_iconos_modo' en
   'emoji' | 'svg' | 'auto' (default 'auto' = detección).

   Self-contained, sin CDN, sin dependencias. Se incluye en cada
   página del portal con una sola línea:
       <script src="../shared/iconos.js" defer></script>
   (en el index.html raíz la ruta es "shared/iconos.js").

   Cómo funciona: recorre los nodos de texto, cambia los emojis por
   su <svg>, y un MutationObserver hace lo mismo con lo que aparece
   después por JS (tiles del Portal, bandeja, listas, etc.).

   Cómo agregar/editar un ícono: sumar una entrada al mapa ICONS con
   el emoji como clave y el interior del SVG (viewBox 0 0 24 24) como
   valor. Usar `S` (trazo currentColor) o `F` (relleno currentColor)
   para que herede el color del contexto; poner un color fijo (#hex)
   solo cuando el color es semántico (rojo/verde/etc.).
   ============================================================ */
(function () {
  'use strict';
  if (window.__msIconos) return;        // no correr dos veces
  window.__msIconos = true;

  // ---- ¿este equipo dibuja emojis a color? ----
  // Dibuja un 😀 en un canvas y revisa los píxeles: si aparece un canal de
  // color bien distinto de los otros (el 😀 es amarillo) => hay fuente de
  // emoji a color (Windows moderno, Chrome/Firefox al día) y NO tocamos nada.
  // Si sale gris/negro (tofu □) o no se dibuja => Windows 7 sin emoji =>
  // reemplazamos por SVG. Ante cualquier duda/error => reemplazamos (la
  // opción segura para navegadores viejos).
  //
  // ⚠️ El emoji de prueba tiene que ser VIEJO (Unicode 6.1, 2012): un emoji
  // nuevo como 🟢 (Unicode 12, 2019) sale como □ en Windows 10 con fuente de
  // emoji anterior a 2019 aunque el resto sí se dibuje a color, y la prueba
  // daría un falso negativo (caería a SVG de más). 😀 está en toda fuente de
  // emoji a color desde el día uno.
  function soportaEmojiColor() {
    try {
      var size = 24;
      var canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      var ctx = canvas.getContext && canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return false;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.font = Math.round(size * 0.85) + 'px sans-serif';
      ctx.fillStyle = '#000';               // si NO hay emoji, el tofu sale negro
      ctx.fillText('😀', size / 2, size / 2);  // 😀 (Unicode 6.1, universal)
      var d = ctx.getImageData(0, 0, size, size).data;
      for (var i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 24) continue;        // píxel transparente, lo ignoramos
        var r = d[i], g = d[i + 1], b = d[i + 2];
        // ¿algún canal se separa claramente de los otros? => color, no gris
        if (Math.max(r, g, b) - Math.min(r, g, b) > 28) return true;
      }
      return false;
    } catch (e) { return false; }
  }

  // Modo: 'auto' (detección), 'emoji' (forzar nativo) o 'svg' (forzar SVG).
  var modo = 'auto';
  try {
    var q = (location.search.match(/[?&]iconos=(emoji|svg|auto)/) || [])[1];
    modo = q || localStorage.getItem('ms_iconos_modo') || 'auto';
  } catch (e) {}

  var usarSVG = modo === 'svg' ? true
              : modo === 'emoji' ? false
              : !soportaEmojiColor();

  // Si el equipo ya muestra emojis lindos, no reemplazamos: dejamos el
  // emoji nativo a color. Igual exponemos msIconos para no romper a quien
  // llame refresh().
  if (!usarSVG) {
    window.msIconos = { refresh: function () {}, icons: {}, modo: modo, activo: false };
    return;
  }

  // Atajos de estilo para no repetir en cada path.
  var S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var F = 'fill="currentColor"';

  // emoji  ->  interior del SVG (viewBox 0 0 24 24)
  var ICONS = {
    // — flechas y símbolos —
    '→': '<path ' + S + ' d="M4 12h14M12 6l6 6-6 6"/>',
    '←': '<path ' + S + ' d="M20 12H6M12 6l-6 6 6 6"/>',
    '↑': '<path ' + S + ' d="M12 19V7M7 12l5-5 5 5"/>',
    '↓': '<path ' + S + ' d="M12 5v12M7 12l5 5 5-5"/>',
    '⬆': '<path ' + S + ' d="M12 20V6M6 12l6-6 6 6"/>',
    '⬇': '<path ' + S + ' d="M12 4v14M6 12l6 6 6-6"/>',
    '⇩': '<path ' + S + ' d="M12 3v10M8 10l4 4 4-4M5 19h14"/>',
    '⇅': '<path ' + S + ' d="M8 4v16M5 7l3-3 3 3M16 20V4M13 17l3 3 3-3"/>',
    '⇆': '<path ' + S + ' d="M4 9h16M17 6l3 3-3 3M20 15H4M7 12l-3 3 3 3"/>',
    '⇒': '<path ' + S + ' d="M4 12h12M12 7l5 5-5 5"/>',
    '⇪': '<path ' + S + ' d="M12 4l6 6h-3v5H9v-5H6zM8 18h8"/>',
    '↻': '<path ' + S + ' d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4"/>',
    '↺': '<path ' + S + ' d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"/>',
    '🔄': '<path ' + S + ' d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2M20 4v4h-4M4 20v-4h4"/>',
    '↩': '<path ' + S + ' d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-1"/>',
    '↳': '<path ' + S + ' d="M6 5v6a2 2 0 0 0 2 2h10M15 10l4 3-4 3"/>',
    '➕': '<path ' + S + ' d="M12 5v14M5 12h14"/>',
    '✔': '<path ' + S + ' d="M5 13l4 4L19 7"/>',
    '⚡': '<path ' + S + ' d="M13 3L5 13h5l-1 8 8-11h-5z"/>',

    // — círculos de estado (color semántico) —
    '🔴': '<circle cx="12" cy="12" r="7" fill="#e5484d"/>',
    '🟢': '<circle cx="12" cy="12" r="7" fill="#30a46c"/>',
    '🟡': '<circle cx="12" cy="12" r="7" fill="#f5c518"/>',
    '🟠': '<circle cx="12" cy="12" r="7" fill="#f76b15"/>',
    '⚪': '<circle cx="12" cy="12" r="7" fill="#f2f2f4" stroke="#b8bcc4" stroke-width="1.5"/>',
    '✅': '<circle cx="12" cy="12" r="9" fill="#30a46c"/><path fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M8 12.5l2.5 2.5L16 9"/>',
    '⚠': '<path ' + S + ' d="M12 4l9 16H3z"/><path ' + S + ' d="M12 10v4"/><circle cx="12" cy="17.3" r="0.7" ' + F + '/>',
    '🚦': '<rect x="8" y="3" width="8" height="18" rx="4" ' + S + '/><circle cx="12" cy="8" r="1.6" fill="#e5484d"/><circle cx="12" cy="12" r="1.6" fill="#f5c518"/><circle cx="12" cy="16" r="1.6" fill="#30a46c"/>',
    '🚩': '<path ' + S + ' d="M6 3v18M6 4h11l-2 3 2 3H6z"/>',

    // — documentos / oficina —
    '📄': '<path ' + S + ' d="M6 3h8l4 4v14H6z"/><path ' + S + ' d="M14 3v4h4M9 12h6M9 16h6"/>',
    '📎': '<path ' + S + ' d="M20.5 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l9-9a3.3 3.3 0 0 1 4.7 4.7l-9 9a1.7 1.7 0 0 1-2.4-2.4l8.1-8.1"/>',
    '📝': '<path ' + S + ' d="M5 4h9l5 5v11H5z"/><path ' + S + ' d="M14 4v5h5M8 13h6M8 16h4"/>',
    '📋': '<rect x="5" y="4" width="14" height="17" rx="2" ' + S + '/><rect x="9" y="2.5" width="6" height="3.5" rx="1" ' + S + '/><path ' + S + ' d="M8 11h8M8 15h8"/>',
    '🧾': '<path ' + S + ' d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path ' + S + ' d="M9 8h6M9 12h6"/>',
    '📊': '<rect x="4" y="11" width="3.5" height="9" ' + F + '/><rect x="10" y="6" width="3.5" height="14" ' + F + '/><rect x="16" y="9" width="3.5" height="11" ' + F + '/>',
    '📈': '<path ' + S + ' d="M4 5v14h16"/><path ' + S + ' d="M7 15l3-4 3 2 5-6M15 7h3v3"/>',
    '📏': '<path ' + S + ' d="M3 8l5-5 13 13-5 5z"/><path ' + S + ' d="M8 8l1.5 1.5M11 5l2 2M14 8l1.5 1.5"/>',
    '📁': '<path ' + S + ' d="M3 6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    '📂': '<path ' + S + ' d="M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v2H3z"/><path ' + S + ' d="M3 11h18l-2 8H5z"/>',
    '🗂': '<path ' + S + ' d="M3 7h6l2 2h10v10H3z"/><path ' + S + ' d="M3 7V5h5v2"/>',
    '📥': '<path ' + S + ' d="M4 13v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5h-5a3 3 0 0 1-6 0z"/><path ' + S + ' d="M12 3v8m-3-3l3 3 3-3"/>',
    '📤': '<path ' + S + ' d="M4 13v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5h-5a3 3 0 0 1-6 0z"/><path ' + S + ' d="M12 11V3m-3 3l3-3 3 3"/>',
    '📌': '<path ' + S + ' d="M9 3h6l-1 6 3 3H7l3-3z"/><path ' + S + ' d="M12 12v7"/>',
    '💾': '<path ' + S + ' d="M5 4h11l3 3v13H5z"/><path ' + S + ' d="M8 4v5h7V4"/><rect x="8" y="13" width="8" height="6" ' + S + '/>',
    '🖨': '<path ' + S + ' d="M7 8V4h10v4"/><rect x="4" y="8" width="16" height="8" rx="1.5" ' + S + '/><rect x="7" y="14" width="10" height="6" ' + S + '/><circle cx="17" cy="11" r="0.7" ' + F + '/>',
    '🖥': '<rect x="3" y="4" width="18" height="12" rx="1.5" ' + S + '/><path ' + S + ' d="M9 20h6M12 16v4"/>',
    '✏': '<path ' + S + ' d="M4 20l1-4L16 5l3 3L8 19z"/><path ' + S + ' d="M14 7l3 3"/>',
    '🎞': '<rect x="3" y="5" width="18" height="14" rx="2" ' + S + '/><path ' + S + ' d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    '🔗': '<path ' + S + ' d="M10 14a4 4 0 0 1 0-5.6l3-3a4 4 0 0 1 5.6 5.6l-1.5 1.5"/><path ' + S + ' d="M14 10a4 4 0 0 1 0 5.6l-3 3a4 4 0 0 1-5.6-5.6l1.5-1.5"/>',
    '🔍': '<circle cx="11" cy="11" r="6" ' + S + '/><path ' + S + ' d="M20 20l-4.5-4.5"/>',
    '🔎': '<circle cx="11" cy="11" r="6" ' + S + '/><path ' + S + ' d="M20 20l-4.5-4.5"/>',
    '🔧': '<path ' + S + ' d="M15 4a5 5 0 0 0-5 6l-6 6 3 3 6-6a5 5 0 0 0 6-5l-3 3-3-1-1-3z"/>',
    '⚙': '<circle cx="12" cy="12" r="3.2" ' + S + '/><path ' + S + ' d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    '🗑': '<path ' + S + ' d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path ' + S + ' d="M10 11v6M14 11v6"/>',
    'ℹ': '<circle cx="12" cy="12" r="9" ' + S + '/><path ' + S + ' d="M12 11v5"/><circle cx="12" cy="8" r="0.8" ' + F + '/>',
    '⏳': '<path ' + S + ' d="M7 4h10M7 20h10M8 4c0 4 8 6 8 8s-8 4-8 8M16 4c0 4-8 6-8 8s8 4 8 8"/>',
    '⏸': '<rect x="7" y="5" width="3.5" height="14" rx="1" ' + F + '/><rect x="13.5" y="5" width="3.5" height="14" rx="1" ' + F + '/>',
    '🕘': '<circle cx="12" cy="12" r="8" ' + S + '/><path ' + S + ' d="M12 7v5l3 2"/>',
    '🔒': '<rect x="5" y="10" width="14" height="10" rx="2" ' + S + '/><path ' + S + ' d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    '🔔': '<path ' + S + ' d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path ' + S + ' d="M10 20a2 2 0 0 0 4 0"/>',

    // — comunicación —
    '✉': '<rect x="3" y="6" width="18" height="12" rx="1.5" ' + S + '/><path ' + S + ' d="M3.5 7l8.5 6 8.5-6"/>',
    '📭': '<path ' + S + ' d="M4 10a4 4 0 0 1 8 0v8H4z"/><path ' + S + ' d="M12 18h7a1 1 0 0 0 1-1v-7a4 4 0 0 0-8 0"/><path ' + S + ' d="M8 10v4"/>',
    '📢': '<path ' + S + ' d="M4 10v4h3l7 4V6l-7 4H4z"/><path ' + S + ' d="M17 9a4 4 0 0 1 0 6"/>',
    '📣': '<path ' + S + ' d="M3 11v2l12 6V5L3 11z"/><path ' + S + ' d="M15 8a4 4 0 0 1 0 8M6 13v4a2 2 0 0 0 2 2"/>',
    '💬': '<rect x="3.5" y="4.5" width="17" height="12" rx="2.5" ' + S + '/><path ' + S + ' d="M8 16.5V21l4.5-4.5"/>',
    '💡': '<path ' + S + ' d="M9 18h6M10 21h4"/><path ' + S + ' d="M12 3a6 6 0 0 1 4 10.5c-.7.6-1 1.2-1 2H9c0-.8-.3-1.4-1-2A6 6 0 0 1 12 3z"/>',
    '👋': '<path ' + S + ' d="M8 11V6a1.5 1.5 0 0 1 3 0v4M11 10V5a1.5 1.5 0 0 1 3 0v5M14 10V6.5a1.5 1.5 0 0 1 3 0V13a6 6 0 0 1-6 6c-2 0-3-1-4-2l-3-4a1.6 1.6 0 0 1 2.4-2L8 11"/>',

    // — comercio / dinero —
    '💰': '<path ' + S + ' d="M9 5h6l-1.5 3H10.5z"/><path ' + S + ' d="M8.5 8C6 10 5 13 5 15a7 7 0 0 0 14 0c0-2-1-5-3.5-7z"/><path ' + S + ' d="M12 11v6M10.5 12.5h3M10.5 15h3"/>',
    '💲': '<path ' + S + ' d="M12 4v16M15 8a3 3 0 0 0-3-2.5c-2 0-3.5 1-3.5 2.8 0 3.7 7 2 7 5.7 0 1.8-1.5 3-4 3a3.5 3.5 0 0 1-3.3-2"/>',
    '🛒': '<circle cx="9" cy="20" r="1.5" ' + F + '/><circle cx="17" cy="20" r="1.5" ' + F + '/><path ' + S + ' d="M3 4h2l2.5 12h11l2-8H6"/>',
    '🛍': '<path ' + S + ' d="M6 8h12l-1 12H7z"/><path ' + S + ' d="M9 8a3 3 0 0 1 6 0"/>',
    '🏷': '<path ' + S + ' d="M4 12V5a1 1 0 0 1 1-1h7l8 8-8 8z"/><circle cx="8" cy="8" r="1.3" ' + F + '/>',
    '📦': '<path ' + S + ' d="M3 8l9-4 9 4-9 4z"/><path ' + S + ' d="M3 8v8l9 4 9-4V8M12 12v8"/>',
    '📷': '<rect x="3" y="7" width="18" height="13" rx="2" ' + S + '/><path ' + S + ' d="M8 7l2-3h4l2 3"/><circle cx="12" cy="13" r="3.2" ' + S + '/>',
    '📅': '<rect x="4" y="5" width="16" height="16" rx="2" ' + S + '/><path ' + S + ' d="M4 9h16M8 3v4M16 3v4"/>',
    '📆': '<rect x="4" y="5" width="16" height="16" rx="2" ' + S + '/><path ' + S + ' d="M4 9h16M8 3v4M16 3v4"/>',
    '🎨': '<path ' + S + ' d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2 0-1.5 1-2 2-2h2a3 3 0 0 0 3-3 8 8 0 0 0-9-9z"/><circle cx="7.5" cy="12" r="1" ' + F + '/><circle cx="9.5" cy="8" r="1" ' + F + '/><circle cx="14" cy="7.5" r="1" ' + F + '/>',
    '🔥': '<path ' + S + ' d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C9 10 12 8 12 3z"/>',
    '🎯': '<circle cx="12" cy="12" r="8" ' + S + '/><circle cx="12" cy="12" r="4.5" ' + S + '/><circle cx="12" cy="12" r="1.3" ' + F + '/>',
    '🎉': '<path ' + S + ' d="M3 21l5-13 8 8z"/><path ' + S + ' d="M14 4l1 1M18 6l1-1M17 10h2M13 3v2"/>',
    '🏆': '<path ' + S + ' d="M7 4h10v4a5 5 0 0 1-10 0z"/><path ' + S + ' d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v4M9 20h6M10 20l.5-3h3l.5 3"/>',
    '🎓': '<path ' + S + ' d="M12 4L2 8.5 12 13l10-4.5z"/><path ' + S + ' d="M6.5 10.8V15c0 1.5 2.5 2.8 5.5 2.8s5.5-1.3 5.5-2.8v-4.2M20 9.5V14"/>',

    // — lugares / logística —
    '📍': '<path ' + S + ' d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5" ' + S + '/>',
    '🏠': '<path ' + S + ' d="M4 11l8-6 8 6M6 10v9h12v-9"/><path ' + S + ' d="M10 19v-5h4v5"/>',
    '🏢': '<rect x="5" y="3" width="14" height="18" ' + S + '/><path ' + S + ' d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
    '🏬': '<path ' + S + ' d="M4 9l1-4h14l1 4M5 9h14v11H5z"/><path ' + S + ' d="M4 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/><rect x="10" y="14" width="4" height="6" ' + S + '/>',
    '🏪': '<path ' + S + ' d="M4 9l1.5-4h13L20 9M5 11v9h14v-9"/><path ' + S + ' d="M4 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/><rect x="9" y="14" width="6" height="6" ' + S + '/>',
    '🏦': '<path ' + S + ' d="M3 9l9-5 9 5H3z"/><path ' + S + ' d="M5 9v9M9 9v9M15 9v9M19 9v9M3 20h18"/>',
    '🚚': '<path ' + S + ' d="M3 6h11v9H3z"/><path ' + S + ' d="M14 9h4l3 3v3h-7z"/><circle cx="7.5" cy="17" r="1.6" ' + S + '/><circle cx="17.5" cy="17" r="1.6" ' + S + '/>',
    '🧹': '<path ' + S + ' d="M16 3l5 5-6 5-4-4z"/><path ' + S + ' d="M11 9l-6 9 3 3 9-6"/>',
    '🧊': '<path ' + S + ' d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path ' + S + ' d="M4 8l8 4 8-4M12 12v8"/>',

    // — personas —
    '👤': '<circle cx="12" cy="8" r="3.5" ' + S + '/><path ' + S + ' d="M5 20a7 7 0 0 1 14 0"/>',
    '🧑‍💼': '<circle cx="12" cy="7.5" r="3.3" ' + S + '/><path ' + S + ' d="M5 20a7 7 0 0 1 14 0M12 14v4M10 16h4"/>',
    '🏃': '<circle cx="14" cy="5" r="2" ' + S + '/><path ' + S + ' d="M6 20l3-5 3 1 2-3M12 16l3 4M14 8l-4 3-3-1"/>',
    '🚴': '<circle cx="6" cy="17" r="3" ' + S + '/><circle cx="18" cy="17" r="3" ' + S + '/><circle cx="14" cy="5" r="1.8" ' + S + '/><path ' + S + ' d="M6 17l4-5h5l-3 5M10 12l3-4"/>',
    '🏋': '<path ' + S + ' d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>',

    // — deportes / indumentaria —
    '⚽': '<circle cx="12" cy="12" r="9" ' + S + '/><path ' + S + ' d="M12 7l3.2 2.3-1.2 3.7h-4l-1.2-3.7z"/><path ' + S + ' d="M12 7V4M15.2 9.3l2.8-1M13.8 13l1.8 2.5M10.2 13l-1.8 2.5M8.8 9.3l-2.8-1"/>',
    '🏀': '<circle cx="12" cy="12" r="9" ' + S + '/><path ' + S + ' d="M3 12h18M12 3v18M5.5 5.5c4 3 9 3 13 0M5.5 18.5c4-3 9-3 13 0"/>',
    '🎾': '<circle cx="12" cy="12" r="9" ' + S + '/><path ' + S + ' d="M5 5c4 3 4 11 0 14M19 5c-4 3-4 11 0 14"/>',
    '🏐': '<circle cx="12" cy="12" r="9" ' + S + '/><path ' + S + ' d="M12 3v9M12 12l8 4M12 12l-8 4M4 8c5 1 8 5 8 9M20 8c-5 1-8 5-8 9"/>',
    '🏉': '<ellipse cx="12" cy="12" rx="9" ry="6" ' + S + ' transform="rotate(-40 12 12)"/><path ' + S + ' d="M10 12h4M12 10v4"/>',
    '🥊': '<path ' + S + ' d="M8 6a4 4 0 0 1 8 0v4h2a2 2 0 0 1 0 4h-2v3H8v-3a5 5 0 0 1-2-4z"/>',
    '👟': '<path ' + S + ' d="M3 16v-4l5-2 3 3 8 1a2 2 0 0 1 2 2v2H3z"/><path ' + S + ' d="M8 11l1 2M11 12l1 2"/>',
    '🧢': '<path ' + S + ' d="M4 15a8 8 0 0 1 16 0z"/><path ' + S + ' d="M12 7a8 8 0 0 1 8 8h2"/>',
    '🎽': '<path ' + S + ' d="M8 4L4 7l2 3 2-1v9h8v-9l2 1 2-3-4-3-2 2h-4z"/>',
    '🦁': '<circle cx="12" cy="13" r="6" ' + S + '/><path ' + S + ' d="M6 7l2 2M18 7l-2 2M12 5v3"/><circle cx="10" cy="12" r="0.7" ' + F + '/><circle cx="14" cy="12" r="0.7" ' + F + '/><path ' + S + ' d="M10.5 15c.6.6 2.4.6 3 0"/>',
    '🦅': '<path ' + S + ' d="M4 8c3 0 5 2 8 2s5-2 8-2c-1 4-4 6-8 6s-7-2-8-6z"/><path ' + S + ' d="M12 14v4M11 20h2"/>',
    // — RRHH (tutorial): cara con termómetro (ausentismo) y buzón (Bandeja de mensajes) —
    '🤒': '<circle cx="12" cy="12" r="8" ' + S + '/><circle cx="9.5" cy="10.5" r="0.8" ' + F + '/><circle cx="14.5" cy="10.5" r="0.8" ' + F + '/><path ' + S + ' d="M9.5 15.5h5"/><path ' + S + ' d="M16 20l4-6"/>',
    '📬': '<path ' + S + ' d="M4 10a4 4 0 0 1 4-4h10v14H4z"/><path ' + S + ' d="M8 6a4 4 0 0 1 4 4v10"/><path ' + S + ' d="M14 6V3h4v3"/><path ' + S + ' d="M18 12h2v2h-2"/>'
  };

  // ---- construcción del regex y del <svg> ----
  var keys = Object.keys(ICONS).sort(function (a, b) { return b.length - a.length; }); // secuencias largas primero (p.ej. 🧑‍💼)
  var alt = keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|');
  var RE = new RegExp('(' + alt + ')\\uFE0F?', 'g');  // ️ = selector de variación (emoji), lo consumimos
  var HAS = new RegExp('(' + alt + ')', '');           // versión no-global para test()

  function svgFor(inner) {
    var span = document.createElement('span');
    // parsear el SVG en un contenedor HTML: los navegadores le dan el namespace SVG correcto
    span.innerHTML = '<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">' + inner + '</svg>';
    var svg = span.firstChild;
    var w = document.createElement('span');
    w.className = 'ms-ico';
    w.setAttribute('aria-hidden', 'true');
    w.appendChild(svg);
    return w;
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, SELECT: 1, OPTION: 1, NOSCRIPT: 1, CODE: 1, PRE: 1 };

  function skippable(node) {
    var p = node.parentNode;
    while (p && p.nodeType === 1) {
      var t = (p.tagName || '').toUpperCase();
      if (t === 'SVG' || SKIP[t] || p.isContentEditable || p.getAttribute('data-no-iconos') !== null) return true;
      p = p.parentNode;
    }
    return false;
  }

  function processText(node) {
    var t = node.nodeValue;
    if (!t || !HAS.test(t)) return;
    RE.lastIndex = 0;
    var frag = document.createDocumentFragment(), last = 0, m, hit = false;
    while ((m = RE.exec(t))) {
      hit = true;
      if (m.index > last) frag.appendChild(document.createTextNode(t.slice(last, m.index)));
      var inner = ICONS[m[1]];
      frag.appendChild(inner ? svgFor(inner) : document.createTextNode(m[0]));
      last = m.index + m[0].length;
    }
    if (!hit) return;
    if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
    if (node.parentNode) node.parentNode.replaceChild(frag, node);
  }

  function walk(root) {
    if (!root || (root.nodeType === 1 && (root.tagName || '').toUpperCase() === 'SVG')) return;
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !HAS.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        return skippable(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    var list = [], n;
    while ((n = tw.nextNode())) list.push(n);
    for (var i = 0; i < list.length; i++) processText(list[i]);
  }

  function start() {
    walk(document.body);
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var mu = muts[i];
        if (mu.type === 'characterData') {
          if (mu.target.nodeType === 3 && !skippable(mu.target)) processText(mu.target);
          continue;
        }
        for (var j = 0; j < mu.addedNodes.length; j++) {
          var node = mu.addedNodes[j];
          if (node.nodeType === 3) { if (!skippable(node)) processText(node); }
          else if (node.nodeType === 1) { walk(node); }
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  // estilo del wrapper (se ve como el texto que reemplaza)
  var st = document.createElement('style');
  st.textContent = '.ms-ico{display:inline-flex;align-items:center;justify-content:center;line-height:0;vertical-align:-0.14em}.ms-ico>svg{width:1em;height:1em;display:block}';
  (document.head || document.documentElement).appendChild(st);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // por si alguien necesita reprocesar a mano
  window.msIconos = { refresh: function (root) { walk(root || document.body); }, icons: ICONS, modo: modo, activo: true };
})();
