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
├── barrida/            # Análisis de Reserva Depósito Central: cruce semanal (subir Excel) de la reserva del depósito central con las ventas por sucursal → alertas de reposición posible y de reserva parada. Firebase: reusa recepciones-mateu (nodo barrida/). Ver "Análisis de Reserva Depósito Central" abajo.
├── objetivos/          # Objetivos de Venta Semanal: gerencia carga el objetivo (Meta) de venta por sucursal por semana (subiendo el Excel "PMS Objetivos" o a mano) → dashboard vs. real; cada sucursal ve su objetivo en Indicadores. Firebase: reusa recepciones-mateu (nodo objetivos/). Ver "Objetivos de Venta Semanal" abajo.
├── capacitaciones/     # Academia de Ventas FUNCIONAL: cursos y programas del capacitador, avance por persona con quiz, certificados, equipo/ranking y encuestas. Ver "Academia de Ventas" abajo. (Las pantallas .dc.html son el prototipo original de Design; quedan de referencia.)
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
  `regalias/` guarda su ledger de acumuladores por temporada: hoy en
  **localStorage** con `FIREBASE_DB_URL` como placeholder; cuando Juli cree
  la base a mano (p.ej. `regalias-mateu`) y pegue la URL, migra solo a Firebase.
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

- La sesión queda en localStorage (`mateu_portal_session`). Los módulos **no
  tienen login propio**: leen esa sesión y redirigen a `../` si falta o si el
  usuario no tiene la herramienta asignada.
- Gestión de usuarios (alta, herramientas, reseteo de PIN): ícono ⚙ del portal,
  visible solo para `julian@mateu.com.ar` (`ADMIN_SETTINGS_EMAIL`).
- El acceso a localStorage está envuelto en try/catch para no romper en
  previews sin storage. Mantener ese patrón.

## Branding / design tokens

Paleta Mateu Sports: **navy `#0B1527`**, **rojo `#CC0000`**, blanco, fondo
`#f5f7fc`. Tipografías: **Bebas Neue** (display), **Barlow Condensed**
(subtítulos/labels), **Barlow** (texto). Estética: minimalista, alta densidad
de información, limpia. Header navy con borde inferior rojo de 3px.

Nota: `condiciones/` es más viejo y usa navy `#002366` + fuente Inter. Si se
rediseña, alinear a los tokens de arriba; si no, dejarlo como está.

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
el mes nuevo con los ya publicados (no los pisa). Publica con el botón
**«Publicar al portal»**: commitea `datos-meses-stock.js` a `main` vía la API de
GitHub (token fine-grained de Juli, solo ese repo, Contents RW, guardado en
localStorage `gs_github_token` de su navegador) y Cloudflare deploya solo.
Plan B: descargar el `.js`, reemplazar y push a mano.

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
`#selPerHost` de la vista activa en `pintarZonas()`), no en la barra global. Hay nav de
salto «Ir a: En curso · Cierre» (sticky en Mi Sucursal; dentro de la barra de chips en
Cadena). `pintarZonas()` pone las fechas en los títulos (`_zonaSem`/`_zonaMes`, que setean
`renderObjetivo` / `renderObjCadena` / `objetivoMesHtml`) y oculta la banda viva si no tiene
secciones (Ecommerce). Regla: todo número vivo lleva el pill `.pprov`; los cerrados, nunca.
**Indicadores de la semana** (`renderKpisSemana`; desde el 26/08 NO son sección propia:
viven **dentro de «Objetivo de la semana»** en `#kpisSemBox`, y el acumulado del mes —
la ex tabla «El puente», hoy «Indicadores del mes en curso» — vive **dentro de «Objetivo
del mes»** en `#puenteBox`): UPT, ticket promedio,
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
localStorage; `_eqOpenState` recuerda el toggle dentro de la visita). Nav «Ir a» oculto <640 px.

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
- **Artículos nuevos sin ubicar** (prioridad del depósito): «nuevo» = `fechaAlta`
  posterior a la **primera carga** de la sucursal (cada carga graba un único
  timestamp; así el día 1 no se marca todo) y ≤ `NUEVO_DIAS` (7). Se destacan con
  banner ámbar arriba de Buscar («⚡ N artículos nuevos sin ubicar» + «Ver nuevos»),
  filtro «⚡ Nuevos» en la cabecera de SIN UBICAR (se activa solo al cerrar el
  resumen de una carga con nuevos), etiqueta «⚡ Nuevo · ingresó hoy/ayer/hace N
  días» en la tarjeta (borde ámbar), siempre primeros en la lista y marcados con ⚡
  en la impresión. Dejan de ser "nuevos" al ubicarlos (`esNuevo`, `nuevosLista`).

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
- **Transferencias (.csv ;-separado, latin1)**: export con fila de encabezado
  `…;Enviado;Recibido;Días proc.`; viene CON o SIN columna Id.item → las columnas
  se detectan por contenido (las dos con prefijo `NN-` = origen y destino, el código
  entre ellas). Queda **guardado en Firebase**: lo sube uno y lo ven todos; subir
  otro lo reemplaza («✕ quitar» lo borra).
- **Cruce**: clave `origen+código+destino` (normalización `nrmF8`/`nrmT` con mapa
  `DEST_MAP_F8`, pliega acentos). Estados: Exacto / Con diferencia / No ejecutado.
  El control se agrupa por la **sucursal que ENVÍA**; 100% = mandó todo exacto.
  Calendario por sucursal×fecha + tarjetas + tabla con filtros y **⇩ Excel**.
  **«Enviados sin F8»**: transferencias no pedidas en ningún F8 — chip en los
  números del cruce (clic lo lista), opción en el filtro de casos y línea 📤 por
  sucursal en las tarjetas. Incluye TODO lo transferido (también cupones/perchas):
  es la foto fiel del export.
