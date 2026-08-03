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
├── equipo/             # Área de Producto / transferencias (localStorage)
├── turnero/            # Turnero de proveedores (Firebase + EmailJS)
├── marcas/             # Asignación de Marcas (Firebase REST)
├── gestion-stock/      # Discontinuos por sucursal + Reporte Mensual + Meses de Stock
├── pedidos-semanales/  # Reposición semanal por sucursal y aprobaciones de Producto
├── managment/          # Desarrollo, OC y seguimiento de ingresos por proveedor
├── recepcion/          # Tablero de recepción preventa Adidas SS27
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
  `condiciones/` y `equipo/` usan **localStorage** (no tienen backend).
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
(`admin` | `sucursal` | `outlet`), su `sucursal`/`outlet_id` y la lista
`herramientas`, que define qué tiles ve. Ya no hay contraseñas en el código:
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

**Forma correcta de regenerarlo — usar el generador:**

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
el cálculo salvo pedido.

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

## Evaluaciones de Supervisor

`evaluaciones/` es un `index.html` self-contained **igual que el resto**: lee/escribe
a Firebase por REST (base `evaluaciones-mateu`). Carga semanal operativa+actitudinal
por sucursal, con ranking, gráficos, seguimiento de puntos de mejora y vista de
encargado. Se evaluó pasarlo por Pages Functions + D1 para tener permisos en el
server, pero Juli eligió mantenerlo consistente con el resto (seguridad blanda).

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

## Objetivos de Venta Semanal

`objetivos/` es un `index.html` self-contained (lee la sesión del Portal, sin login
propio). Lo carga **gerencia** semana a semana: el objetivo de venta por sucursal.
La ve el rol `admin` o quien tenga la herramienta `objetivos`. Las sucursales NO
entran acá: ven su objetivo en Indicadores.

- **Valores por sucursal/semana**: **META** (el objetivo, el único que se carga),
  **MÍNIMO** (= Meta ÷ 1,2), **120** (= Meta × 1,2, superación) y **REAL** (venta de
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
  Excel de venta **abierta por vendedor** (SheetJS lazy; autodetecta las columnas
  vendedor/venta y, si vienen, tickets/unidades), **previsualiza** y guarda. Muestra
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
  ⚠️ Diagonal 80 tiene objetivo pero no tiene datos de Indicadores todavía, así que
  su encargado aún no ve la sección (Indicadores lo manda a empty state antes). Se
  resuelve cuando Diagonal tenga datos de venta.
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
- **Etapa 2 pendiente (pedida por Juli)**: armar los objetivos directo en el portal
  (sin Excel) y, al confirmar, **enviar una notificación interna** a cada usuario de
  sucursal. Enganchar con la Bandeja de mensajes (`mensajes-mateu`) del Portal.

**Puesta en marcha: ya funciona (usa `recepciones-mateu`, en vivo). No hace falta
crear ninguna base.**

## Academia de Ventas (`capacitaciones/`)

`capacitaciones/index.html` es la versión FUNCIONAL, self-contained como el resto
(lee la sesión del Portal, sin login propio). Roles: **staff** = `admin` /
`capacitador` (Iván Nicoloff, `capacitacion@mateu.com.ar`) / `supervisor`
(Cristian Campion) con acceso total; **alumno** = cuentas `sucursal`/`outlet` con la
herramienta `capacitaciones`.

- **Staff**: pestañas Cursos (CRUD: módulos de texto / video YouTube / **archivo
  PDF-PPT subido desde la PC** (se guarda en Firebase en partes base64, nodo
  `archivos/<fid>`, tope 20 MB; el alumno lo descarga reconstruido) / material por
  link + quiz opción múltiple con % de aprobación), Programas (junta cursos y los asigna
  por puesto y/o sucursal con fecha límite; botón «📣 Avisar» publica la notificación
  en la Bandeja del Portal vía `mensajes-mateu/avisos`), Equipo (avance persona por
  persona de una sucursal), Ranking (cumplimiento promedio por sucursal) y Encuestas
  (promedios + comentarios por curso).
- **Alumno**: la cuenta de sucursal elige QUIÉN es (picker con la dotación de
  Indicadores del último período, mismo mapa `SLUG_SUC_IND` que Buscador/RRHH; se
  recuerda en localStorage `cap_yo_<slug>`). Ve sus cursos asignados (por su puesto:
  encargado/vendedor/cajera/depósito), marca módulos vistos, rinde el quiz (se
  habilita con todos los módulos vistos), y al aprobar gana badge + **certificado
  imprimible** (firmas: Iván capacitador / Cristian supervisor) + encuesta post-curso.
- **Firebase**: reusa **`recepciones-mateu`**, nodo aparte `capacitaciones/` (no toca
  recepciones/, barrida/, objetivos/, ingreso/): `cursos/<id>`, `programas/<id>`,
  `avances/<slug>/<personaId>/<cursoId>` (agrupado por slug → cada sucursal baja solo
  lo suyo, seguridad blanda) y `encuestas/<cursoId>/<pushId>`.
- Las pantallas `.dc.html` + `support.js` + `sesion.js` son el **prototipo de Design**
  que originó el módulo; quedan como referencia visual (siguen gateadas).

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
- No agregar frameworks ni build steps. Mantener todo self-contained.
- No tocar la config de Firebase de los módulos (URLs de las bases) salvo pedido explícito.
- Antes de un cambio grande en una herramienta, confirmá el alcance con Juli.
- Juli itera con correcciones puntuales: hacé cambios acotados y dirigidos, no
  reescrituras completas salvo que lo pida.
