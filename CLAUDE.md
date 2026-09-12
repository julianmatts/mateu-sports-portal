# CLAUDE.md — Portal Mateu Sports

Contexto del proyecto para Claude Code. Mantener corto y concreto.

## Qué es esto

Monorepo con las herramientas internas de **Mateu Sports** (cadena de retail
deportivo, zona La Plata) y un **portal** con login que las enlaza. Todo se
deploya a Cloudflare Pages desde GitHub. El idioma del proyecto es **español (Argentina)**.

## Estructura

```
mateu-sports-portal/
├── index.html          # EL PORTAL: login (email+PIN contra Firebase) + tiles a cada herramienta
├── netlify.toml        # leftover de cuando se usaba Netlify; ya no aplica, no usar de referencia
├── condiciones/        # Condiciones Comerciales (localStorage)
├── equipo/             # Área de Producto: F8s de David/Daniel (Firebase turnero-mateu, nodo equipo/); reseteado a cero 24/08/2026
├── turnero/            # Turnero de proveedores (Firebase + EmailJS)
├── marcas/             # Asignación de Marcas (Firebase REST)
├── gestion-stock/      # Discontinuos por sucursal + Reporte Mensual + Meses de Stock
├── pedidos-semanales/  # Reposición semanal por sucursal y aprobaciones de Producto
├── managment/          # Desarrollo, OC y seguimiento de ingresos por proveedor
├── diagonal80/         # Apertura Diagonal 80 (propuesta vs. capacidad)
├── ubicaciones/        # "Buscador de Artículos": ubicaciones de depósito por sucursal
├── indicadores/        # Indicadores de Sucursal: UPT, tickets/hora, ticket promedio + meses de stock, por sucursal y persona. Es la HOME de los roles sucursal/outlet.
├── data/indicadores/   # salida particionada (un JSON por sucursal + cadena.json) que consume el módulo
├── regalias/           # Liquidador de Regalías RUGE/EDLP (Estudiantes): clasifica ventas, aplica escalas, exporta el Excel del mes y genera la presentación comercial (plantilla-presentacion.html, embebida en index.html)
├── evaluaciones/       # Evaluaciones de Supervisor: carga semanal operativa+actitudinal por sucursal, ranking, gráficos y vista de encargado. Escribe a Firebase (base evaluaciones-mateu). Ver "Evaluaciones de Supervisor" abajo.
├── barrida/            # «Reparto de Mercadería» (ex Análisis de Reserva Depósito Central): pestaña «Barrida de reserva» (cruce semanal de la reserva del depósito con las ventas por sucursal → reposición posible y reserva parada) y pestaña «Reparto inicial» (lo que entró, remito por remito, desde la estadística de remitos). Firebase: reusa recepciones-mateu (nodo barrida/). Ver "Análisis de Reserva Depósito Central" y "Reparto inicial" abajo.
├── objetivos/          # Objetivos de Venta Semanal: gerencia carga el objetivo (Meta) de venta por sucursal por semana (subiendo el Excel "PMS Objetivos" o a mano) → dashboard vs. real; cada sucursal ve su objetivo en Indicadores. Firebase: reusa recepciones-mateu (nodo objetivos/). Ver "Objetivos de Venta Semanal" abajo.
├── capacitaciones/     # Academia de Ventas FUNCIONAL: cursos y programas del capacitador, avance por persona con quiz, certificados, equipo/ranking y encuestas. Ver "Academia de Ventas" abajo. (Las pantallas .dc.html son el prototipo original de Design; quedan de referencia.)
├── tareas/             # Tareas de la Sucursal: Cambio de precios, Sectores de marcas, Limpieza (checklist) y Vidrieras (alerta por días sin cambios), con foto antes/después y comparativa. Firebase: reusa recepciones-mateu (nodo tareas/). Ver "Tareas de la Sucursal" abajo.
├── logistica/          # Envíos e Ingresos: dashboard de logística (unidades enviadas a cada sucursal + ingresos al depósito por mes/rubro/subrubro/disciplina/marca). Pantalla inicial de logistica@ y deposito@. Firebase: reusa recepciones-mateu (nodo logistica/). Ver "Envíos e Ingresos" abajo.
├── reviews/            # Reseñas de Google por sucursal: buenas/malas, captación sobre tickets y evolución mes a mes, con estética de ficha de Google. Solo lectura; los datos salen del Excel de Iván vía scripts/gen-reviews.py. Ver "Reseñas de Google" abajo.
├── lib/                # código JS común versionado y testeable (hoy: evaluacion.js = cálculo puro de Evaluaciones + tests con node --test)
└── shared/             # código común del shell (calendario retail, etc.)
```

## Convención principal — NO romper

Cada herramienta es **un único `index.html` self-contained**: HTML + CSS + JS
todo inline, sin build, sin bundler, sin dependencias de node. Las libs externas
(fuentes de Google, xlsx, etc.) entran por `<link>`/`<script src>` desde CDN.
El logo de Mateu va **embebido como data URI base64** (no como archivo suelto).

Al editar: trabajar siempre dentro del `index.html` de la herramienta. No partir
en múltiples archivos salvo que se decida explícitamente centralizar algo en
`shared/`.

**Íconos = SVG, no emojis.** Windows 7 y navegadores viejos no dibujan los emojis
a color (salen como recuadros □). Por eso `shared/iconos.js` reemplaza al vuelo
todos los emojis del DOM por su SVG inline equivalente (self-contained, sin CDN,
con MutationObserver para lo que se genera por JS). **Todo módulo nuevo debe
incluirlo** con una línea en el `<head>`: `<script src="../shared/iconos.js" defer></script>`
(en el Portal raíz la ruta es `shared/iconos.js`). Se pueden seguir usando emojis
en el código como hasta ahora: el script los convierte. Si falta un ícono nuevo,
sumar la entrada al mapa `ICONS` de ese archivo.

**Header unificado del shell (`shared/header.js`).** Todos los módulos usan el
mismo header que Indicadores: botón **Menú** rojo (abre el drawer lateral con
las herramientas de la sesión), logo centrado que vuelve al Portal y el
calendario retail a la derecha. Se incluye con una línea en el `<head>`:
`<script src="../shared/header.js" defer></script>` (después de `iconos.js`).
El script inyecta header + drawer + calendario solo; clases con prefijo `msh-`
y publica la variable CSS `--msh-h` (alto real del header) para que las barras
sticky del módulo cuelguen de `top:var(--msh-h,67px)`. Los controles que antes
vivían en el header propio van en una barra secundaria `.msh-subbar`; los nodos
que el JS del módulo sigue escribiendo (whoName, salir, etc.) quedan como stubs
ocultos. Herramienta nueva → sumar la entrada al mapa `TOOLS` de `header.js`
(y del Portal e Indicadores). **Indicadores y el Portal raíz tienen su header
propio: ahí NO se incluye.**

## Stack — quién hace qué

- **GitHub** → guarda el código y el historial.
- **Cloudflare Pages** → publica el sitio; **deploya solo con cada push** a `main`.
- **Firebase (Realtime Database vía REST, sin SDK)** → los datos en vivo, un
  proyecto por dominio: `discontinuos-mateu` (usuarios del portal + gestión de
  stock), `asignacion-marcas-mateu`, `pedidos-semanales-mateu`,
  `ubicaciones-mateu` (Buscador de Artículos) y el del turnero.
  `regalias/` guarda en **`recepciones-mateu`, nodo `regalias/`** (10/09/2026): `ledger`
  (acumuladores por temporada), `keywordsEDLP` y `liquidaciones/<YYYY-MM>` (líneas ya leídas +
  asignaciones a mano de cada mes liquidado; índice liviano en `liquidacionesIdx`). Al entrar se
  reabre la última liquidación, así recargar la pestaña no obliga a cargar todo de nuevo. Se guarda
  como «borrador» al liquidar y como «guardada» con «Guardar mes en el ledger» (un mes guardado solo
  se pisa con ese botón). localStorage queda como copia del navegador; el ledger viejo de cada
  navegador se fusiona a la base una sola vez (`regalias_ledger_migrado`).
  `condiciones/` usa **localStorage** (no tiene backend). `equipo/` guarda los
  F8s y el control manual en la base del turnero (`turnero-mateu`, nodo `equipo/`).
  `evaluaciones/` escribe a su propia base Firebase `evaluaciones-mateu`.
  No migrar Firebase a otra cosa sin que Juli lo pida: es la opción correcta
  para los datos multi-usuario en tiempo real.

Regla mental: **GitHub + Cloudflare Pages = el código. Firebase = los datos.**

## Cómo deployar

No hay build. El flujo es: editar → commit → push a `main`. Cloudflare Pages
republica solo en ~30s. Para probar local, abrir el `index.html` en el navegador.

Config en Cloudflare Pages: build command vacío, output directory = raíz (`/`).

## El portal (`index.html` raíz) y el login

Login centralizado **blando** (sin Firebase Auth; ordena accesos, NO es
seguridad real): email + PIN de 4 dígitos validado contra
`discontinuos-mateu-default-rtdb/usuarios`. Cada usuario tiene `rol`
(`admin` | `sucursal` | `outlet` | `supervisor` | `capacitador` | `deposito` | `puesto`),
su `sucursal`/`outlet_id` y la lista `herramientas`, que define qué tiles ve.

**Roles operativos de sucursal (24/08/2026)** — la cuenta `sucursal` queda para
encargado/subencargado (es la única que ve Mi Sucursal):
- **`deposito`** (p.ej. `NN-deposito@`): opera el Buscador de Artículos con todo
  (asignar/desasignar, cargar stock del día, editar estanterías) + las herramientas
  que se le asignen, pero **NUNCA `indicadores`** (se filtra en
  `herramientasEfectivas` y el propio módulo lo rebota). NO administra perfiles
  (`canManage` false; cargar stock/estanterías usa `canStock`). Su home es la
  grilla del Portal.
- **`puesto`** (p.ej. `NN-consulta@`): quiosco del salón a la vista de clientes.
  El Portal lo redirige SIEMPRE a `ubicaciones/` (también con `?ver=bandeja`);
  `header.js` no le monta Menú/drawer y el logo va sin link; `tutorial.js` no
  aparece. En el Buscador: solo pestaña Buscar, sin perfiles fijos; puede
  **comentar** artículos eligiendo qué perfil firma (la selección se olvida al
  cerrar la hoja). «Salir» pide el **PIN de la cuenta** antes de cerrar la
  sesión (`salirPuesto`), así un cliente no desloguea el quiosco. Ya no hay contraseñas en el código:
la config del `<script>` es `TOOLS` (nombre, ícono y url de cada herramienta)
y las listas de sucursales/outlets.

- **Orden del panel de las sucursales (07/09/2026)**: las cuentas `sucursal`/`outlet` ven
  tiles y drawer siempre en el mismo orden, el que tenía Diagonal 80: Mi Sucursal → Buscador →
  Marcas → Gestión de Stock → Pedidos Semanales → Evaluaciones → Tareas; lo demás va después.
  Lo fija `ORDEN_SUCURSAL`/`ordenarSucursal` dentro de `herramientasEfectivas` (solo ordena,
  no agrega herramientas; `inicio` sigue mandando). No depende del orden guardado en `usuarios/`.
- La sesión queda en localStorage (`mateu_portal_session`). Los módulos **no
  tienen login propio**: leen esa sesión y redirigen a `../` si falta o si el
  usuario no tiene la herramienta asignada.
- Gestión de usuarios (alta, herramientas, reseteo de PIN): ícono ⚙ del portal,
  visible solo para `julian@mateu.com.ar` (`ADMIN_SETTINGS_EMAIL`).
- **Pantalla inicial y tiles acotados por usuario (03/09/2026)**: dos campos opcionales
  del registro en `usuarios/`, editables desde el ⚙ (columna «Pantalla inicial» y check
  «Solo estas» en admins, también en el alta). `inicio` = clave de `TOOLS` a la que el
  Portal redirige al entrar (`toolInicio()` en `render()`; tiene que estar entre sus
  herramientas; `?ver=bandeja` y `?ver=portal` no redirigen, y «← Volver» de la Bandeja
  vuelve ahí). `soloHerramientas:true` = un **admin** ve SOLO las herramientas marcadas,
  en ese orden, en vez de todas (`herramientasEfectivas`). Caso de uso: `producto@` es
  admin (lo exigen el Control de Pedidos Semanales y el Dashboard de stock) pero su
  Portal es Área de Producto + Marcas + Gestión de Stock + Pedidos Semanales, con Área
  de Producto como inicio. Los campos se leen al loguearse (sesiones ya abiertas los
  toman al volver a entrar). El nombre del usuario en drawers/mensajes (`nombreCorto`, 4
  copias: Portal, `header.js`, Indicadores, `notificaciones.js`) escribe «RRHH» en mayúsculas.
  **Perfiles fijos en el código** (`PERFILES_FIJOS` en el
  `index.html` raíz, pedido de Juli 04/09/2026): pisan esos tres campos al loguearse y al
  normalizar una sesión abierta, así no dependen del ⚙ (la fila del ⚙ lo avisa). Hoy:
  `producto@` (las 4 herramientas de arriba, inicio Área de Producto), `rrhh@` (solo
  Recursos Humanos, inicio ahí) y `capacitaciones@` (solo Academia de Ventas, inicio ahí;
  07/09/2026 — ese día la cuenta se renombró de `capacitacion@` a `capacitaciones@`).
- **Bandeja de entrada — quién publica (04/09/2026)**: en el **Tablero** y en los **avisos**
  de la campana solo escriben los mails de `PUBLICAN_TABLERO` (`index.html` raíz:
  julian@, cristian.campion@ y rrhh@; helper `puedePublicarTablero`). El resto lee el
  tablero, ve una nota y usa Directos. Es «por ahora»: para abrirlo, sumar mails a la
  lista. Los módulos que publican avisos solos (reporte semanal de equipo/, Academia) no
  pasan por ese filtro. La base `mensajes-mateu` se **reinició** ese día (tablero, directos,
  avisos y lecturas borrados; respaldo en `Descargas/respaldo-mensajes-mateu-2026-09-04.json`).
- **Diseño de la Bandeja (05/09/2026)**: pestañas segmented; el **Tablero es un muro**
  (tarjetas `.post` más nuevo arriba, avatar con iniciales `avatarHtml`, etiqueta del autor
  `ETIQ_AUTOR` —Gerencia/Supervisor/RRHH—, chip de destino, «nuevo» = posterior a la
  última lectura; la caja de publicar `.tb-compose` elige destinatarios con **chips**
  `MSG_DEST` + select para sumar una sucursal/outlet puntual). **Directos** es una sola
  tarjeta `.dm-wrap` con lista (avatar, hora, no leídos) + conversación con separadores
  por día (`diaEtiqueta`) y textarea que crece (`autoGrow`). Horas en 24 hs (`fechaBonita`).
- El acceso a localStorage está envuelto en try/catch para no romper en
  previews sin storage. Mantener ese patrón.
- **Bloqueo por inactividad (04/09/2026, `shared/bloqueo.js`)**: las cuentas de encargado
  (roles `sucursal`/`outlet`) que pasan **5 minutos** sin actividad en cualquier módulo ven
  una cortina navy y tienen que ingresar el PIN de la cuenta para seguir (la sesión no se
  cierra; lo que estaban haciendo queda igual). `header.js` lo carga solo en todos los
  módulos con header unificado; el Portal e Indicadores lo incluyen con una línea en el
  `<head>`. Última actividad y estado bloqueado en localStorage (`mateu_bloqueo_act` /
  `mateu_bloqueo_lock`, compartidos entre pestañas; el Portal los limpia al entrar/salir).
  PIN validado contra `usuarios/<mail>` como el login. Minutos y roles se cambian en las
  constantes del script o con `window.MATEU_BLOQUEO = {minutos, roles}` antes de cargarlo.
  `puesto`, `deposito` y gerencia no se bloquean.

## Branding / design tokens

Paleta Mateu Sports: **navy `#0B1527`**, **rojo `#CC0000`**, blanco, fondo
`#f5f7fc`. Tipografías: **Bebas Neue** (display), **Barlow Condensed**
(subtítulos/labels), **Barlow** (texto). Estética: minimalista, alta densidad
de información, limpia. Header navy con borde inferior rojo de 3px.

Nota: `condiciones/` es más viejo y usa navy `#002366` + fuente Inter. Si se
rediseña, alinear a los tokens de arriba; si no, dejarlo como está.

## Reporte Mensual de stock — presentación pública

La presentación del mes (`gestion-stock/?pres=YYYY-MM`, deck generado desde
`gestionStock/<ym>` de Firebase) es **pública**: no pide sesión del Portal
(pedido de Juli 03/09/2026: David comparte el link con gente que todavía no
tiene usuario). En `init()` el chequeo de `?pres=` va ANTES del gate de sesión;
el resto del módulo sigue gateado. El deck solo muestra agregados del mes.

**Diseño del deck (03/09/2026, `gsPresHtml` + `gsPresTot`):** **todo en claro, portada
incluida** (04/09, pedido de Juli: se probó navy, carbón y tapa navy + cuerpo claro; quedó
unificado en claro, mismo fondo `#f5f7fc` del portal): tarjetas blancas, texto navy, cabeceras
de tabla en dos filas (indicador + unidad) y totales **neutros** (gris, sin navy ni rojo), logo
en oscuro. **Sellos Mateu** tipo certificado (`sello()`: SVG con anillo de texto) en la portada
(logo + «datos certificados» + fecha de carga), en cada bloque (con su número) y en el pie.
Tablas sin barras dentro de las celdas; los chips de variación llevan signo («▲ +55» /
«▼ −115») y cada tabla cierra con la leyenda de lectura (`tblLegend`). En Indicadores, la
tabla **«Discontinuos mes a mes»** (`discMM`: una columna por informe cargado, celda
sombreada por magnitud, «Repite N de M» y punto rojo para las sucursales con discontinuos en
todos los informes; `gsPresTot` expone `disc` por slug).
**Variación del ratio (06/09, pedido de Producto):** en «Meses de stock» cada ratio lleva
al lado el chip `msVar` con la variación % vs. el mes anterior cargado («▲ +12%» / «▼ −8%»,
columna «vs. Jul 26» en la tabla, total y «Cobertura total» del rubro). El color NO sigue la
regla «más = peor»: verde si se acercó al rango saludable (3 a 5), rojo si se alejó, gris si
se movió dentro del rango o no cambió; sin mes anterior sale «—». El ratio por sucursal del
mes previo viaja en `gsPresTot(...).msSuc[rubro][slug]` (el `hist` de las sparklines).
**Foco del mes (06/09, pedido de Juli): el Reporte Mensual es la base de trabajo de Daniel
y David.** `shared/foco-stock.js` (`window.FocoStock`, se incluye SIN `defer`) calcula desde
`mesesStock` del mes + los ratios del anterior, con las reglas del deck (< 3 riesgo · 3 a 5
saludable · ≥ 6 exceso; el Depósito se excluye): por rubro, **Achicar stock** (≥ 6, con las
unidades por encima de 6 meses de venta), **Reponer** (< 3, con lo que falta para 3 meses) y
**Vigilar** (en rango pero pegada al borde y moviéndose para el lado malo). Operadores fijos en
`OPERADORES`: Daniel → calzado; David → indumentaria + accesorios. Se ve en dos lugares:
(1) el deck, bloque `.foco` al pie de cada rubro (`focoHtml`), de solo lectura; (2) **`equipo/`
(la pantalla inicial de `producto@`)**, sección «Foco del mes» arriba del Dashboard
(`cargarFocoMes`/`renderFocoMes`: baja el último `gestionStock/<ym>/mesesStock` y el anterior),
una tarjeta por operador con **checklist** (✓ trabajada + ✎ nota) y progreso «N/M trabajadas».
El checklist se comparte en `turnero-mateu/equipo/foco/<ym>/<rubro>__<slug>` =
`{hecho, nota, por, ts}`. El generador `scripts/gen-presentacion-stock.js` carga el helper
antes del script del módulo.
**Regla de color (04/09):** navy = magnitud (barras Top 5, barras bajo los números, stock
apilado navy+acero, óptimo/saludable), **rojo solo alerta** (crítico, exceso, ▲ empeoró),
ámbar la zona intermedia y un verde apagado únicamente en ▼ mejoró. Clase `.f-nav` para las
barras de magnitud;
números en Saira itálica 800 (la tipografía «rendimiento» del módulo), KPIs con
conteo animado, delta ▲/▼ (más = peor, rojo) y **sparkline de los últimos 6 meses
cargados** (`gsRenderPresentacion` baja los meses anteriores para la tendencia);
paneles «Top 5» por indicador; tablas con barra proporcional al máximo de la columna
y chips de variación; horas de descarga con guías de 55/80 hs y promedio; meses de
stock como gráfico de zonas (escala 0–12, flecha si se pasa) + tabla. Animaciones
por IntersectionObserver con fallback (Win7) y `prefers-reduced-motion`; imprime
con todo visible. Para probar el diseño sin navegador ni sesión:
`node scripts/gen-presentacion-stock.js 2026-09 salida.html` (ejecuta el script del
módulo con un DOM simulado y datos reales de Firebase).

## Presentación de regalías — publicar en Cloudflare (`regalias/`, 10/09/2026)

La presentación del mes se comparte por link desde un **proyecto aparte de Cloudflare Pages por
subida directa**, `regalias-ruge-mateu` → https://regalias-ruge-mateu.pages.dev. **NO se commitea al
portal**: el repo `julianmatts/mateu-sports-portal` es público y la presentación es confidencial
(Netlify quedó sin créditos, por eso no se usa). En el paso ⑦, además de «Generar presentación
(.html)» (para verla local), está **«☁ Publicar en Cloudflare»** (`publicarPresentacion`): en el
mismo clic abre `CF_PAGES_DASH` (`dash.cloudflare.com/?to=/:account/pages/view/<proyecto>`, sin ID de
cuenta en el código) y baja `regalias-<mes>-<año>.zip` con la presentación como `index.html` (el
navegador no puede bajar una carpeta y Pages acepta un único zip; `zipUnArchivo` + `crc32` = zip sin
comprimir, sin librería). El panel `#pubPasos` indica Create deployment → soltar el zip → Save and
Deploy, con «Copiar link». Publicar un mes reemplaza al anterior (el link es uno solo).

## Entregas EDLP (pestaña de `regalias/`, 06/09/2026)

Digitaliza el Excel «RUGE 2026 – Seguimiento de Entregas por Canal» de Juli (carpeta
`Desktop/EDLP 2026/Control Entregas EDLP 2026- Segumiento por Canal/`). El módulo
`regalias/` tiene ahora **dos pestañas** (`.mtabs`, sticky bajo el header): «⚽ Liquidación de
regalías» (todo lo de siempre, envuelto en `#vistaLiq`) y «📦 Entregas EDLP» (`#vistaEnt`;
link directo `regalias/?tab=entregas`; la última pestaña queda en localStorage `regalias_tab`).
Código en el mismo `index.html`, bloque «ENTREGAS EDLP» (funciones con prefijo `en`).

- **Modelo**: `articulos/<id>` = maestro de la temporada (código, artículo, color, género,
  silueta, origen, proveedor, línea, `oc:{'2026-01':n}` = orden de compra por mes,
  `pedido:{spf,tp,plantel,fem,res,juv,prot}`, `noSuma` (las medias tubo del Excel:
  «NO SUMA UNIDADES»), `nota`, `orden`, `nuevo`). La **ENTREGA no se tipea**: es la suma de
  `entregas/<id>` = movimientos `{art, canal, codigo, cant, comprobante, fecha, nota, origen:
  excel|import|acum|manual, por, ts, archivo}`. Resta = pedido − entrega (negativa = se
  entregó de más). `id` del artículo = código (`RUG858`); sin código → `X-<slug del nombre>`.
- **Canales** (`EN_CANALES`): Mayoristas = SuperFútbol (`spf`) y TiendaPincha (`tp`); Contrato
  = Plantel Prof. (`plantel`), Femenino (`fem`), Reserva (`res`), Juvenil (`juv`), Protocolo
  (`prot`). `EN_ALIAS` traduce lo que dice el sistema (categoría del remito «FUTBOL
  PROFESIONAL»/«FPF», «FF», «FJ»… o el cliente «SUPERFUTBOL S.R.L.-…») a canal; PRENSA /
  FOTOGRAFÍA no tienen canal (se eligen a mano o quedan afuera, como en el Excel).
- **Vistas**: Resumen (KPI por canal = hoja RESUMEN ENTREGAS, pendientes y últimas entregas),
  Control general (grilla artículo × canal Pedido | Entrega | Resta, **pedido editable en la
  celda**, clic en Entrega = detalle/alta, filtro por línea/canal/estado, «Ver OC por mes»,
  ⇩ Excel), Por canal (= hojas «ANÁLISIS <canal>»: KPIs + apertura por línea con estado),
  Entregas (ledger: **⇧ Importar del sistema** / + Cargar a mano / ✎ ✕) y Artículos y OC
  (maestro + **⇧ Importar el Excel de seguimiento**, que lee la hoja CONTROL GENERAL y
  actualiza artículos/OC/pedidos sin pisar entregas; opción de cargar la columna ENTREGA como
  saldo inicial solo donde no hay nada).
- **Importar del sistema** (`enDetectarEntregas`): detecta por contenido columna(s) de código
  `RUGnnn`, cantidad, comprobante (`Rem.`/`Fc.`), categoría/cliente (con arrastre hacia abajo
  en pivots) y descripción; soporta el export de remitos (Categoría · Nro comprobante · Código
  · Cantidad), el listado Cliente · Artículo · Código · Cantidad y los pivots por cliente
  (varios bloques por hoja, cada uno con su cliente arriba). **Dedupe** por canal+comprobante+
  código. Check «El archivo trae el acumulado a la fecha» (auto si no hay comprobante y dice
  «Suma de…»): carga solo la **diferencia** contra lo ya entregado (así se replica el VLOOKUP
  al pivot de MAYORISTAS del Excel sin duplicar). Códigos desconocidos crean el artículo
  marcado «NUEVO».
- **Firebase**: reusa `recepciones-mateu`, nodo aparte `entregasEdlp/<temporada>/`
  (`EN_DB` + `enNodo()`; temporada = `CONFIG.temporadaVigente`). Sembrado el 06/09/2026 desde
  el Excel «al 03-06-26»: 92 artículos, 241 entregas como «Saldo inicial · Excel de
  seguimiento» (fecha 29/06/2026); totales validados exactos contra el Excel (25.152 pedido /
  21.297 entregado). La fila duplicada «calzas cortas arquero 3» del Excel se cargó como
  «calza larga arquero 3».
- **Clientes del sistema (Juli, 09/09/2026 — no confundir)**: `SUPERFUTBOL S.R.L.-30709250716` es
  **«Pincha Store»**, el local físico del estadio (otro cliente) → canal `spf`; `CLUB ESTUDIANTES DE
  LA PLATA.-30528412285` es **«Tienda Pincha»**, la web de venta del club → canal `tp`; `CLUB
  ESTUDIANTES RUGE CONTRATO.-88888888` es el cliente con el que se remiten las entregas por contrato,
  **sin discriminar disciplina**. Los nombres de los canales en pantalla ya son esos (`EN_CANALES`
  lleva `cliente`); en el código los ids `spf`/`tp` no cambian.
- **Mapa remito → disciplina** (`entregasEdlp/<temporada>/remitos/<nro corto>` = `{canal, origen:
  drive|excel|manual, por, ts, nota}`; `canal:'x'` = fuera del control: prensa, fotografía, RRHH):
  resuelve la disciplina de cada remito del cliente del contrato. Fuente humana: el Drive «REMITOS
  ENTREGAS CONTRATOS RUGE 2026 → CONTRATO PROFESIONAL → <disciplina>» donde el depósito sube el
  remito firmado con el archivo nombrado por el número (`54096.jpg` = Rem.0094-00054096;
  `enNroRem` saca el número corto sin ceros). ⚠ **La lista de Drive se carga por partes al scrollear**:
  la primera lectura (09/09 mediodía) vio solo 27 de los 53 archivos de Fútbol Profesional; la
  relectura completa (09/09 noche, `tr[role=row][data-id]` + scroll de a 250 px) confirmó los 24
  remitos que había tomado del Excel y sumó la NcI 6708 → Plantel, 53920 (no está en el reporte) y
  54064 → carpeta «Campaña socios» = `x` (fuera del control, 50 RUG858 de julio). Mapa al 09/09/2026:
  Fútbol Profesional 52, Femenino 11, Reserva 11, Juvenil 5 (+ 53922 a mano, camisetas RUG259/261),
  Protocolo 3, **Prensa y fotografía** (`prensa`: 53866 + 53880) y **Campaña socios** (`socios`:
  54064): estas dos son disciplinas del contrato desde el 09/09/2026 (pedido de Juli, como Protocolo),
  así que `x` queda solo para lo que de verdad no entra (RRHH). Con eso el contrato concilia EXACTO
  con la estadística de ventas: 13.255 brutas.