- **Firebase** (`turnero-mateu`, nodo `equipo/`): `f8s/<id>` (objeto por id, alta
  con PATCH — así las subidas simultáneas no se pisan), `ctrl` (registro manual,
  legacy) y `transf` (export vigente `{archivo,subido,por,filas:[[o,c,d,art,env]]}`).
  Eliminar un F8: botón 🗑 en el Historial (PATCH null).

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

`barrida/` (carpeta/URL se mantiene; el nombre visible es "Análisis de Reserva
Depósito Central") es un `index.html` self-contained (lee la sesión del Portal, sin
login propio). Lo corre el **depósito / gerencia** semana a semana (típico: los lunes) para
decidir la reposición de la semana anterior. La ve el rol `admin` o quien tenga la
herramienta `barrida` en su lista; las sucursales NO entran acá (ven su aviso en
Indicadores, ver abajo).

- **Entrada = subir Excel** (client-side, SheetJS por CDN, no se sube nada hasta
  guardar). Dos hojas: **ventas por sucursal** (columna `Sucursal` + `ID ITEM` +
  columnas por talle) y **reserva del depósito** (sin `Sucursal`, `ID ITEM` +
  columnas por talle). Puede ser un archivo con las dos hojas o dos archivos: se
  autodetecta cuál es cuál por los encabezados. Cruce por **`ID ITEM`**, abierto por
  talle. ⚠️ La hoja de reserva trae una columna final **`Total`** (suma de la fila):
  se excluye de los talles a propósito; si se contara, **duplicaría el stock**.
- **Salida = dos alertas por sucursal**: **Reposición** (artículo con reserva Y venta
  en una sucursal → sugerido por talle = `mín(vendido, reserva)`; los talles donde
  `vendido > reserva` van en **rojo** + pill ⚠ falta en el artículo = reserva no
  alcanza, señal de recompra a la marca; filtro "Solo con faltante de talle").
  Botón **⇩ Excel** (las tres pestañas exportan): estilo ExcelJS como el OC de
  Managment — membrete, header navy, autofiltro, freeze. La de **Reposición** replica
  la planilla física del depósito ("REPOSICIÓN CALZADO / ADIDAS"): título dinámico
  según el rubro/marca filtrado + columnas **Código · Artículo (ID ITEM) · Descripción
  · Destino · [talles = cantidad a mandar] · Total** y las analíticas (Vendido ·
  Reserva · Falta) al final; talles faltantes en rojo. Parada y Compras: header navy +
  autofiltro (Compras antepone Categoría y tiñe rojo/verde según sin/con reserva).
  Y **Reserva parada**
  (reserva y CERO venta en toda la cadena). El Depósito y filas basura (`Sucursal`)
  se excluyen de la demanda; se puede filtrar `Varios/Facturación` (gift cards,
  cupones). El grano fino es art×sucursal.
- **Vista Compras** (pestaña `compras`, para el rol Compras — Juli + Julián de Marco):
  mirada por **artículo global** (no por sucursal), ranking por vendido en la cadena,
  en tres grupos: **mejores vendidos SIN reserva** = reponer a la marca (recomprar),
  **mejores vendidos CON reserva** = solo seguimiento, y **artículos frenados** (= la
  reserva parada). "Mejores" usa un umbral `Vendidos ≥` (default 3, ajustable); el
  badge del tab y los KPIs usan ese umbral. Incluye un resumen "a quién reponer" por
  marca de lo sin reserva. Se guarda en el payload (`compras`) para el histórico.
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
  `{meta, reposicion:{<slug>:[...]}, parada:[...], compras:[...]}`,
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
  día a día de la hoja REAL); (2) **la estadística detallada por línea** (26/08/2026,
  la misma que sube gerencia en la vista Cadena — puede venir SIN columna Sucursal
  y hasta SIN encabezados: `veParseDetallado(m, sucFija)` + `veDetectarColumnas(m,
  sinSuc)` asumen la sucursal de la sesión, se quedan solo con los días de la semana
  elegida y traen el día a día por vendedor; va ANTES del genérico porque el genérico
  la leería mal); (3) genérico (columnas vendedor/venta y, si vienen, tickets/unidades
  — sin días). Muestra
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
  = port de `cargar-venta-semana.py`; mantener los criterios en sintonía. Previsualiza
  por sucursal vs. meta (avisa cuántos comprobantes descarta de otros días, sucursales
  sin slug —05-Depósito— y metas sin venta) y
  **publica en un solo PATCH multi-path** a `ventaEquipo/<slug>/<lunesISO>` (mismo
  payload que el script). La tabla de la cadena muestra esa venta como **«prov»**
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
  Bandeja** a `ALERTA_ADMINS` (capacitaciones@ —cubre RRHH, confirmado por Juli— /
  cristian.campion@ / capacitacion@, constante en `indicadores/`).
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

**Puesta en marcha: ya funciona (usa `recepciones-mateu`, en vivo). No hace falta
crear ninguna base.**

## Academia de Ventas (`capacitaciones/`)

`capacitaciones/index.html` es la versión FUNCIONAL, self-contained como el resto
(lee la sesión del Portal, sin login propio). Roles: **staff** = `admin` /
`capacitador` (Iván Nicoloff, `capacitacion@mateu.com.ar`) / `supervisor`
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
