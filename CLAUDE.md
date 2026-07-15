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
└── shared/             # código común (hoy casi vacío, para el futuro)
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

Pendiente de validar con Juli: el mapa slug de Portal → sucursal de datos (`SLUG_SUC`
/ `OUTLET_SUC` en el módulo); `diagonal` y `deposito` no tienen datos de venta todavía.

## Reglas

- Responder y comentar el código en **español**.
- No agregar frameworks ni build steps. Mantener todo self-contained.
- No tocar la config de Firebase de los módulos (URLs de las bases) salvo pedido explícito.
- Antes de un cambio grande en una herramienta, confirmá el alcance con Juli.
- Juli itera con correcciones puntuales: hacé cambios acotados y dirigidos, no
  reescrituras completas salvo que lo pida.