- **Desborde entre renglones del contrato (regla de Juli 09/09/2026 para las medias)**: un renglón
  con `tomaDe:<id>` + `tomaArts:[…]` se llena primero, hasta su `cantidad`, con las unidades de esos
  artículos del otro renglón; el excedente queda en el origen (`enCalcContrato`, en orden de
  `orden`; la tabla muestra «← se completa con … · tomó N» y «→ cedió N»). Hoy: «media» y «media 2»
  (300 c/u) toman de «medias entrenamiento» (arts RUG942 + RUG943 + RUG533 pico) solo las comunes
  RUG942/943; la pico RUG533 solo cuenta como entrenamiento; las tubo (`noSuma`) no cuentan nunca.
  Se edita en el ✎ del renglón («Se completa con el excedente de otro renglón»). La misma regla
  existe **por artículo** para el control general / por canal (`enCalc`, campo `tomaDe:[ids]` del
  artículo, editable en el ✎ como «Se completa con la entrega de…»): la media de juego no existe como
  código (`X-MEDIA-…-HOME/AWAY`, nota «= media entrenamiento + tubo»), así que se completa canal por
  canal hasta su pedido con RUG943 / RUG942 y el excedente queda en la media de entrenamiento; las
  celdas muestran ↙N (tomó) / ↗N (cedió) y el detalle lo aclara. Las medias tubo figuran como
  constancia (cantidades por disciplina, en cursiva) sin sumar: bloque «MEDIAS TUBO» al pie de la
  tabla del contrato y filas `noSuma` en control general / por canal.
- «Por canal» lista todo lo que tiene pedido **o entrega** en el canal (los «sin pedido» también,
  p.ej. 2 manga larga + 2 crop en Protocolo), así el total de la tabla cierra con la tarjeta; se
  quitó el tilde «Solo artículos con pedido». `#vistaEnt.wrap` va a todo el ancho de la pantalla. Se edita en Entregas →
  **«🗂 Remitos → disciplina»** (`enModalRemitos`: cambiar la disciplina reescribe las entregas ya
  cargadas de ese remito; «fuera del control» las saca) y en la propia importación (elegir la
  disciplina en una fila la copia a las demás filas del mismo remito y queda guardada).
- **Reporte de ventas por cliente** («Reporte ventas ruge mayorista y contrato 2026.xlsx»: Cliente ·
  Día · Rubro · Nro.comprobante · Artículo · Código barras · una columna «Mes Cant.» + «Mes Imp.» por
  mes): el detector lo reconoce por la fila con ≥2 encabezados «… Cant.» (`mesCols`, `det.mensual`)
  y genera **un movimiento por mes** con `ym` y `fecha` = mes + Día; el cliente manda el canal
  (`EN_ALIAS` incluye los CUIT) y las filas del contrato pasan por el mapa. Las **variantes** de código
  (`RUG858SS`, `RUG844A`) suman al artículo base con nota «variante …» (check en la importación;
  desmarcado crean artículo). Las NcA/NcI vienen con cantidad negativa y entran como devolución.
  **El 09/09/2026 se reemplazó el saldo inicial del Excel por el reporte completo** (429 movimientos,
  24.291 u.; respaldo del saldo en el `seed-entregas-2026.json` de la sesión del 06/09): SuperFútbol
  4.019, Tienda Pincha 7.628, Plantel 9.013, Femenino 771, Reserva 648, Juvenil 975, Protocolo 154.
  Quedaron sin disciplina el remito 54064 (jul, 50 RUG858) y la NcI 6708 (−12 RUG887): la importación
  los vuelve a mostrar hasta que Juli los asigne. **Conciliación 09/09/2026 (tarde)**: mayoristas exactos
  (4.019 / 7.628); contrato 13.200 = 13.255 del reporte − 17 (prensa 53866 + fotografía 53880, fuera
  del control) − 38 (54064 y NcI 6708 sin disciplina). Ojo: `RX_COD` acepta hasta 3 letras al final
  (`RUG858SS` = sin sponsor, Femenino/Reserva); con `[A-Z]?` esos 35 renglones (556 u.) no entraban. 15 códigos del reporte no estaban en el maestro
  (RUG944–948, 957–959, 974/975, 464/466, 533, 601, 796) y se crearon marcados «NUEVO».
- **Vista «📜 Contrato» (09/09/2026)**: cruza el contrato oficial con lo entregado. **El contrato
  oficial es la «PROPUESTA DE SPONSOR TÉCNICO EdeLP – MATEU 2025 (07.10.2024)»** (docx en
  Descargas; cláusula 6.1: **13.000 prendas anuales sin cargo** según el ANEXO I = 50 renglones
  Tipo · Producto · Cantidad: Juego / Tiempo Libre / Entrenamiento). ⚠ No confundir con el
  «CONTRATO PERTENENCIA SPONSORIZACION» (PDF escaneado, deporte amateur y colegio: 2.094 prendas +
  425 medias) ni con el anexo «Pedido CONTRATO EDLP 2026 - ANEXO prop inicial y devolución
  martín» (13.162 / 12.102: negociación por disciplina, no el contrato). Firebase
  `entregasEdlp/<temporada>/contrato` = `{fuente, total, items:{<id>:{orden, tipo, producto,
  cantidad, arts:[ids de artículo]}}}`, sembrado el 09/09/2026 con el anexo y un **mapeo
  producto → códigos RUG hecho por nombre** (p.ej. «camiseta home» = RUG858 + RUG974 + RUG975;
  «media» = medias home + RUG950; gorro, chinelas, guantes, cuellos, botineros, socks y térmicas
  cortas sin artículo). `enCalcContrato`: entregado = todo lo que salió a las 5 disciplinas del
  contrato en el año (por `fecha`; **excluye** los artículos `noSuma` = medias tubo RUG949/950/957/958/959:
  regla de Juli 09/09/2026, la tubo es la pantorrillera que completa la media de juego = media
  entrenamiento + tubo, así que el renglón «media» del anexo se cumple con RUG943 y «media 2» con
  RUG942), por renglón y por disciplina; lo entregado sin renglón se lista abajo con un select
  para asignarlo (juveniles «pertenencia» RUG259/261/464/466/250/796 y kids quedan ahí).
  ✎ por renglón (`enModalContratoItem`: cantidad, tipo, producto y checklist de artículos, avisa
  si ya está en otro renglón), «+ Renglón», «⇩ Excel» (`enExportarContrato`). Al 09/09/2026:
  12.644 entregadas (11.902 en renglones + 742 fuera del anexo) = 97,3 %.
- **Criterio de Juli (09/09/2026) para leer el cruce**: el ANEXO I es un marco para dar orden; lo
  que manda es el total de **13.000 prendas anuales**, y el reparto por renglón varía según el uso
  de la temporada. Mientras el total no llegue a 13.000, las entregas siguen por contrato aunque un
  renglón esté pasado (p.ej. camiseta home) y otros con faltante. No plantear cada excedente por
  renglón como «se factura»: la cláusula 8.4 se aplica al total. Las medias comunes son un solo
  artículo para juego y entrenamiento (no hay «de más» real ahí); «mochilas» del anexo = solo RUG845
  (bolsos y morrales van sin renglón).
- Pendiente/no digitalizado: el corte S1/S2 (ene-jun / jul-ago) de las hojas ANÁLISIS
  SUPERFUTBOL/TIENDAPINCHA (el pedido es un solo número por canal).

## Meses de Stock — cómo regenerar `datos-meses-stock.js` desde el Excel

El dashboard de Meses de Stock (`gestion-stock/`) no lee el Excel: lee
`gestion-stock/datos-meses-stock.js`, que se genera desde el reporte
`RATIO <año> ok.xlsx` (hoja "Ratios", ~115k filas, columnas
Año/Mes/Sucursal/Rubro/Marca/Segmento/Stock/Ventas/Ratio + Comentarios Encargados
+ Comentarios Área de Producto).

**Carga mensual (lo habitual desde 08/2026):** Juli sube el export mensual del
sistema tal cual (p.ej. `RATIO JULIO.xls`, formato jerárquico con filas de
totales y columna `Vtas.cant.`) en la pantalla «Actualizar datos» del módulo:
el uploader lo detecta solo, lo parsea con las reglas del generador y **fusiona**
el mes nuevo con los ya publicados (no los pisa). El lector es tolerante (08/09/2026):
busca los encabezados en **cualquier hoja** y en las **primeras 30 filas**, compara los
nombres de columna sin puntos ni espacios (`Vtas.cant.` = `Vtas. Cant.` = `Ventas`), y si
el archivo no trae columna **MES** lo deduce del nombre («RATIO AGOSTO.xls», `msMesDeNombre`).
⚠️ **El sistema cambia los encabezados de un mes al otro.** Julio vino
`Mes · Sucursal · Rubro · Marca · SEGMENTO · Stock · Vtas.cant. · ratio` y agosto
`Año · Mes · Sucursal · Rubro · MARCA · SubRub · Stock · Ventas · Ratio`: el segmento pasó a
llamarse **SubRub** y apareció una columna **Año**. Sin reconocer el segmento, el archivo NO se
detecta como jerárquico, cae al lector plano y ahí el daño es silencioso: suma las filas de
totales con las de detalle (stock ~3× inflado), inventa la marca «Total» y **no fusiona** —
publicar eso borraba ene–jul. Por eso `seg` acepta `SEGMENTO`/`SUBRUB`/`SUBRUBRO` y, si viene
columna `AÑO`, ese año manda sobre el del campo de la pantalla. **Y para que el próximo rename no
vuelva a depender de un programador (09/09/2026):** si ningún alias pega, la columna de segmento se
busca **por contenido** — la columna de texto, con pocos valores distintos, que trae la fila «Total»
de cada marca (lo avisa en el resumen); y si aun así no aparece pero el archivo TIENE filas de
totales, la carga **se frena con un error** en vez de leerse plana. Ojo: las filas «Total» están al
FINAL del archivo, así que esas dos búsquedas recorren todas las filas, no las primeras N.
Cuando no encuentra los encabezados, el error **lista las hojas y los encabezados que leyó**
en vez de un mensaje genérico. ⚠️ El export tiene que traer el **mes completo con todos los
rubros**: si sube uno solo (p.ej. el de Calzado), los demás quedan sin ese mes y figuran «sin
dato» — el resumen de la carga lo avisa en ámbar. Publica con el botón
**«Publicar al portal»**: commitea `datos-meses-stock.js` a `main` y Cloudflare deploya solo.
Plan B: descargar el `.js`, reemplazar y push a mano.

**Quién puede publicar (09/09/2026, pedido de Juli: «que Daniel pueda cargarlo todos los meses
sin mi confirmación»).** El commit lo hace la Pages Function **`functions/api/publicar-stock.js`**
con un token de GitHub que vive **en Cloudflare**, no en el navegador:
- `GET /api/publicar-stock` → `{disponible, quienes}`; el módulo lo consulta al abrir
  «Actualizar datos» (`msCargarPubApi`) y muestra el botón si el mail de la sesión está en la
  lista (`msPuedePublicarServidor`).
- `POST` con el `.js` **ya en base64 como cuerpo de texto plano** y los datos chicos en headers
  (`X-Mateu-Email`, `X-Mateu-Pin`, `X-Mateu-Meta`). Va así a propósito: el dataset pesa ~3 MB
  (4 MB en base64) y hacerle `JSON.parse` + base64 dentro de la Function quemaría el CPU;
  la Function solo lo revisa y lo reenvía (el cuerpo de GitHub se arma concatenando, después de
  validar que el base64 no tenga caracteres raros).
- El endpoint es público, así que el permiso se valida ahí: **mail en la lista + PIN correcto**
  contra `discontinuos-mateu/usuarios` (mismo criterio que el login), y solo se puede escribir
  ESE archivo y solo si empieza con `window.STOCK_DATA = {`. El token nunca baja al navegador.
- **`GITHUB_TOKEN` configurado el 11/09/2026** en el proyecto **Pages** `mateu-sports-portal` (el de
  `mateu-sports-portal.pages.dev`) → Settings → Variables and Secrets, como *Secret*, vence el
  **11/09/2027** — fine-grained, acceso SOLO a `mateu-sports-portal`, permiso «Contents: Read and
  write». Un secreto nuevo toma efecto recién en el deploy siguiente (Deployments → ⋯ → Retry
  deployment); se verifica con `GET /api/publicar-stock` → `"disponible":true`.
  ⚠️ En «Workers & Pages» hay además un **Worker con el mismo nombre** (solo archivos estáticos,
  con «Latest build failed»): NO es el que publica el sitio y ahí no se pueden cargar variables. Opcional `PUBLICAN_STOCK` (mails separados por coma; por defecto
  `julian@mateu.com.ar,producto@mateu.com.ar` — `producto@` es la cuenta de Daniel y David).
  ⚠️ Los tokens fine-grained **caducan**: cuando pase, la Function devuelve «GitHub rechazó el
  token del servidor» y hay que renovarlo en Cloudflare.
- **Respaldo**: sin `GITHUB_TOKEN` configurado, `disponible:false` y el módulo cae al camino
  viejo (token fine-grained en localStorage `gs_github_token` del navegador de Juli). Sin
  ninguno de los dos NO se muestra el botón: aparece una nota que deja «Descargar
  datos-meses-stock.js» como acción principal y el link «Tengo el token…». Antes salía un
  `prompt()` pidiendo un token de GitHub a quien no lo tenía — ese era el «error» que reportaba
  Daniel el 08/09/2026 y por el que agosto nunca se publicó.

**Forma correcta de regenerar el año completo — usar el generador:**

```
node gestion-stock/generar-datos-meses-stock.js "ruta/RATIO 2026 ok.xlsx" 2026
```

Es self-contained (solo `fs`+`zlib`, sin npm) y aplica el mapeo correcto. Después:
commit + push. Solo si hay que hacerlo a mano (o tocar el generador), seguir estas
reglas **exactas** (un intento previo dividió las marcas por 2 → stock a la mitad;
NO repetir):

- **`rubro.serie[mes]`** = fila `Marca="Total", Segmento="Total"` de ese
  sucursal/rubro/mes. Es el total real del rubro. **Tal cual, sin dividir.**
- **`marca.serie[mes]`** = fila `Marca=<marca>, Segmento="Total"` (= suma de sus
  segmentos). **Tal cual, sin dividir por 2.** ⚠️ Acá estuvo el bug.
- **`segmentos[SEG].serie[mes]`** = fila `Marca=<marca>, Segmento=<SEG>` (SEG ≠
  "Total"). El agregado top-level `{stock,ventas,ratio}` del segmento = su serie
  del **último mes**.
- **`suc.serie[mes]`** = Σ `rubro.serie` de todos los rubros de la sucursal.
- **NO** crear la pseudo-marca `"Total"` como si fuera una marca. Excluir de col C
  las filas basura `"Total"` y `"Sucursal"`.
- **Comentarios** (`STOCK_COMMENTS`): una entrada por fila con col J (Encargados)
  no vacía → `texto`; si además tiene col K (Área Producto) → `respuesta` +
  `estado:"resuelto"`; `id` secuencial 0..N.
- PRODUCTO es un rubro raro (las "marcas" son tipos de producto, sin fila Total,
  segmentos que sobre-suman) y está excluido de los KPIs; dejarlo como el archivo
  actual salvo pedido.

`msCorregirDatos()` en el `index.html` es una red de seguridad: si un `.js` viene
crudo (con la marca "Total"), duplica las marcas al vuelo. Si se genera bien
siguiendo lo de arriba, no hace falta que actúe. Ver memoria
`meses-stock-marcas-mitad`.

## Indicadores de Sucursal — datos y seguridad

**Nombre visible (21/08/2026):** el módulo se llama **«Mi Sucursal»** para los roles
`sucursal`/`outlet` y **«Panel General»** para gerencia (admin/supervisor). El nombre se
resuelve en el render según `session.rol` en los cuatro lugares: `nombreTool()` del Portal,
el drawer de `shared/header.js`, `nombreModulo()` en `indicadores/` (drawer + `<title>`) y
`shared/tutorial.js`. En el código y en este archivo se sigue hablando de "Indicadores".
Ícono del módulo: `🏪` (frente de local). Si la sucursal no tiene datos (sin entrada en
`SLUG_SUC`), el chip y el drawer muestran el slug embellecido (`nombreBonito`: "diagonal"
→ "Diagonal"; lo mismo hace `header.js`). Los dos drawers (Indicadores y `header.js`)
tienen un ítem fijo **«📬 Bandeja de mensajes»** → `../?ver=bandeja` (es la única vía de
las sucursales a la Bandeja, porque no ven la grilla del Portal). El botón «?» del tutorial
se corre a `bottom:92px` cuando la pantalla tiene la campana `#notifWidget`, para no taparla.
El toast de un aviso/mensaje nuevo (`.notif-toast`, Portal e Indicadores) sale de la campana
**hacia la izquierda**, a su altura (con puntita), no hacia arriba. En el Portal, «← Volver» de
la Bandeja y el clic en el logo del header (`#topLogo`) llevan a `./indicadores/` (Mi Sucursal /
Panel General) para sucursal/outlet y siempre que se llegó con `?ver=bandeja`; para admin en
la grilla, vuelven a la grilla (`volverAlInicio()`).

**Dos zonas (23/08/2026).** La pantalla (Mi Sucursal y Cadena) está partida en dos bandas
con cabecera propia, para que no se mezclen las dos líneas de tiempo: **«En curso»**
(banda azul intenso `#zonaViva` / `#zonaVivaCad` — tokens `--vivo*` —, pill «● provisorio»: Objetivo del mes, Objetivo
de la semana + equipo, **Indicadores de la semana** y Reposición — todo Firebase, mes/semana
abiertos) y **«Cierre»** (`#zonaCierre` / `#zonaCierreCad`, pill «✓ oficial»: los cuatro
indicadores con el switch Mes/Sem 1…4 y todo el análisis del último mes cerrado — JSON del
ETL). El **selector de período vive en la cabecera de Cierre** (`#selPer` se mueve al
`#selPerHost` de la vista activa en `pintarZonas()`), no en la barra global.
**Pestañas (29/08/2026, reemplazan al nav «Ir a»):** se ve **UNA zona por vez** con el
segmented `.zona-tabs` («● En curso · provisorio» azul / «✓ Cierre · oficial» navy;
sticky arriba en Mi Sucursal; en Cadena va PRIMERO en la rk-bar — pestaña → Línea → KPI,
y el grupo KPI solo se muestra en Cierre porque únicamente filtra el ranking). `setZonaTab()` guarda
la elección en localStorage `ind_zona_tab` (default: En curso) y `pintarZonas()` aplica
el display de las zonas + el estado `.on`; sin secciones vivas (Ecommerce) se fuerza
Cierre y la pestaña viva se oculta. La **impresión/PDF saca las dos zonas juntas** igual
(`@media print` fuerza `display:block`, salvo `.zona.z-empty`). La mini-barra `#kpiBar`
lee la grilla de la pestaña activa (`kpiBarGrid`: En curso → `#kpisSem`/`#kpisSemCad`
con contexto «Sem N · provisorio»; Cierre → `#kpis`/`#kpisCad`). En Cadena, la sección
«Indicadores de la semana» (`#kpisSemCadBox`, la pinta `pintarKpisSemCad`
desde `pintarObjCad`) agrega los cuatro KPIs de la semana a la línea filtrada
(numeradores/denominadores sumados; UPT y ticket prom. en la pasada 1, tickets/venta
por hora con las horas asignadas de los equipos en la pasada 2) vs. el mes cerrado —
las ex cajitas «UPT semana / Ticket prom. / Tickets/h» de la tarjeta del objetivo,
que ahora solo conserva Mínimo y ★ 120%.
**Cierre de Cadena con análisis (29/08/2026):** además de KPIs generales / Ranking /
Comparación, el Cierre de la vista Cadena suma la tarjeta **«Venta neta»** del mes
(`cadAggFiltrada` ahora devuelve `venta`; sparkline con `serieCadena('venta')`),
**«La venta semana a semana»** agregada (`renderSemCad`, suma las `semanas` de
`cadena.json`; sin el filtro por semana de la vista sucursal) y **«Cobertura vs.
demanda» + «Tickets por hora y día»** agregados (`renderAnalisisCad`: baja el detalle
de cada sucursal de la línea — cacheado, solo gerencia — y suma las curvas horarias;
el gráfico de cobertura se compartió en `covChart()`). Todo respeta el filtro por
línea (los chips repintan también estas secciones) y excluye Ecommerce, como los
KPIs generales.
`pintarZonas()` pone las fechas en los títulos (`_zonaSem`/`_zonaMes`, que setean
`renderObjetivo` / `renderObjCadena` / `objetivoMesHtml`).
Regla: todo número vivo lleva el pill `.pprov`; los cerrados, nunca.
**Disposición canónica (30/08/2026, pedido de Juli — las cuatro vistas alineadas):**
En curso (sucursal y Cadena): Objetivo del mes → Indicadores del mes en curso
(`#puenteBox` / `#puenteBoxCad`, secciones `.sec-cont`) → Objetivo de la semana →
Indicadores de la semana (`#kpisSemBox` / `#kpisSemCadBox`, `.sec-cont`) → operativas
(sucursal: F8 para armar + Reposición; Cadena: F8 control). Cierre (ambas): **Objetivo
del mes cerrado** (`secObjMesCierre`/`renderObjMesCierre` con la meta de
`objetivos/meses` vs. la venta neta oficial; en Cadena `secObjMesCadCierre`/
`renderObjMesCadCierre`, mismo universo meta↔venta por línea) → KPIs → **La venta
semana a semana** (subida al 3.º lugar en sucursal, decisión A1) → el resto del
análisis. La **tira resumen se repartió por período**: chip «Mes %» arriba de Objetivo
del mes (`#vivaStripMes[Cad]`), chips Hoy/Semana/Ritmo/UPT/Ticket prom. arriba de
Objetivo de la semana (`#vivaStripSem[Cad]`); el **selector de semana** vive en el
`sec-head` de «Objetivo de la semana» (ya no en la cabecera de la banda). El Cierre de
Cadena suma el **switch «Mes / Sem 1…N»** (`kpiSegCad`/`semSelCad`/`cadSucVista`,
decisión D1: filtra KPIs generales y Comparación; horas del mes repartidas por semana,
banner `#filtroBannerCad`), y la zona viva de Cadena un **insight corto agregado**
(`#diagSemCad` en `pintarKpisSemCad`, decisión E1: % de meta, sucursales en ritmo,
KPI más flojo). «La venta semana a semana» (las dos vistas) muestra el **% vs. la
meta PMS semanal** adentro de cada barra y como columna (`semLunesISO`/`metaSemana`:
lunes desde el rango del ETL + metas de `objetivos/semanas`, cache async). Los F8 de
«F8 para armar» arrancan **cerrados** (sin `open`).
**Análisis del mes EN CURSO (30/08 tarde, pedido de Juli — siempre que haya venta
provisoria cargada):** la zona viva de sucursal suma **«La venta semana a semana»
prov** (`secSemViva`/`renderSemViva`: barras por semana del mes abierto con el % vs.
la meta PMS; pico en azul `--vivo`, ≥2 semanas con venta) y **«Quién vende cada rubro»
prov** (`secRubrosViva`/`renderRubrosViva`: participación+mix acumulados desde los
`rubros` de ventaEquipo; solo CALZADO/INDUMENTARIA/ACCESORIOS). Cobertura, heatmap y
plantilla NO tienen versión viva (no hay dato horario ni dotación hasta el ETL). La
zona viva de Cadena suma el **«Ranking del mes en curso» prov**
(`secRankingViva`/`pintarRankingViva`: un bloque `.rk-kpi` enmarcado por KPI con las
sucursales de la línea, % vs. el objetivo de su formato y **cuántas semanas cargadas
tiene cada una**; usa `_mesCadData`, Ecommerce no rankea); por eso los **chips de KPI
se ven en las dos pestañas** de Cadena (filtran ambos rankings). Estética del ranking
del Cierre: **todos los bloques `.rk-kpi` enmarcados** (borde superior navy; Prioridad
rojo) y los valores `.rk-val` en tipografía «rendimiento» (Saira itálica 800).
**Indicadores de la semana** (`renderKpisSemana`; sección `#kpisSemBox` que desde el
30/08 va **pegada debajo de «Objetivo de la semana»** como continuación — clase
`.sec-cont`, título chico, sin label «Resumen»; lo mismo `#kpisSemCadBox` en Cadena.
Sin venta cargada muestra un empty state en vez de desaparecer. El
acumulado del mes — la ex tabla «El puente», hoy **«Indicadores del mes en curso»,
tarjetas KPI con el mismo formato que las de la semana** (30/08: acumulado, % del
objetivo con semáforo, delta y valor del cerrado, sparkline semana a semana y nota de
horas; la columna «Sem N» de la tabla vieja no se repite porque son las tarjetas de la
semana) — sigue **dentro de «Objetivo del mes»** en `#puenteBox`, y desde el 30/08
**también existe en la vista Cadena** (`#puenteBoxCad`, `cargarMesCad`/`pintarPuenteCad`:
baja ventaEquipo+equipo de cada sucursal por semana de fondo, agrega numeradores y
denominadores por línea filtrada; % del objetivo solo con una línea elegida). El
`#puenteBox` de sucursal suma además el desplegable **«Cómo viene el equipo · mes»**
(acumulado por vendedor de las semanas publicadas: venta, participación, tickets, UPT,
ticket prom., semanas con venta) — SOLO en la vista de una sucursal, no en Cadena
(pedido de Juli: en el agregado se hace eterno)): UPT, ticket promedio,
tickets/hora y venta/hora de la semana elegida con la venta de `ventaEquipo` y las horas
asignadas del equipo (solo los días que ya tienen venta: `eqHorasDias`), cada uno vs. el
objetivo de la línea, vs. el mes cerrado (`kpisCerrado`: con horas asignadas si ese
período tiene equipo guardado; si no, tickets/venta por hora se marcan «no comparable») y
vs. la semana anterior; el acumulado (semana · mes en curso acumulado · mes
cerrado · objetivo) calcula tickets/venta por hora solo con las semanas que
tienen horas (`kpisAcum`), y hay un insight corto de la semana. Los KPIs del mes cerrado
quedan como sección aparte en la zona Cierre. En Cadena, la tabla del objetivo
semanal suma **UPT sem. y Ticket prom. sem.** por sucursal con su % vs. el cierre, y el
agregado de la línea. La Reposición avisa «hace N semanas» si el análisis tiene ≥7 días.
**Afinado 23/08 (tarde):** la cabecera de «En curso» es del **mes abierto** («Agosto 2026 ·
mes abierto») y lleva el **selector de semana** (`#semHost` / `#semHostCad`; lo pinta
`renderObjetivo` / `renderObjCadena`) + una **tira resumen** (`#vivaStrip`, `pintarResumenVivo`
sobre `_resumenVivo`: semana % · ritmo · mes % · UPT · ticket prom.; también va en «⧉ Copiar»
vía `resumenVivoTxt`). **Ritmo esperado** (`ritmoSemana` / `ritmoEsperado`): con la matriz de
pesos turno×día (`fetchEqPesos` en sucursal, `fetchPesosSlug` en Cadena, promedio si no hay)
calcula qué % de la meta «debería» estar vendido con los días cargados; un día sin venta dentro
de lo transcurrido (feriado) sale de la curva; semana completa → `{completa:true}` y no se
muestra. Sale bajo la barra del objetivo semanal (`.ritmo`), en el insight de la semana y como
columna «Ritmo» (+ «✓ completa») en la tabla de Cadena. **Equipo vigente** (`equipoVigente`):
si la semana no tiene equipo con horas, usa el último guardado anterior (nota «equipo de Sem N»)
— así tickets/hora de la semana y de la anterior siempre salen; Cadena suma la columna
«Tickets/h sem.» (delta vs. cierre solo en base «Horas asignadas»). El desplegable «Cómo viene
el equipo» abre solo la primera vez que se ve esa semana (`ind_eq_visto_<slug>|<sem>` en
localStorage; `_eqOpenState` recuerda el toggle dentro de la visita).

`indicadores/` es un `index.html` self-contained que **lee la sesión del Portal**
(no tiene login propio) y es la **pantalla de inicio de los roles `sucursal` y
`outlet`**: el Portal los redirige a `./indicadores/` al entrar (ver
`herramientasEfectivas` + el redirect en `render()` del `index.html` raíz). El rol
`admin` ve el selector de sucursal + la vista "Cadena (comparar todas)".

**Seguridad en la capa de datos, no en el render.** El módulo NO trae un JSON con
las 20 sucursales: pide solo `data/indicadores/<periodo>/<SUCURSAL>.json` (su
sucursal, con personas) + `cadena.json` (agregados de las 20, SIN personas). Así el
navegador de una sucursal nunca se baja las personas de otra. Es seguridad "blanda"
(archivos estáticos en Cloudflare Pages, como el resto del portal): ordena accesos,
no es auth real — un usuario decidido podría pedir otro archivo por URL.

