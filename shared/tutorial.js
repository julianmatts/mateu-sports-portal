/* ============================================================
   Tutorial de primer ingreso — Portal Mateu Sports.
   Vanilla JS, cero dependencias. Un solo archivo compartido:
   - Al entrar POR PRIMERA VEZ a un módulo, abre solo un recorrido
     paso a paso de cómo se usa (se recuerda por localStorage).
   - Botón flotante «?» (abajo a la derecha) para volver a verlo
     cuando se quiera.

   Uso (en el <head> de cada módulo, después de header.js):
     <script src="../shared/tutorial.js" defer></script>
   (en el Portal raíz la ruta es shared/tutorial.js)

   Config opcional (definir ANTES de cargar este script):
     window.MATEU_TUTORIAL = { herramienta:'gestion-stock' }
   Si falta, el módulo se deduce de la URL (carpeta); sin carpeta
   se asume el Portal raíz ('portal').

   El contenido de todos los tutoriales vive acá (mapa TUT), así
   se mantiene en un solo lugar. Pasos con `roles:[…]` solo se
   muestran a esos roles de la sesión. Los emojis los convierte
   shared/iconos.js a SVG, como en el resto del portal.
   Clases con prefijo mtu- para no chocar con el CSS del módulo.
   ============================================================ */
