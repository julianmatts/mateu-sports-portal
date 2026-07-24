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
por sucursal. Se corre en el sandbox de Juli (necesita pandas + los Excel); después se
copia `out/indicadores/` a `data/indicadores/` del repo. Los objetivos por formato y la
regla nombre→formato viven fijos en ese script — NO tocar el cálculo salvo pedido.

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
  Managment — membrete, header navy, autofiltro, freeze. Orden de columnas
  Rubro · Marca · Artículo · Código · Sucursal · Vendido · Reserva · Sugerido · Falta
  + el **sugerido abierto por talle en columnas** (talles faltantes en rojo). Parada y
  Compras usan el mismo estilo/orden (sin Sucursal; Compras antepone Categoría y tiñe
  rojo/verde según sin/con reserva). Y **Reserva parada**
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

## Reglas

- Responder y comentar el código en **español**.
- No agregar frameworks ni build steps. Mantener todo self-contained.
- No tocar la config de Firebase de los módulos (URLs de las bases) salvo pedido explícito.
- Antes de un cambio grande en una herramienta, confirmá el alcance con Juli.
- Juli itera con correcciones puntuales: hacé cambios acotados y dirigidos, no
  reescrituras completas salvo que lo pida.
