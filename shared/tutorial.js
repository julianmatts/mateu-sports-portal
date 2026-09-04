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
      { ic:'📆', t:'Novedades del mes', d:'El calendario que antes mandabas en Excel, pero SEMANA POR SEMANA: solo la semana en curso se puede escribir. Anotá día por día lo que pasó (ausencias, horas extra, vacaciones, compensatorios, francos, reincorporaciones) y al cerrar la semana tocá «Confirmar la semana». Si no hubo nada, confirmalo igual con «Sin novedades». Los viernes, RRHH y el supervisor reciben la lista de las sucursales que no confirmaron.' },
      { ic:'🕘', t:'Compensatorios y horas', d:'Lo que la empresa le debe a cada persona: días de compensatorio y horas extra, por separado. Desde ahí pedís que se lo tome como tiempo libre o que lo cobre en plata; la solicitud le queda pendiente a RRHH y al supervisor. Si la aprueban se descuenta solo del saldo; si la rechazan, puede venir con un día sugerido.' },
      { ic:'🗓️', t:'Meses de stock y Plantilla', d:'Más abajo: la foto de stock, ventas y ratio por rubro, y la dotación de la sucursal por rol y régimen (full/part time).' },
      { ic:'🏢', t:'Todas las sucursales', d:'Con el selector de sucursal podés mirar cualquiera, y «Todas las sucursales (comparar)» las pone una al lado de la otra.', roles:['admin','supervisor'] }
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
      { ic:'⇶', t:'Masivo', d:'En modo edición, el botón «Masivo» agrega o quita una marca en varias sucursales a la vez: elegís la acción, la marca y tildás las sucursales por canal. Queda pendiente hasta Guardar.' },
      { ic:'🔍', t:'Filtrar una marca', d:'Con una marca elegida en el filtro, cada tarjeta muestra solo esa marca con sus meses de stock al lado, y las sucursales que no la trabajan quedan atenuadas.' },
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
      { ic:'📋', t:'Qué es', d:'Dos tipos: la visita SEMANAL (el detalle de cada recorrida) y la evaluación MENSUAL, que es la oficial de la sucursal. Parte operativa + actitudinal (50 + 50 puntos, nota de A a D).' },
      { ic:'📝', t:'Cargar', d:'Elegí tipo, sucursal y período y marcá cada ítem (Bien · Regular · Mal); el puntaje y la nota se calculan solos. En la mensual ves lo que marcaste semana a semana y podés precargar desde las visitas.', roles:['admin','supervisor'] },
      { ic:'🏆', t:'Ranking y gráficos', d:'La comparativa entre sucursales y la evolución de cada una en el tiempo, por mes (oficial) o por semana.' },
      { ic:'🔧', t:'Puntos de mejora', d:'Dejá registrado qué tiene que corregir cada sucursal y hacé el seguimiento hasta resolverlo. Cuando el encargado lo marca resuelto o deja un descargo, te llega el aviso por la Bandeja.' },
      { ic:'👀', t:'Vista de encargado', d:'Cada sucursal entra con su cuenta y ve su evaluación mensual, las visitas semanales y sus pendientes; puede marcar resuelto y dejar un descargo (ej.: faltan insumos).', roles:['sucursal','outlet'] }
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
      { ic:'📊', t:'Dashboard e histórico', d:'Cumplimiento por sucursal con semáforo (verde ≥ meta, ámbar ≥ mínimo, rojo por debajo), total de todas las sucursales y ranking.' },
      { ic:'⏱️', t:'Pesos por turno', d:'La matriz de venta por hora y día que usa el reparto de la Meta entre las personas del equipo de cada sucursal.' }
    ]},

    capacitaciones: { icono:'🎓', nombre:'Academia de Ventas', version:3,
      nombreRol:{ admin:'Academia · Guía del capacitador', supervisor:'Academia · Guía del capacitador', capacitador:'Academia · Guía del capacitador', sucursal:'Academia · Guía del vendedor', outlet:'Academia · Guía del vendedor' },
      pasos:[
      /* ===== STAFF: Iván (capacitador), Cristian (supervisor) y gerencia ===== */
      { ic:'🎓', t:'Bienvenido: vos gestionás la Academia', d:'La Academia de Ventas es la plataforma de capacitación de todas las sucursales. Con tu rol ves lo mismo que el equipo (Catálogo, Novedades, Ranking) más dos pestañas exclusivas: «Mi equipo», para seguir el avance de cada persona, y «Gestión», donde se crea y se asigna todo el contenido. Este recorrido te lleva por el circuito completo, en el orden en que lo vas a usar.', roles:['admin','supervisor','capacitador'] },
      { ic:'⚡', t:'Cargar una capacitación en 3 pasos', d:'Gestión → «Crear curso desde un PDF o PowerPoint». Paso 1: elegís el archivo de tu PC (el título se completa solo), duración y competencia. Paso 2: la Academia lee el texto y te propone un módulo por página o diapositiva. Paso 3: quiz opcional, a qué programa va y si avisás al equipo → «Publicar». El archivo original queda adjunto para descargar. Si preferís arrancar de cero, «Nuevo curso en blanco».', roles:['admin','supervisor','capacitador'] },
      { ic:'✨', t:'Ayudante con IA (si está activado)', d:'En el paso 2 del asistente, «Mejorar con IA» limpia el texto extraído (columnas mezcladas, líneas cortadas), lo reordena en módulos con tarjetas destacadas y propone título, descripción, frase gancho y un quiz; en el paso 3 y en el editor, «Proponer preguntas con IA» arma el quiz a partir del contenido. Siempre revisás antes de publicar. Los botones aparecen solo si gerencia cargó la clave de la API en Cloudflare.', roles:['admin','supervisor','capacitador'] },
      { ic:'✏️', t:'Personalizar la base que te propone', d:'En el paso 2 (y después desde ✏ Editar) el curso es todo tuyo: corregí el texto, cambiá títulos, reordená con ↑ ↓, uní un módulo con el anterior, quitalo o agregá módulos nuevos de texto, video de YouTube, archivo PDF/PPT o link. El botón 👁 «Vista previa» te muestra exactamente cómo lo va a ver el vendedor. Tip: un bloque que empieza con [[tip]] Título, [[dato]], [[evitar]] o [[ejemplo]] se destaca con color.', roles:['admin','supervisor','capacitador'] },
      { ic:'🖼️', t:'Portada, frase y color', d:'Cada curso tiene color (el de la tarjeta y del badge), una portada opcional (pegá la URL de una foto) y una «frase gancho» que aparece sobre la imagen en la portada del curso, antes de que el vendedor entre al contenido. La descripción y la lista de módulos también se muestran ahí como «Qué vas a aprender».', roles:['admin','supervisor','capacitador'] },
      { ic:'❓', t:'El quiz final', d:'Preguntas de opción múltiple: escribí la pregunta, las opciones una por línea y el número de línea de la correcta. Definí con qué % se aprueba (70% por defecto). El quiz se habilita cuando el vendedor terminó todos los módulos, puede reintentarlo y al aprobar gana el badge y el certificado. Sin preguntas, el curso se completa con solo leerlo.', roles:['admin','supervisor','capacitador'] },
      { ic:'🗂️', t:'Programas: a quién le toca cada cosa', d:'Los cursos solos no los ve nadie: se reparten por programa. Gestión → Programas → «Nuevo programa»: nombre, color e ícono, los cursos que incluye, los puestos (encargado, vendedor, caja, depósito; vacío = todos), las sucursales (vacío = todas) y la fecha límite. Al guardar, cada persona de ese puesto/sucursal ya lo ve en su Inicio y Catálogo con el «vence en N días».', roles:['admin','supervisor','capacitador'] },
      { ic:'📝', t:'Borradores y la hoja de ruta', d:'Un curso sin tildar «Publicado» queda en borrador: el equipo no lo ve, y un programa cuyo contenido está todo en borrador tampoco les aparece. Ya están cargados los programas Onboarding, Vendedores, Vendedores Intermedio y Encargados con sus cursos en borrador (chip ámbar en Gestión → Cursos): entrá con ✏, cargá el contenido (o usá el asistente y sumalo al programa) y tildá Publicado.', roles:['admin','supervisor','capacitador'] },
      { ic:'📋', t:'Encuesta previa al programa', d:'En el editor del programa podés activar «Encuesta previa»: un texto de bienvenida y preguntas abiertas (una por línea) que el vendedor responde antes de arrancar. Aparece como la primera tarjeta del programa. Las respuestas son confidenciales —solo las ven los administradores de la Academia— y se leen por persona en Gestión → Encuestas.', roles:['admin','supervisor','capacitador'] },
      { ic:'📣', t:'Avisar al equipo', d:'En la fila de cada programa, «📣 Avisar» publica la notificación en la Bandeja del Portal de todas las sucursales y en Novedades de la Academia (pide confirmación antes de enviar). El asistente de carga también ofrece avisar al publicar. En Novedades podés publicar además avisos y recordatorios propios; los logros («X completó un curso») se publican solos.', roles:['admin','supervisor','capacitador'] },
      { ic:'👁️', t:'Ver el curso como lo ve el equipo', d:'Desde Gestión → Cursos → «Ver», o tocando la tarjeta en el Catálogo, entrás a la portada y al curso tal cual lo ve el vendedor (hero, índice lateral, tarjetas), con una diferencia: en el quiz la respuesta correcta aparece marcada en verde. No guarda avance.', roles:['admin','supervisor','capacitador'] },
      { ic:'👥', t:'Mi equipo: toda la dotación', d:'La gente real de las 15 sucursales, tomada de Indicadores (no hay que cargar usuarios): niveles por puesto, buscador, filtros por puesto y sucursal, y por persona la barra de progreso y su última actividad. Tocá una persona y se abre su ficha: qué cursos le faltan, minutos de lectura, y botones para escribirle a la cuenta de su sucursal o resetear su PIN. Arriba, «Recordar a los que no empezaron» manda un directo por sucursal con los nombres, y «⇩ Excel» exporta todo el avance.', roles:['admin','supervisor','capacitador'] },
      { ic:'⏰', t:'Recordatorios y alertas', d:'Si un programa tiene fecha límite, la Academia avisa sola por la Bandeja y en Novedades 7 días antes y el día anterior. En Mi equipo, el chip «⚠ muy rápido» marca a quien completó un curso en menos de 20 segundos por módulo: vale la pena charlarlo. El Panel General, Evaluaciones y RRHH también muestran el avance de la Academia.', roles:['admin','supervisor','capacitador'] },
      { ic:'🏆', t:'Ranking y Encuestas', d:'Ranking: el podio de las personas más capacitadas (avance promedio, módulos completados, certificados), con el toggle «Toda la empresa» / «Por sucursal». Gestión → Encuestas: lo que dijo el equipo al terminar cada curso (contenido · claridad · utilidad de 1 a 5 y comentarios) y las respuestas de las encuestas previas, por persona.', roles:['admin','supervisor','capacitador'] },
      { ic:'🎖️', t:'Certificados', d:'Al aprobar un curso el vendedor gana un badge hexagonal y su certificado imprimible con tu firma como capacitador y la del supervisor; al completar todos los cursos de un programa, el certificado del programa aparece en su Historial. No hay nada que emitir a mano.', roles:['admin','supervisor','capacitador'] },
      { ic:'❓', t:'Este recorrido', d:'Queda siempre disponible en el botón «?» de abajo a la derecha. Cualquier curso o programa se puede seguir editando cuando quieras desde Gestión → ✏.', roles:['admin','supervisor','capacitador'] },

      /* ===== EQUIPO: vendedores, cajeras, depósito y encargados (cuenta de sucursal) ===== */
      { ic:'🎓', t:'Bienvenido a la Academia de Ventas', d:'Acá están las capacitaciones de Mateu: cursos cortos con lecturas, videos y materiales, un quiz al final y un certificado cuando aprobás. Los cursos que ves son los que corresponden a tu puesto. Este recorrido te muestra cómo se usa.', roles:['sucursal','outlet'] },
      { ic:'👤', t:'Primero, decí quién sos', d:'La cuenta es de la sucursal, pero la Academia es personal: al entrar elegís tu nombre en la lista del equipo y tu avance, tus badges y tus certificados quedan a tu nombre. Queda recordado en esta computadora; si entra otra persona, toca «Cambiar persona» arriba a la derecha.', roles:['sucursal','outlet'] },
      { ic:'🔑', t:'Tu PIN', d:'La primera vez que elegís tu nombre creás un PIN de 4 números; de ahí en más, cada vez que alguien elige tu nombre en esta u otra computadora lo pide. Así nadie puede cursar por vos ni ver tu avance. Si lo olvidás, tu encargado lo resetea desde «Mi equipo».', roles:['sucursal','outlet'] },
      { ic:'🏠', t:'Inicio: tu panel', d:'Arriba ves «Mi progreso» (tu programa, cuántos cursos llevás y cuántos días te quedan), «Mis competencias» (barras por tema) y «Certificados y badges» (tocá un badge para ver e imprimir tu certificado). Abajo, «Continuá tu programa» con las tarjetas de lo que te falta: tocá una para entrar.', roles:['sucursal','outlet'] },
      { ic:'📚', t:'Catálogo', d:'Todos tus programas, uno por pestaña de color («Programas por nivel»). Las tarjetas muestran la duración y, arriba a la izquierda, un ✓ si ya lo terminaste o tu % de avance. Podés buscar por título, ordenar, filtrar por competencia y ocultar los completados.', roles:['sucursal','outlet'] },
      { ic:'📖', t:'Cómo se hace un curso', d:'Al tocar una tarjeta ves la portada: de qué va, «Qué vas a aprender» y cómo se evalúa. «Comenzar módulo» te lleva al contenido: a la izquierda el índice con todos los módulos, a la derecha la lectura (o el video, o el material para descargar). Al terminar cada módulo tocá «Completar y seguir»: queda marcado con ✓ y podés retomar otro día desde donde dejaste.', roles:['sucursal','outlet'] },
      { ic:'✅', t:'El quiz final', d:'Se habilita cuando completaste todos los módulos. Elegí una opción por pregunta y tocá «Enviar respuestas»: las correctas se pintan en verde y las que no, en rojo. Si no llegás al puntaje, «Reintentar» las veces que haga falta; repasar los módulos antes ayuda.', roles:['sucursal','outlet'] },
      { ic:'🏅', t:'Badges y certificado', d:'Al aprobar ganás el badge del curso y el certificado con tu nombre, firmado por el capacitador y el supervisor: «Ver mi certificado» → «Imprimir / PDF» o «Compartir» (para mandarlo por WhatsApp desde el celular). Si completás todos los cursos de una competencia, ganás el badge dorado de esa competencia; y al terminar un programa entero, el certificado del programa aparece en Historial.', roles:['sucursal','outlet'] },
      { ic:'📋', t:'Encuestas', d:'Algunos programas empiezan con una «Encuesta previa» (es la primera tarjeta, 5 minutos): contanos qué esperás y qué te cuesta; tus respuestas son confidenciales, solo las ven los responsables de la Academia. Y al terminar cada curso hay una encuesta cortita de 3 puntajes y un comentario para mejorar el contenido.', roles:['sucursal','outlet'] },
      { ic:'📰', t:'Novedades', d:'El canal del equipo: programas nuevos, recordatorios del capacitador y los logros de tus compañeros. El número rojo en la pestaña son las que no leíste; «Marcar todas como leídas» las deja al día.', roles:['sucursal','outlet'] },
      { ic:'🏆', t:'Historial y Ranking', d:'Historial: tus cursos por programa, con el certificado cuando lo completás o el candado con tu progreso mientras tanto. Ranking: el podio de tu sucursal por avance, módulos y certificados. Si sos encargado/a, además tenés «Mi equipo» con el avance de cada persona de tu local.', roles:['sucursal','outlet'] },
      { ic:'⏰', t:'Fechas límite', d:'Cuando un programa tiene vencimiento lo ves en Inicio y en el Catálogo («vence en N días», en rojo si ya venció). Organizate: cada curso lleva entre 20 y 45 minutos y se puede hacer en varias sesiones.', roles:['sucursal','outlet'] },
      { ic:'❓', t:'Ayuda', d:'Este recorrido queda siempre en el botón «?» de abajo a la derecha. Cualquier duda de contenido, a tu encargado o al capacitador.', roles:['sucursal','outlet'] }
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
      { ic:'🧑‍💼', t:'Qué es', d:'Tu herramienta de RRHH: la nómina de toda la empresa, las faltas y licencias, lo que se le debe a cada persona (compensatorios y horas extra), el calendario de novedades de cada sucursal, el cierre mensual para el estudio contable y la rotación. Son seis pestañas, arriba de todo: Legajos · Ausentismo · Compensatorios y horas · Calendario · Novedades de nómina · Rotación. Todo se guarda solo al confirmar cada carga y lo ven también gerencia y el supervisor.' },
      { ic:'📁', t:'1 · Legajos', d:'La ficha de cada persona: datos, DNI, puesto, sucursal, régimen (full/part time), fecha de ingreso y antigüedad. Arriba, las tarjetas de dotación activa, sucursales con gente, antigüedad promedio, bajas del año y lo que se debe en compensatorios y horas. Buscá por nombre, DNI o puesto y filtrá por sucursal, puesto y estado (activos / bajas / todos). Tocá una fila para abrir la ficha completa: contrato, vacaciones del año (se calculan solas por antigüedad, según la LCT, menos las ya tomadas), compensatorios y su avance en la Academia.' },
      { ic:'➕', t:'Cargar y mantener la nómina', d:'«+ Legajo» da de alta a alguien a mano. «⇩ Importar dotación» trae en un paso a toda la gente que registró ventas en Indicadores (nombre, sucursal y puesto). «⟳ Actualizar (Excel)» sube el Registro Único y actualiza los legajos con lo que trae. En cada fila: ✎ edita la ficha, ⏻ registra la baja (con fecha y motivo: renuncia, despido, fin de contrato…) y ↩ reactiva a alguien dado de baja. La baja no borra nada: la persona queda en el historial y alimenta la Rotación.' },
      { ic:'🤒', t:'2 · Ausentismo y licencias', d:'Faltas, licencias y vacaciones de toda la cadena. Con «+ Ausencia / Licencia» cargás la persona, el tipo (vacaciones, enfermedad/ART, licencia especial, falta injustificada, suspensión u otro), el período desde/hasta y si es con o sin goce de sueldo; los días se calculan solos. Las tarjetas muestran quiénes están ausentes HOY, cuántos de vacaciones y las solicitudes pendientes. Una ausencia pendiente se aprueba con ✓ o se rechaza con ✕; ✎ edita y 🗑 elimina. Filtrá por sucursal, tipo y estado. El saldo de vacaciones de cada uno está en su legajo.' },
      { ic:'🕘', t:'3 · Compensatorios y horas', d:'Lo que la empresa le debe a cada persona por haber trabajado de más, en dos conceptos separados: DÍAS de compensatorio (feriado, domingo, inventario, cobertura…) y HORAS extra. «+ Cargar ▾» elige cuál cargar (o registrar un día que ya se tomó fuera del circuito). El saldo de cada uno es la suma de sus movimientos (+ ganados, − tomados); el 🕘 de cada persona abre su ficha con el historial y abajo de todo está el listado de compensatorios tomados. «⇧ Importar Excel» sube la planilla de compensatorios pendientes de toda la cadena y ajusta los saldos (cruza por número de legajo).' },
      { ic:'✅', t:'Responder las solicitudes', d:'Los encargados piden desde Mi Sucursal que una persona se tome el tiempo o lo cobre en plata; la solicitud te llega acá (y por la Bandeja de mensajes) como pendiente. «Aprobar» descuenta solo del saldo; si pidieron cobrar, el pago se valoriza y podés pasarlo directo a Novedades de nómina. «Rechazar» pide el motivo y te deja sugerir otro día para compensar. ↩ vuelve una solicitud a pendiente y devuelve el día si estaba aprobada. Al responder, la sucursal y quien pidió reciben el aviso solos.' },
      { ic:'💲', t:'Valor de la hora', d:'Con «💲 Valor de la hora» cargás el valor general (y, si hace falta, uno distinto por persona) y cuántas horas vale un día. Con eso el portal calcula el valorizado: lo que saldría pagar en plata todo lo que se debe. El importe de cada pago queda grabado en el momento, así el histórico no cambia cuando después actualizás el valor. Los encargados nunca ven importes: piden el cobro y vos lo valorizás.' },
      { ic:'📆', t:'4 · Calendario', d:'El calendario de novedades de cada sucursal, con el mismo formato del Excel que mandaban los encargados: una grilla lunes→domingo, día por día (ausencias, horas extra, vacaciones, compensatorios; los feriados salen solos). Ellos lo cargan SEMANA POR SEMANA desde Mi Sucursal y la cierran con «Confirmar la semana» (o «Sin novedades»). Elegí la sucursal y el mes con los selectores; acá podés corregir cualquier día y se guarda al salir del casillero.' },
      { ic:'🚦', t:'Semáforo de la semana', d:'Arriba del calendario: cuántas sucursales ya confirmaron la semana en curso y cuáles faltan (marcadas las que no cargaron nada). «📣 Recordar a las que faltan» les manda el recordatorio por la Bandeja; los viernes sale solo el resumen a RRHH y al supervisor. Abajo, el «Cierre semanal» de las últimas 6 semanas de esa sucursal. «🖨 Imprimir» saca el mes en A4 apaisado y «⇩ Excel ▾» baja solo esa sucursal o todas: una hoja por sucursal con el calendario, la hoja «Detalle» con autofiltro (para trabajar) y el resumen del cierre semanal.' },
      { ic:'🧾', t:'5 · Novedades de nómina', d:'El cierre de cada mes para el estudio contable. Elegí el período y cargá con «+ Novedad» cada concepto por persona: horas extra, adelanto de sueldo, comisión, premio/bono, presentismo, descuento, ausencia informativa, compensatorio u horas cobradas, otro; con su valor y un detalle. Los pagos de compensatorios que aprobás pueden pasar solos a esta lista. Las tarjetas resumen cuántas novedades hay, a cuántas personas afectan y el monto neto en $. Al cierre, «⇩ Excel para el estudio» baja el listado del mes listo para mandar.' },
      { ic:'🔄', t:'6 · Rotación', d:'Se arma sola con las fechas de ingreso y de baja de los legajos, no hay nada que cargar: dotación actual, altas y bajas de los últimos 12 meses, índice de rotación anualizado, el gráfico de altas y bajas mes a mes, la tabla por sucursal (dotación, altas, bajas, antigüedad promedio y rotación) y los motivos de baja. Por eso importa registrar cada baja con ⏻ y su motivo, y no borrar el legajo.' },
      { ic:'📬', t:'Avisos y ayuda', d:'Todo lo que requiere tu respuesta (solicitudes de compensatorios, semanas del calendario sin confirmar) te llega también a la Bandeja de mensajes del Portal: abrila desde el botón «Menú» de arriba a la izquierda. El logo del header vuelve al Portal. Este recorrido queda siempre disponible en el botón «?» de abajo a la derecha.' }
    ]},

    tareas: { icono:'✅', nombre:'Tareas de la Sucursal', pasos:[
      { ic:'✅', t:'Qué es', d:'Las tareas operativas del local en un solo lugar, en cuatro pestañas: Cambio de precios, Sectores de marcas, Limpieza y Vidrieras. Todo queda registrado con quién lo hizo, cuándo y, donde corresponde, la foto de antes y la de después.' },
      { ic:'👤', t:'Decí quién sos', d:'La cuenta es de la sucursal: escribí tu nombre en «Yo soy» (arriba, se recuerda en este dispositivo) para que lo que marques quede firmado por vos.', roles:['sucursal','outlet'] },
      { ic:'💲', t:'Cambio de precios', d:'Las remarcaciones que publica gerencia (con la marca y desde cuándo rigen) y las que te anotás vos. Sacá la foto de cómo está, hacé el cambio, sacá la de cómo quedó y tocá «✓ Hecha». Las que pasaron su vigencia sin hacerse se marcan en rojo.' },
      { ic:'🏷️', t:'Sectores de marcas', d:'Armados y rearmados de sectores de exhibición: marca, dónde va y cómo tiene que quedar, con fecha límite. Mismo circuito: foto de antes, foto de después, hecha.' },
      { ic:'🧹', t:'Limpieza', d:'El checklist del local con tareas diarias, semanales y mensuales (podés cargar el sugerido y ajustarlo). Cada día se marca lo que se hizo; los puntitos muestran el cumplimiento de los últimos días. 📷 guarda la foto de antes y ✨ la de después.' },
      { ic:'🪟', t:'Vidrieras', d:'Cada vidriera del local con su último cambio y cuántos días lleva igual. Cuando la cambiás, «🔄 Registrar cambio» con la foto de cómo quedó (la de antes se toma sola del cambio anterior). Si pasa el tope de días sin cambios se pone en rojo y avisa por la Bandeja.' },
      { ic:'⇄', t:'Antes / después', d:'Tocá cualquier par de fotos y se abre la comparativa: deslizá la barra para ver el antes y el después sobre la misma imagen, o mirá las dos lado a lado.' },
      { ic:'📵', t:'Sin señal, no se pierde nada', d:'Si estás en el depósito o en la vidriera sin conexión, lo que marques y las fotos quedan guardadas en el teléfono y se mandan solas cuando vuelve la señal (arriba aparece «N cambios esperando conexión»).' },
      { ic:'🏢', t:'Todas las sucursales', d:'Gerencia ve el resumen de todas en cuatro solapas: «Hoy» (pendientes, vencidas, limpieza del día con «📣 Recordar a las que faltan» y vidrieras en alerta), «Cumplimiento» (ranking mensual: tareas a tiempo, días para cerrar, limpieza cumplida, cambios de vidriera e índice), «Vidrieras» (la galería con la última foto de cada vidriera de todos los locales) y «Recurrentes». Desde ahí se publica una tarea a varias sucursales, se ajusta el tope de días de las vidrieras y «⇩ Excel» baja todo.', roles:['admin','supervisor'] },
      { ic:'🔁', t:'Tareas recurrentes', d:'Plantillas que generan la tarea solas cada N días en las sucursales elegidas (o todas), con plazo y foto obligatoria si querés: por ejemplo «Remarcación de fin de semana» cada 7 días. Se generan al abrir el resumen el día que toca y avisan por la Bandeja.', roles:['admin','supervisor'] },
      { ic:'📬', t:'Avisos automáticos', d:'Una tarea que vence sin hacerse y una vidriera que pasa el tope avisan solas por la Bandeja a la sucursal y al supervisor. Al publicar una tarea con «Exigir foto de después», no se puede marcar hecha sin la foto. Mi Sucursal muestra «Tareas de hoy» y el Panel General el control por sucursal.', roles:['admin','supervisor'] }
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
  // con la campana de notificaciones: arriba de ella y con el eje centrado (campana 56px a right:22 → eje a 50px; el «?» de 46px necesita right:27)
  +'.mtu-fab.mtu-fab-campana{bottom:92px;right:27px}'
  +'@media(max-width:560px){.mtu-fab.mtu-fab-campana{bottom:calc(86px + env(safe-area-inset-bottom,0px));right:21px}}'
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
  +'border-radius:10px;padding:10px 16px;cursor:pointer;transition:all .14s;border:1px solid #d7deec;background:#fff;color:#0B1527;white-space:nowrap;flex:0 0 auto}'
  +'.mtu-btn:hover{background:#f0f3fa}'
  +'.mtu-btn[disabled]{opacity:.35;cursor:default}'
  +'.mtu-btn[disabled]:hover{background:#fff}'
  +'.mtu-btn.pri{background:#CC0000;border-color:#CC0000;color:#fff;box-shadow:0 3px 12px rgba(204,0,0,.3)}'
  +'.mtu-btn.pri:hover{background:#a00000;border-color:#a00000}'
  +'@media(max-width:560px){.mtu-body{padding:20px 16px 12px}.mtu-bd{font-size:14px}.mtu-foot{padding:12px 12px 14px;gap:8px}.mtu-btn{padding:10px 12px;font-size:12.5px;letter-spacing:1px}}';

  function montar(){
    var slug = toolActual();
    var tut = TUT[slug];
    if(!tut) return;

    var S = leerSesion();
    if(!S || !S.rol) return;   // sin sesión (p.ej. pantalla de login del Portal) no hay tutorial
    if(S.rol==='puesto') return;   // puesto de consulta del salón (quiosco): sin tutorial ni botón «?»

    var pasos = tut.pasos.filter(function(p){ return !p.roles || p.roles.indexOf(S.rol)>=0; });
    if(!pasos.length) return;
    // el módulo de indicadores se llama distinto según el rol
    var nombreTut = (slug==='indicadores' && (S.rol==='sucursal'||S.rol==='outlet')) ? 'Mi Sucursal' : TUT[slug].nombre;
    if(tut.nombreRol && tut.nombreRol[S.rol]) nombreTut = tut.nombreRol[S.rol];

    var VISTO_KEY = 'mtu_visto_'+slug+(tut.version?'_v'+tut.version:'');   // version: al subirla, el tutorial se vuelve a abrir solo

    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    // ---- botón flotante «?» ----
    var fab = document.createElement('button');
    fab.className = 'mtu-fab';
    // si la pantalla tiene la campana de notificaciones (Portal, Indicadores) abajo a la
    // derecha, el «?» va arriba de ella para no taparla
    if(document.getElementById('notifWidget')) fab.classList.add('mtu-fab-campana');
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