**Cómo regenerar los datos.** El cálculo (UPT, tickets/hora, etc.) vive en
`scripts/etl_indicadores.py`, que lee los Excel de ventas + staff y ya emite tanto
el JSON combinado por período como la **salida particionada** (`out/indicadores/…`):
`objetivos.json`, `periodos.json`, `<periodo>/cadena.json` y un `<periodo>/<NN-Nombre>.json`
por sucursal. Corre en la máquina de Juli (Python 3.12 + pandas instalados 03/08/2026;
también sirve el sandbox); después se copia `out/indicadores/2026-NN/` a `data/indicadores/`
del repo y se agrega el período a mano en `periodos.json` (el ETL solo escribe los períodos
que procesó — los que no tienen archivo se saltean con aviso). Desde julio 2026 el export
de ventas es el Excel **detallado por línea** ("Estadistica de venta - …": 6 columnas base +
Artículo + Rubro + un par Cantidad/Importe por mes calendario; `formato='detallado'` en
`PERIODOS`): se cargan todos los pares y el índice día+día-de-semana deja solo el período
retail (así el 29-30/6 del par de junio entran a julio retail). Aplica los **criterios de
Juli por línea** (`criterio_linea()`: Otros no suma; REDONDEO no; PROMOS/descuentos solo
importe; CREDITO A FAVOR ambos; INGRESO CUPON y LLAVERO COMPRA GRANDE afuera; ENVIO solo
importe) y agrega por comprobante atómico (metadata = línea de mayor importe). ⚠️ El export
consolidado viejo (por comprobante) venía SIN las líneas de promo → importes sin descontar;
`formato='consolidado'` queda soportado pero no usarlo si está el detallado. Staff:
`Sucursales staff.xlsx` en Descargas.
Los objetivos por formato y la regla nombre→formato viven fijos en ese script — NO tocar
el cálculo salvo pedido. Desde el 26/08/2026 el ETL además emite **`rubros`** (venta neta
por CALZADO/INDUMENTARIA/ACCESORIOS/… por vendedor y por sucursal, cada línea atribuida
al vendedor de su comprobante; aditivo, no cambia ningún número): lo consume la sección
**«Quién vende cada rubro»** (`secRubros`/`renderRubros`) del análisis del mes en
`indicadores/` — participación + mix propio por vendedor, referente ★ y sugerencias de
mentoreo (el que domina el rubro le tira tips al que lo tiene flojo). Oculta en Ecommerce
y en períodos sin el dato. Los KPIs usan la tipografía «rendimiento» (Saira itálica 800,
la de meses de stock) con el color del semáforo en el número; al scrollear pasadas
las tarjetas aparece la **mini-barra fija** `#kpiBar` (`kpiBarScroll`, lee las
tarjetas ya renderizadas, clic = volver). Los filtros (mes/sucursal/semana) usan el
**dropdown propio** `dropSel()` (el `<select>` queda oculto como estado y dispara
su `change` normal; `pintarZonas` mueve el wrapper). **Solo Ecommerce y Outlet
Gonnet abren los domingos**: `pesosSinDomingo()` anula el domingo de la matriz de pesos
para el resto (importa con la curva promedio, fallback de Diagonal 80). El objetivo
semanal se abre además **por día** (tira «Objetivo por día» del local con real y % cuando
hay venta diaria, y objetivo diario por vendedor en su desplegable — `eqPesosDia`,
`eqSharesDia`, `objDiasHtml`).

**Regla de calendario del cierre mensual (Juli, 07/09/2026): los totales de venta del MES
van por MES CALENDARIO, tal como se carga el export; el calendario retail queda solo para la
venta SEMANAL.** Los dos criterios no cierran entre sí y por ahora se acepta así. Mayo, junio
y julio 2026 quedaron con el criterio viejo (retail: 27/04–31/05, 01/06–28/06, 29/06–26/07).
**Agosto 2026 (07/09/2026)**: **01/08–31/08**, 26 hábiles; las semanas del mes siguen siendo
retail Lu–Do, así que la 1.ª (01–02/08) y la 6.ª (31/08) quedan parciales. El export del
sistema vino como **CSV** («Ventas agosto portal.csv»: `;`, latin1, una fila de cabecera, UN par
Cantidad/Importe) → `csv=True` en `PERIODOS`. Para completar bordes desde otro archivo existe
`extra_det={archivo, mes, dias}` (no se usa en agosto). `--solo YYYY-MM` procesa un único período (los otros
tardan ~2 min cada uno). Las **altas de mitad de mes** que no están en el staff ni en el
padrón (`ALTAS_MES`) cuentan como vendedores con las horas reales de su venta (franja
diaria, como los eventuales), marcadas `propuesto`. `APERTURAS` (sucursal → fecha de
apertura) prorratea las horas de contrato por los hábiles desde la apertura (Diagonal 80
abrió el 10/08: ×0,60; si no, tickets/hora salía a la mitad). **Diagonal 80 ya tiene datos**: está en
`SLUG_SUC` de Indicadores como `10-MS Diagonal 80` (el nombre del sistema y de Meses de
Stock; `SOLO_OBJ_SUC` quedó vacío); julio y anteriores dan empty state.

Alternativa sin Python (cuando solo se tiene el JSON del ETL, no los Excel):
`node scripts/gen-indicadores.mjs indicadores-2026-05.json indicadores-2026-06.json`
produce exactamente los mismos archivos particionados. Es lo que se usó para poblar el
repo la primera vez.

**Meses de stock** reutiliza `gestion-stock/datos-meses-stock.js` (mismo nombre de
sucursal como clave); no se duplica el dato. Sin dato en el período → empty state.

El mapa slug de Portal → sucursal de datos (`SLUG_SUC` / `OUTLET_SUC` en el módulo)
lo validó Juli (14/07/2026). `diagonal` y `deposito` no tienen datos de venta todavía
→ empty state.

**Plantilla / Dotación**: sección `secPlantilla` del módulo que lista a la gente de
la sucursal por rol y régimen (headcount + FT/PT), desde los `vendedores` del período
(quien registró ventas). **El Buscador de Artículos reutiliza esta misma dotación**:
en su panel de perfiles (encargado/admin) hay "⇩ Importar dotación desde Indicadores",
que lee `data/indicadores/<último-periodo>/<SUC>.json`, mapea grupo→rol de perfil
(Jefatura→encargado, Ventas→vendedor, Caja→cajera, Refuerzos→depósito), excluye
coberturas (cada persona en su sucursal fija) y **REEMPLAZA** `perfiles` de esa
sucursal (pisa avatares/ajustes a mano; lo dispara el encargado). No se duplica el dato.

## Buscador de Artículos (`ubicaciones/`) — carga de stock

«📄 Cargar stock del día» (encargado) acepta **dos modelos de Excel**, autodetectados:

- **Export plano** (una hoja: Código · Descripción · Stock · Ubicación opcional
  «EST n - MOD n» o «En-Mn»): modal de mapeo de columnas (`abrirModalMapeo`).
  Puede venir **SIN fila de encabezados** (el stock pelado de Diagonal: Id.item ·
  SKU · Descripción · Stock): `detectarColumnasDatos` reconoce las columnas por
  contenido (números grandes = Id.item, chicos = stock, texto con espacios =
  descripción, texto corto = SKU), el selector de fila tiene la opción «Sin
  encabezados» y hay columna **Id.item opcional** (→ `articulo`). La carga solo
  actualiza stock/descripción y preserva ubicaciones y lo demás ya asignado.
  ⚠ **La descripción es opcional y solo acepta texto (07/09/2026)**: si no se detecta
  columna, el select queda en «No importar» (antes caía en la col A = Id.item, y en
  Diagonal una carga pisó las 4.341 descripciones con un número; se recuperaron desde
  el export del 24/08 + la planilla de Drive del 27/08 + Calle 49/barrida/maestro adidas).
  `esDescBasura()` descarta descripciones vacías, `#N/A`, iguales al código o numéricas,
  tanto al parsear como al fusionar (`sincronizarStock` conserva la guardada), y la
  previsualización avisa en rojo si la columna elegida no trae texto.
- **Planilla de Drive de la sucursal** (modelo «UBICACION DEPOSITO», el que usa
  Diagonal 80): hojas `UBICACION CALZADO / INDUMENTARIA / ACCESORIOS` (grilla por
  casillero `E#-M#` con columnas UBICACIÓN · Contador · Articulo (Id.item) · Codigo
  (SKU) · Descripcion · Stock) + hoja `Base de Datos` (stock completo del día).
  `abrirModalDrive` lee **todas** las hojas de ubicación juntas (cargar una por vez
  borraría las otras: lo que no viene en el Excel cuenta como eliminado), ignora los
  casilleros `#N/A`, y **NO suma** el stock de un artículo repetido en varios módulos
  (cada fila trae el total). Checkbox para incluir `Base de Datos` (los no ubicados
  quedan en SIN UBICAR). Un link permite forzar el otro modo.
- **Clave del artículo = SKU de marca** (columna «Codigo»), igual que Calle 49. El
  **Id.item** se guarda en `articulo` y se busca por él (búsqueda, escáner, picking);
  la tarjeta lo muestra como `#233282` y el export lo lleva en su columna.
- Validado 21/08/2026 con el archivo real de Diagonal 80: 4.191 artículos, 2.175
  ubicados, 30 estanterías, re-importación idempotente.
- **Stock por talle (27/08/2026, opcional)**: el modal de mapeo del export plano
  tiene columna **«Talle» opcional** (autodetectada por encabezado `TALLE`/`Talla`/
  `Size`; en archivos sin encabezado se elige a mano). Si el export viene abierto
  por talle (una fila por artículo+talle), el stock se agrupa por código como
  siempre y además se guarda el desglose en `talles: [{t,c}]` (array — los talles
  «7.5» tienen punto, ilegal como clave Firebase). La tarjeta lo muestra como chips
  (`40 2 · 41 1`; talle en 0 = chip apagado con el número en rojo) y el export ⇩
  Excel suma la columna «Talles». **Sin la columna se carga solo el total como
  siempre**; una carga sin talle borra el desglose anterior (no se muestran talles
  viejos como vigentes). La planilla de Drive no cambia.
- **Lista de retiro con talles del F8 (27/08/2026)**: al importar el F8 en la Lista
  de retiro, el parser captura la **curva de talles** (las columnas entre la cabecera
  y el TOTAL, solo en el formato con columna DESTINO; el formato matriz no las trae)
  y el recorrido impreso muestra por artículo un renglón por destino con cantidad y
  talles («CITY BELL ×4 — 40×2 · 41»). Talles de letra en orden de ropa (XS→S→M→L→XL),
  ×1 se omite. ⚠ **El F8 trae VARIAS curvas de talle (10/09/2026)**: arriba de ORIGEN hay
  una fila por curva (1 = niños 10/10-/11…, 2 = US 3/3.5/4…, 3 = 17…42, 4 = 30…56, 5 = 30.5…,
  6/7 = UNI/XXS/XS/S…), numeradas en la columna que va justo antes de los talles (col. G), y
  cada artículo lleva en esa columna el número de SU curva. `f8DetectarCurvas` las detecta y
  el rótulo sale de la fila de la curva del artículo; antes se usaba siempre la de más abajo
  (a una zapatilla le salían XXS/XS…) y el número de curva se sumaba como un talle («7×2»).
  Filas con «Todo» o vacío en esa columna toman la curva del mismo código en otra fila;
  «UNI» = talle único; sin curva conocida la línea va solo con la cantidad (no se inventan
  talles). Validado con los F8 de Daniel y David (abr–ago 2026): suma de talles = total. Los destinos **«Todo X» sin unidades** ahora entran a la lista (antes
  se descartaban por total 0) marcados «TODO lo que haya», sin cantidad ni talles.
- **Dos depósitos en Diagonal 80 (27/08/2026)**: el mapa `DEPOSITOS_SUC` de
  `ubicaciones/index.html` asigna rangos de estantería → piso (slug `diagonal`:
  E1–E26 = **Subsuelo**, E27 en adelante = **2° piso**; el piso se deduce del
  número en el nombre de la estantería, `depositoDe()`). La etiqueta del piso
  aparece en las ubicaciones de la tarjeta/export, la hoja de asignación (con
  separador por piso), la pestaña Estanterías (cabecera por piso), los recorridos
  de F8/retiro y las impresiones/auditoría. Sucursal nueva con más de un
  depósito = agregar su entrada al mapa.
- **«Yo repongo» (01/09/2026)**: se vendió un artículo que estaba exhibido y el
  vendedor se hace cargo de reponerlo en la exhibición. Botón `🔄 Yo repongo` en la
  tarjeta (al lado de «Comentar», en todos los modos): abre una hoja con **dónde está
  en el depósito** (ubicaciones + stock + talles), avisa si quedó en cero, y firma —
  en el **puesto** eligiendo el perfil como en Comentar, en sucursal con el perfil
  activo. Queda pendiente en una lista compartida de la sucursal (botón con badge al
  lado del historial; en el quiosco va arriba a la derecha) hasta que alguien toca
  **«✓ Repuesto»**, desde el drawer o desde la propia tarjeta; el ✕ lo saca si se
  tomó por error. Un pendiente por artículo. Firebase: nodo `reposicion/<id>` de la
  sucursal `{artKey,codigo,descripcion,ubic,por,avatar,ts,hecho:{por,ts}}`, se baja
  en cada poll junto con las consultas y `podarConsultas` borra los repuestos de más
  de 7 días. Decisión de Juli: pizarra simple, sin vencimientos ni aviso al encargado
  (eso queda para más adelante si hace falta controlar el cumplimiento).
- **Actividad (04/09/2026)**: la pestaña abre con **«🚫 Lo que buscan y no aparece»**
  (búsquedas sin resultado de los últimos 7 días, agrupadas por texto, con cuántas veces,
  quiénes y hace cuánto: o el artículo está y falta cargarlo, o es demanda que no tenemos)
  y **«🔄 Reposición del salón»** (repuestos de la semana, los que siguen pendientes y
  quiénes repusieron). Antes `renderActividad` descartaba con `if(!c.key) return` toda
  consulta sin artículo, así que las búsquedas de texto no llegaban a ninguna pantalla;
  ahora el ranking de buscadores también las cuenta.
- **Búsquedas guardadas solas (01/09/2026)**: el historial de consultas ya no depende
  de tocar la tarjeta. Toda búsqueda queda registrada a los 1,4 s de dejar de tipear
  (desde 3 caracteres): un solo resultado → el artículo; varios → el texto y cuántos
  dio; sin resultados → también (sirve para saber qué piden y no está). Mientras se
  sigue tipeando se refina la MISMA fila (`zap` → `zapatilla run`, ventana de 3 min) y
  se mantiene el dedupe de 10 min por perfil. Tocar una búsqueda del historial la
  repite en el buscador.
- **Etiquetas de marca — código de barras EAN/UPC (04/09/2026)**: las etiquetas de
  Under Armour, adidas, Nike… traen el EAN del talle, no el código del sistema, y el
  export de stock NO puede traer ese dato (Juli). Se resuelve con un **mapa compartido
  por todas las sucursales** en `ubicaciones-mateu/ean/<gtin13>` =
  `{codigo, descripcion, t (talle), slug, por, ts}` + índice `ean/suf/<últimos 11>` →
  clave (tolera la lectora que recorta el primer dígito; si llegó recortado se guarda
  como `p<dígitos>`). Primera vez: «Sin resultados» + botón **«Vincular a un artículo»**
  (también en el toast del escaneo; puesto y encargado pueden) → hoja
  `abrirSheetVincularEan`: buscar el artículo, elegir talle opcional, guardar. Desde ahí
  el escaneo lo encuentra en cualquier sucursal (`eanResolver` = `eanLocal` por los
  `eans` del artículo + `eanRemoto` por el mapa, cacheado por promesa). Normalización
  en `gtin13`/`mismoEan`: solo dígitos, UPC-A de 12 = EAN-13 con cero adelante,
  igualdad por sufijo de 11 cuando uno vino recortado. Búsqueda, escaneo y Lista de
  retiro lo usan.
- **Importar el stock CON los EAN (08/09/2026, el reporte del sistema ya los trae)**: el
  mapeo de la carga tiene columna **«Código de barras» opcional** → `eans: [{e,t}]` por
  artículo (un EAN por talle si el export viene abierto). Cómo los toma:
  - **Detección**: el encabezado (`RX_EAN`) manda, pero se **valida el contenido**
    (`columnaEsEan`: mayoría de números de 12-14 dígitos) — la hoja «Base de Datos» de la
    planilla de Drive llama «Código de barras» al SKU y NO es un EAN. Sin encabezado que lo
    diga, se busca la columna por contenido (`colEanPorContenido`; en el export pelado,
    `eanShare` en vez del largo promedio, así no se confunde con el Id.item).
  - **La celda**: `eanDigits` acepta el EAN como número, con guiones/espacios, con `.0` de
    más y en notación científica **completa**; una científica recortada («7,7912E+12»,
    Excel ya perdió dígitos) se **descarta** en vez de inventar un código. `eansDeCelda`
    parte una celda con varios códigos.
  - **Reporte que identifica por EAN** (sin columna de código del sistema): el modal lo
    detecta y ofrece **resolver cada EAN al artículo** (índice `eanIndexCargar` = los `eans`
    ya cargados + todo el mapa compartido; `eanIdxBuscar` tolera el dígito recortado). Sin
    resolver, cada talle entraría como un artículo distinto — lo avisa en rojo. Las filas con
    un EAN que nadie vinculó todavía no se cargan y se listan en la vista previa.
  - **Se fusionan, no se pisan**: los EAN nuevos se suman a los del artículo (tope
    `EAN_MAX_ART` = 80), así una carga sin la columna no borra los vinculados a mano.
  - **Se comparten**: al terminar la carga, `eanCompartir` publica en el mapa `ean/` los
    códigos que no estaban (de a 250, sin pisar nunca un vínculo existente), así sirven en
    todas las sucursales. El resumen de la carga muestra cuántos y el ⇩ Excel del módulo
    suma la columna «Cód. barras». Tests: `node --test lib/ean.test.js`.
- **Sin conexión (10/09/2026, reclamo del puesto «a veces no busca»)**: la búsqueda es
  local (catálogo en memoria), así que tiene que seguir andando aunque se corte internet.
  `fetchJSON` lleva tope de tiempo (15 s; el catálogo 90 s) — antes un pedido colgado no
  fallaba nunca. `refrescarDatos` **nunca pisa con vacío**: un pedido fallido devuelve
  `undefined` y se conserva lo anterior (antes un corte a mitad de la descarga dejaba
  `articulos` en `{}` y el puesto no encontraba nada por 10 min). Aviso `avisoSinConexion`
  («la búsqueda sigue funcionando con los datos de las HH:MM»), refresco inmediato con el
  evento `online`, un solo ciclo de polling por «generación» (`pollGen`: los ciclos colgados
  ya no se suman al apagar/prender la pantalla) y el catálogo se serializa para comparar solo
  cuando se baja, no cada 5 s. El EAN que no se pudo consultar muestra «No se pudo consultar…
  ↻ Reintentar» y el error no queda en `_eanCache`. El puesto monta la pantalla a los 8 s
  aunque los perfiles no respondan.
- **Artículos nuevos sin ubicar** (prioridad del depósito): «nuevo» = `fechaAlta`
  posterior a la **primera carga** de la sucursal (cada carga graba un único
  timestamp; así el día 1 no se marca todo) y ≤ `NUEVO_DIAS` (7). Se destacan con
  banner ámbar arriba de Buscar («⚡ N artículos nuevos sin ubicar» + «Ver nuevos»),
  filtro «⚡ Nuevos» en la cabecera de SIN UBICAR (se activa solo al cerrar el
  resumen de una carga con nuevos), etiqueta «⚡ Nuevo · ingresó hoy/ayer/hace N
  días» en la tarjeta (borde ámbar), siempre primeros en la lista y marcados con ⚡
  en la impresión. Dejan de ser "nuevos" al ubicarlos (`esNuevo`, `nuevosLista`).
- **Puente con el escáner del sistema (`scripts/puente-escaner/`, 09/09/2026)**: un
  script de AutoHotkey corre de fondo en la PC del salón, detecta la ráfaga de la
  lectora cuando el vendedor escanea **parado en el sistema** (tipeo velocísimo, se
  descarta lo que tipea una persona) y publica el código en
  `ubicaciones-mateu/scanBridge/<slug>` = `{codigo, ts, pc, test?}` (el `ts` lo pone el servidor con `.sv`).
  El Buscador lo escucha (`iniciarScanBridge`) y dispara `procesarEscaneo`, el MISMO
  circuito que la lectora local: resuelve el EAN de la etiqueta, resalta la tarjeta y
  registra la consulta. Una pasada de lectora, las dos pantallas. Escucha por SSE y
  cae a **polling cada 2,5 s** si el navegador no tiene `EventSource` (Win7 con IE),
  si la conexión falla o si no abre en 4 s (el `open` apaga el polling); anda en los
  modos `puesto` **y** `sucursal` (la cuenta del local también sirve, no solo
  `NN-consulta@`). El código `PUENTE-TEST` (menú de la bandeja → «Probar el puente»)
  no busca nada: muestra «Puente conectado ✔», que es la prueba de punta a punta.
  Cada escaneo se atiende UNA vez (`sbVistos`, marca = `ts|codigo`): **en cada
  reconexión Firebase reenvía el último valor del nodo**, y sin eso el quiosco
  repetía solo el escaneo anterior. Lo primero que se lee al conectar se ignora
  (es lo que quedó guardado), **salvo que sea de menos de 60 s** — si no, una pasada
  hecha justo antes de que la pantalla empiece a escuchar se perdía en silencio.
  Prueba sin Firebase ni PC del salón: `npx --yes http-server -p 8777 -s .` +
  `node scripts/probar-puente-escaner.mjs sse|poll puesto|sucursal` (Playwright con
  Chromium, intercepta la base con datos de prueba).
  ⚠️ La **v1 no publicaba nada**: el PUT a Firebase se hacía asincrónico y el objeto
  `WinHttpRequest` se liberaba al salir de la función, así que Windows cancelaba el
  envío (ahora es sincrónico y se lee el status); además juntaba las teclas con
  `Input` letra por letra (se le escapaban caracteres de las lectoras rápidas → ahora
  `InputHook`, con el `Input` viejo solo de respaldo), no aceptaba el Enter del pad
  numérico ni las lectoras sin tecla final, y del lado del Buscador escribía el texto
  en el campo de búsqueda en vez de pasar por `procesarEscaneo` (una etiqueta EAN no
  encontraba nada). Causas de campo que no son bugs: el sistema corriendo **como
  administrador** (Windows no le deja ver las teclas a un programa común: hay que
  ejecutar el puente como administrador) y **Windows 7 sin TLS 1.2** (KB3140245).
  Todo eso está en `scripts/puente-escaner/LEEME.txt`, que es lo que se les manda a
  las sucursales.

## Área de Producto (`equipo/`) — Control F8

`equipo/index.html` self-contained (lee la sesión del Portal). David (Indumentaria &
Accesorios) y Daniel (Calzado) suben sus F8s; el módulo los cruza contra la
estadística de transferencias del sistema. Calibrado con archivos reales 25/08/2026.

- **F8 (.xlsx)**: parser por encabezados (fila con `ORIGEN`; soporta layouts
  distintos: con/sin columna MARCA, ORIGEN en col A o B, columna DESTINO por fila o
  matriz con una columna por sucursal). El rótulo `TOTAL` puede estar en cualquier
  fila de la cabecera y el valor 1-2 columnas a la derecha (merges). La **fecha del
  F8 sale del nombre del archivo** (`F8 18-08-2026.xlsx`); re-subir el mismo F8
  (operador+archivo+fecha) REEMPLAZA al anterior. La marca sale de la columna MARCA
  si existe; si no, por prefijo del código (`BRAND_MAP2`). ⚠ `RUGE-EDLP` con guion:
  la `/` es ilegal como clave Firebase y hacía fallar el guardado en silencio.
  **Destino `Todo <sucursal>` sin unidades** = mandar todo lo que haya: entra al
  cruce con control laxo (hubo envío → «Hecho», cuenta como exacto sin comparar
  cantidades; nada → «No ejecutado»); plan mostrado como «Todo» (regla de Juli 26/08).
- **Transferencias (.csv ;-separado, latin1)**: el sistema lo exporta en VARIAS
  variantes (con/sin fila de encabezado `…;Enviado;…`, con/sin Id.item, y el orden
  origen/código/destino cambia). Las columnas se detectan por **contenido puro**:
  sucursales = prefijo `NN-` (1ª origen, 2ª destino), código = la columna con letras
  que no es sucursal, enviado = la del rótulo «Enviado» o la primera decimal
  (`1,00`/`1.00`) tras código y destino, Id.item = enteros largos; filas «Total» se
  saltean. Queda **guardado en Firebase**: lo sube uno y lo ven todos; subir
  otro lo reemplaza («✕ quitar» lo borra).
- **Cruce**: clave `origen+código+destino` (normalización `nrmF8`/`nrmT` con mapa
  `DEST_MAP_F8`, pliega acentos). Estados: Exacto / Con diferencia / No ejecutado.
  El control se agrupa por la **sucursal que ENVÍA**; 100% = mandó todo exacto.
  Calendario por sucursal×fecha + tarjetas + tabla con filtros y **⇩ Excel**.
  **«Enviados sin F8»**: transferencias no pedidas en ningún F8 — chip en los
  números del cruce (clic lo lista), opción en el filtro de casos y línea 📤 por
  sucursal en las tarjetas. Incluye TODO lo transferido (también cupones/perchas):
  es la foto fiel del export.
  **Reporte semanal**: botón «📋 Reporte semanal» en Control F8 → ranking 🟢/🟡/🔴
  por efectividad, con «⧉ Copiar» (WhatsApp) y «📣 Publicar en la Bandeja»
  (`mensajes-mateu/avisos`); banner recordatorio vie-dom si la semana no salió
  (flag `equipo/reporteSem/<semanaISO>`).
  **Tolerancia** (pedido de Juli 27/08: entre el F8 y el envío hay ventas/fallas):
  selector en Control F8 (exacta/±10/±20/±30, default ±10%), compartida en
  `equipo/config/tolerancia`; línea con envío dentro del margen = cumplida
  (badge «±Tolerancia»); enviar cero nunca se tolera. El reporte declara la vara.
- **Circuito F8 → sucursal (27/08/2026)**: al subir un F8 se REPARTE por sucursal
  de origen a `equipo/f8suc/<slug>/<f8id>` (mapa `SLUG_EQ` canónico→slug del
  Portal) con aviso opcional por directo de la Bandeja. La sucursal lo ve en
  **Mi Sucursal → «F8 para armar»** (`secF8` en `indicadores/`): visto al abrirlo,
  dos descargas (ver abajo), y **confirmación artículo por artículo** (✓ enviado / ✗ +
  motivo de `MOTIVOS_F8`). En equipo/: tabla «Seguimiento del circuito»
  (recibido/visto/descargado/confirmado) y el cruce suma dos estados: 
  **Justificado** (✗ con motivo, sin transferencia — cuenta para la efectividad) y
  **⚠ CRÍTICO** (✓ de la sucursal SIN transferencia real = intento de engaño).
  Aviso doble a cada cuenta de la sucursal: directo por la Bandeja + **mail real**
  (EmailJS: servicio del turnero + template `template_s38ov8s`, conectado 27/08).
  **Recorrido de armado**: el Buscador de Artículos (`ubicaciones/`) tiene pestaña
  «F8s» (badge de pendientes; el puesto no la ve): cruza el F8 con el stock local
  (Id.item, respaldo código) y ordena el picking por estantería/módulo, con
  imprimir/descargar; la confirmación ✓/✗+motivo también se puede hacer ahí
  (misma escritura en `f8suc`). **Control en el Panel General (30/08)**: la vista
  Cadena de `indicadores/` suma la sección «F8 para armar · control» (`secF8Cad`,
  `renderF8Cad`/`pintarF8Cad`): baja `equipo/f8suc` completo (solo gerencia) y
  muestra quién está al día y quién tiene F8 sin confirmar (tabla: sucursal, F8,
  artículos, hace cuántos días, estado sin abrir/visto/descargado), con el filtro
  por línea. El detalle sigue en equipo/.