(function(){
  'use strict';

  var CFG = window.MATEU_TUTORIAL || {};
  var SESSION_KEY = 'mateu_portal_session';

  /* ============ CONTENIDO — un tutorial por herramienta ============ */
  var TUT = {

    portal: { icono:'🏠', nombre:'Portal Mateu Sports', pasos:[
      { ic:'👋', t:'Bienvenido al Portal', d:'Este es el punto de entrada único a las herramientas internas de Mateu Sports. Las tarjetas que ves dependen de tu usuario y tu rol: cada una abre una herramienta distinta.' },
      { ic:'🧭', t:'Moverse entre herramientas', d:'Tocá una tarjeta para entrar. Adentro de cada herramienta, el logo del header te trae de vuelta al Portal y el botón «Menú» abre el listado para saltar de una a otra sin volver.' },
      { ic:'📬', t:'Bandeja de mensajes', d:'El tablero de avisos internos y los mensajes directos entre usuarios. Los no leídos aparecen marcados al entrar al Portal.' },
      { ic:'📅', t:'Calendario retail', d:'Arriba a la derecha está siempre la semana retail vigente y las fechas clave del calendario comercial.' },
      { ic:'⚙️', t:'Gestión de usuarios', d:'Desde el engranaje se dan de alta usuarios, se asignan herramientas y se resetean PINs.', roles:['admin'] },
      { ic:'❓', t:'Este tutorial', d:'Cada herramienta tiene su propio recorrido: aparece la primera vez que entrás y queda siempre disponible en el botón «?» de abajo a la derecha.' }
    ]},

    indicadores: { icono:'🏪', nombre:'Panel General', pasos:[   // «Mi Sucursal» para sucursal/outlet (ver render)
      { ic:'📈', t:'Tus indicadores', d:'UPT, tickets por hora y ticket promedio de la sucursal, por período y por persona. Elegí el período con el selector de arriba.' },
      { ic:'🎯', t:'Objetivo de la semana y del mes', d:'Arriba de todo: la Meta de la semana con su Mínimo y su 120, la barra de avance contra la venta real y el objetivo del mes. Con el selector podés rever semanas anteriores.' },
      { ic:'👥', t:'Cómo viene el equipo', d:'Panel para el encargado: armá tu equipo, asigná las horas de venta por turno y día (el portal reparte la Meta entre las personas) y subí el Excel de venta por vendedor para ver el ranking del equipo.' },
      { ic:'📦', t:'Reposición disponible', d:'Cuando el depósito publica su análisis semanal, acá aparece lo que tu sucursal puede pedir, por artículo y talle.' },
      { ic:'🗓️', t:'Meses de stock y Plantilla', d:'Más abajo: la foto de stock, ventas y ratio por rubro, y la dotación de la sucursal por rol y régimen (full/part time).' },
      { ic:'🏢', t:'Vista cadena', d:'Con el selector de sucursal podés mirar cualquiera, y «Cadena (comparar todas)» pone a las sucursales una al lado de la otra.', roles:['admin','supervisor'] }
    ]},

    turnero: { icono:'📅', nombre:'Turnero Depósito', pasos:[
      { ic:'📅', t:'Qué es', d:'La agenda de turnos del Depósito: acá se coordinan los días y horarios en que los proveedores entregan mercadería.' },
      { ic:'🕒', t:'Pedir un turno', d:'Elegí un día y una franja horaria libre y completá los datos del proveedor y de la entrega.' },
      { ic:'✉️', t:'Confirmación', d:'Al reservar, sale el aviso por mail con el detalle del turno.' },
      { ic:'🔑', t:'Administrador', d:'Con acceso de administrador se ve la agenda completa y se pueden editar o liberar turnos.', roles:['admin'] }
    ]},

    marcas: { icono:'🏷️', nombre:'Asignación de Marcas', pasos:[
      { ic:'🏷️', t:'Qué es', d:'La asignación de marcas por rubro a cada sucursal: define qué marcas trabaja cada local.' },
      { ic:'🧩', t:'Asignar', d:'Elegí el rubro y marcá qué marcas corresponden a cada sucursal. Los cambios se guardan en vivo y los ven todos.' },
      { ic:'👀', t:'Consultar', d:'Cualquier usuario con la herramienta ve la foto actual de la asignación, siempre actualizada.' }
    ]},

    equipo: { icono:'📦', nombre:'Área de Producto', pasos:[
      { ic:'📦', t:'Qué es', d:'El tablero del Área de Producto para el seguimiento de transferencias y movimientos de mercadería.' },
      { ic:'📝', t:'Carga', d:'Registrá y seguí los movimientos desde el propio tablero.' },
      { ic:'⚠️', t:'Datos locales', d:'Lo cargado se guarda en este navegador (localStorage): no se comparte entre computadoras.' }
    ]},

    condiciones: { icono:'📄', nombre:'Condiciones Comerciales', pasos:[
      { ic:'📄', t:'Qué es', d:'El archivo de condiciones comerciales por proveedor, con su pestaña aparte para Mayoristas.' },
      { ic:'📝', t:'Cargar y consultar', d:'Agregá o editá las condiciones de cada proveedor y usá el buscador para encontrarlas rápido.' },
      { ic:'⚠️', t:'Datos locales', d:'Lo cargado se guarda en este navegador (localStorage): no se comparte entre computadoras.' }
    ]},

    'gestion-stock': { icono:'📊', nombre:'Gestión de Stock', pasos:[
      { ic:'📊', t:'Qué es', d:'Tres miradas sobre el stock: los discontinuos por sucursal, el Reporte Mensual y el dashboard de Meses de Stock.' },
      { ic:'🏬', t:'Discontinuos', d:'Cada sucursal marca sus artículos discontinuos y el Área de Producto los sigue desde acá.' },
      { ic:'🗓️', t:'Meses de Stock', d:'Stock, ventas y ratio (meses de stock) por sucursal, rubro, marca y segmento, mes a mes, con los comentarios de encargados y las respuestas de Producto.' },
      { ic:'⬆️', t:'Actualizar datos', d:'Subí el export mensual «RATIO <MES>.xls» tal cual sale del sistema: se fusiona con lo ya publicado, y con «Publicar al portal» queda en vivo para todos.', roles:['admin'] }
    ]},

    'pedidos-semanales': { icono:'📝', nombre:'Pedidos Semanales', pasos:[
      { ic:'📝', t:'Qué es', d:'La reposición semanal: cada sucursal arma su pedido y el Área de Producto lo revisa y aprueba.' },
      { ic:'🛒', t:'Pedidos', d:'Armá el pedido de la semana de tu sucursal, artículo por artículo.' },
      { ic:'📉', t:'Menos vendidos', d:'La lista de lo que menos rota, para decidir con datos qué pedir (y qué no).' },
      { ic:'✅', t:'Control', d:'El circuito de aprobaciones de Producto sobre lo pedido por cada sucursal.' }
    ]},

    managment: { icono:'🧾', nombre:'Managment', pasos:[
      { ic:'🧾', t:'Qué es', d:'El circuito de Producto con cada proveedor, en tres pasos: Desarrollo → Orden de compra → Ingresos.' },
      { ic:'🎨', t:'Paso 1 · Desarrollo', d:'Cargá los artículos en desarrollo con el proveedor: modelos, curvas y avíos.' },
      { ic:'📑', t:'Paso 2 · Orden de compra', d:'Generá la OC con su planilla de corte/curva y la gestión de avíos, lista para exportar.' },
      { ic:'🚚', t:'Paso 3 · Ingresos', d:'Seguí los ingresos de mercadería contra lo pedido a cada proveedor.' }
    ]},

    diagonal80: { icono:'🏬', nombre:'Apertura Diagonal 80', pasos:[
      { ic:'🏬', t:'Qué es', d:'El tablero de la apertura de Diagonal 80: la propuesta de surtido contra la capacidad real del local.' },
      { ic:'🧮', t:'Propuesta vs. capacidad', d:'Cargá y ajustá la propuesta por rubro y compará contra la capacidad de exhibición para ver dónde sobra o falta.' }
    ]},

    ubicaciones: { icono:'📍', nombre:'Buscador de Artículos', pasos:[
      { ic:'📍', t:'Qué es', d:'El mapa del depósito de tu sucursal: dónde está guardado cada artículo.' },
      { ic:'🔎', t:'Buscar', d:'Escaneá o tipeá el código del artículo y te dice la estantería y la ubicación exacta.' },
      { ic:'🗄️', t:'Estanterías', d:'El mapa de estanterías: desde ahí se cargan artículos a una ubicación o se corrigen las existentes.' },
      { ic:'👤', t:'Perfiles', d:'Cada movimiento queda firmado por la persona que lo hizo. El encargado administra los perfiles y puede importar la dotación desde Indicadores.' },
      { ic:'📋', t:'Resumen y Actividad', d:'El estado general del depósito y el historial de todos los movimientos.' }
    ]},

    regalias: { icono:'⚽', nombre:'Regalías RUGE / EDLP', pasos:[
      { ic:'⚽', t:'Qué es', d:'El liquidador de regalías RUGE / EDLP (Estudiantes): clasifica las ventas del mes y aplica las escalas del contrato.' },
      { ic:'⬆️', t:'Cargar el mes', d:'Subí el Excel de ventas del mes: el módulo clasifica los artículos y calcula la regalía que corresponde por escala.' },
      { ic:'📤', t:'Exportar', d:'Descargá el Excel de liquidación del mes y la presentación comercial lista para enviar al club.' },
      { ic:'🧮', t:'Acumuladores', d:'El acumulado por temporada (que mueve las escalas) se lleva solo; revisalo en la vista de acumuladores.' }
    ]},

    evaluaciones: { icono:'📋', nombre:'Evaluaciones de Supervisor', pasos:[
      { ic:'📋', t:'Qué es', d:'La evaluación semanal de cada sucursal: parte operativa y parte actitudinal (50 + 50 puntos, nota de A a D).' },
      { ic:'📝', t:'Cargar', d:'Elegí sucursal y semana y marcá cada ítem (Bien · Regular · Mal); el puntaje y la nota se calculan solos.', roles:['admin','supervisor'] },
      { ic:'🏆', t:'Ranking y gráficos', d:'La comparativa entre sucursales y la evolución de cada una en el tiempo.' },
      { ic:'🔧', t:'Puntos de mejora', d:'Dejá registrado qué tiene que corregir cada sucursal y hacé el seguimiento hasta resolverlo.' },
      { ic:'👀', t:'Vista de encargado', d:'Cada sucursal entra con su cuenta y ve sus propias evaluaciones y pendientes.', roles:['sucursal','outlet'] }
    ]},

    barrida: { icono:'🧹', nombre:'Análisis de Reserva Depósito Central', pasos:[
      { ic:'🧹', t:'Qué es', d:'El cruce semanal (típico: los lunes) de la reserva del Depósito Central contra las ventas por sucursal, para decidir la reposición.' },
      { ic:'⬆️', t:'Cargar', d:'Subí el Excel con las dos hojas — ventas por sucursal y reserva del depósito — y se cruzan solas por ID ITEM y talle.' },
      { ic:'📦', t:'Reposición', d:'Por sucursal: qué puede pedir del depósito, talle por talle. Los talles donde lo vendido supera la reserva van en rojo (señal de recompra a la marca). Todo exportable a Excel.' },
      { ic:'🛍️', t:'Compras', d:'La mirada por artículo global: mejores vendidos SIN reserva (recomprar), CON reserva (solo seguimiento) y artículos frenados.' },
      { ic:'💾', t:'Guardar la semana', d:'Al guardar, cada sucursal ve su «Reposición disponible» en Indicadores y se acumula el histórico (la reserva crónica de 3+ semanas sale de ahí).' }
    ]},

    objetivos: { icono:'🎯', nombre:'Objetivos de Venta', pasos:[
      { ic:'🎯', t:'Qué es', d:'Acá gerencia carga los objetivos de venta por sucursal, semanales y mensuales. Cada sucursal ve el suyo en Indicadores.' },
      { ic:'📅', t:'Semanal', d:'Subí el Excel «PMS Objetivos» de la semana o cargá los montos a mano. El Mínimo (÷1,2) y el 120 (×1,2) se calculan solos; revisá y publicá.' },
      { ic:'📆', t:'Mensual', d:'Subí el Excel mensual acumulativo: publica la meta del mes y habilita la comparación contra el mismo mes del año anterior.' },
      { ic:'📊', t:'Dashboard e histórico', d:'Cumplimiento por sucursal con semáforo (verde ≥ meta, ámbar ≥ mínimo, rojo por debajo), total cadena y ranking.' },
      { ic:'⏱️', t:'Pesos por turno', d:'La matriz de venta por hora y día que usa el reparto de la Meta entre las personas del equipo de cada sucursal.' }
    ]},

    capacitaciones: { icono:'🎓', nombre:'Academia de Ventas', pasos:[
      { ic:'🎓', t:'Bienvenido a la Academia', d:'Cursos y programas de capacitación por puesto, con quiz, certificados, ranking y novedades.' },
      { ic:'👤', t:'Quién sos', d:'La cuenta de la sucursal primero elige la persona (queda recordada; «Cambiar persona» está en el header). Tu avance es individual.', roles:['sucursal','outlet'] },
      { ic:'📚', t:'Catálogo y cursos', d:'Entrá a un curso desde el catálogo: lecciones de texto, video o PDF y el quiz final. Al aprobar ganás el badge y el certificado imprimible.' },
      { ic:'🏅', t:'Historial y Ranking', d:'Tus certificados por programa completado y el podio por persona y por sucursal.' },
      { ic:'🛠️', t:'Gestión y Mi equipo', d:'El staff crea cursos, programas y encuestas, publica novedades y sigue el avance de toda la cadena en «Mi equipo».', roles:['admin','supervisor','capacitador'] }
    ]},

    recepciones: { icono:'📥', nombre:'Control de Recepciones', pasos:[
      { ic:'📥', t:'Qué es', d:'El circuito de compras y depósito en un solo lugar: remitos, pedidos de compra, ingresos contra pedido, repartos e ingreso físico de mercadería.' },
      { ic:'📑', t:'Pedidos de compra', d:'Cargá las OC por marca. Con «⇆ Convertir OC de marca» subís la planilla de cualquier marca y sale la OC unificada Mateu Sports.' },
      { ic:'📊', t:'Ingresos vs pedido', d:'Cuánto ingresó de cada pedido, en unidades y en pesos, marca por marca.' },
      { ic:'📦', t:'Ingreso de Mercadería', d:'El circuito físico del depósito: pre-ingreso del remito → control ciego escaneando el EAN de cada unidad → conciliación de faltantes y sobrantes.' },
      { ic:'🚚', t:'Repartos', d:'El reparto de lo ingresado hacia las sucursales.' }
    ]},

    presupuesto: { icono:'💰', nombre:'Presupuesto de Compras', pasos:[
      { ic:'💰', t:'Qué es', d:'El presupuesto de compras: cuánto comprar y cómo viene lo ejecutado contra lo planificado.' },
      { ic:'📊', t:'Panel', d:'La vista de análisis con los indicadores del presupuesto.' },
      { ic:'📝', t:'Datos', d:'La carga y edición de los datos que alimentan el panel.' }
    ]},

    rrhh: { icono:'🧑‍💼', nombre:'Recursos Humanos', pasos:[
      { ic:'🧑‍💼', t:'Qué es', d:'El módulo de Recursos Humanos: legajos, ausentismo y licencias, novedades de nómina y rotación.' },
      { ic:'📁', t:'Legajos', d:'La ficha de cada persona. La dotación se puede importar directo desde Indicadores.' },
      { ic:'🤒', t:'Ausentismo y licencias', d:'Registrá ausencias y licencias y mirá el índice por sucursal.' },
      { ic:'🧾', t:'Novedades de nómina', d:'Lo que hay que informar para la liquidación de cada mes.' },
      { ic:'🔄', t:'Rotación', d:'Altas, bajas y rotación por sucursal a lo largo del tiempo.' }
    ]},

    picking: { icono:'📋', nombre:'Picking', pasos:[
      { ic:'📋', t:'Qué es', d:'La preparación de los pedidos del Depósito Central: acá el encargado crea los pickings, sigue cómo avanzan y los controla. El operario los prepara físicamente desde la tablet (el kiosco), no desde acá.' },
      { ic:'📊', t:'Panel', d:'La pantalla que abre primero: el estado de todos los pickings (pendientes, en preparación, para control, finalizados y con diferencias), las unidades pendientes y pickeadas, la productividad por operario y los faltantes. Es tu tablero para ver dónde está trabada la operación.' },
      { ic:'🗺️', t:'1º — Zonas', d:'Antes de crear pickings, definí las zonas del depósito (nombre y orden del recorrido) y asigná cada marca/rubro a su zona. Con eso, cada pedido se ordena solo por el recorrido físico (Zona A → B → C…). Sin zonas, los artículos salen “sin zona” al final.' },
      { ic:'👷', t:'2º — Operarios', d:'Cargá los nombres del equipo del depósito. El kiosco los muestra en una lista para que el operario elija quién arma o controla cada pedido (así queda el registro de quién hizo qué).' },
      { ic:'➕', t:'3º — Crear un picking', d:'En la pestaña Pickings, «+ Crear picking»: elegís la sucursal destino y, si querés, filtrás por marca y/o rubro. El detalle sale de la última barrida, ya ordenado por zona, y le podés poner prioridad (normal, alta o urgente).' },
      { ic:'🔀', t:'Estados y prioridad', d:'Cada pick recorre: Pendiente → En preparación → Listo para control → Finalizado (o Con diferencias si faltó algo). Los urgentes aparecen arriba y destacados.' },
      { ic:'📱', t:'La tablet (kiosco)', d:'El operario entra a «…/recepciones/control/» (sin usuario, en la tablet del depósito), elige la tarea Picking, y el sistema lo va guiando zona → producto → cantidad, validando con el escáner. Después otra persona hace el Control final. Vos seguís todo desde el Panel.' }
    ]}
  };

  /* ============ infraestructura ============ */

  function leerSesion(){
    try{ return JSON.parse(localStorage.getItem(SESSION_KEY)||'null'); }catch(e){ return null; }
  }
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  function esc(s){ return (s==null?'':String(s)).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  // herramienta actual: config o carpeta de la URL; sin carpeta = Portal raíz
  function toolActual(){
    if(CFG.herramienta) return CFG.herramienta;
    var m = location.pathname.match(/\/([^\/]+)\/(?:index\.html)?$/);
    return (m && TUT[m[1]]) ? m[1] : 'portal';
  }

  var CSS = ''
  +'.mtu-fab{position:fixed;right:18px;bottom:18px;z-index:1280;width:46px;height:46px;border-radius:50%;'
  +'background:#0B1527;color:#fff;border:2px solid #CC0000;cursor:pointer;display:flex;align-items:center;justify-content:center;'
  +'font-family:\'Bebas Neue\',sans-serif;font-size:22px;line-height:1;box-shadow:0 4px 16px rgba(11,21,39,.35);'
  +'transition:transform .14s,background .14s}'
  +'.mtu-fab:hover{background:#CC0000;transform:translateY(-2px)}'
  +'.mtu-scrim{position:fixed;inset:0;background:rgba(11,21,39,.62);z-index:1300;display:flex;align-items:center;justify-content:center;'
  +'padding:16px;opacity:0;visibility:hidden;transition:opacity .22s}'
  +'.mtu-scrim.open{opacity:1;visibility:visible}'
  +'.mtu-card{background:#fff;border-radius:16px;width:min(540px,94vw);max-height:88vh;display:flex;flex-direction:column;'
  +'overflow:hidden;box-shadow:0 24px 70px rgba(11,21,39,.45);font-family:\'Barlow\',sans-serif;'
  +'transform:translateY(10px);transition:transform .22s}'
  +'.mtu-scrim.open .mtu-card{transform:translateY(0)}'
  +'.mtu-head{background:#0B1527;border-bottom:3px solid #CC0000;color:#fff;padding:14px 18px;display:flex;align-items:center;gap:12px}'
  +'.mtu-hic{width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-size:20px;flex:0 0 auto}'
  +'.mtu-ht{min-width:0}'
  +'.mtu-ht .mtu-k{font-family:\'Barlow Condensed\',sans-serif;font-size:10.5px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#ff3b3b}'
  +'.mtu-ht .mtu-n{font-family:\'Bebas Neue\',sans-serif;font-size:21px;letter-spacing:1px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  +'.mtu-x{margin-left:auto;background:transparent;border:none;color:rgba(255,255,255,.7);font-size:26px;line-height:1;cursor:pointer;padding:0 2px;flex:0 0 auto}'
  +'.mtu-x:hover{color:#fff}'
  +'.mtu-body{padding:26px 26px 18px;text-align:center;overflow-y:auto;flex:1 1 auto}'
  +'.mtu-bic{width:66px;height:66px;border-radius:18px;background:#f0f3fa;display:flex;align-items:center;justify-content:center;'
  +'font-size:32px;margin:0 auto 14px}'
  +'.mtu-bt{font-family:\'Bebas Neue\',sans-serif;font-size:26px;letter-spacing:.8px;color:#0B1527;margin-bottom:8px}'
  +'.mtu-bd{font-size:15px;line-height:1.55;color:#3d4a63;max-width:44ch;margin:0 auto}'
  +'.mtu-foot{padding:14px 18px 18px;display:flex;align-items:center;gap:12px;border-top:1px solid #eef1f8}'
  +'.mtu-dots{display:flex;gap:6px;margin:0 auto}'
  +'.mtu-dot{width:8px;height:8px;border-radius:50%;background:#d7deec;border:none;padding:0;cursor:pointer;transition:background .14s,transform .14s}'
  +'.mtu-dot.on{background:#CC0000;transform:scale(1.25)}'
  +'.mtu-btn{font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:13.5px;letter-spacing:1.5px;text-transform:uppercase;'
  +'border-radius:10px;padding:10px 16px;cursor:pointer;transition:all .14s;border:1px solid #d7deec;background:#fff;color:#0B1527}'
  +'.mtu-btn:hover{background:#f0f3fa}'
  +'.mtu-btn[disabled]{opacity:.35;cursor:default}'
  +'.mtu-btn[disabled]:hover{background:#fff}'
  +'.mtu-btn.pri{background:#CC0000;border-color:#CC0000;color:#fff;box-shadow:0 3px 12px rgba(204,0,0,.3)}'
  +'.mtu-btn.pri:hover{background:#a00000;border-color:#a00000}'
  +'@media(max-width:560px){.mtu-body{padding:20px 16px 12px}.mtu-bd{font-size:14px}.mtu-foot{padding:12px 12px 14px;gap:8px}}';

  function montar(){
    var slug = toolActual();
    var tut = TUT[slug];
    if(!tut) return;

    var S = leerSesion();
    if(!S || !S.rol) return;   // sin sesión (p.ej. pantalla de login del Portal) no hay tutorial

    var pasos = tut.pasos.filter(function(p){ return !p.roles || p.roles.indexOf(S.rol)>=0; });
    if(!pasos.length) return;
    // el módulo de indicadores se llama distinto según el rol
    var nombreTut = (slug==='indicadores' && (S.rol==='sucursal'||S.rol==='outlet')) ? 'Mi Sucursal' : TUT[slug].nombre;

    var VISTO_KEY = 'mtu_visto_'+slug;

    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    // ---- botón flotante «?» ----
    var fab = document.createElement('button');
    fab.className = 'mtu-fab';
    // si la pantalla tiene la campana de notificaciones (Portal, Indicadores) abajo a la
    // derecha, el «?» va arriba de ella para no taparla
    if(document.getElementById('notifWidget')) fab.style.bottom = '92px';
    fab.type = 'button';
    fab.title = 'Cómo usar esta herramienta';
    fab.setAttribute('aria-label','Ver el tutorial de esta herramienta');
    fab.textContent = '?';
    document.body.appendChild(fab);

    // ---- modal ----
    var scrim = document.createElement('div');
    scrim.className = 'mtu-scrim';
    scrim.setAttribute('role','dialog');
    scrim.setAttribute('aria-modal','true');
    scrim.setAttribute('aria-label','Tutorial: '+nombreTut);
    scrim.innerHTML = '<div class="mtu-card">'
      +'<div class="mtu-head"><span class="mtu-hic">'+tut.icono+'</span>'
      +'<div class="mtu-ht"><div class="mtu-k">Cómo se usa</div><div class="mtu-n">'+esc(nombreTut)+'</div></div>'
      +'<button class="mtu-x" title="Cerrar" aria-label="Cerrar tutorial">×</button></div>'
      +'<div class="mtu-body"><div class="mtu-bic"></div><div class="mtu-bt"></div><p class="mtu-bd"></p></div>'
      +'<div class="mtu-foot"><button class="mtu-btn" data-mtu="prev">‹ Anterior</button>'
      +'<div class="mtu-dots"></div>'
      +'<button class="mtu-btn pri" data-mtu="next">Siguiente ›</button></div>'
      +'</div>';
    document.body.appendChild(scrim);

    var elIc   = scrim.querySelector('.mtu-bic');
    var elT    = scrim.querySelector('.mtu-bt');
    var elD    = scrim.querySelector('.mtu-bd');
    var elDots = scrim.querySelector('.mtu-dots');
    var bPrev  = scrim.querySelector('[data-mtu="prev"]');
    var bNext  = scrim.querySelector('[data-mtu="next"]');
    var body   = scrim.querySelector('.mtu-body');

    var i = 0, abierto = false;

    elDots.innerHTML = pasos.map(function(_,k){
      return '<button class="mtu-dot" type="button" data-k="'+k+'" aria-label="Paso '+(k+1)+'"></button>';
    }).join('');

    function pintar(){
      var p = pasos[i];
      elIc.textContent = p.ic;
      elT.textContent  = p.t;
      elD.textContent  = p.d;
      var dots = elDots.children;
      for(var k=0;k<dots.length;k++) dots[k].classList.toggle('on', k===i);
      bPrev.disabled = (i===0);
      bNext.textContent = (i===pasos.length-1) ? '¡Listo!' : 'Siguiente ›';
      body.scrollTop = 0;
    }
    function abrir(){
      i = 0; pintar();
      scrim.classList.add('open');
      abierto = true;
      lsSet(VISTO_KEY,'1');   // visto: no se vuelve a abrir solo
      bNext.focus();
    }
    function cerrar(){
      scrim.classList.remove('open');
      abierto = false;
    }

    fab.onclick = abrir;
    scrim.querySelector('.mtu-x').onclick = cerrar;
    scrim.addEventListener('click', function(e){ if(e.target===scrim) cerrar(); });
    bPrev.onclick = function(){ if(i>0){ i--; pintar(); } };
    bNext.onclick = function(){ if(i<pasos.length-1){ i++; pintar(); } else cerrar(); };
    elDots.addEventListener('click', function(e){
      var b = e.target.closest('.mtu-dot');
      if(b){ i = +b.getAttribute('data-k'); pintar(); }
    });
    document.addEventListener('keydown', function(e){
      if(!abierto) return;
      if(e.key==='Escape') cerrar();
      else if(e.key==='ArrowRight') bNext.click();
      else if(e.key==='ArrowLeft')  bPrev.click();
    });

    // API mínima por si un módulo lo quiere disparar a mano
    window.MateuTutorial = { abrir: abrir };

    // primera vez: se abre solo (con un respiro para que cargue la pantalla)
    if(!lsGet(VISTO_KEY)) setTimeout(abrir, 800);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