- **Descargas del F8 (11/09/2026, pedido de Juli)** — `shared/f8-descargas.js`
  (`window.F8Descargas`, se incluye SIN defer). Las usan Mi Sucursal («F8 para armar») y la
  pestaña **F8s del Buscador de Artículos**, que es donde lo ve, lo baja y lo confirma la
  **cuenta de depósito** de la sucursal (no entra a Mi Sucursal). El aviso de F8 nuevo también
  le llega por la Bandeja (`cuentasDeSucursal` suma el rol `deposito`); link directo `ubicaciones/?tab=f8s`.
  ⚠ **Mail real (EmailJS) solo a las cuentas `sucursal`/`outlet`** (11/09/2026): `deposito.<suc>@` y
  `consulta.<suc>@` son mails ficticios — rebotaban y agotaron los créditos de EmailJS. `notificarF8`
  los saltea por rol (`ROLES_SIN_MAIL`) y por prefijo (`mailFicticio`); solo reciben el directo.
  Dos botones. **«⇩ Descargar F8»** (`descargarF8`, ExcelJS por cdnjs) arma la
  **planilla OFICIAL del operador** solo con las líneas de la sucursal: **Daniel** = hoja
  `Hoja1`, logo arriba a la izquierda, «F / 8», fecha, «DANIEL» + nro «NF8-…», 7 curvas en
  G1:G7 con los talles desde la I, encabezado negro en la fila 7 (ORIGEN · MARCA · CODIGO ·
  ARTÍCULO · DESCRIPCIÓN · DESTINO) y TOTAL en la AI; **David** = hoja `F8`, logo en B3:C8,
  «F8 ACCESORIOS» + fecha, 6 curvas en G3:G8 con talles desde la H, encabezado en la fila 9
  (sin MARCA) y Total en la AF. **«🖨 Planilla de recorrido»** (`abrirRecorrido`) abre una hoja
  imprimible (A4 apaisado) con cada artículo agrupado por estantería/módulo según las
  ubicaciones del Buscador (`ubicaciones-mateu/sucursales/<slug>/articulos|estanterias`,
  cruce por Id.item y código como en su pestaña F8s; pisos de Diagonal en `DEPOSITOS`, copia del mapa del Buscador),
  destino con cantidad y talles, stock por talle con las mismas fichitas de la tarjeta del Buscador
  (cero en rojo, con borde los talles que pide el F8; la lista de retiro del Buscador también las lleva,
  `pickingStockTallesHtml`), «sin ubicar» / «no está en el
  stock» aparte y firmas; desde ahí «Descargar Excel» (`recorridoExcel`). Las dos marcan
  `descargado`. **Corregir la confirmación** (mismo día): en un F8 ya confirmado cada fila tiene «✎ Corregir»
  (Mi Sucursal `f8EdCelda`/`f8EdGuardar`, Buscador `f8uEdCelda`/`f8uEdGuardar`; gerencia no corrige) → ✓/✗ +
  motivo → PATCH solo de `conf/lineas/<i>` = `{ok, motivo, ed:{ts, por, antes:{ok, motivo}}}` + `conf/editado`;
  la fila dice «(corregido)» y el Seguimiento de equipo/ «· corregida». Los F8 abiertos quedan abiertos al repintar.
  ⚠ **La pestaña F8s no se repinta sola (12/09/2026, reclamo del depósito: «se la pasa actualizando»)**:
  el polling general del Buscador corre cada 5 s y antes rehacía toda la pestaña en cada vuelta (parpadeo del
  «Cargando F8s…», scroll perdido, marcas a medio hacer). Ahora los F8 se consultan cada `F8_REFRESH_MS`
  (**5 min**; 30 s le pareció demasiado seguido a Juli — un F8 nuevo llega una o dos veces por día y además
  avisa por la Bandeja, y entrar a la pestaña o el botón **«↻ Buscar F8 nuevos»** (`f8Actualizar`) consultan al toque)
  y el HTML se rehace SOLO si lo bajado es distinto de lo que está en pantalla (`_f8Hash` vs. `_f8HashPintado`,
  `refrescarF8sAuto`) y nadie está marcando (`f8Ocupado`: marcas sin enviar, una corrección abierta o el foco
  dentro de la pestaña); los ✓ / ✗ / ✎ Corregir repintan SU celda (`f8uCeldaHtml`/`f8uRepintarCelda`, td con
  `data-f8c`), no la tabla. `renderF8s` = bajar + `pintarF8s`; `pintarF8s` = solo DOM (conserva el scroll). Para eso **equipo/ guarda más datos al repartir** (`parseF8` +
  `f8DetectarCurvas`, copia de la de ubicaciones/): por línea `m` marca, `ds` descripción,
  `cv` lo que dice la columna de curva («4», «Todo», «UNI»), `k` curva resuelta, `x` la
  columna H del de Daniel y `q = [[índice de talle, unidades]]`; por doc `curvas =
  [{n, t:[rótulos]}]` y `hdr = {nro, titulo}`. Los F8 repartidos antes no tenían talles: se
  completaron el 11/09 los de 14-08 (David) y 19-08 (Daniel), que estaban en Descargas
  (verificado línea por línea); 21, 24 y 26-08 bajan con el total solo y una nota. Sin
  `curvas` en el doc se usan las del operador horneadas en `F8_CURVAS_DEF`.
- **Firebase** (`turnero-mateu`, nodo `equipo/`): `f8s/<id>` (objeto por id, alta
  con PATCH — así las subidas simultáneas no se pisan), `ctrl` (registro manual,
  legacy), `transf` (export vigente `{archivo,subido,por,filas:[[o,c,d,art,env]]}`),
  `f8suc/<slug>/<f8id>` (reparto + tracking + conf), `config` (tolerancia),
  `reporteSem/<semana>` y `foco/<ym>/<rubro>__<slug>` (checklist del «Foco del mes», ver
  Reporte Mensual). Eliminar un F8: botón 🗑 en el Historial (PATCH null).
- **Foco del mes (06/09/2026)**: sección arriba del Dashboard (pantalla inicial de
  `producto@`) con la base de trabajo mensual de Daniel (Calzado) y David (Indumentaria +
  Accesorios) que sale de «Meses de stock» del último Reporte Mensual: sucursales a achicar
  (≥ 6 meses), a reponer (< 3) y a vigilar, con ratio, variación % vs. el mes anterior,
  unidades de más / faltantes, checkbox ✓ y nota ✎ compartidos. Reglas en
  `shared/foco-stock.js`; link «Ver el Reporte Mensual →» al deck.
  **Descarte de gerencia** (`FOCO_ADMIN` = julian@): botón ✕ en cada ítem → motivo opcional
  → `{descartado:true, motivoDesc}`; se ve tachado, no se puede marcar, no cuenta en el N/M
  ni en el cierre; ↩ lo vuelve a incluir. **Cierre del mes** (`renderFocoCierre`,
  `FocoStock.evaluar`): cuando hay un Reporte Mensual más nuevo, el foco del mes anterior
  se evalúa con sus ratios: **resuelta** (entró a 3–5) · **mejoró** (se acercó ≥10 % de lo
  que le faltaba) · sin cambio · **empeoró** · sin dato; cumplimiento % = resueltas +
  mejoraron / evaluadas (verde ≥70, ámbar ≥40, rojo), «declaró trabajadas X de N» y alerta
  ⚠ por las marcadas como trabajadas que no mejoraron. Tarjeta por operador debajo del foco
  con detalle desplegable, «⧉ Copiar» y (Juli) «📣 Enviar por la Bandeja». **Aviso
  automático**: la primera vez que alguien abre el módulo con el reporte nuevo cargado, se
  manda el resumen por directo `producto@ → julian@` (`FOCO_CIERRE_AVISO`) y se marca
  `equipo/focoCierre/<ym>/avisado`; solo para meses ≥ `FOCO_DESDE` (2026-09, cuando arrancó
  el checklist; los cierres anteriores se ven pero no se avisan solos).

## Evaluaciones de Supervisor

`evaluaciones/` es un `index.html` self-contained **igual que el resto**: lee/escribe
a Firebase por REST (base `evaluaciones-mateu`). Carga operativa+actitudinal
por sucursal, con ranking, gráficos, seguimiento de puntos de mejora y vista de
encargado. Se evaluó pasarlo por Pages Functions + D1 para tener permisos en el
server, pero Juli eligió mantenerlo consistente con el resto (seguridad blanda).

- **Dos tipos de evaluación (24/08/2026)**: la **visita SEMANAL** (el detalle de cada
  recorrida de Cristian) y la **evaluación MENSUAL, que es la oficial** — la que cuenta
  para la nota final de la sucursal. El selector «Tipo» está en Ranking, formulario,
  Gráficos y vista de encargado; **la vista por defecto es la mensual**. La mensual se
  nutre de las semanales: el form muestra las visitas del mes (tarjetas con nota y
  «Ver»), en cada ítem los valores semana a semana con una **sugerencia**
  (`E.sugerirMensual`: promedio de puntos → valor más cercano, en `lib/evaluacion.js`
  con tests) y un botón «⤓ Precargar ítems desde las semanas» que llena los vacíos.
  Una semana ISO pertenece al mes de su **jueves** (`mesDeSemana`). Árbol: la mensual
  va en `evaluaciones_mensuales/<suc>__<YYYY-MM>` (campo `mes`; mismo formato que la
  semanal); las semanales siguen en `evaluaciones/<suc>__<semana>`. Los
  **puntos_mejora nacen SOLO de las semanales** (circuito operativo); la mensual
  guarda sus planes en sus items.
- **Notificaciones por la Bandeja** (directos `mensajes-mateu`, best-effort): al
  **guardar una evaluación** (estado enviada) les llega a gerencia
  (`GERENCIA_MAILS`), al supervisor (`SUPERVISOR_MAIL` = cristian.campion@) y a la
  cuenta de la sucursal evaluada (se resuelve con
  `discontinuos-mateu/usuarios` → `emailsDeSucursal(slug)`); cuando el encargado
  **marca resuelto un punto** o deja un **descargo**, le llega a Cristian.
- **Descargo del encargado en los puntos de mejora**: botón «💬 Agregar descargo» en
  su vista (ej.: "no tenemos insumos de limpieza") → `puntos_mejora/<id>/comentario`
  (+ por/en); el supervisor lo ve en el form y en el detalle.
- **Campana flotante compartida**: `shared/notificaciones.js` (la misma campana del
  Portal/Indicadores como componente del shell: se inyecta sola, no hace nada si la
  página ya tiene `#notifWidget` o no hay sesión). Se incluye con una línea en el
  `<head>` **antes de `tutorial.js`** (así el «?» se corre arriba de la campana):
  `<script src="../shared/notificaciones.js" defer></script>`. Hoy la incluye
  `evaluaciones/`; cualquier módulo puede sumarla con esa línea.

- **Cálculo** (`lib/evaluacion.js`): única fuente de verdad del puntaje/nota
  (Bien 10 · Regular 5 · Mal 0; Operativa/50 + Actitudinal/50; A≥80 B≥60 C≥40 D<40).
  Es UMD isomórfico (browser + node): lo usan el módulo, el generador y los tests
  (`node --test lib/evaluacion.test.js`). NO cambiar la escala sin que Juli avise.
- **Base Firebase**: `evaluaciones-mateu` (ya conectada; la URL está en la constante
  `EVAL_DB_URL` en `evaluaciones/index.html` y en el Portal para el badge). Reglas
  abiertas (`.read`/`.write` true), como el resto. Árbol:
  `evaluaciones/<suc>__<semana>` + `puntos_mejora/<pushid>`. Si `EVAL_DB_URL` queda
  vacía, cae a modo demo con `evaluaciones/mock-data.js` (no persiste).
- **Rol nuevo `supervisor`** (además de admin/sucursal/outlet): su alcance (qué
  sucursales ve/edita) se carga en el ⚙ del Portal (multiselect →
  `usuarios/<mail>/sucursales` en `discontinuos-mateu`), y el módulo lo lee de
  `session.sucursales`. Gerencia = `admin`; encargado = cuenta de `sucursal`/`outlet`.
  Hoy hay un solo supervisor: `cristian.campion@mateu.com.ar` (cubre todo).
- **Alcance por rol es "blando" (en el cliente)**, como el resto del portal: ordena
  accesos, no es barrera dura.
- **Datos de demo** (`node scripts/gen-evaluaciones-mock.mjs`): regenera
  `evaluaciones/mock-data.js`. Reusa `lib/evaluacion.js` para el puntaje.
- **Cruce con Meses de Stock** (§ ratio): lee `window.STOCK_DATA` de
  `gestion-stock/datos-meses-stock.js` con el mismo mapa slug→nombre que Indicadores.

**Puesta en marcha (crear la base y pegar la URL): ver `docs/EVALUACIONES-SETUP.md`.**

## Análisis de Reserva Depósito Central

`barrida/` (carpeta/URL se mantiene; el nombre visible es **«Reparto de Mercadería»** desde el
11/09/2026 — antes "Análisis de Reserva Depósito Central"; se cambia en `TOOLS` del Portal, de
`header.js` y de Indicadores, en `tutorial.js` y en el `<title>`) es un `index.html` self-contained (lee la sesión del Portal, sin
login propio). Lo corre el **depósito / gerencia** semana a semana (típico: los lunes) para
decidir la reposición de la semana anterior. La ve el rol `admin` o quien tenga la
herramienta `barrida` en su lista; las sucursales NO entran acá (ven su aviso en
Indicadores, ver abajo).

- **Entrada = subir Excel** (client-side, SheetJS por CDN, no se sube nada hasta
  guardar). **Ya no hay pestaña «Cargar» (07/09/2026, pedido de Juli): la carga es una tarjeta
  compacta arriba de Reposición** (`cargaHtml`/`wireCarga`): tres botones ⇧ Ventas por sucursal ·
  Reserva depósito · Stock por sucursal (opcional), selector de semana, Procesar y 💾 Guardar en
  la misma pestaña, más una línea de resumen (artículos, reponibles, unidades, parada, curvas,
  fuentes de prioridad, guardada/sin guardar). El botón usado manda el tipo (`cargarFilesComo`:
  una hoja con Sucursal va a ventas o stock según el botón; la reserva siempre a reserva); la
  tarjeta acepta arrastrar archivos (se clasifican solos). Con ventas + reserva **se procesa
  solo**. Reposición es la primera pestaña (`state.tab='reposicion'`).
  **El stock por sucursal se guarda por semana** (pedido de Juli 07/09: se sube una vez por
  semana y lo usan todas las barridas de esa semana, otro día u otra compu): al subirlo,
  `guardarStockSemana()` escribe `barrida/stockSuc/<lunesISO>` = `{meta:{archivo,hoja,subido,por,
  semana,ids,filas}, data:{<id>:{<slug>:[[talle,cant],…]}}}` (solo talles positivos, como pares).
  Al abrir el módulo o cambiar la semana, `cargarStockSemana()` trae el `meta` (liviano) y el botón
  muestra «✓ Stock por sucursal · de la semana»; `asegurarStockData()` baja el `data` recién al
  procesar. `stockRows()` unifica las dos fuentes (archivo cargado manda; `R.stockOrigen` =
  archivo|base). Un archivo nuevo pisa el guardado; Guardar la barrida también guarda el stock si
  no quedó bajo esa semana. Dos hojas: **ventas por sucursal** (columna `Sucursal` + `ID ITEM` +
  columnas por talle) y **reserva del depósito** (sin `Sucursal`, `ID ITEM` +
  columnas por talle). Puede ser un archivo con las dos hojas o dos archivos: se
  autodetecta cuál es cuál por los encabezados. Cruce por **`ID ITEM`**, abierto por
  talle. ⚠️ La hoja de reserva trae una columna final **`Total`** (suma de la fila):
  se excluye de los talles a propósito; si se contara, **duplicaría el stock**.
  **Columnas descriptivas (corregido 08/09/2026)**: el export real es `Sucursal · Rubro ·
  Marca · Grupo 1 · Disciplina · Subrubro · Articulo · Id Item · Codigo de barras · talles`
  (la reserva, igual pero sin `Sucursal`). El sistema llama **«Grupo 1»** al tipo de producto
  (CALZADO ADULTO), **«Disciplina»** a CASUAL/RUNNING/FUTBOL 11 y **«Subrubro»** al género
  (02-HOMBRE, 03-DAMA). Hasta el 08/09 el mapa posicional estaba corrido y el filtro
  «Subrubro» mostraba disciplinas; ahora hay **un filtro por cada uno** (Tipo de producto ·
  Disciplina · Subrubro, los dos últimos multi-selección) y los valores se muestran sin el
  prefijo numérico (`opts`/`fmulti` aplican `stripNN`; el valor real no cambia). La hoja
  «reporte stock global» rotula la columna Marca con el nombre de la marca filtrada
  («Puma»): por eso el respaldo posicional sigue haciendo falta.
- **Salida = dos alertas por sucursal**: **Reposición** (artículo con reserva Y venta
  en una sucursal → sugerido por talle = `mín(vendido, reserva)`; los talles donde
  `vendido > reserva` van en **rojo** + pill ⚠ falta en el artículo = reserva no
  alcanza, señal de recompra a la marca; filtro "Solo con faltante de talle").
  La columna **Talles** es un **casillero por talle** (`talleChip`, rediseñada 08/09/2026:
  antes era la línea «41 1/13», en la que no se sabía qué era cada número): arriba el talle,
  en grande **cuántas unidades van** y abajo el porqué («de 13» = lo que hay en reserva;
  en rojo «pedía 3» = la reserva no alcanzó y por prioridad le tocó menos). Los talles de
  «Completar curva» usan el mismo casillero en verde («+1 · no tiene»). El tilde
  **«Solo lo que se puede mandar»** (ex «Solo con talle disponible») oculta las líneas sin
  nada para bajar: hay reserva del artículo pero no en los talles que la sucursal vendió.
  Botón **⇩ Excel** (las tres pestañas exportan): estilo ExcelJS como el OC de
  Managment — membrete, header navy, autofiltro, freeze. La de **Reposición** replica
  la planilla física del depósito ("REPOSICIÓN CALZADO / ADIDAS"): título dinámico
  según el rubro/marca filtrado + columnas **Código · Artículo (ID ITEM) · Descripción
  · Destino · [talles = cantidad a mandar] · Total**; talles faltantes en rojo. Desde el
  07/09/2026 (pedido de Juli) la de Reposición va **sin fila de resumen y sin las analíticas**
  (Vendido · Reserva · Falta · Prioridad · Meses stock · Categoría), todo en negrita, filas de
  alto 25, fondo blanco y bordes finos en todas las celdas (sin bandas ni separadores gruesos). Parada y Compras: header navy +
  autofiltro (Compras antepone Categoría y tiñe rojo/verde según sin/con reserva). Los tres
  exports **repiten el membrete y los encabezados arriba de cada hoja al imprimir**
  (`pageSetup.printTitlesRow`; Reposición además repite Código..Destino a la izquierda con
  `printTitlesColumn`) — pedido de Juli 08/09/2026.
  Y **Reserva parada**
  (reserva y CERO venta en toda la cadena). El Depósito y filas basura (`Sucursal`)
  se excluyen de la demanda; se puede filtrar `Varios/Facturación` (gift cards,
  cupones). El grano fino es art×sucursal.
- **Vista Compras** (pestaña `compras`, **solo para `COMPRAS_MAILS`** = julian@ y julian.demarco@ —
  pedido de Juli 08/09/2026: al depósito no le sirve; para sumar a alguien, un mail más en esa
  constante. Sin permiso la pestaña se saca del DOM y `setTab`/`viewCompras` rebotan a Reposición):
  mirada por **artículo global** (no por sucursal), ranking por vendido en la cadena,
  en tres grupos: **mejores vendidos SIN reserva** = reponer a la marca (recomprar),
  **mejores vendidos CON reserva** = solo seguimiento, y **artículos frenados** (= la
  reserva parada). "Mejores" usa un umbral `Vendidos ≥` (default 3, ajustable); el
  badge del tab y los KPIs usan ese umbral. Incluye un resumen "a quién reponer" por
  marca de lo sin reserva. Se guarda en el payload (`compras`) para el histórico.
- **Prioridad de reposición (07/09/2026, pedido de Juli — «que no queden en duda»)**: hasta ahora
  cada sucursal pedía `mín(vendido, reserva)` por su cuenta y varias podían pedir la misma
  reserva de un talle (eso era el rojo). Ahora en `computar` hay un **reparto por artículo ×
  talle**: si la suma de lo pedido entra en la reserva, todas reciben lo suyo; si no, se reparte
  en orden de `cmpPrioridad`: **1) vendido del artículo** en la sucursal esa semana (empate: lo
  vendido de ese talle), **2) meses de stock** de la sucursal en la **marca-rubro** (último mes
  de `gestion-stock/datos-meses-stock.js`, cargado lazy en `cargarStockData` al procesar; sin
  dato de la marca cae al rubro; sin dato, al final), **3) categoría** de la sucursal
  (`asignacion-marcas-mateu/asignacion_marcas`, mapa `SLUG2MARCAS`, `CAT_RANK` cat1 > cat2 =
  aurelius = adidas > outlet; respaldo `CAT_SEED`). `prioInfo(slug,marca,rubro)` → `pr:{ms,
  msNivel, cat, catRank}` en cada fila; `prio`/`prioDe` = puesto entre las sucursales del
  artículo. El talle recortado guarda `s < v` (`rec`); `faltaEn` (global) = algún talle con
  `s < v`; la vista muestra «v/r → s» en rojo, columna «Prioridad» con tooltip (`prioTxt`), el
  export suma Prioridad · Meses stock · Categoría y la pantalla Cargar un banner con las
  fuentes usadas (`prioFuentes`, también en `meta`). El mismo comparador ordena el reparto de
  «Completar curva».
- **Completar curva (07/09/2026, pedido de Juli)**: tercera hoja **opcional**, el **stock por
  sucursal abierto por talle** (mismo layout que ventas: Sucursal · … · ID ITEM · talles). Por
  encabezados no se distingue de ventas: `clasificarHoja` mira el nombre de la hoja y del
  archivo («stock»/«existencia» → stock, «venta» → ventas; si no, ventas) y el chip de Cargar
  tiene «↔ es stock por sucursal» (`swapVentasStock`). **No es una pestaña: es el tilde
  «Completar curva de talles» de Reposición** (`filtros.curva`, al lado de «Solo con talle
  disponible», deshabilitado sin hoja de stock; pedido de Juli 07/09 tarde). Con el tilde,
  `reposFiltradas()` fusiona en cada fila de reposición los talles de curva de esa sucursal
  (`curvaFaltan`, `curvaU`; `sugerido` pasa a ser reposición + curva y `sugRep` guarda la
  reposición sola) y agrega filas `soloCurva` (pill verde) para sucursales que no vendieron
  pero tienen el artículo incompleto; los chips verdes «41 +1/6» van a continuación de los de
  reposición (`curvaChips`) y el badge muestra «(+N)». Definición (`computar`, `R.curva`): la
  sucursal **tiene stock en ≥ `minTalles` talles** (default **2**: un talle suelto es un resto,
  no una curva) y le faltan talles con stock ≤ 0 en la sucursal y > 0 en reserva; por defecto
  se **excluyen los artículos sin venta en ninguna sucursal** (`ventaCadena`, = reserva parada;
  control «Incluir artículos sin venta»). Reparto (`aplicarUnidadesCurva`): por artículo ×
  talle se descuenta primero lo de Reposición (`usoRep`) y el resto va a las sucursales en
  orden de `cmpPrioridad`, `unidades` por talle (1/2/3) hasta agotar (`agotado`, chip gris
  «agot.»); un talle que ya va por Reposición se marca `ya`. Controles (solo con el tilde):
  unidades, «al menos N talles», «solo huecos internos» (`marcarInternos`/`rankTalle`),
  «incluir sin venta». Export ⇩ Excel: la cantidad del talle = reposición + curva, subtítulo
  «+ COMPLETAR CURVA DE TALLES». Se guarda `barrida/barridas/<lunes>/curva/<slug>` **solo si el
  tilde estaba puesto** = `[{…, sugerido, prio, pr, talles:[{t,r,s}] (faltantes),
  tiene:[{t,q}]}]` + `meta.archivo_stock` y `meta.curva_param` (`activa`…); al abrir del
  histórico el tilde vuelve como se guardó. La sucursal lo ve en Indicadores (bloque «talles
  para completar la curva» dentro de «Reposición disponible») y el **Picking** lo suma al armar
  el pick (check «Incluir Completar curva», `curvaDe`).
- **Panel de Reposición reordenado (08/09/2026)**: los 6 selects, los 5 tildes y el botón de
  Excel estaban todos sueltos en la misma línea. Ahora es una tarjeta `.fpanel` con dos filas:
  arriba **qué mirar** (Sucursal · Rubro · Marca · Tipo · Disciplina · Subrubro · Buscar) y
  abajo, separadas por una línea, las opciones agrupadas en **Mostrar** (solo lo que se puede
  mandar · excluir Varios · solo con faltante) y **Sumar al pedido** (Completar curva · Vaciar
  la reserva chica), con «Limpiar filtros» y ⇩ Excel a la derecha. Debajo, **chips con los
  filtros puestos** (`chipsFiltros`, ✕ para sacar uno de a uno), los parámetros de curva y
  vaciado como bloques `.fmodo` (verde y azul, en el mismo orden que sus tildes, con cuántas
  unidades aporta cada uno) y una **tira de resumen arriba de la tabla** (`.resu`: líneas,
  unidades a bajar con el desglose por venta/curva/vaciado, líneas con faltante, artículos y
  sucursales) — antes ese total estaba solo al pie. La explicación larga de la tabla pasó a un
  desplegable **«¿Cómo se lee esta tabla?»** (`<details class="ayuda">`), abierto la primera vez
  y después como lo deje el usuario (localStorage `barrida_ayuda`).
- **Vaciar la reserva chica (08/09/2026, pedido de Juli)** — es un **MODO de la vista, no un
  extra**: al tildarlo la lista queda SOLO con los artículos de poca reserva (`R.vacArts`,
  `reposFiltradas` filtra por ahí), con el título «Vaciar la reserva chica» y su propio Excel
  (`vaciado-reserva-<lunes>.xlsx`). La primera versión los sumaba a la reposición normal y se
  seguía viendo todo lo demás: no servía para la tarea, que es limpiar el depósito. En
  **calzado e indumentaria**
  (`esVaciable`), un artículo con muy poca reserva no tiene sentido en el depósito: conviene
  repartir lo que queda y que viva en las sucursales. Tilde **«Vaciar la reserva chica»** en
  Reposición (apagado por defecto) + dos controles: «reserva del artículo de hasta N unidades»
  (default **5**, sumando TODOS los talles) y «dejar el talle si todas ya tienen N o más»
  (default **3**). Se calcula en `computar` (candidatos: las sucursales que lo **vendieron**
  esta semana o que lo **tienen en stock**) y el reparto lo hace `aplicarVaciado()` con los
  parámetros de pantalla: por talle, sobre lo que queda después de la reposición normal, **de
  a una unidad por vuelta** en orden de `cmpPrioridad`. **Excepción**: si TODAS las candidatas
  ya tienen `minSuc` o más de ese talle, el talle **se deja** en el depósito (`R.vacDejados`,
  casillero gris «se deja») para no pasarles el límite de stock del local; necesita la hoja de
  stock por sucursal (sin ella se baja todo y lo avisa). **Mínimo del artículo (10/09/2026,
  pedido de Juli)**: control «Mandar solo si la sucursal tiene del artículo» (`filtrosVac.minArt`,
  default **2**; «sin mínimo» = 0): la sucursal con menos de N unidades del artículo (todos los
  talles) queda **afuera de ese artículo entero en el modo vaciado — también de la reposición por
  venta** (caso PUM31273108: Gonnet lo vendió pero ya no tenía, Calle 55 tenía 1; una unidad suelta
  no arma nada). `aplicarVaciado` arma `R.vacFuera` (id → {slug: stock}), no descuenta su
  reposición de la reserva (esas unidades se reparten entre las que sí lo tienen) y, si ninguna
  llega al mínimo, deja los talles (`vacDejados` con `sinSuc`). `reposFusionadas` pone esas filas en
  cero con el aviso «no va · tiene N» (se ven destildando «Solo lo que se puede mandar»); el ⇩ Excel
  y el guardado las omiten; `meta.vaciado_param.minArt`. Necesita la hoja de stock por sucursal.
  La separación «Reparto inicial» / «Barrida» por días desde la última compra (idea de Juli del
  10/09/2026) quedó hecha el 11/09: ver «No repartir lo nuevo» abajo.
  Los artículos que se vacían salen del
  reparto de «Completar curva» (bajan enteros igual). En pantalla: casilleros azules
  «+N · vaciar» y filas <span>solo vaciado</span> (sucursales que no lo vendieron pero lo
  tienen). En el ⇩ Excel la cantidad del talle = reposición + curva + vaciado. **Al guardar,
  el vaciado se SUMA a la reposición de cada sucursal** (no va en un nodo aparte: para el local
  es la misma mercadería que baja, y así lo ven sin cambios Indicadores y el Picking), con el
  campo `vaciado` por fila y `meta.vaciado_param`. ⚠️ Pendiente que definió Juli: usar la
  **curva de talles** (velocidad de venta por talle) como criterio adicional.
- **No repartir lo nuevo — «Días u.compra» (11/09/2026, pedido de Juli)**: el reporte de stock del
  depósito ahora trae, **por talle**, dos columnas: `Stock` y `Días u.compra` (días desde la última
  compra de ese talle). Viene con **dos filas de encabezado**: arriba el talle repetido dos veces y
  abajo «Stock | Días u.compra | Stock | …» (+ `Total | Total` al final, que se descarta; el total de
  días es el mínimo de la fila). `detectarCols` lo reconoce (`conDias`: alguna columna de la zona de
  talles dice «compra»/«días») y toma el rótulo del talle de la fila de ARRIBA; cada talle queda con
  `idx` (stock) y `diasIdx`. `filasDeHoja` devuelve `dias:{talle:d}`. Sin esa columna todo sigue
  igual. Los días **varían entre talles del mismo artículo** (p.ej. CAVEN III: 7–9.5 con 0 días y
  10–11 con 48), así que el filtro es **por talle**. **0 días = compró hoy** (validado: los artículos
  en 0 son justo los de los remitos 0005-00047640/43, los últimos de septiembre).
  Control en el grupo «Ingreso» del panel: tilde **«No repartir lo que ingresó hace menos de [N]
  días»** (`filtros.sinNuevos` + `filtros.diasNuevo`, default 10, se recuerdan en `barrida_prefs`;
  cambiar el número ya prende el tilde). Se aplica en `computar`: el talle con compra de hace menos
  de N días sale de la reserva repartible (`R.nuevos[t]={q,d}`, `R.nuevoU`; `R.totalDepo` = todo lo
  que hay) → no baja **por venta, ni por curva, ni por vaciado** (un artículo con mercadería nueva no
  es «reserva chica»). Compras y el snapshot del histórico usan `totalDepo`; un artículo con solo
  mercadería nueva y sin venta no es reserva parada. Como cambia lo que se reparte, el cambio llama a
  `recalcular()`, que rehace el cruce con los archivos y lo ya bajado de la base (`state._proc`, lo
  guarda `procesarBarrida`) y deja la semana «sin guardar». En pantalla: casillero violeta
  **«nuevo · N d»** (`esNuevoRet(d)`: `d.nv` unidades nuevas, `d.nd` días; se ve con «Ver los talles
  que no hay», no cuenta como faltante ni «hay que comprar», no va al Excel), pill «nuevo · sin
  repartir», «Stock reserva» con «+N» nuevas y en la tira de resumen «N u. nuevas sin repartir».
  Una barrida abierta del historial no trae días: el control queda deshabilitado. Se guarda
  `meta.dias_param = {reservaConDias, activa, dias, unidades, articulos}`. El «Reparto inicial» lee el
  reporte nuevo igual (`repReserva` usa `filasDeHoja`), todavía sin usar los días.
- **Pestañas por usuario e Historial (11/09/2026, pedido de Juli)**: `logistica@` y `deposito@`
  (`SOLO_REPARTO_MAILS`) ven solo **Barrida de reserva** y **Reparto inicial** (se les quita Reserva
  parada; Compras ya era solo de `COMPRAS_MAILS`). La pestaña «Histórico» **ya no existe para nadie**:
  es el botón **«🕘 Historial»** a la derecha de la barra de pestañas, que abre un panel (`#histPop`,
  fuera de `#view`, `pintarHistorial`/`abrirHistorial`/`cerrarHistorial`) con **buscador** por fecha
  («08/09», «2026-09»), mes o año; «Abrir →» llama a `abrirBarrida`. Se cierra con clic afuera o Esc.
- **Reparto por artículo, no por sucursal (08/09/2026, aclaración de Juli)**: el depósito agarra
  el artículo y lo reparte a todas las sucursales de una (ir local por local sería doble trabajo).
  Por eso el orden por defecto de la tabla y del Excel es **`sortRep.k='art'`**: los artículos que
  más unidades bajan primero y, dentro de cada uno, las sucursales por prioridad.
- **Qué queda en el depósito (08/09/2026)**: columna **«Queda»** por artículo = reserva −
  todo lo repartido (`restantePorArt()` sobre `reposFusionadas()`, que son las filas con curva y
  vaciado sumados y SIN los filtros de navegación); en azul los que salen enteros, y la tira de
  resumen cuenta cuántos artículos quedan en cero.
- **Se repite de la semana pasada (08/09/2026)**: al procesar, `cargarSemanaPrevia()` baja la
  reposición de la última barrida guardada anterior (`barridas/<lunes>/reposicion`, agregada por
  `id|slug`) y la fila lleva el chip **↻ repite** con cuántas unidades se le habían sugerido:
  o no se ejecutó el envío, o el artículo rota y hay que recomprarlo. Tilde «Solo lo que se
  repite» y contador en la tira. (De paso, `cargarHistKeys` pasó a `?shallow=true`: bajaba TODAS
  las barridas enteras solo para leer las claves.)
- **Curva de talles (08/09/2026, pedido de Juli)**: `curvaDeTalles()` calcula con la venta de la
  semana de todas las sucursales cuánto pesa cada talle, agrupado por **rubro + tipo de producto**
  (CALZADO ADULTO y CALZADO NIÑO tienen escalas distintas); ordenados de más a menos: **fuerte**
  = primer 60 % de la venta acumulada, **medio** hasta el 90 %, **flojo** la cola. Se usa en dos
  lados: el rótulo del casillero se tiñe (navy pleno / claro / apagado, con el % en el tooltip) y
  el control **«Solo talles que rotan»** de Completar curva no gasta reserva en los de la cola.
  Validado con el export real: en calzado adulto los fuertes son 8.5 · 8 · 9 · 9.5 · 7.5 (escala
  US), y el 47/48 caen en la cola.
- **Preferencias del depósito (08/09/2026)**: filtros, tildes, parámetros de curva/vaciado y orden
  se recuerdan en el navegador (`localStorage barrida_prefs`; la búsqueda no).
- **Sugerido vs. enviado (08/09/2026)**: cuarto botón opcional **«⇧ Transferencias»** en la
  tarjeta de carga: se sube el export de transferencias del sistema (CSV `;`-separado latin1 o
  Excel) y `parseTransf` cruza lo que la barrida sugirió con lo que realmente salió del depósito.
  Columnas por CONTENIDO, igual que el Control F8 de `equipo/` (mantener en sintonía), con dos
  arreglos propios: **la columna de sucursal se valida contra `NAME2SLUG`** (el rubro y el
  subrubro también empiezan con «NN-»: 02-CALZADO, 02-HOMBRE) y **el código de artículo empieza
  con letras y trae dígitos**, desempatando por cantidad de valores distintos. Reconoce el export
  simple (origen · destino · código · enviado) y el **pivot anual con una columna por mes**
  («Estad transferencias <año>»), del que toma el mes de la semana de la barrida y lo avisa.
  Solo cuenta lo que sale del depósito (`esDeposito`, con acentos plegados: el sistema escribe
  «05-Depósito»); si el export no trae ninguna salida del depósito, cuenta todo y lo aclara.
  Cruce por **Id.item** con respaldo por código. En la tabla, columna **«Enviado»** con estado
  (✓ completo · ⚠ parcial · ✗ sin salir · + sin estar en la barrida), tilde «Solo lo que falta
  enviar» y un **% de cumplimiento** en la tira de resumen. Si esa semana ya está guardada, el
  cruce se guarda en `barridas/<lunes>/transf` y vuelve al abrirla del histórico.
- **Reparto automático + tope de calzado + agrandar la curva (11/09/2026, pedido de Juli)** — reemplaza
  lo de los tildes que se describe más arriba:
  - **«Completar curva» y «Vaciar la reserva chica» se aplican SIEMPRE** («no encuentro escenario donde no
    quiera»): ya no hay tildes. La curva va siempre que haya stock por sucursal (`R.conStock`) y el
    vaciado siempre que haya artículos de reserva chica; `reposFusionadas` suma los dos a las filas, el
    guardado siempre graba `curva/<slug>` y suma el vaciado a la reposición. Sus parámetros (bloques
    verde y azul) quedan siempre a la vista. El ex «modo» vaciado es ahora un filtro de vista: grupo
    **«Ver solo»** con `filtros.verSoloCurva` / `filtros.verSoloVac` (título y Excel «Vaciado» cuando
    está puesto «Reserva chica»).
  - **Tope de calzado** (`filtros.topeCalzado`, default **3**, select «Calzado · Tope por talle en la
    sucursal»: sin tope / 2–5): con lo que se le manda, la sucursal no pasa de N unidades de ese talle,
    aunque haya vendido más. Se aplica en `computar` (objetivo = mín(vendido, N − lo que tiene); campos
    `d.tiene` y `d.top`; totales en `R.tope`), en `aplicarUnidadesCurva` (`capDe`) y en `aplicarVaciado`
    (`cabe`: si ninguna puede recibir, el talle «se deja» con `tope`). Necesita el stock por sucursal;
    cambiarlo llama a `recalcular()`. Casillero «de 13 · tiene 2» y, con «Ver los talles que no hay»,
    gris «— · tiene 3» para los que no van.
  - **Agrandar la curva** (`filtrosCur.centralHasta`, default **3**, select «Talles centrales con poco
    stock»: no agrandar / llevar a 2 / llevar a 3 si alcanza): en los talles **centrales** (la misma
    tabla del Reparto inicial, `centralesDe` → `repCentrales`; al procesar se bajan los editados de
    `repartoConfig/centrales`) donde la sucursal tiene 1 o 2, `computar` arma `row.engrosa=[{t,r,q,s}]`
    (y crea la fila de curva aunque no le falte ningún talle). `aplicarUnidadesCurva`, después de los
    talles faltantes y con la reserva que queda, sube por **rondas en orden de prioridad**: todas a 2
    y, si alcanza, a 3 (cuenta lo que tiene + lo que le va por venta; respeta el tope). Casillero verde
    «+1 · tiene 1» (`engChips`). Se guarda dentro de `curva/<slug>/talles` con `tiene` (Indicadores:
    columna «Te mandan»; `abrirBarrida` lo separa de los faltantes por ese campo).
  - **Abrir a más sucursales** (Juli 11/09/2026, a partir del informe «reparto automático vs. manual» de
    Puma: el depósito, a mano, le manda a sucursales que NO tienen el artículo cuando lleva días en la
    reserva y lo que baja por venta igual deja mercadería parada). Cuarto paso automático, después de
    venta → vaciado → curva (`aplicarReparto()` = `aplicarVaciado` + `aplicarUnidadesCurva` +
    `aplicarAmpliar`), con la reserva que dejaron los otros. **Artículo**: calzado o indumentaria, sin
    mercadería nueva, cuya compra más nueva (mínimo de «Días u.compra» entre sus talles, `ampBase` en
    `computar`) es de hace **N días o más, N = el mismo número de «Ingreso»** (`filtros.diasNuevo`,
    default 10: lo más nuevo va por el Reparto inicial); no entra si es reserva chica. **Candidatas**:
    sucursales con menos del mínimo del artículo del vaciado (`filtrosVac.minArt`, 2) que esa semana no
    reciben nada de él, con la marca en Asignación de Marcas (`repCandidatos`/`repAsig`, igual que el
    Reparto inicial; sin asignación cargada no entra) y con menos de 6 meses de stock en la marca-rubro.
    **Nunca Aurelius** (Juli: trabaja canal moda y modelos puntuales de cada marca, p.ej. en adidas solo
    Originals) **ni los locales Adidas** (`ampExcluida`). **Y al revés tampoco (11/09/2026, caso Court Vision
    Low negro NIKDH2987002 del informe Nike automático vs. manual): un artículo que en el stock por sucursal
    está SOLO en Aurelius es modelo del canal moda: se abre ÚNICAMENTE a Ecommerce, la web de Aurelius**
    (`AMP_WEB_AURELIUS`; es lo que hizo el depósito a mano con ese artículo: 11 pares a ecom). A la web no se
    le aplica el tope de 6 meses de stock (su ratio es el de toda la web). Ni Mateu ni outlets; contador
    `R.ampAurelius` en el bloque turquesa. Ese día eran 103 de los 452 Nike con stock. **Los outlets recién desde los 40 días**
    (`filtrosAmp.outletDias`, editable en pantalla). **Cuánto**: curva de arranque de `repRepartirArt`
    (2 en los centrales —«hasta 3 si alcanza»—, 1 en el resto, mínimo 3 talles y algún central, sin
    excedente) y queda 1 por talle en el depósito; la que tiene 1 unidad suelta cuenta como que no lo
    tiene (si no, recibía un talle suelto); respeta el tope de calzado. Si lo que sobra del artículo
    queda en menos de 3 talles (después de dejar la reserva) no se abre: sería una curva rota
    (`R.ampSinCurva`). Pantalla: bloque turquesa
    «Abrir a más sucursales» (parámetros + unidades/líneas/artículos + cuántos artículos viejos no
    tienen ninguna sucursal para abrir o no arman curva), casilleros turquesa «+N · abrir», pill
    «sucursal nueva», «Ver solo: Otras sucursales», suma al ⇩ Excel. Al guardar se SUMA a
    `reposicion/<slug>` (campo `ampliar`, `soloAmpliar` + `diasDeposito` en las filas nuevas;
    `meta.ampliar_param`), así Indicadores y el Picking no cambian. Prueba 11/09 con los reportes reales
    de Puma (escrituras a Firebase bloqueadas): 32 artículos califican, 22 se abren (201 u. en 35
    líneas), 10 sin sucursal para abrir y 13 que no arman curva. ⚠ En
    los artículos con más diferencia del informe (CARINA MIA, REBOUND V6) no hay a quién abrir: ya los
    tienen las 11 sucursales de línea y lo que falta son Aurelius (excluida) y outlets (tienen menos de
    40 días), así que esa diferencia no la explica esta regla.
- **Amarillo = va menos, rojo = no va nada; talles en orden (11/09/2026, pedido de Juli)**: en la
  columna Talles, el casillero que **recibe algo pero menos de lo pedido** (`0 < s < v`, la reserva no
  alcanzó y por prioridad le tocó menos) es **amarillo** (clase `corto`, pill «⚠ recortado» también
  amarillo); **rojo** (`rec`) queda solo para los que **no reciben nada** (`s = 0`: se lo llevó otra
  sucursal, o «no hay» con borde punteado). Lo nuevo retenido pasó a **violeta** para no confundirse con
  el amarillo. En el ⇩ Excel, igual: celda en 0 roja, celda con menos de lo pedido amarilla
  (`BRAND.cortoBg/cortoTxt`). Los casilleros de la fila (reposición + curva + vaciado + «se deja») van
  en **un solo recorrido de menor a mayor talle** (`cmpTalle`; `curvaChips`/`vacChips`/`dejChips`
  devuelven `[{t,h}]` y la fila los intercala; a igual talle, reposición primero).
- **Dos rojos distintos en los talles (08/09/2026, no se entendían)**: el casillero rojo decía
  siempre «pedía N» y mezclaba dos cosas. Ahora `talleChip` separa **«no hay»** (borde punteado,
  `d.r<=0`: el depósito no tiene NINGUNA de ese talle — no se la llevó nadie, hay que pedírsela
  a la marca) de **«de R · pedía V»** (hay stock pero no alcanza y por prioridad le tocó menos).
  El pill de la fila también: **⚠ hay que comprar** (`sinStockEn`) vs. **⚠ recortado**.
- **Por defecto NO se muestra lo que no se puede reponer (08/09/2026, pedido de Juli)**: para
  armar la barrida solo sirven los talles que bajan. `filtros.verRojos` (default **false**) oculta
  los casilleros que quedan en 0 —el depósito no tiene el talle, o se lo llevó otra sucursal— y
  los pills ⚠ de la fila; el ⇩ Excel tampoco lleva esos ceros ni sus columnas. El tilde
  **«Ver los talles que no hay»** (grupo Mostrar) los trae de vuelta, y el contador
  «N con faltante de talle» de la tira de resumen funciona como interruptor. «Solo con faltante
  de talle» lo prende solo. Los recortados que igual mandan algo (`s>0`) se ven siempre.
- **La tabla ya no se corta (08/09/2026)**: `main` pasó de 1200 a **1600 px** de ancho y los
  casilleros de la columna Talles van en un `div.tw` con `max-width:560px` y `flex-wrap`, así
  envuelven en vez de estirar la tabla fuera de la pantalla (a 1440 px ya no hay scroll lateral).
- **Tarjeta de carga plegada (08/09/2026)**: con la barrida procesada queda una sola línea
  (chips ✓ de los archivos, la semana, ↻ Reprocesar y 💾 Guardar); «⇧ Archivos» la despliega y
  «▴ plegar» la vuelve a cerrar (`state.cargaOpen`). Pasó de ~130 px de alto a 46.
- **Ingreso reciente / crónica**: NO hay columna de fecha ni SKU en recepciones, así
  que se resuelve con el **histórico semanal** guardado: un artículo que aparece por
  primera vez en la reserva = *ingreso reciente* (se separa de "parada"); "semanas"
  cuenta cuántas semanas seguidas lleva en reserva. En una sola semana el ~65% de los
  SKUs no vende → la lista "parada" cruda es ruidosa; el valor sale del filtro
  *crónica (3+ semanas)* que se acumula semana a semana.
- **Firebase**: **reusa la base `recepciones-mateu`** (la del Depósito Central, ya
  existe con reglas abiertas). Se descartó crear una base propia `barrida-mateu` para
  no depender de un alta manual; los datos viven en un nodo aparte `barrida/…` sin
  tocar el árbol `recepciones/…`. Constante `FIREBASE_DB_URL` en `barrida/` y
  `BARRIDA_URL` en `indicadores/`. Árbol: `barrida/barridas/<lunesISO>` con
  `{meta, reposicion:{<slug>:[...]}, curva:{<slug>:[...]}, parada:[...], compras:[...]}`,
  `barrida/reservaHist/<lunesISO>` (snapshot `{idItem:total}` para ingreso reciente /
  semanas) y `barrida/ultima` (puntero al último lunes). La reposición se guarda
  **agrupada por slug de sucursal** para que cada sucursal baje solo lo suyo (seguridad
  blanda, como Indicadores).
- **Aviso a la sucursal**: vive en **`indicadores/`** (la home de sucursal/outlet).
  La sección `secBarrida` lee `recepciones-mateu/barrida/ultima` + `.../reposicion/<slug>`
  y muestra "Reposición disponible" con lo que esa sucursal puede pedir del depósito.
  Sin dato → la sección no aparece. Usa el mapa `SUC2SLUG` (nombre→slug).

**Puesta en marcha: ya funciona (usa `recepciones-mateu`, que está en vivo). No hace
falta crear ninguna base.**

## Reparto inicial (pestaña de `barrida/`, 10/09/2026)

Pedido de Juli: **diferenciar la barrida de reserva del reparto inicial, en dos pestañas**. La
pestaña «Reposición» pasó a llamarse **«Barrida de reserva»** (sin cambios: reporte de stock +
estadística de ventas) y se sumó **«Reparto inicial»**, que reparte lo que **entró** y se alimenta
de la **estadística de remitos**. Código en el bloque «REPARTO INICIAL» de `barrida/index.html`
(funciones `rep*`, estado `state.rep`).

- **Entrada**: el CSV pivot «Estad remitos <año>.csv» (una columna Cant.recibido + Costo por mes,
  encabezados de texto vacíos → las columnas se reconocen por contenido en `repParseRemitos`: nro
  de remito `0005-000…`, ID ITEM, código, marca, rubro, subrubro, disciplina, tipo), el Excel
  «Remitos de ingreso» (mismo pivot con encabezados) o un export con columna Remito + columnas de
  talle. Se elige el **mes de ingreso** y se marcan los remitos (los ya repartidos se ocultan).
- ⚠ **El export de remitos NO trae talles.** Cada artículo se abre con la curva que tiene hoy en la
  **reserva del depósito** (el mismo reporte de stock de la Barrida, `repReserva`; también sirve el
  stock global con las filas «Depósito»), repartida entre sus remitos por la cantidad de cada uno
  (`repTallesDe`, mayor resto). Si la reserva tiene menos que lo que entró, se reparte lo que hay y
  la tira lo avisa («N u. de los remitos ya no están en la reserva»). Si el sistema saca la
  estadística de remitos abierta por talle, se usan esos talles exactos.
- **A quién y en qué orden** (`repCandidatos`/`cmpReparto`): la marca tiene que estar en la
  **Asignación de Marcas** de la sucursal (`asignacion_marcas/data` = calzado, `data_indumentaria`;
  accesorios mira las dos; sin asignación cargada entra igual con el rango más bajo; marcas «niño»
  solo para artículos de niño; si la marca tiene disciplinas, la del artículo tiene que estar —
  tilde); **Mateu Kids (`SOLO_NINO`) no recibe adulto**. Orden: ya lo recibió en un reparto
  anterior (memoria, tilde) → marca principal/niño > especial > secundaria → **categoría** →
  **venta** de la marca en el rubro el último mes de Meses de Stock (`ventasMarcaDe`, en tres
  niveles respecto de la que más vende) → **meses de stock** (menos = antes). Destinos por defecto:
  todas menos los outlets; Diagonal 80 entra (`SUC_EXTRA`, la Barrida todavía no la toma).
- **Cuánto** (`repRepartirArt`): talles centrales 2 unidades (hasta 3 si alcanza), resto 1; a una
  sucursal no se le manda una curva rota (mínimo de talles + algún central); el excedente se sigue
  repartiendo de a una por talle (tilde); **queda ~1 curva en el depósito** (1 por talle con 2 o
  más, en el remito que más tiene del artículo). Todo parametrizable en «2 · Cómo repartir».
- **Talles centrales** (`CENTRALES_DEF`, editables en pantalla y compartidos en
  `barrida/repartoConfig/centrales`): calzado dama 37/37.5/38 AR + US 5.5/6/6.5 (Puma UK
  4.5/5/5.5), hombre 41/41.5/42 AR + US 8.5/9/9.5 (Puma UK 8/8.5/9); indumentaria dama S-M, hombre
  y unisex M-L, niño 10-12 (+10A/12A/YM). Los US/UK se calibraron con la estadística de ventas real
  del 08/09/2026. Calzado niño/unisex/infante no tiene regla: los talles del medio del artículo.
- **Un artículo en varios remitos** se reparte junto (una curva por sucursal) y cada unidad sale del
  remito que más le cubre / que ya le está dando a esa sucursal.
- **Salida**: vista «Por remito» (una tarjeta por remito con cada artículo, sucursales en orden de
  prioridad con sus casilleros de talle y «Queda en el depósito»), «Por sucursal» y «Sin repartir»
  (con el motivo); ⇩ Excel con **una hoja por remito** (para imprimir en su ubicación) + resumen por
  sucursal; 🖨 Imprimir.
- **El hueco entre los dos reportes (12/09/2026, planteo de Juli)**: esta pestaña sale de la
  estadística de **remitos** y la Barrida del reporte de **stock** con «Días u.compra», así que un
  artículo puede tener compra de hace pocos días (la Barrida no lo reparte: lo ve nuevo) y no figurar
  en ningún remito de la lista — sin nadie que lo reparta. Ahora el corte en días es **UNO SOLO para
  las dos pestañas** (`state.filtros.diasNuevo`, editable desde las dos; en el Reparto está en el
  grupo «Ingreso» del panel 2) y el Reparto inicial, además de los remitos marcados, suma solo esos
  artículos: `repNuevosSinRemito` (talles con `dias < N` que no vienen por un remito elegido y que no
  se repartieron en los últimos N días según la memoria) los mete como un artículo más con el remito
  virtual `REP_NUEVO`, que sale en su propia tarjeta **«Ingresó hace poco · sin remito»** (violeta,
  hoja «Sin remito» en el Excel). Se puede armar el reparto **solo con eso**, sin marcar ningún
  remito. El tilde «Sumar lo que ingresó hace poco y no está en los remitos» lo apaga. La tarjeta
  virtual NO marca remitos como repartidos (no lo son): lo que evita repetirla es la memoria por
  artículo. `repReserva` ahora guarda también `dias`, `meta` y `conDias` (y se cachea por archivo);
  cada artículo muestra hace cuántos días entró lo que hay en el depósito, y si ya pasó los N días
  aclara que lo toma la Barrida. Sin la columna «Días u.compra» en el reporte de stock, la tarjeta de
  selección lo avisa y no se detecta nada. Probado 12/09 con «Estad remitos 2026.csv» + el reporte de
  stock con días de Puma: de 17 artículos nuevos, 16 venían en los remitos de septiembre y 1
  (BORUSSIA C TT, compra de hace 7 días) no estaba en ninguno → se repartió por la tarjeta nueva.
- **Firebase** (`recepciones-mateu/barrida/`): `repartos/<AAAA-MM-DD_HHMMSS>` = `{meta, remitos,
  porSuc}` (porSuc agrupado por slug, por si después lo lee Indicadores/Picking),
  `remitosRepartidos/<nro>` = `{rep, fecha, por}` y `repartoHist/<idItem>/<slug>` = `{t:[[talle,q]],
  ts, rep}` (memoria de 120 días). «Borrar» un reparto guardado devuelve sus remitos a pendiente y
  lo descuenta de la memoria.
- Probado el 10/09/2026 con «Estad remitos 2026.csv» (2.102 remitos) + el reporte de stock del
  depósito de Puma: 9 remitos de septiembre → 540 u. a 14 sucursales, 77 quedan.

## Panel General de Logística (`logistica/`, 08/09/2026)

Dashboard de logística (envíos e ingresos), **pantalla inicial de `logistica@` y `deposito@`**.
Desde el 08/09/2026 (tarde) las dos cuentas están en **`PERFILES_FIJOS`** del Portal (sus
herramientas, `inicio:'logistica'`, `soloHerramientas:true`), como producto@/rrhh@, así la
pantalla inicial no depende del ⚙ ni de la sesión que tengan abierta; sus registros en
`usuarios/` llevan lo mismo. Son admin (lo exigen sus módulos) pero ven SOLO esas herramientas.
Ojo: un admin **sin** `soloHerramientas` ve todos los tiles aunque se le marquen algunos — por
eso el ⚙ avisa en cada fila «⚠ Hoy ve TODAS las herramientas». Las sesiones ya abiertas toman
los cambios del ⚙ al pasar por el Portal (`refrescarSesion` en `init()`).
**Nombre visible (pedido de Juli 08/09/2026): «Panel General»** para quien lo tiene de pantalla
inicial (`session.inicio==='logistica'`: tiles del Portal `nombreTool`, drawer de `header.js`,
título/hero del módulo `NOMBRE_MODULO`) y **«Panel General · Logística»** para gerencia, que ya
tiene el Panel General de Indicadores (así no hay dos tiles iguales en la grilla de Juli). En
el código y en este archivo se sigue hablando de «logística» / envíos e ingresos. Replica
el informe HTML «Dashboard Gerencial — Envíos e Ingresos» (jun–ago 2026, generado fuera del
portal) con datos vivos: `index.html` self-contained (header unificado, Chart.js 4 + SheetJS
por jsdelivr; ⚠ en cdnjs la ruta de Chart.js da 404).

- **Fuente = los dos exports pivot del sistema** (CSV `;` latin1, una columna por mes 1..12,
  el año va en el nombre del archivo): **«Estad transferencias <año>.csv»** = envíos del
  depósito a cada sucursal (origen · rubro · subrubro · marca · proveedor · disciplina · tipo
  de artículo · campaña · línea · código · artículo · ID ITEM · destino · meses; una fila
  «Total» por artículo que se descarta) y **«Estad remitos <año>.csv»** = ingresos al depósito
  (marca · rubro · subrubro · disciplina · remito · tipo · campaña · línea · artículo · código
  · ID ITEM · pares Cant.recibido/Costo por mes + Total; segunda fila de encabezado). El
  informe HTML original era un **recorte** de estos archivos (Adidas/Nike/Puma y 4
  disciplinas, jun–ago): 9.226 de sus 9.228 filas coinciden con el CSV.
- **Modelo Firebase** (`recepciones-mateu/logistica/`): `arts/<clave>` = maestro compartido
  `[rubro, sub, disc, marca, idItem, artículo, tipo, código]` (clave = código con `. # $ [ ] /`
  → `_`; el rubro va sin el prefijo «NN-»: `CALZADO`), `meses/<YYYY-MM>` =
  `{meta:{envios:{archivo,hoja,subido,por,filas,unidades}, ingresos:{…}},
  envios:[[clave, sucursal, unidades],…], ingresos:[[clave, unidades, costo],…]}` (sumados
  por artículo × sucursal × mes), **`porSuc/<slug>/<YYYY-MM>`** = `{u, rubros:{}, marcas:{},
  top:[[art, marca, u, cod]…]}` (resumen por sucursal, seguridad blanda: Mi Sucursal baja solo
  el suyo; `PREFIJO_SLUG` NN→slug como en objetivos/), `avisos/<YYYY-MM>` (recordatorio ya
  mandado) y `ultimo`. **Carga perezosa (08/09/2026 tarde)**: al abrir baja `arts` + los
  últimos `MESES_INICIALES` (3) meses; el filtro «Mes» lista todos los del año (los no
  cargados con «·») y `refresh()` baja a demanda los que se elijan más el período anterior y
  el mismo del año anterior (para las variaciones); «Limpiar filtros» = todo el año.
  Sembrado el 08/09/2026 ene–sep 2026 con `node scripts/importar-logistica-csv.js 2026
  "<transferencias.csv>" "<remitos.csv>" [--dry]`. Totales: 643.710 enviadas · 787.804
  ingresadas · 151 marcas.
- **Parser en `lib/logistica-parse.js`** (UMD, `window.LogisticaParse` / `require`): única
  fuente de verdad de la lectura de los exports (`detectarPivot`, `conocidosDesde`,
  `inferirColumnas`, `parsearPivot`, `detectarPorNombre`, `parsearPorNombre`, `csvAMatriz`,
  `filasMes`, `unidadesDe`, `resumenPorSucursal`, `ymDeCelda`…). Lo usan el módulo, el
  script de siembra y los tests: **`node --test lib/logistica-parse.test.js`** (fixtures con
  el formato real, columnas desordenadas, remitos con costo, formato por nombre).
- **Pantalla**: 7 filtros multi-select propios (`multiSel`, chips con buscador; **encadenados**:
  cada uno ofrece solo los valores que quedan con los demás; el de Sucursal aplica solo a
  envíos porque los ingresos son del depósito; el 7.º es Tipo de artículo) → 5 KPIs
  (enviadas, ingresadas con **costo** en millones, **sin distribuir**, sucursales, artículos ·
  marcas) con **chips de variación** `varChip` vs. el período anterior de la misma cantidad
  de meses y vs. los mismos meses del año anterior (solo si están todos cargados) → Envíos
  (unidades por sucursal con selector «ver solo estas», anillo por rubro, **línea por mes con
  el año anterior punteado** y el **ritmo del mes en curso** `ritmoHtml`: unidades por día
  hábil lun–sáb sin feriados del calendario del shell `shared/data/calendario-<año>.json`,
  proyección y % del ritmo del mes pasado; top marcas, disciplinas, subrubros) →
  **«Abastecimiento vs. venta»** `ventaVsEnvios` (unidades enviadas por cada 100 vendidas por
  sucursal; la venta neta sale de `data/indicadores/<ym>/cadena.json` — períodos RETAIL, sin
  apertura por rubro — solo para los meses que tienen período) → Ingresos con **switch
  «Unidades / $ al costo»** (`MODO_ING`, `valIng`) para rubro/subrubro/mes → **«Ingresó y no
  salió»** `noSalio` (por artículo: ingresó − salió a cualquier sucursal en los mismos meses,
  % distribuido con barra, top 30; alimenta el KPI «Sin distribuir») → detalle **ordenable por
  columna** (`TB.sort`), **«Agrupar por artículo»** (suma sucursales) y **«⧉ Copiar»** (TSV al
  portapapeles), con «Ingresó al depósito» del mismo artículo+mes. «⇩ Excel» = Envíos,
  Resumen, Ingresos (con costo), Sin distribuir y Vs. venta. Plugin `valueLabels` dibuja
  valor · % en barras/anillo/puntos (texto plano, sin contorno; sin % con un solo valor).
- **Recordatorio de carga** (`recordatorioCarga`): si falta el mes anterior (desde el día 5)
  sale un banner ámbar con «⇧ Cargar ahora» y se manda **una vez por mes** un directo por la
  Bandeja a `AVISO_MAILS` (logistica@, deposito@; flag `logistica/avisos/<ym>`).
- **Mi Sucursal**: sección **«Qué te mandó el depósito»** (`secDeposito`,
  `renderDeposito`/`paintDeposito` en `indicadores/`, zona viva, después de la Reposición):
  lee `logistica/porSuc/<slug>` y muestra por mes (selector) unidades recibidas con variación
  vs. el mes anterior (el mes en curso se marca «parcial»), chips por rubro, barras por marca
  y los 10 artículos que más llegaron. Sin resumen → la sección no aparece.
- **Carga mensual** («⇧ Cargar export», modal con dos recuadros envíos / ingresos, CSV o
  Excel, drag & drop; el CSV se lee como windows-1252): `detectarPivot` reconoce el pivot del
  sistema por la fila de meses (y «Cant.recibido» en la segunda fila para remitos). **El orden
  de las columnas de texto NO importa (pedido de Juli 08/09/2026)**: `inferirColumnas` asigna
  cada columna por su CONTENIDO (valores conocidos del maestro `ARTS` para rubro/subrubro/
  disciplina/tipo/marca; patrones para ID ITEM, código, sucursal «NN-…», artículo; proveedor,
  campaña y nro. de remito se ignoran solos) y la previsualización muestra el panel «Cómo leí
  las columnas» (ejemplos + selector por columna, `CAMPOS`): cambiar un selector re-lee el
  archivo (`reprocesar`), marca «corregida», bloquea Guardar si falta Código/ID, Artículo o
  Sucursal destino, y recuerda la corrección por tipo y cantidad de columnas (localStorage
  `logi_colmap_<tipo>_<n>`). Respaldo `detectarPorNombre`/`parsearPorNombre` para una tabla
  plana con encabezados por alias (`ALIAS`: mes desde Fecha o Mes), con el mismo panel. El año
  sale del nombre del archivo o del campo «Año». Avisa si el archivo parece del otro recuadro.
  Cada mes del archivo **reemplaza** ese mes y tipo y actualiza el maestro (PATCH multi-path);
  los demás meses quedan. Validado con los dos CSV reales y con una copia con las columnas
  desordenadas: mismos totales que el script. Etiquetas de los gráficos (`valueLabels`): texto
  plano sin contorno, blanco adentro / navy afuera, sin % cuando hay un solo valor.

## Objetivos de Venta Semanal (y Mensual)

`objetivos/` es un `index.html` self-contained (lee la sesión del Portal, sin login
propio). Lo carga **gerencia**: el objetivo de venta por sucursal, semanal y mensual.
La ve el rol `admin` o quien tenga la herramienta `objetivos`. Las sucursales NO
entran acá: ven su objetivo en Indicadores.

- **Objetivo MENSUAL (18/08/2026)**: pestañas «Mensual · cargar» y «Mensual ·
  dashboard». Se sube el Excel **"Objetivos Ventas Mensual - Al MM-YYYY.xlsx"**
  (`Desktop/PMS/MENSUAL/`): libro ACUMULATIVO, una hoja por mes ("AGO26") y cada
  hoja trae todos los meses en bloques de 4 columnas (OBJETIVO · ALCANZADO ·
  %REAL · %ESTIMADO) desde ago-2021 — el año de cada bloque se deduce contando
  hacia atrás desde el mes de la hoja. La META publicada sale de la **tabla
  lateral** del mes (objetivo REDONDEADO, el que se comunica, con su división
  **Semanal**); fallback al bloque sin redondear. El mes en curso viene sin
  ALCANZADO: el real llega con el Excel del mes siguiente. Checkbox «Publicar
  también el histórico» → PATCH con todos los meses (habilita el **vs. mismo mes
  del año anterior** del dashboard; `·m` = compara la meta porque el mes está
  abierto). Avance del mes abierto = suma de las semanas del mes: real oficial donde está y, si no, la venta provisoria cargada (ventaEquipo) — «x sem».
  Firebase: `objetivos/meses/<YYYY-MM>` (mismo formato porSlug que las semanas,
  + campo `semanal`) y `objetivos/ultimoMes`. En **Indicadores**, bloque
  «Objetivo del mes» dentro de la sección Objetivo (cada sucursal baja solo su
  slug; suma semanas publicadas + lo provisorio del encargado).

- **Valores por sucursal/semana**: **META** (el objetivo, el único que se carga),
  **MÍNIMO** (= Meta ÷ 1,2), **120** (= Meta × 1,2, el gran objetivo; en pantalla se llama solo «120», destacado) y **REAL** (venta de
  la semana). Banda geométrica de razón 1,2 alrededor de la Meta (validado con el
  Excel real de Juli: p.ej. Meta 108M → Mín 90M → 120 129,6M). Mínimo/120 se derivan
  solos y se guardan horneados. Los factores están en `F_MIN`/`F_120` del módulo.
  ⚠️ Los objetivos son montos grandes (decenas/cientos de millones de pesos): la venta
  semanal de una sucursal grande ronda los 100M. Cuidado con hojas viejas del Excel que
  vienen en otra escala (×40 menos).
- **Carga (Etapa 1, dos caminos)**: (a) subir el Excel **"PMS Objetivos Semanal
  Locales"** (SheetJS por CDN, client-side, no se sube nada) → se elige la hoja de la
  semana ("SEMANA 3 AGO"…) y se parsea la grilla; o (b) cargar los montos a mano. Todo
  editable antes de guardar. El parseo detecta la sucursal por su **código NN** (01,
  02, … → slug del Portal vía `PREFIJO_SLUG`), toma el objetivo y la venta real de la
  fila, y las filas "FINAL AJUSTADO" (más abajo en la hoja) **pisan** a las de "FINAL".
  El lunes de la semana se deduce del nombre de la hoja.
- **Dashboard (gerencia)**: por semana, tabla con Meta/Mínimo/120/Real, % de
  cumplimiento con color (verde ≥meta, ámbar ≥mínimo, rojo <mínimo), total cadena,
  ranking ordenable y barra de avance. Selector de semana + histórico.
- **Firebase**: **reusa `recepciones-mateu`** (nodo `objetivos/…`, sin tocar
  `recepciones/…` ni `barrida/…`; no hace falta crear base). Árbol:
  `objetivos/semanas/<lunesISO>` con `{meta:{…}, porSlug:{<slug>:{meta,minimo,s120,real,nota}}}`
  y `objetivos/ultima` (puntero al último lunes). Se guarda **agrupado por slug** para
  que cada sucursal baje solo lo suyo (seguridad blanda, como Indicadores/Barrida).
  Constante `FIREBASE_DB_URL` en `objetivos/`, `OBJETIVOS_URL` en `indicadores/`.
- **Aviso a la sucursal**: vive en **`indicadores/`**, **arriba de todo** (encima de
  los KPIs — es lo primero que ve el encargado). La sección `secObjetivo` lista las
  semanas publicadas (`objetivos/semanas.json?shallow=true` → solo las claves, sin bajar
  datos de otras sucursales) en un **selector para ver semanas anteriores**, y por la
  elegida lee `.../porSlug/<slug>` (Meta destacada, Mínimo/120 y barra de avance vs.
  Real). Sin dato para esa semana → nota "aún sin cargar"; sin ninguna semana → la
  sección no aparece. Usa `SUC2SLUG`.
- **Venta por vendedor que carga el encargado** (en `indicadores/`, dentro de la
  sección Objetivo): panel desplegable "Cómo viene el equipo". El encargado sube el
  Excel de venta **abierta por vendedor** (SheetJS lazy), **previsualiza** y guarda.
  Tres formatos autodetectados en orden: (1) template PMS semanal (hoja PMS(H) +
  día a día de la hoja REAL — `vePegarDias` cruza los nombres de las dos hojas: idéntico →
  sin lo que va entre paréntesis → parecido único → mismo total de venta, y la vista previa
  avisa quién quedó sin días; hasta el 10/09/2026 exigía el nombre idéntico y en Aurelius 12
  «NICORA EZEQUIEL (VENDEDOR FULL)» vs. «NICORA EZEQUIEL» dejó al vendedor sin día a día); (2) **la estadística detallada por línea** (26/08/2026,
  la misma que sube gerencia en la vista Cadena — puede venir SIN columna Sucursal
  y hasta SIN encabezados: `veParseDetallado(m, sucFija)` + `veDetectarColumnas(m,
  sinSuc)` asumen la sucursal de la sesión, se quedan solo con los días de la semana
  elegida y traen el día a día por vendedor; va ANTES del genérico porque el genérico
  la leería mal); (3) **planilla por día** (27/08/2026, la que arma el encargado a
  mano: días en COLUMNAS — fila de «lunes/martes/…» en celdas combinadas arriba y
  sub-encabezados unidades·ticket·Importe por bloque, una fila por vendedor —
  `veParseMatrizDias`; suma los bloques y arma `dias`; va antes del genérico, que
  tomaría solo el primer día); (4) genérico (columnas vendedor/venta y, si vienen,
  tickets/unidades — sin días). Muestra
  ranking por venta con barra de participación, avance del equipo **vs. la Meta de la
  semana**, y UPT/ticket promedio por vendedor cuando el Excel trae tickets/unidades.
  Firebase: reusa `recepciones-mateu`, nodo `ventaEquipo/<slug>/<semanaISO>` (agrupado
  por slug → cada sucursal baja solo lo suyo, como Objetivos/Barrida).
- **Objetivos por equipo SIN Excel (reemplaza el circuito PMS)** — el recorrido:
  gerencia publica el objetivo semanal → el encargado **arma su equipo y asigna horas
  de venta por turno×día** (editor en el panel "Cómo viene el equipo" de Indicadores:
  agregar/quitar gente, importar de Plantilla, grilla 3 turnos × 7 días por persona,
  cap 4/3/4 h; semana nueva copia la anterior) → el portal **reparte la Meta** entre
  las personas. Turnos: T1 9-13 · T2 13-16 · T3 16-20. Fórmula (validada contra el
  PMS real de Aurelius CB): el peso de un turno-día se divide entre las horas del
  equipo en ese turno-día; `share persona = Σ horas×peso/horasEquipo`; su meta/mínimo
  = share × Meta/Mínimo. **Matriz de pesos**: pestaña **"Pesos por turno"** de
  `objetivos/` — Juli sube mensualmente la estadística de venta por sucursal×hora×día
  (hoja tipo "Datos actualizados"; T1=filas 9-12, T2=13-16, T3=17-20) y se publica en
  `objetivos/pesosTurnos` (porSlug); fallback horneado `indicadores/pesos-turnos.js`
  (regenerable con `node scripts/gen-pesos-turnos.js "PESOS TURNOS….xlsx"`). Equipo en
  `objetivos/equipos/<slug>/<lunesISO>` (equipo + real manual). La venta real
  individual sale del Excel PMS subido (match por nombre) o de carga manual (pisa al
  Excel). ⚠️ `num()` de objetivos come el punto decimal si hay exactamente 3
  decimales: para celdas numéricas usar el valor directo (ver `numCell`).
  Diagonal 80 tiene objetivo pero no datos de Indicadores: desde el 21/08/2026 la
  sección Objetivo (mes + semana + equipo) y la Reposición se muestran igual, porque
  resuelven el slug con `slugActual()` (sesión) y no con `SUC2SLUG[sucName]`; solo
  los KPIs quedan en empty state hasta que Diagonal tenga datos de venta.
- **Venta de la semana en curso (real provisorio)**: Juli baja del sistema la
  estadística detallada por línea de la semana ("Semana DD-MM-AA.xls") y corre
  `python scripts/cargar-venta-semana.py "<xls>" <lunesISO> --publicar` → escribe
  `ventaEquipo/<slug>/<lunesISO>` (venta · tickets · unidades · día a día por vendedor)
  para las 21 sucursales con los criterios por línea del ETL. Sin `--publicar` solo
  muestra el resumen vs. meta. Se puede re-correr con el archivo actualizado (pisa).
  NO escribe el `real` de `objetivos/semanas` (ese es el oficial del HISTÓRICO).
  **Desde el portal (22/08/2026, el camino habitual):** en Indicadores (Panel General),
  vista **Cadena**, sección «Objetivo de la semana», botón **«⇧ Cargar venta de la
  semana»** (solo gerencia): sube el export detallado con TODAS las sucursales — sirve
  tanto el semanal ("Semana DD-MM-AA.xls") como el **del mes entero** ("Venta Agosto
  Portal.xlsx", encabezados «Numero de comprobante»/«Descripcion» también válidos) como
  la vista **"Venta semanal portal"** del sistema ("ventas semana DD-MM.xlsx": **sin fila
  de encabezado**, sin año/mes, rubro sin prefijo «CALZADO»; `veDetectarColumnas`
  reconoce cada columna por su contenido — código «NN-» de sucursal, Lu/Ma/…, nro de
  comprobante «FcC.0057-…», rubros conocidos, enteros día/hora, los dos numéricos
  finales = cantidad/importe, texto antes del nro = vendedor y después = artículo).
  Con año y mes (filas 0-1) arma la fecha completa de cada comprobante; sin ellos
  compara los pares (día de semana, día del mes) con el calendario de la semana. El
  portal se queda **solo con los días de la semana elegida** en el selector
  (auto-selecciona la última publicada que el archivo cubre; si ninguna venta cae en
  la semana, bloquea Publicar). `veCriterioLinea` normaliza el rubro sin el «NN-». `veParseDetallado` (comprobantes) + `veAgregarSemana` (filtro + payloads)
  = port de `cargar-venta-semana.py`; mantener los criterios en sintonía.
  **Omnicanalidad (29/08/2026)**: los vendedores **WEB MATEU / WEB AURELIUS** en una
  sucursal física (Calle 12, Aurelius Calle 12, …) son venta de ecom facturada ahí:
  `veAgregarSemana` los **REASIGNA a Ecommerce** (la física queda igual que el
  sistema y la venta no se pierde; la previsualización avisa cuánto movió). En
  Ecommerce (99) son sus vendedores reales y quedan. Ojo: el ETL mensual y el
  script Python todavía no aplican esta regla. Previsualiza
  por sucursal vs. meta (avisa cuántos comprobantes descarta de otros días, sucursales
  sin slug —05-Depósito— y metas sin venta) y
  **publica en un solo PATCH multi-path** a `ventaEquipo/<slug>/<lunesISO>` (mismo
  payload que el script). **Dos botones, un mismo input** (`veCadElegir`, 29/08/2026):
  «⇧ Cargar venta de la semana» (sección Objetivo de la semana) toma **SOLO la semana
  elegida** en el selector aunque el archivo traiga el mes entero; «⇧ **Cargar venta del
  mes**» (bloque Objetivo del mes de la vista Cadena) sube el export del arranque del mes
  a hoy y publica **todas las semanas publicadas que cubre, juntas** en el mismo PATCH.
  En el modo mes, una semana **no vigente cubierta a medias** (días de la semana fuera del
  rango del archivo — típico de un export por mes calendario que corta las semanas retail
  de los bordes) se alerta y se **excluye** de la publicación, para no pisar una semana ya
  cargada completa (`veSemanasCobertura`); un día sin venta DENTRO del rango
  (feriado/domingo) no cuenta como faltante; la vigente publica con los días que tenga.
  Un `.xls` que llega al tope de 65.536 filas se detecta como truncado: alerta 🛑 y
  Publicar bloqueado (pedir `.xlsx`/CSV).
  ⚠️ Criterios de calendario: hasta agosto 2026 el objetivo MENSUAL se armó por **mes
  calendario** y el semanal por **semanas retail** (no cierran entre sí); desde septiembre
  2026 se unifica todo en calendario retail: **una semana pertenece al mes de su DOMINGO**
  (igual que `mesRetailDe` del calendario del shell), así que la **Semana 36 (31/08–06/09)
  es de septiembre**. El helper es `objMesDeSemana()` en `indicadores/` y `mesDeSemana()`
  en `objetivos/` (desde `2026-09` manda el domingo; antes, el mes calendario del lunes).
  Nunca derivar el mes con `sem.slice(0,7)`. La banda «En curso» y el acumulado del mes
  van por el mes retail de la semana elegida aunque la tarjeta del objetivo mensual caiga
  al último mes publicado (lo aclara en su título). La tabla de la cadena muestra esa venta como **«prov»**
  mientras no esté el real oficial (gerencia baja `ventaEquipo/<slug>/<sem>/total`
  de cada sucursal). El script Python queda como plan B.
- **Base «Horas asignadas» + justificaciones (03/08/2026)**: el toggle de KPIs de
  Indicadores pasó de "Horas con venta" a **"Horas asignadas"**: usa las horas que el
  encargado asignó a la venta en la grilla del equipo (de las contratadas, solo las de
  venta — un full suele tener 7 de 9 hs; el resto es limpieza/armados). Por semana del
  período: horas del equipo guardado, fallback al `h_act` del sistema; la nota al pie
  dice cuántas semanas cubre. En vista cadena solo gerencia baja los equipos de todas
  (seguridad blanda). Y dos alertas con modal de justificación: (1) al **guardar el
  equipo**, personas con días sin horas o de la dotación fuera del equipo → motivo
  obligatorio; (2) con venta cargada, personas con **horas asignadas y cero venta** →
  popup automático al encargado. Ambas se guardan en el payload del equipo
  (`justif.sinHoras` / `justif.sinVenta`) y el resumen les llega por **directo de la
  Bandeja** a `ALERTA_ADMINS` (capacitaciones@ —Iván, cubre RRHH, confirmado por Juli— /
  cristian.campion@, constante en `indicadores/`).
- **Etapa 2 (26/08/2026, HECHA la parte de aviso)**: al publicar la semana en
  `objetivos/` (`guardar()`), con confirmación se manda un **directo por la Bandeja**
  (`mensajes-mateu`) a cada cuenta de sucursal/outlet con su meta (`notificarSucursales`;
  mails resueltos contra `discontinuos-mateu/usuarios`). Queda pendiente solo la parte
  de armar objetivos sin Excel (ya se pueden cargar a mano).
- **Circuito operativo en Indicadores (26/08/2026)**: chip **«Hoy»** en la tira viva
  (objetivo del día de HOY con la curva, real y % si hay venta — solo en la semana en
  curso); **semáforo «Datos de la semana»** en el Panel General (venta cargada X/N y
  equipo armado X/N, botón «📣 Recordar a las que faltan» → directos por la Bandeja);
  **alerta de ritmo automática** (`alertasRitmo`): de jueves a domingo, al abrir el
  Panel General, directo a la sucursal + supervisor si va <90% del ritmo (una vez por
  semana/sucursal, flag `objetivos/alertasRitmo/<sem>/<slug>` en recepciones-mateu).
  El payload de `ventaEquipo` ahora guarda **`rubros`** por vendedor (importe por
  CALZADO/INDUMENTARIA/… de la estadística detallada) → «Mix de la semana» en el
  desplegable de cada vendedor. La matemática del reparto tiene **tests**:
  `node --test lib/reparto.test.js` (extraen las funciones del propio index.html).
- **Ritmo por vendedor (11/09/2026, pedido de Juli: «que el número quede ahí» y el encargado
  se lo pase al vendedor con seguridad, sin sacar la cuenta a ojo)**: en «Cómo viene el
  equipo» de Mi Sucursal, cada tarjeta muestra bajo el nombre **«⏱ N% del ritmo · para el
  ★ 120%: $X por día · meta: $Y por día (Ju·Vi·Sá)»** y el desplegable abre el bloque
  (`eqRitmoBloque`): debería llevar / lleva / ritmo, a cuánto cierra si sigue así, y dos
  recuadros (su meta y ★ 120%) con lo que falta, el promedio por día y el mismo monto abierto
  según la curva de cada día. Cálculo en `eqRitmoPersona(venta, objDias, diasSet, sem, hoy)`
  sobre su objetivo por día (`eqSharesDia` × meta): esperado = objetivo de los días ya cargados
  (un día transcurrido sin venta en el local sale, como en `ritmoEsperado`); «por día» = lo que
  falta ÷ los días que le quedan **con horas** después del último día cargado; semana terminada
  → no se pide nada; si la venta cargada quedó atrás de hoy lo avisa. Botón **«⧉ Copiar ritmo
  del equipo»** (texto para WhatsApp, `eqRitmoLinea`). Tests en `lib/reparto.test.js`.
  ⚠ Mismo día: `eqDiasSet` ahora cuenta un día como cargado **solo si el local vendió algo**
  (`veVentaDia` > 0). La plantilla PMS trae los días que no pasaron con venta 0 (Vie/Sáb en 0
  un jueves) y contarlos daba la semana por completa: el ritmo del local no salía y tickets/hora
  sumaba horas de días sin venta.

**Puesta en marcha: ya funciona (usa `recepciones-mateu`, en vivo). No hace falta
crear ninguna base.**

## Academia de Ventas (`capacitaciones/`)

`capacitaciones/index.html` es la versión FUNCIONAL, self-contained como el resto
(lee la sesión del Portal, sin login propio). Roles: **staff** = `admin` /
`capacitador` (Iván Nicoloff, `capacitaciones@mateu.com.ar`) / `supervisor`
(Cristian Campion) con acceso total; **alumno** = cuentas `sucursal`/`outlet` con la
herramienta `capacitaciones`.

**La app ES el prototipo de Design hecho funcional** (decisión de Juli 03/08/2026):
mismas pantallas y estética, con datos reales.

- **Pestañas** (SPA, sin recargar): alumno = Inicio (progreso, competencias, badges,
  carrusel "Continuá tu programa") · Catálogo (tabs de programas por nivel + carrusel
  de tarjetas con portada) · Novedades (feed) · Historial (certificado por programa
  completo o candado con progreso) · Ranking (podio por persona). Staff (admin /
  capacitador Iván / supervisor Cristian) = Catálogo (+ ✏ en cada tarjeta) · Novedades
  (+ publicar) · Mi equipo (dotación real de TODAS las sucursales con niveles y
  progreso por persona) · Ranking (toggle empresa/sucursal) · Gestión (CRUD de cursos
  y programas + encuestas).
- **Player de curso**: hero oscuro con barra de progreso, índice lateral (lecciones +
  quiz final), contenido en tarjetas; en módulos de texto, un bloque que arranca con
  `[[dato]]`/`[[tip]]`/`[[evitar]]`/`[[ejemplo]] Título` se destaca con color, y
  `Título:` al inicio de bloque hace tarjeta con título. Módulos tipo texto / video
  YouTube / **archivo PDF-PPT subido desde la PC** (Firebase en partes base64, nodo
  `archivos/<fid>`, tope 20 MB) / link. Quiz con opciones botón y banner de resultado
  (staff ve la correcta marcada). Al aprobar: badge + certificado imprimible (firmas
  Iván/Cristian) + encuesta + novedad automática en el feed.
- **Alumno**: la cuenta de sucursal elige QUIÉN es (picker con la dotación de
  Indicadores, mapa `SLUG_SUC_IND`; se recuerda en `cap_yo_<slug>`; "Cambiar persona"
  en el header). Programas filtran por puesto (encargado/vendedor/cajera/depósito)
  y/o sucursal, con fecha límite.
- **Firebase**: reusa **`recepciones-mateu`**, nodo aparte `capacitaciones/`:
  `cursos/`, `programas/`, `avances/<slug>/<personaId>/<cursoId>` (agrupado por slug,
  seguridad blanda), `novedades/` (feed; no-leídas por localStorage),
  `encuestas/<cursoId>/` y `archivos/<fid>`. «📣 Avisar» de un programa publica en la
  Bandeja del Portal (`mensajes-mateu/avisos`) y en Novedades.
- **Portada del curso** antes del player (datos, frase gancho, "Qué vas a aprender",
  Evaluación) y **certificado** con el diseño exacto del prototipo. **Encuesta previa
  al programa** (opción del programa: intro + preguntas abiertas de Iván; respuestas en
  `encuestasPrevias/<prog>/<slug>/<persona>`, visibles en Gestión → Encuestas). Programas
  con ícono (`icono`) y chips de filtro por competencia en el Catálogo. Cursos en
  **borrador** (`activo:false`): el equipo no los ve; un programa sin contenido visible
  no aparece al alumno.
- **Mejoras 03/08/2026 (todas en `capacitaciones/index.html` salvo aviso)**: PIN personal de 4
  dígitos por persona (`pins/<slug>/<persona>`; lo crea cada uno, staff/encargado lo resetea desde la
  ficha); tiempo de lectura por módulo (`avance.tiempo`) + alerta «muy rápido» (<20 s/módulo);
  Mi equipo → ficha de persona (pendientes, minutos, directo a la cuenta de la sucursal vía
  `mensajes-mateu/directos`, reset PIN), «Recordar a los que no empezaron» y export Excel;
  recordatorios automáticos de vencimiento (7 días antes y el día anterior, flag
  `programas/<id>/recordatorios`) a Bandeja + Novedades; PDF embebido en el curso; badges
  dorados por competencia completa; duplicar curso; encuesta post-programa
  (`encuestasPost/`); certificado «Compartir» (html2canvas + Web Share); celular (índice
  horizontal, tablas con scroll). **Resumen para otros módulos**: el staff publica
  `capacitaciones/resumen` (por sucursal y por persona) al entrar; `capacitaciones/resumen-widget.js`
  lo inyecta en Indicadores (sección «Academia de Ventas»), Evaluaciones (tarjeta bajo el
  formulario) y RRHH (chip por legajo) — cada uno lo incluye con una línea en el `<head>`.
- **Ayudante con IA**: `functions/api/academia-ia.js` (Pages Function; HTTP directo a
  `/v1/messages`, `claude-opus-5`, salida JSON Schema, fallback server-side). Necesita
  `ANTHROPIC_API_KEY` en Cloudflare Pages → Settings → Environment variables; sin la clave el
  GET responde `disponible:false` y la Academia no muestra los botones ✨ («Mejorar con IA» en
  el asistente, «Proponer preguntas con IA» en asistente y editor). Pendiente técnico: los
  archivos subidos van en base64 en RTDB (tope 20 MB); si crecen, migrar a Firebase Storage.
- **Tanda de adopción (07/09/2026, «aplicar todo» de Juli)** — al 07/09 había 3 cursos activos, 39 en
  borrador y CERO avances, así que estas mejoras apuntan a que se use:
  (1) **Panel del encargado en Mi Sucursal**: `resumen-widget.js` ya no depende del resumen del staff
  para la sucursal: calcula EN VIVO (cursos + programas + `avances/<slug>` + `asignaciones/<slug>` sobre
  el padrón de `shared/equipo.js`) el estado por persona (al día / en curso / sin empezar, qué le falta)
  y tiene **«⧉ Copiar recordatorio para WhatsApp»** (texto listo con nombres, pendientes y link). Copia
  mínima de `programasDe`/`cursosDe`/`estadoCurso`: mantener en sintonía. El Panel General sigue leyendo
  `capacitaciones/resumen`.
  (2) **Link directo**: `capacitaciones/?curso=<id>` abre la portada del curso (tras «¿Quién sos?»);
  `?programa=<id>` el catálogo en ese programa (`urlAcademia()`). Botones 🔗 en Gestión (cursos y
  programas) y «🔗 Copiar link» en la portada (staff); «📣 Avisar», los recordatorios de vencimiento y
  los avisos automáticos llevan el link.
  (3) **Resultados en la venta**: `resultadosPersona` cruza cada curso aprobado (`fin`) con la venta
  semanal por vendedor de `ventaEquipo/<slug>` (match por nombre/alias del padrón, `Equipo.norm`):
  UPT y ticket promedio hasta 4 semanas antes vs. hasta 4 después, con chip de variación. Se ve en la
  ficha de la persona (Mi equipo) y en el Inicio del alumno («Mis resultados»).
  (4) **Cruce con Evaluaciones**: en el formulario del supervisor, un ítem en Regular/Mal muestra
  «🎓 Curso de la Academia para este punto» (`ACAD_MAPA` ítem → competencia + palabras clave contra los
  cursos publicados) y **«Asignar a la sucursal»** escribe `capacitaciones/asignaciones/<slug>/<cursoId>`
  = `{curso, titulo, motivo, item, semana, por, ts}` + directo a la sucursal. En la Academia esos cursos
  entran a `cursosDe` como el programa virtual `PROG_SUP` («Recomendado por el supervisor», id `_sup`,
  todos los puestos): bloque propio en Inicio, pestaña en el Catálogo, cuentan en el avance y el resumen.
  Gestión → Programas los lista con ✕ para quitarlos.
  (5) **Píldoras**: `formato:'micro'` (check «⚡ Píldora» del editor; avisa si pasa de 3 módulos o 3
  preguntas): chip en tarjetas y portada, carrusel «⚡ Píldoras de 5 minutos» en Inicio y filtro en el
  Catálogo.
  (6) **Quiz**: `quiz.mezclar` (default sí) baraja preguntas y opciones en cada intento (`ordenQuiz`;
  `PLAYER.resp` sigue con índices originales; el staff lo ve en orden); `quiz.intentos` (0 = sin límite;
  el editor propone 3) bloquea al agotarse y el encargado/staff **habilita otro** desde la ficha
  («🔁 Habilitar otro intento», deja `int = intentos−1`). Cada envío suma contadores del servidor
  (`{'.sv':{increment:1}}`) en `quizStats/<curso>/<preguntaId>` = `{n, mal, op:{<opción>:n}}`; las
  preguntas reciben `id` estable al guardar; el editor muestra «Cómo responde el equipo» (% de falla y la
  equivocada más elegida).
  (7) **Firebase Storage opcional** (`STORAGE_BUCKET`, vacío hoy, mismo patrón que Tareas): con bucket,
  `subirArchivo` sube por REST y guarda la URL como `contenido` (`bajarArchivo` entiende URL y partes
  base64), tope 200 MB. **Videos subidos** (mp4/webm/mov) se reproducen en el player (`<video>`; en base64
  se bajan al tocar ▶).
  (8) **Certificación**: al completar un PROGRAMA entero, `avisarCertificacion` manda un directo a las
  cuentas de la sucursal **de parte de capacitaciones@** (`enviarDirectoDe`) y otro al capacitador; flag
  `certAvisos/<slug>/<persona>/<programa>`.
  Pendientes de Juli: `ANTHROPIC_API_KEY` en Cloudflare (botones ✨) y el bucket de Storage.
- **Quiz «como vendedor» + perfil deportivo (07/09/2026 tarde)**: el staff ve la correcta en verde y un
  banner lo aclara; «👁 Ver como vendedor» (`PLAYER.comoAlumno`) muestra el quiz sin marcas y mezclado.
  **Perfil deportivo** (pedido de Juli: qué disciplinas practica/conoce cada vendedor o cajera y de qué
  cuadro es hincha): tarjeta «Mi perfil deportivo» en el Inicio del alumno (chips `DISCIPLINAS`, «otra»,
  select `CLUBES` con «Otro»), guardado en `perfiles/<slug>/<personaId>` = `{disc[], otra, club, nombre,
  rol, ts}`. Se ve en la ficha, debajo del nombre en Mi equipo, como filtro por disciplina con conteos
  (para planificar cursos de producto) y en el Excel.
- **Bloques visuales en los módulos de texto (07/09/2026, pedido de Juli por el curso de HEAD)**:
  además de `[[dato]]/[[tip]]/[[evitar]]/[[ejemplo]]` y `Título:`, `seccionesDeTexto` entiende
  `## Subtítulo` (`.lec-h2`, grande con barra roja), `[[img]] ruta-o-URL | leyenda` (figura), `[[lista]]
  Título` + líneas `Término: explicación` (ficha a dos columnas) y `[[vs]] Evitar | Decir mejor` + líneas
  `malo | bueno` (comparación roja/verde). Render compartido en `seccionHtml` (player y vista previa).
  Las fotos de un curso van como archivos estáticos en `capacitaciones/assets/cursos/<curso>/` (JPEG
  ≤1400 px), NO en Firebase. **Curso «Head 2026: Raquetas y Paletas»** (`c-mtrji4n9mkv8`): rearmado
  con las 8 imágenes del PPTX de Iván (extraídas de `archivos/<fid>` con zipfile + PIL), títulos por
  módulo, fichas, comparación y quiz de 9 preguntas (3 intentos, mezclado); portada = foto de raquetas.
  La fuente está en `capacitaciones/assets/cursos/head-2026/curso.json` (semilla; se publica con
  `PUT cursos/<id>`), generada por el script de la sesión del 07/09.
  ⚠ Bug arreglado en la misma tanda: `sucsAcademia()` se llamaba a sí misma desde el commit del padrón
  (04/09) y Mi equipo / Ranking / `publicarResumen` reventaban para el staff.
- **Asistente «Crear curso desde un PDF o PowerPoint»** (Gestión): lee el texto en el
  navegador (pdf.js / JSZip por CDN), propone un módulo por página/diapositiva, Iván
  revisa (reordena, une, quita, agrega, vista previa), quiz opcional, programa y aviso.
- **Contenido cargado**: «Atención al Cliente» (programa «Introducción», toda la cadena),
  «Wilson: Tennis & Padel 2026» y «Hockey: palos adidas y Malik FW26» (programa
  «Producto de marca», vendedores+encargados), y los 4 programas del prototipo
  (Onboarding, Vendedores, Vendedores Intermedio, Encargados) con 39 cursos en borrador
  como hoja de ruta.
- Las pantallas `.dc.html` + `support.js` + `sesion.js` son el **prototipo de Design**
  que originó el módulo; quedan como referencia visual (siguen gateadas).

## Conversor de OC de marca (pestaña "Pedidos de compra" de `recepciones/`)

Botón **⇆ Convertir OC de marca**: Juli sube la planilla que manda **cualquier**
marca y sale la **OC unificada Mateu Sports** (detalle por artículo con curva de
talles) → Excel/PDF o "Guardar al sistema" (queda como pedido y alimenta el
control de ingresos vs pedido).

- **Motor genérico** (no hay un parser por marca): elige la hoja, encuentra la
  fila de encabezados y mapea las columnas por nombre (alias + pistas por marca).
  Entre varias combinaciones gana la que mapea más campos; que produzca artículos
  con unidades es el desempate (así descarta hojas de lista de precios). Nike
  conserva su lector propio ("Resumen Pedido") como atajo, con caída al genérico.
- **Unidades = la columna de confirmado**. En adidas es literalmente `Confirmado`
  (ojo: el export trae **dos** columnas con ese nombre, una numérica y otra de
  texto tipo "0-STOCK" → se elige por perfil numérico). Las filas con 0 quedan
  afuera. Los importes no se confunden con unidades porque se exige que la
  columna sea mayormente entera.
- **Empresa / banner**: si la planilla mezcla empresas (el multimarcas de adidas
  trae **MATEU SPORTS y AURELIUS**; los exclusivos de franquicias vienen en otro
  archivo), aparece un selector para convertir una OC por cada una.
- **Si la detección falla**: "⚙ Cambiar columnas" reasigna a mano cada campo (+
  rubro por defecto cuando la planilla no lo trae) y **★ Guardar como modelo de
  la marca** deja ese mapeo para la próxima vez (Firebase `recepciones/ocModelos/`).
- **Modelos por marca** (`recepciones/modelos-oc.js` → `window.OC_MODELOS_SEED`):
  semilla con el mapeo aprendido del **último pedido guardado de cada marca** en
  `G:\Soporte\Julian Mateu\Mateu sports\Pedidos de compras\<Marca>\…`. Regenerar con:
  `node scripts/gen-modelos-oc.js "G:/…/Pedidos de compras"` (self-contained, lee
  el motor del propio `recepciones/index.html` para no desincronizarse). Hoy 49 de
  80 marcas tienen modelo; el resto entra por detección + mapeo a mano. Los `.xls`
  viejos (BIFF) los lee el navegador con SheetJS pero no el generador.

## Ingreso de Mercadería (pestaña en `recepciones/`)

Circuito **físico** de recepción del depósito central, distinto de "Control de
Recepciones" (mirada de Compras: ingresos vs pedido en $). Es una **pestaña dentro
de `recepciones/`** (rol `admin` o depósito). MVP: **Adidas**.

Flujo: **pre-ingreso** (Ariel/Luis cargan el remito → declarado por SKU) → **control
ciego** (el operario escanea el EAN de cada unidad; NO ve las cantidades esperadas,
para que no redondee) → **conciliación** (declarado vs controlado → faltantes/sobrantes
por talle; "Ingresar a stock" cuando está ok) → reparto.

- **Cruce por EAN:** ni el remito ni el packing list traen EAN; el operario escanea el
  EAN de la caja. El puente es el **maestro de Adidas** (`recepciones/maestro-adidas.json`):
  `scan EAN → SKU (material+talle) → cruce vs. declarado`. Se cumple exacto que el SKU
  del packing list = `Material+Size` del maestro (validado). Se genera con:
  `node scripts/gen-maestro-adidas.js "Lista Codigos EanNNN.XLSX"` (self-contained
  fs+zlib, reusa el lector XLSX del generador de Meses de Stock; ~237k EANs, 7,4 MB /
  1,5 MB gzip). Regenerar cuando Adidas mande catálogo nuevo.
- **Arquitectura liviana (como Indicadores):** el maestro pesado se usa SOLO del lado
  escritorio (Ariel/Luis). En pre-ingreso se hornea un **mini-mapa por remito** (EAN→SKU
  de los SKU de ese remito) y el celular del operario baja solo eso.
- **Escáner (ambos):** lector de mano (input siempre enfocado, EAN+Enter) + cámara
  (ZXing por CDN, carga lazy).
- **Firebase:** reusa `recepciones-mateu`, nodo aparte `ingreso/` (no toca
  `recepciones/…`): `ingreso/remitos/<nro>` = {cabecera, `declarado{SKU:{talle,ean,desc,cant}}`,
  `minimap{ean:SKU}`}, `ingreso/control/<nro>` = {`scans{SKU:cant}`, `unknown{ean:cant}`,
  terminado}, `ingreso/ultima`.
- **PENDIENTE:** import automático del packing list (Excel/CSV del bizlogit, para no
  cargar el declarado a mano); la **hoja de apertura de cajas** (orden eficiente de
  apertura con switch de criterio — ver algoritmo probado en el chat); aviso a Ariel/Luis
  por `mensajes-mateu` al terminar el control; otras marcas.

## Equipo de la sucursal — padrón único (`shared/equipo.js`, 04/09/2026)

**Una sola lista de personas por sucursal para todos los módulos.** Fuente de verdad:
`rrhh/legajos/<legajoId>` (discontinuos-mateu). Índice por sucursal para que cada local baje
solo lo suyo: `rrhh/equipo/<slug>/<legajoId>` = resumen `{nombre, puesto, regimen, estado,
alias[], pendiente, ingreso, legajo_nro}`. RRHH lo regenera entero tras cada escritura a
legajos (`sincronizarEquipo()` → `Equipo.reconstruir`); las altas/bajas/alias hechas desde
Mi Sucursal escriben legajo + índice en un PATCH multi-path.

- **Identidad = `legajoId`, nunca el nombre.** El nombre con que aparece la persona en el
  sistema de ventas («CASAO KEVIN ARMANDO M.») se guarda como **alias** del legajo, una vez,
  con confirmación humana; desde ahí el cruce es exacto (`Equipo.resolver`: exacto por
  nombre/alias normalizado → `{persona, exacto:true}`; si no, la mejor **sugerencia** difusa
  — el algoritmo por tokens que antes usaba Indicadores en silencio — que hay que confirmar).
  Nada se vincula solo.
- **Helper** `shared/equipo.js` (`window.Equipo`, se incluye SIN `defer` antes de `iconos.js`):
  `cargar(slug)` / `cargarTodas()` / `activos()`, `resolver` / `resolverTodos` / `clavesDe`,
  `vincular(slug,id,nombreVentas)`, `alta(slug,{nombre,puesto,regimen,ingreso},por)` (entra
  al padrón YA con `pendiente:true`, `origen:'sucursal'`), `editar`, `baja`, `reconstruir`,
  `rolDe(puesto)` (encargado/vendedor/cajera/deposito/otro), `grupoDe`, `sectorDe`, `norm`.
- **RRHH**: campo «Nombres en el sistema de ventas (alias)» en el legajo, tag «Por validar»
  + ✓ para las altas de sucursal (guardar el form también valida), y **«⇄ Conciliar con
  ventas»** (`abrirConciliar`): junta los nombres del ETL del último período + últimas 4
  semanas de `ventaEquipo`, y por cada nombre que ningún legajo reconoce ofrece Vincular
  (alias) / Crear legajo / Ignorar (`rrhh/aliasIgnorados/<norm_con_guiones>`); lote «Aplicar
  las marcadas» para las sugerencias fuertes (score ≥3 en la misma sucursal). Aparte lista
  **«Venden en otra sucursal que la de su legajo»** (identidad resuelta: cobertura → nada;
  traslado → «Mover a X») y **legajos duplicados** (Unificar si el segundo no tiene
  movimientos). El form ahora conserva `legajo_nro`/`origen`/`creado` (antes se perdían
  al editar).
- **Indicadores (Mi Sucursal)**: sección **«Mi equipo»** (`secEquipo`, zona viva, antes de
  Novedades; `renderEquipoSuc`/`paintEquipoSuc`): padrón con puesto/régimen/estado de
  vínculo, **+ Agregar persona** (alta → aviso a `RRHH_MAILS` por la Bandeja), ✎ (nombre,
  puesto, régimen, ingreso) y ⏻ baja (aviso a RRHH); bloque **«Nombres de ventas sin
  vincular»** (de la venta de la semana activa `_ultimoVe` + `DET.vendedores`) con
  Vincular / Es nuevo / Ignorar. El **equipo semanal** guarda `{id, nombre, h}`: se arma
  desde el padrón (`padronVenta()` = activos encargado/vendedor/cajera; fallback ETL), «+
  Agregar persona…» es un select del padrón (+ «alguien nuevo» → alta), «⇩ Traer del
  padrón» reemplaza a «Importar de Plantilla», las filas viejas sin id muestran el select
  «¿Quién es?» con la sugerencia preseleccionada (se toma al Guardar). `real` y
  `justif` se indexan por `eqKey(p)` = id (o la clave por nombre para lo viejo). La venta
  se pega **exacto por alias** (`eqIdxExacto`); el difuso queda solo como «vínculo a
  confirmar ✓» (botón que llama a `Equipo.vincular`). `eqCasosSinHoras` toma la dotación
  del padrón. La **Plantilla** (`renderPlantillaPadron`) sale del padrón cruzado con el
  ETL por alias.
- **Buscador de Artículos**: `sincronizarPerfilesPadron()` en cada `cargarPerfiles`: los
  perfiles pasan a ser los activos con rol operativo, `id = legajoId`, avatar conservado
  (por id o por nombre); perfiles creados a mano llevan `manual:true` y se respetan; los
  del padrón (`legajo:true`) solo editan avatar y no se borran acá. Sin padrón, no toca nada.
- **Academia**: `dotacion(slug)` lee el padrón primero (ETL de respaldo); `personaId` =
  legajoId; `migrarIdsAcademia` mueve avances y PINs viejos (id por nombre) al legajoId
  cuando el nombre coincide exacto; el picker «¿Quién sos?» ya no acepta nombre libre si hay
  padrón; el staff ve también las sucursales con padrón (`sucsAcademia()`, Diagonal 80).
  `resumen-widget.js` busca en RRHH por legajoId (fallback por nombre).
- **Tareas**: «Yo soy» es un select del padrón (texto libre solo sin padrón).
- **ETL** `scripts/etl_indicadores.py --maestro`: el staff sale de `rrhh/equipo` (una fila
  por nombre+alias, `sector` en el vocabulario del Excel), los vendedores se normalizan como
  `Equipo.norm` (mayúsculas, sin acentos ni puntuación) y cada `vendedor` sale con `legajo`.
  Sin la opción sigue usando `Sucursales staff.xlsx`.
- **Tarea pendiente para RRHH (07/09/2026, pedido de Juli)**: al entrar a `rrhh/`,
  `conciliarPendientes()` corre de fondo el mismo cruce de «⇄ Conciliar con ventas» (último
  período del ETL + últimas 4 semanas de `ventaEquipo`) y, si hay nombres sin legajo, muestra
  un **banner ámbar en Legajos** con la lista por sucursal + contador en el botón (`CONC_PEND`,
  se actualiza a medida que se resuelven en el modal). La **primera vez** que aparece un período
  nuevo del ETL con pendientes, manda un **directo por la Bandeja a `CONC_AVISADOS`** (rrhh@) con
  la lista y graba `rrhh/aliasAviso/<periodo>` (solo con alcance completo, no supervisores). Así
  cada carga mensual de Indicadores deja la conciliación como tarea visible, sin depender de
  que alguien abra el modal.
- **Estado 04/09/2026**: índice sembrado desde los 237 legajos con sucursal (20 del Registro
  Único quedaron sin sucursal y no entran). Conciliación **pendiente de Juli** (RRHH → ⇄):
  para Diagonal 80 propone Polari/Casao/Maldonado (vincular), 5 personas nuevas
  (Calvimonte, Castro, Cavalier, Hernandez, y las que solo cubren) y traslados a confirmar
  (Arguello desde Adidas, Del Valle desde Kids…). Pendiente: unificar los ~20 mapas
  slug↔sucursal duplicados en `shared/` (hoy cada módulo tiene el suyo; el ETL suma `SLUG_DATA`).

## Compensatorios y horas (RRHH + Mi Sucursal)

Circuito de lo que la empresa le debe a cada persona por haber trabajado de más.
Son **dos conceptos separados** (pedido de Juli 01/09/2026), en la misma ficha:
**compensatorios en días** (feriado, domingo, inventario) y **horas extra en horas**.
Cada movimiento lleva `k` (`comp` | `hs`; sin `k` = compensatorio, los viejos) y `t`
(`alta` | `uso` | `pago` | `ajuste`). Cualquiera de los dos se puede **compensar con
tiempo** (`uso`) o **cobrar en plata** (`pago`). Vive en dos lugares y comparte el
nodo `rrhh/` de **discontinuos-mateu**:

- **`rrhh/` — pestaña «Compensatorios»** (gerencia / RRHH / supervisor): carga los
  días a favor, ve el saldo por persona y **responde las solicitudes**. Aprobar
  escribe un movimiento negativo (descuenta solo del saldo); rechazar pide el
  motivo y permite **sugerir otro día** para compensar. El botón ↩ vuelve la
  solicitud a pendiente (y devuelve el día si estaba aprobada). La columna
  **«Comp.»** de la nómina (pestaña Legajos) muestra el saldo y lo que está en
  trámite de cada persona, y el detalle del legajo suma la caja «Compensatorios».
  El modal **«+ Cargar compensatorio»** tiene el selector *Movimiento*: `➕ Días a
  favor` (fecha en que se generó) o `➖ Día tomado` (**fecha en que se usó**, con
  desde/hasta, días autocalculados y el saldo proyectado) — así RRHH registra un
  compensatorio que se tomó fuera del circuito de solicitudes. Atajo: el botón
  «🕘 Registrar día tomado».
- **Historial de uso**: cada movimiento guarda `t` (`alta`/`uso`/`ajuste`) y, en los
  usos, `desde`/`hasta`. La pestaña cierra con **«Historial de compensatorios
  tomados»** (`usosLista`/`histUsoHtml`, respeta el filtro por sucursal) y el 🕘 de
  cada persona abre su ficha con la columna Tipo y el día tomado. **No se pierde
  aunque se borre la solicitud**: el dato vive en el movimiento, no en la solicitud.
- **`indicadores/` — sección «Compensatorios del equipo»** (`secComp`,
  `renderComp`/`paintComp`, en la banda «En curso», junto a F8 y Reposición): el
  encargado ve el saldo de su gente y **solicita el día**. Gerencia lo ve de solo
  lectura. Una solicitud rechazada con día sugerido trae el botón «Pedir el día
  sugerido», que reabre el formulario con esa fecha precargada. Las pendientes se
  pueden cancelar. El desplegable **«Historial»** (`compHistorial`) lista todos los
  movimientos del equipo con su chip GANADO / TOMADO / AJUSTE y **el día en que se
  tomó cada compensatorio**.
- **Horas extra cargadas por la sucursal, validadas por RRHH (08/09/2026, pedido de
  Juli)**: el encargado carga las horas extra de su gente desde la misma sección de
  Mi Sucursal («+ Cargar horas extra» → persona del padrón, día, horas, motivo de
  `HS_MOTIVOS` y detalle). **No suman al saldo**: quedan en
  `rrhh/horas_pend/<slug>/<id>` con `estado:'pendiente'` (`hsEnviar`; el desplegable
  «Horas extra cargadas por la sucursal» las muestra con su estado y las pendientes
  se pueden cancelar). El aviso le llega a `COMP_APROBADORES` (rrhh@ y el
  supervisor) por la Bandeja. En **RRHH → Compensatorios y horas** aparecen arriba
  de las solicitudes, en «Horas extra cargadas por las sucursales» (`hpHtml`;
  pendientes + resueltas de los últimos 30 días, filtradas por el selector de
  sucursal y contadas en el badge de la pestaña): **✓ validar**
  (`formValidarHoras`: se puede ajustar la cantidad y el día, muestra el saldo
  proyectado y recién ahí escribe el movimiento `{d, k:'hs', t:'alta', hp:<id>}` en
  la ficha) o **✕ rechazar** con motivo (`formRechazarHoras`); las dos le avisan a
  la sucursal por la Bandeja. El 🗑 borra el registro ya resuelto (no toca el
  movimiento). Los **compensatorios en días los sigue cargando solo RRHH**.

**Carga masiva — «⇧ Importar Excel»** (pestaña Compensatorios): sube el Excel de
Juli (`Compensatorios.xlsx`: una hoja con bloques por sucursal — encabezado
`Legajo | <Sucursal> | Total`, una fila por persona con nro de legajo · nombre ·
días pendientes, y una fila de subtotal; la sucursal siguiente viene en la columna
del nombre con el legajo vacío). El cruce es por **`legajo_nro`**, no por nombre
(el Excel los trae recortados: «Casao Kevin» vs «Casao Kevin Armando»). El Excel
trae el **saldo**, no los movimientos: se publica un movimiento de **ajuste** por
la diferencia contra el saldo actual, en un solo **PATCH multi-path** a
`rrhh/compensatorios`. Previsualiza personas, saldos a actualizar, los que ya
estaban igual y los que **no tienen legajo** en el portal. Si el Excel ubica a
alguien en otra sucursal, le **mueve la ficha entera** (con su historial) y ofrece
el check **«Corregir también la sucursal del legajo»** (PATCH multi-path a
`rrhh/legajos`), que es lo que mantiene la dotación al día.
Alias de sucursal propios del Excel en `COMP_ALIAS_SUC` (`Diag 80`→diagonal,
`ADIDAS`→adidas, `Aurelius`→aurelius-10); el resto sale de `RU_DIVISOR`.

⚠️ La `sucursal` del legajo puede estar vieja (los legajos vienen del Registro
Único de julio y hubo movimientos, sobre todo a Diagonal 80). Por eso **manda el
slug donde vive la ficha de compensatorios**, no el del legajo: `compSlugDe()`.
La tabla de saldos avisa «legajo: <otra sucursal>» cuando difieren.

**Valorizado — el valor de la hora lo carga RRHH** (botón «💲 Valor de la hora»):
`rrhh/config/valorHora` = `{general, horasDia (default 8), porLegajo:{<legajoId>:valor}}`.
Un día de compensatorio se paga como `horasDia × valor`. El importe de un pago se
**hornea en el movimiento** (`vh` e `imp`), así el histórico no cambia cuando después
se actualiza el valor. Al registrar un pago (a mano o al aprobar una solicitud de
cobro) se puede **pasar a Novedades de nómina** del período con el concepto
`comp_pago` (`novedadDePago`), que es lo que va al estudio contable. El encargado
**no ve importes**: pide el cobro y RRHH lo valoriza.

**Firebase** (nodo `rrhh/`, agrupado por slug para que cada sucursal baje solo lo
suyo, misma seguridad blanda que Objetivos / Barrida):
`rrhh/compensatorios/<slug>/<legajoId>` = `{nombre, puesto, movs:{<id>:{d,f,m,por,en,sol}}}`
— el **saldo es la suma de `d`** (+ ganados, − tomados; no hay campo `saldo`) —
y `rrhh/solicitudes_comp/<slug>/<id>` = `{legajoId, nombre, k, modo:'tomar'|'cobrar',
cant (y `dias` por compatibilidad), desde, hasta, motivo, estado, por, en,
resp:{por,en,nota,imp,vh,sug:{desde,hasta,nota}}}`, y
`rrhh/horas_pend/<slug>/<id>` = `{legajoId, nombre, puesto, fecha, horas, motivo,
detalle, estado:'pendiente'|'aprobada'|'rechazada', por, en,
resp:{por,en,nota,horas,fecha}}` (las horas que carga la sucursal, hasta que RRHH
las valida).

**Avisos por la Bandeja** (`mensajes-mateu/directos`, best-effort): al solicitar le
llega a `COMP_APROBADORES` (rrhh@ = RRHH y cristian.campion@ = supervisor,
constante en `indicadores/`); al responder, RRHH le avisa a las cuentas de la
sucursal (resueltas contra `discontinuos-mateu/usuarios`) y a quien pidió.

## Mapa de sucursales y movimientos de personal (`rrhh/`, 08/09/2026)

Segunda pestaña de RRHH: **la dotación de cada local en una sola pantalla**, y el circuito
para mover gente entre sucursales. La ve gerencia, RRHH y el supervisor (este último de solo
lectura: `puedeMover = esAdmin || tieneTool`).

- **Pantalla**: KPIs (dotación activa · movimientos de los últimos 30 días · coberturas
  abiertas y cuántas con la vuelta vencida · sucursales sin encargado) + buscador de persona
  y filtro por puesto + dos vistas (**Tarjetas** / **Comparar**) + ⇩ Excel. Cada tarjeta es
  una sucursal: total, FT/PT, barra de composición por rol (`Equipo.rolDe`), chips de alerta
  (sin encargado, altas por validar, «N cubriendo acá», «N cubriendo afuera», vueltas
  vencidas), la lista de personas y **+ Persona** (alta con la sucursal precargada). Los
  legajos sin sucursal caen en la tarjeta «Sin sucursal asignada», primera de todas.
  «Comparar» es la misma foto como tabla (total · FT · PT · Jefatura · Ventas · Caja ·
  Depósito · Otros · Cubren) para ver desbalances.
- **Mover a alguien**: se **arrastra** la persona a otra tarjeta (en celular, el botón ⇄ de
  su fila; también hay «⇄ Registrar movimiento» en la barra y «⇄ Mover de sucursal» en el
  detalle del legajo). El modal pide destino, **tipo** (Traslado / Cobertura temporal con
  fecha de vuelta), fecha, motivo (`MOTIVOS_MOV`), puesto en el destino y observaciones.
- **Qué hace un movimiento** (`guardarMovimiento`), en este orden: (1) PATCH a
  `rrhh/legajos/<id>` con la sucursal nueva, el puesto y el campo `cobertura`
  (`{origen, retorno, mov, desde}`, o `null` si es traslado); (2) `sincronizarEquipo()` →
  `Equipo.reconstruir` regenera `rrhh/equipo/<slug>` — **por eso el cambio impacta solo en
  Mi Sucursal, el Buscador de Artículos, la Academia, Tareas y el ETL**, que leen ese índice;
  (3) **muda la ficha de compensatorios** `rrhh/compensatorios/<origen>/<id>` → `<destino>`
  con todos sus `movs` (mismo criterio que el import del Excel) y las solicitudes que siguen
  pendientes; (4) **avisa por la Bandeja** (`mensajes-mateu/directos`) a las cuentas de las
  DOS sucursales + `MOV_AVISADOS` (rrhh@ y cristian.campion@), con checkbox para no mandarlo.
- **Cobertura temporal**: la persona igual se muda (trabaja allá, así que todos los módulos
  tienen que verla allá) pero queda marcada; la tarjeta muestra el chip «Cubre», el botón ↩
  la devuelve a su sucursal (movimiento de tipo `retorno`, que cierra el original) y pasada
  la fecha de vuelta el chip se pone rojo y suma al KPI de vencidas.
- **Historial**: tabla «Movimientos de personal» al pie (últimos 40) con fecha, persona,
  desde → hasta, tipo, motivo y quién lo registró. El ↩ de una fila **deshace** un movimiento
  mal cargado (solo si la persona sigue donde ese movimiento la dejó): la devuelve, mueve la
  ficha de vuelta y lo tacha en el historial (`deshecho`), sin borrarlo.
- **Firebase**: nodo nuevo `rrhh/movimientos/<id>` en discontinuos-mateu =
  `{legajoId, nombre, puesto, desde, hasta, tipo:'traslado'|'cobertura'|'retorno', fecha,
  retorno, motivo, obs, por, en, cerrado?, deshecho?}`. Nada más cambia de esquema: la
  sucursal sigue viviendo en el legajo, que es la única fuente de verdad
  (ver «Equipo de la sucursal — padrón único»).
- **⇩ Excel** (ExcelJS, estilo del resto de RRHH): hojas «Dotación» (una fila por sucursal),
  «Personas» (una por persona, con la situación: estable / cubre / alta por validar) y
  «Movimientos», las tres con autofiltro.

## Calendario de novedades del mes

Reemplaza el Excel que los encargados mandaban mes a mes (`Calendario 08-2026.xls`:
grilla LUNES→DOMINGO, un par de columnas por día — número + texto libre — y el pie
con la sucursal y el mes). Mismo formato, en grande y en el portal:

- **`indicadores/` → «Novedades del mes»** (`secNov`, `renderNov`/`paintNov`, en la
  banda «En curso»): **solo la SEMANA EN CURSO es editable** (pedido de Juli 01/09/2026:
  si pueden cargar el mes entero, esperan a fin de mes y anotan cosas en días que no
  van). Los 7 casilleros lunes→domingo se guardan al salir del campo (`onchange`, no
  re-renderiza para no perder el foco) y la semana puede cruzar dos meses (cada día se
  escribe en el nodo de SU mes). Las semanas anteriores y el mes completo quedan de
  solo lectura. Al terminar, el encargado **confirma la semana** — y si no hubo nada,
  tiene que confirmarlo igual con **«Sin novedades»** (`rrhh/calSemanas/<slug>/<lunesISO>`
  = `{estado:'cargada'|'sin', dias, por, en}`). Desde el **jueves** el aviso se pone rojo
  y sale un recordatorio por la Bandeja (una vez por semana, flag en
  `rrhh/calAlertas/<lunesISO>/<slug>`). Gerencia lo ve de solo lectura.
- **`rrhh/` → pestaña «Calendario»**: la misma grilla por sucursal y **mes completo**,
  editable (RRHH corrige cualquier día), con el semáforo **de la semana en curso**
  («N de M sucursales ya la confirmaron», marcando las que no cargaron nada) + botón
  «📣 Recordar a las que faltan», la tabla **«Cierre semanal»** de las últimas 6 semanas
  de esa sucursal, **🖨 Imprimir** (`@media print`, A4 apaisado) y **⇩ Excel**.
- **El Excel** (ExcelJS, menú con «solo esta sucursal» / «todas»): un libro con
  **una hoja por sucursal** — calendario real de 7 columnas donde cada semana ocupa
  dos filas (el número del día arriba, la novedad abajo, con wrap), membrete, feriados
  en ámbar, fines de semana grisados, días fuera del mes apagados, apaisado y ajustado
  a una página —, la hoja **«Detalle»** (Sucursal · Fecha real · Día · Semana · Feriado
  · Novedad) **con autofiltro**, que es con lo que RRHH realmente trabaja, y — al
  exportar todas — la hoja **«Resumen»** con el cierre semanal de cada sucursal
  (confirmada / sin novedades / SIN CONFIRMAR, en verde y rojo). Helpers: `calHojaMes`,
  `calHojaDetalle`, `calHojaResumen`, paleta en `XC`. Exportar las 21 sucursales tarda
  ~5 s (hay un toast «Generando el Excel…»).
- **Aviso automático de los viernes** (`calAvisoViernes`, se dispara al abrir la pestaña
  — no hay backend con cron, mismo patrón que `alertasRitmo` de Indicadores): manda por
  la Bandeja el resumen de las sucursales que no confirmaron la semana a **RRHH y al
  supervisor** (`CAL_AVISADOS`) y un recordatorio a cada sucursal que falta. Flag
  `rrhh/calAlertas/<lunesISO>/__resumen` para no repetirlo.

Los **feriados** salen del calendario retail del shell (`shared/data/calendario-<año>.json`,
eventos con `tipo:'feriado'`; se resuelven fecha fija, rango y regla móvil) y se marcan
solos en la celda — el 17/08/2026 aparece como «Paso a la Inmortalidad de San Martín».

**Firebase**: `rrhh/calendario/<slug>/<YYYY-MM>` = `{dias:{'1':'texto',…}, actualizado, por}`
en discontinuos-mateu, agrupado por slug para que cada sucursal baje solo lo suyo.

## Tareas de la Sucursal (`tareas/`)

`tareas/index.html` self-contained (lee la sesión del Portal, sin login propio). Es de
**todas las cuentas de sucursal/outlet** (se les agrega sola en `herramientasEfectivas`,
como Marcas; también al supervisor) y gerencia la usa como control. `deposito`/`puesto`
no entran. Cuatro pestañas:

- **Cambio de precios** y **Sectores de marcas**: tareas con título, marca, fecha
  (vigencia / límite), detalle, estado pendiente/hecha, **foto ANTES y DESPUÉS** y quién
  la hizo. Las publica **gerencia a una o varias sucursales** (chips de sucursales en el
  formulario, un PATCH multi-path; aviso por directo de la Bandeja a cada cuenta) o la
  propia sucursal se las anota. Vencida = fecha pasada sin marcar (rojo). Al marcar hecha
  una tarea de gerencia, le llega un directo a quien la publicó (`creado.mail`).
- **Limpieza**: checklist con frecuencia `diaria` / `semanal` / `mensual`; cada ítem
  guarda `hechos/<período>` (`YYYY-MM-DD`, lunes ISO o `YYYY-MM`) con `{por,ts,antes,
  despues}`. Puntitos de cumplimiento de los últimos períodos (neutros antes del alta).
  Botón «Cargar checklist sugerido» (`LIMPIEZA_SUGERIDA`) cuando no hay nada. 📷 = foto
  de antes (deja la entrada `pendiente:true`), ✨ = foto de después (marca hecho).
- **Vidrieras**: una tarjeta por vidriera con el último cambio y los **días sin cambios**;
  alerta (rojo + badge rojo en la pestaña + banner) al superar `config/global.diasVidriera`
  (default `DIAS_VIDRIERA_DEF` = 15; gerencia lo ajusta con «ajustar» y puede darle un tope
  propio a una vidriera en su edición), ámbar cuando está por vencer. «🔄 Registrar cambio»
  pide la foto de después (la de antes se hereda del cambio anterior, se puede reemplazar)
  + nota; historial de cambios con comparativa. **Aviso por la Bandeja** una vez cada 7
  días por vidriera en alerta (flag `alertasVidriera/<slug>/<vid>`, se borra al registrar
  el cambio) a las cuentas de la sucursal + `ALERTA_AVISADOS` (Cristian); se dispara al
  abrir el módulo, como `alertasRitmo`.
- **Comparativa antes/después** (`abrirCmp`): modal con modo **Deslizar** (slider con
  `clip-path`) y **Lado a lado**; baja las fotos grandes recién ahí.
- **Fotos**: se comprimen en el navegador (`comprimirFoto`: JPEG ≤1280px + miniatura
  ≤360px) y el input lleva `capture="environment"` (celular → cámara). La grande va a
  `tareas/fotos/<slug>/<id>` = `{data,ts,por}`; en el ítem solo viaja `{id,thumb,ts,por}`
  → el listado es liviano. Al borrar tarea/vidriera se borran sus fotos.
- **«Yo soy»** (cuenta de sucursal): nombre de quien opera, en localStorage
  `tareas_yo_<slug>`; `firma()` = «Nombre (Usuario)». Gerencia firma con el usuario.
- **Todas las sucursales** (gerencia, selector vacío): tabla sucursal × (precios y
  sectores pendientes con ⚠ vencidas, limpieza hoy y semana x/y, vidrieras en alerta, máx.
  días sin cambio) + KPIs, «+ Publicar tarea» a varias sucursales. El supervisor ve solo
  su alcance (`session.sucursales`) si lo tiene cargado.
- **Firebase**: `recepciones-mateu`, nodo `tareas/` (agrupado por slug, seguridad blanda):
  `precios/<slug>/<id>`, `sectores/<slug>/<id>`, `limpieza/<slug>/<id>`,
  `vidrieras/<slug>/<id>` (`cambios/<cid>`), `fotos/<slug>/<fid>`, `config/global`,
  `alertasVidriera/<slug>/<vid>`, `alertasVenc/<slug>/<id>`, `recurrentes/<id>`.
  Íconos nuevos en `shared/iconos.js`: ⇄ ✨ 🪟.

**Segunda tanda (04/09/2026 tarde, las diez mejoras que pidió Juli):**
- **Foto obligatoria** (`exigeFoto`, check en el formulario; gerencia lo deja marcado por
  defecto): sin foto de después no se puede confirmar «Hecha» (chip «📷 exige foto»).
- **Vencidas por la Bandeja** (`avisarVencidas`): tarea con fecha pasada sin marcar →
  directo a la sucursal + `ALERTA_AVISADOS`, una sola vez por tarea (flag `alertasVenc`).
  Se dispara al abrir el módulo (la sucursal para sí; gerencia para todas).
- **Resumen de gerencia con 4 solapas** (`state.resVista`): **Hoy** (tabla + semáforo de
  limpieza con «📣 Recordar a las que faltan», `recordarLimpieza`), **Cumplimiento**
  (`cumplSucursal`: por mes, tareas hechas/total, % a tiempo, días promedio para cerrar,
  % de limpieza sobre los períodos que correspondían desde el alta de cada ítem, cambios
  de vidriera, vidrieras en alerta e **índice** = promedio de los tres %; ranking),
  **Vidrieras** (`renderGaleria`: última foto de cada vidriera de todos los locales) y
  **Recurrentes**.
- **Recurrentes** (`tareas/recurrentes/<id>` = tipo, título, marca, detalle, `cadaDias`,
  `plazoDias`, `proximo`, `sucursales` (vacío = todas), `exigeFoto`, `activo`):
  `generarRecurrentes()` corre cuando gerencia abre el resumen; por cada plantilla con
  `proximo <= hoy` crea la tarea en sus sucursales (fecha = último vencimiento + plazo,
  `recurrente:<id>`, origen gerencia) en un PATCH multi-path, adelanta `proximo` y avisa
  por la Bandeja. Pausar / reanudar / borrar desde la solapa.
- **⇩ Excel** (`exportarExcel`, ExcelJS por CDN, estilo RRHH): hojas Hoy · Cumplimiento
  (mes elegido) · Tareas (detalle del mes) · Limpieza (marcas del mes) · Vidrieras.
- **Cola offline** (`fbWrite`): toda escritura que falla por red queda en localStorage
  `tareas_cola` (tope ~4 MB, fotos incluidas) y se reintenta al volver `online`, al abrir el
  módulo y cada 30 s; la pantalla se actualiza igual y arriba sale «N cambios esperando
  conexión». Errores HTTP (no de red) siguen fallando normal.
- **Firebase Storage opcional** (`STORAGE_BUCKET`, vacío hoy): cuando Juli cree el bucket
  y pegue su nombre, las fotos grandes suben por REST a `tareas/<slug>/<id>.jpg` y el ítem
  guarda `url` en vez de `id`; `bajarFoto`/`borrarFoto` entienden las dos formas. Mientras
  tanto, **poda** (`podarFotos`, gerencia, una vez por día por dispositivo): tareas hechas y
  limpiezas de más de `PODA_DIAS` (90) pierden la foto grande (queda la miniatura, marcadas
  `podada:true`). Las vidrieras no se podan.
- **En Indicadores**: sección **«Tareas de hoy»** (`secTareas`, `renderTareasSuc`) en la
  banda «En curso» de Mi Sucursal (chips precios/sectores/limpieza/vidrieras + lista de
  vencidas, para hoy, limpieza sin marcar y vidrieras en alerta + link al módulo; oculta si
  la sucursal no usa el módulo) y **«Tareas de la Sucursal · control»** (`secTareasCad`,
  `renderTareasCad`/`pintarTareasCad`, solo gerencia, respeta el filtro por línea) en la
  vista de todas las sucursales, con «📣 Recordar limpieza a las que faltan». Los helpers
  `t*` de Indicadores son una copia mínima de la lógica del módulo: mantener en sintonía.

## Celular (03/09/2026)

Juli usa el portal como app instalada en el iPhone (PWA, `manifest.json` con
`display:standalone` + barra de estado `black-translucent`). Convenciones:

- **Safe-area del header**: la regla va SIN `@media(display-mode:standalone)` y con
  `html` delante (`html .top{padding-top:calc(12px + env(safe-area-inset-top,0px))}`).
  Motivo: las media queries móviles de cada módulo (`.top{padding:10px 14px}`) venían
  después y pisaban el padding-top → el botón Menú quedaba debajo de la hora del
  teléfono. Con la especificidad extra gana siempre; en el navegador el inset es 0.
  Todo módulo con header propio la lleva; `header.js` la trae para el resto. El
  `<meta viewport>` lleva `viewport-fit=cover` en todos los módulos.
- **Indicadores ≤640px** (bloque `/* CELULAR */` al final del CSS): la barra de la vista
  «Todas las sucursales» (`.rk-bar`) se apila (pestañas / Línea / KPI) con los chips
  deslizables de costado y deja de ser sticky; toolbar con selector y segmented a todo
  el ancho; menos padding en tarjetas; la semana editable de «Novedades del mes» se
  apila un día por fila (`data-dow` en cada `.cald`). Los widgets flotantes suman
  `env(safe-area-inset-bottom)`.
- **Portal ≤560px**: los tiles pasan a lista compacta (ícono a la izquierda, nombre +
  descripción); ≤480px se oculta el rol del header (el saludo ya lo dice).
- Para probar sin teléfono: Playwright con Chromium (`/opt/pw-browsers/chromium`),
  viewport 390×844 e `isMobile:true`, sesión inyectada en `localStorage`.

## Estética por marca — sucursales Aurelius (`shared/marca.js`, 06/09/2026)

Las cuentas de las sucursales **Aurelius** (Aurelius 12, Aurelius 5, Aurelius CB y el outlet
Aurelius 10 — incluidas sus cuentas de depósito y puesto) ven todo el portal con la estética de
Aurelius: **negro `#0b0b0d` + rojo `#C2201F` + blanco**, logo de Aurelius (escudo + corona +
palabra) en vez del de Mateu, título «… — Aurelius» y app instalable propia. El resto no cambia.

- **Un solo archivo**, `shared/marca.js`, incluido **SIN `defer` antes de `iconos.js`** en el
  `<head>` de todos los módulos y del Portal (`<script src="../shared/marca.js"></script>`).
  Módulo nuevo → sumar esa línea. Decide la marca en este orden: (1) **gerencia mirando una
  sucursal** — el módulo avisa con `Marca.vista(slug)` (hoy Indicadores en `render()`,
  Buscador al elegir sucursal y Tareas); vale solo para esa página (sessionStorage
  `mateu_marca_vista`); (2) la **sesión** del Portal (`sucursal`/`outlet_id` que empieza con
  `aurelius`); (3) sin sesión, `?marca=aurelius` en la URL o la última marca que entró en ese
  dispositivo (localStorage `mateu_marca_login`, lo guarda el Portal en `login()` vía
  `Marca.alIniciarSesion`; `?marca=mateu` lo borra).
- **Cómo pinta**: pone `data-marca="aurelius"` en `<html>` y pisa las variables del módulo
  (`--navy`, `--red`, `--off`, `--muted`, `--border`, sombras…). Los scripts del shell
  (`header.js`, `bloqueo.js`, `tutorial.js`, `notificaciones.js`) ya no llevan colores
  horneados: usan `var(--marca-navy,#0B1527)`, `var(--marca-red,#CC0000)`,
  `var(--marca-off,#f5f7fc)` y `var(--marca-mid,#1a2f55)`, que `marca.js` publica en `:root`
  con los valores Mateu por defecto. Colores escritos a mano dentro de un módulo NO cambian
  (son acentos menores); si molesta alguno, pasarlo a variable.
- **Logo (07/09/2026, isotipo OFICIAL)**: reemplaza todo `<img alt="Mateu Sports">` (header propio,
  `header.js`, login) por el isotipo oficial de Aurelius (escudo + corona, PNG del identificador que
  pasó Juli, embebido en `marca.js` como data URI a 200 px) y lo envuelve en un lockup
  `.marca-lockup` = isotipo + la **palabra AURELIUS oficial** (`img.marca-word`, PNG blanco del
  identificador, 110 px de alto, también embebido). Le saca el filtro `brightness(0) invert(1)`.
  **Headers y pantallas de ingreso (11/09/2026, pedido de Juli): el logo completo APILADO oficial**
  (variante 1-08 del identificador: escudo a color arriba, palabra blanca abajo; UNA sola imagen
  `APILADO_AU`, 240 px de alto embebida, clase `img.marca-apilado`). **El escudo va al 80 % del
  original** (pedido de Juli el mismo día: «achicar un poco la corona que quede proporcional»; se
  recompuso con PIL escudo + separación escalados y la palabra al 100 %). Va donde el logo cuelga de
  `SEL_APILADO` (`.msh-logo`, `.top`, `.logo` de Indicadores, `.login-head`, `.login-logo` del
  Turnero, `.pss-logo` del puesto y el modal «Acceso Aurelius»): 43 px en headers (37 en celular),
  80 px en el login del Portal, 66 en los otros ingresos (la palabra queda del mismo tamaño que con el
  escudo entero). En el resto (decks, impresiones, etiquetas
  chicas) sigue el lockup horizontal isotipo + palabra. Un MutationObserver cubre lo que se inyecta después.
  ⚠ No volver a dibujar el escudo ni las letras a mano: la primera versión (SVG propio) quedó mal y
  Juli pidió el original. Los 14 PNG del identificador (isotipo, logo apilado y palabra, a color y en
  rojo/negro/blanco) están en su carpeta de Drive «id aurelius…».
  Textos: «Mateu Sports» del login y «MATEU SPORTS» de la cortina de bloqueo → «Aurelius».
- **App instalable**: `manifest-aurelius.json` (id `./aurelius`, así convive con la app Mateu)
  + `icons/aurelius-{192,512,maskable,180}.png` (solo el escudo con la corona sobre negro, pedido de
  Juli; generados con PIL desde el PNG oficial, maskable con más margen); `marca.js` cambia el
  `<link rel=manifest>`, `theme-color`, `apple-touch-icon` y el favicon cuando la marca está activa.
- **Explicación para los usuarios**: ítem **«Acceso Aurelius»** en el drawer (`header.js` e
  Indicadores; lo inyecta `marca.js`) → modal con el link `…/?marca=aurelius`, botón Copiar y los
  pasos para agregarlo a la pantalla de inicio (iPhone/Android). En el login con la marca activa
  hay una nota con el mismo link; y la primera vez que una cuenta Aurelius entra en un
  dispositivo sale un aviso (flag `mateu_marca_aviso_v1`). API: `Marca.abrirAcceso()`,
  `Marca.urlAcceso()`, `Marca.activa()`, `Marca.refrescar()`.
- Para sumar otra marca: una entrada más en el mapa `MARCAS` de `marca.js` (`esSlug`, paleta,
  logo, manifest e íconos).

## Reseñas de Google (`reviews/`, 08/09/2026)

`reviews/index.html` self-contained (lee la sesión del Portal, sin login propio). Muestra las
**reseñas de Google de cada sucursal** — buenas y malas, captación sobre tickets y evolución
mes a mes — con la estética de una ficha de Google (avatar, estrellas, barras). Es de solo
lectura: NO escribe a Firebase. Lo mira gerencia; la fuente la mantiene **Iván**.

**Dos métricas distintas, no confundirlas:**
- **Captación** = `buenas ÷ tickets`. Es la columna «%» del Excel de Iván: cuántos de los que
  compran dejan una reseña. Es el KPI del módulo (semáforo del chip: ≥10 % verde, ≥5 % ámbar,
  menos rojo) y la línea del gráfico.
- **% positivas** = `buenas ÷ (buenas + malas)`. La calidad de lo que se recibió. Da ~99–100 %
  en casi todas, así que sirve de control, no de ranking. Es el número grande + las estrellas.

**Pantalla:** barra con selector de mes y buscador · 4 KPIs del mes (reseñas, captación con
delta en puntos vs. el mes anterior, % positivas, acumulado en Google) · grilla de fichas por
sucursal ordenada por captación (avatar con iniciales, estrellas rellenas al % positivas,
barras positivas/negativas, captación con delta, acumulado en Google con las nuevas del mes,
sparkline de 12 meses y quién dejó la última opinión) · ranking ordenable por cualquier
columna · detalle al tocar una ficha (barras apiladas buenas/malas + línea de captación de
toda la serie, y tabla mes a mes). La ficha de la sucursal del usuario va con borde rojo.

**Todo el dibujo es SVG inline** (estrellas, sparkline y gráfico del detalle), como Meses de
Stock: sin Chart.js ni ninguna librería de gráficos.

**Datos — `reviews/reviews-data.js`**, que genera `scripts/gen-reviews.py` desde el Excel de
Iván «Porcentaje de buenas y malas criticas.xlsx». **No editar a mano.** Para actualizar:

```
python scripts/gen-reviews.py "C:/ruta/Porcentaje de buenas y malas criticas.xlsx"
```

Hoy: **20 sucursales, 26 meses (jul-2024 → ago-2026)**. Forma:
`{fuente, generado, periodos:[...], sucursales:{<slug>:{nombre, serie:{"2026-07":{b,m,t,total,nuevas,autor}}}}}`
— `b` buenas, `m` malas, `t` tickets, `total` reseñas acumuladas del local en Google,
`nuevas` las del mes, `autor` el nombre de la última opinión leída.

**Trampas del Excel** (están resueltas en el generador, no volver a pisarlas):
- Los bloques mensuales **no tienen ancho fijo**: arrancan en 3 columnas y crecen hasta 8. Hay
  que detectarlos buscando `Sucursal` en la fila 2 y leer los encabezados contiguos, nunca
  saltando de a N columnas.
- **Cada bloque ordena las sucursales distinto** (los últimos van por captación), así que el
  nombre se lee fila por fila dentro del bloque.
- El mes que mide un bloque: manda la **etiqueta** de la fila 1 si está; si no, con dos fechas
  la primera es el 1.º del mes medido, y con una sola el dato se leyó a principios del mes
  siguiente (los datos de junio se tomaron el 04/07). El corte de año aparece en las dos hojas:
  se deduplica comparando el contenido **ordenado por sucursal** (si no, se corre todo un mes).
- La columna «%» no se copia: se recalcula.

**Informe mensual — `reviews/?pres=YYYY-MM`** (08/09/2026): deck que **Iván manda por mail la
primera semana de cada mes**. Es **público**, igual que el Reporte Mensual de stock — el
chequeo de `?pres=` va ANTES del gate de sesión, así lo abre cualquiera desde el mail. Solo
muestra agregados: no lista los nombres de quienes dejaron reseña (eso queda dentro del
módulo). Cinco secciones: los números del mes, ranking (paneles de las cinco primeras y
últimas + tabla), qué subió y qué bajó contra el mes anterior, reseñas negativas y la
captación de los últimos 12 meses. Tres acciones (no se imprimen): **🖨 Imprimir** (A4,
`@media print`), **🔗 Copiar link** y **⧉ Resumen para el mail** (`presTexto`, texto plano
listo para pegar). En el módulo lo abre el botón «📄 Informe del mes», con el mes que se
esté mirando.

**Usa el mismo lenguaje visual que `gestion-stock/?pres=`** (pedido de Juli 08/09/2026: los
dos informes se mandan por mail y tienen que verse de la misma familia): tapa a pantalla
completa con grilla y diagonales, nav fija con links y barra de progreso, secciones
numeradas con label rojo y logo tenue, números en **Saira itálica 800**, KPIs con conteo
animado y sparkline, paneles con barras, tablas con barra en la celda y leyenda de lectura,
reveal por IntersectionObserver y pie navy. Se escribe con **`document.write`** (documento
completo, como el de stock), así no hereda el CSS del módulo; el logo va embebido y todo el
dibujo es SVG, así que el HTML imprime suelto.

⚠️ Dos cosas que el patrón original deja expuestas y acá **no hay que volver a romper**,
porque esto se manda por mail y se abre en cualquier navegador: (1) el **valor final de cada
KPI va escrito en el HTML** y la animación solo lo recorre — si el span sale vacío y arranca
en cero, un navegador sin `requestAnimationFrame` (o una pestaña en segundo plano) muestra
«0 reseñas», que es un número falso; hay además un plazo de 1,8 s que lo escribe igual;
(2) un bloque **no puede quedar en `opacity:0`** si el IntersectionObserver no dispara: el
handler de scroll revela lo que ya está en pantalla (`red()`) y hay un chequeo a los 1,2 s.

⚠️ **El mes que se manda suele no tener tickets todavía** (la columna se carga después), y sin
tickets no hay captación. En ese caso el ranking ordena por **reseñas recibidas** y el informe
lo aclara; cuando Iván carga los tickets, el mismo link pasa solo a ordenar por captación.
La constante `MODO` (`'tasa'` | `'vol'`) es la que decide, en `presRender` y en `presTexto`.

**Quién lo ve** (08/09/2026): gerencia, el rol **supervisor** (Cristian — se suma en
`herramientasEfectivas` junto a evaluaciones/indicadores/capacitaciones/tareas) e **Iván**
(`capacitaciones@`, que tiene perfil fijo con `soloHerramientas`: su lista es
`['capacitaciones','reviews']` y el inicio sigue siendo la Academia).

**Lo que el Excel NO trae: el texto de las reseñas.** Solo el nombre de quien dejó la última
opinión leída. Para ver los comentarios hace falta conectar la **API de Google Business
Profile** (OAuth + el Place ID de cada sucursal), que queda pendiente. Tampoco hay mapa
geográfico: no están cargadas las direcciones de los locales.


## Reglas

- Responder y comentar el código en **español**.
- **No usar la palabra «cadena» en textos visibles** (Juli, 23/08/2026): el agregado de todas
  las sucursales se llama **«Todas las sucursales»** (vista, títulos) o **«total sucursales»**
  (rótulos cortos: «Mínimo total sucursales»); en rankings cortos, «Todas 5/19» y «vs. todas».
  En el código los identificadores (`vistaCadena`, `cadena.json`, etc.) siguen igual.
- El objetivo de superación se muestra como **«★ 120%»** (nunca «Superación»).
- No agregar frameworks ni build steps. Mantener todo self-contained.
- No tocar la config de Firebase de los módulos (URLs de las bases) salvo pedido explícito.
- Antes de un cambio grande en una herramienta, confirmá el alcance con Juli.
- Juli itera con correcciones puntuales: hacé cambios acotados y dirigidos, no
  reescrituras completas salvo que lo pida.
