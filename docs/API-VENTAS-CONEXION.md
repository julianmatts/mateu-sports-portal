# API de ventas — conexión del Portal (24/09/2026)

Cómo Indicadores (Mi Sucursal / Panel General) lee la venta de la semana en curso desde el
sistema, y qué hay que configurar en Cloudflare para que ande. La API en sí (rutas, criterio,
validación) está en `API-VENTAS-FASE1.md` y los informes del 23 y 24/09.

## Qué hace

```
navegador ──► /api/ventas?semana=…[&sucursal=…] ──► functions/api/ventas.js ──► https://66-97-37-173.sslip.io/v1/ventas/…
   (Indicadores)     mismo origen, sin CORS            lib/ventas-proxy.mjs             (key Bearer en un Secret)
                                                        cache 5 min + respaldo 24 h
```

- **La key nunca baja al navegador**: vive en el Secret `VENTAS_API_KEY` de Cloudflare Pages y
  la usa solo la Function. El repo es público, así que tampoco va en ningún archivo.
- **Cache en el proxy** (`lib/ventas-proxy.mjs`): cada respuesta se guarda en memoria del isolate y
  en R2 (bucket `LEGAJOS`, prefijo `_cache/ventas/`). Menos de 5 min: se sirve sin tocar la API.
  Entre 5 min y 24 h: se sirve al toque y se refresca de fondo. Una ruta que falló (500 de la
  API, timeout) no se vuelve a pedir por 60 s. Así el bloqueo de ~20 s cada 30 s que hoy tiene
  la base del sistema no lo ve el encargado: como mucho lo paga la primera consulta del día.
- **Permisos en la Function, no en el navegador**: el mail de la sesión viaja en el header
  `X-Mateu-Email` (y el token de `acceso.js` en `X-Mateu-Tok`); rol y sucursal salen de
  `discontinuos-mateu/usuarios`. `admin` y `supervisor` ven cualquier sucursal; `sucursal` y
  `outlet` solo la propia (los totales de la semana les llegan filtrados); el resto, 403. Con
  el ingreso por servidor activo el token es obligatorio.
- **Indicadores** (`indicadores/index.html`, bloque «API de ventas del sistema»): al abrir hace
  `GET /api/ventas` una vez (se recuerda 10 min en sessionStorage). Con `disponible:true`:
  - **Semana en curso** (lunes de hoy o posterior): `fetchVentaEquipo` y `fetchVentaEquipoTotal`
    piden primero al proxy y, si no responde, caen a `ventaEquipo` de Firebase. El payload de
    la API tiene el mismo shape que `ventaEquipo` y viene marcado `fuente:'api'`.
  - **Semanas anteriores**: primero `ventaEquipo` (lo que cargó gerencia o el encargado) y solo
    si no hay nada, la API. Así una semana que nadie cargó igual aparece.
  - Si el encargado sube su Excel en una semana viva, en esa visita se muestra lo suyo
    (`_veManual`); al recargar vuelve a mandar el sistema.
  - En pantalla: pill **«● en vivo · hasta DD/MM HH:MM»** en «Cómo viene el equipo» (Mi Sucursal)
    y **«vivo»** en vez de «prov» en la tabla del objetivo semanal del Panel General.
- Sin el Secret (o abriendo el HTML suelto): `disponible:false` y todo sigue por `ventaEquipo`
  como siempre. Nada se rompe.

## Configurar en Cloudflare (lo hace Juli, una vez)

1. Cloudflare → Workers & Pages → proyecto **Pages** `mateu-sports-portal` (el de
   `mateu-sports-portal.pages.dev`, no el Worker del mismo nombre) → Settings → Variables and
   Secrets → **Add** → tipo **Secret**, nombre `VENTAS_API_KEY`, valor = la key de la API.
2. Deployments → último deploy → ⋯ → **Retry deployment** (un Secret nuevo recién se ve en el
   deploy siguiente).
3. Verificar: abrir `https://mateu-sports-portal.pages.dev/api/ventas` → `{"disponible":true}`.
4. Entrar a Mi Sucursal o al Panel General: la semana en curso tiene que salir con el pill
   «● en vivo».

Opcionales: `VENTAS_API_BASE` (variable, si el dev cambia el host) y un binding R2 `VENTAS_CACHE`
si se quiere un bucket propio para el cache (hoy usa `LEGAJOS`).

## Cómo probar sin Cloudflare

`node --test lib/ventas-proxy.test.mjs` prueba la Function con la API y Firebase simulados
(permisos por rol, cache fresco/viejo, API caída, una sola consulta en vuelo, memoria de fallos).
Para probarlo en el navegador contra la API real se puede servir el repo con un servidor de
node que monte `manejar()` de la librería en `/api/ventas` con la key leída de un archivo fuera
del repo (así se validó el 24/09/2026: Panel General y Mi Sucursal de Kids, semana del 21/09).

## Pendiente del lado de la API (dev)

- Descuento de cabecera del comprobante en el importe (Kids 24/08: 26 comprobantes, +329.320).
- El bloqueo de la base cada ~30 s (el cache lo tapa, no lo arregla).
- **500 en 0,15 s justo después de un 500 de 16–20 s** (visto el 24/09 al conectar, repitiendo la misma
  llamada cada 4 s: Kids 14/09 → 500 en 20,6 s, y las dos llamadas siguientes —Plaza y Kids— 500 en
  0,12 s; un minuto después, lo mismo). No es una sucursal ni una semana en particular: mientras dura
  la ventana de bloqueo, cuando una llamada agota sus reintentos las siguientes fallan al instante,
  como si el pool de conexiones quedara agotado o roto. Es lo que hay que mirar en el log de la API.

## Segunda tanda (24/09/2026, noche): la API en los demás módulos

- **Espejo en Firebase** (`espejar` en `lib/ventas-proxy.mjs`): cada vez que el proxy trae de la API el
  detalle de una sucursal, copia el payload a `recepciones-mateu/ventaEquipo/<slug>/<lunes>` con
  `por:'api'` y `fuente:'api'`, de fondo (`waitUntil`), **solo si ese nodo no existe o ya era del
  proxy**: lo que cargó a mano un encargado o gerencia no se pisa. Así los módulos que leen
  `ventaEquipo` directo (Academia «resultados en la venta», Matts, conciliación de RRHH, avance del
  objetivo mensual, curva de venta de Diagonal 80) siguen teniendo la semana aunque nadie suba el
  Excel. Se apaga con la variable `VENTAS_ESPEJO=0`.
- **`shared/ventas-api.js`** (`window.VentasApi`): el acceso al proxy para cualquier módulo, con una
  línea en el `<head>`: `disponible()`, `semana(lunes)`, `sucursal(slug, lunes)`, `totalesMes(ym)`
  (suma las semanas retail del mes, las que ya empezaron; `completo` dice si el mes cerró),
  `semanasDelMes(ym)`, `lunesHoyISO()`. Sin sesión o sin proxy devuelve `null` y el módulo sigue
  con su fuente de siempre.
- **Objetivos**: en el dashboard semanal, la sucursal sin real oficial ni carga del encargado muestra
  la venta del sistema con el pill **«sistema»** (`state.dashApi`); en el dashboard mensual,
  `acumuladoSemanal` suma la venta del sistema de las semanas publicadas que no tienen real y el
  banner cuenta cuántas («4, 1 leída en vivo del sistema»). Nada se escribe en `real`: el oficial
  sigue saliendo del HISTÓRICO del Excel PMS.
- **Reseñas de Google**: los meses de la planilla que vienen SIN la columna de tickets (el que Iván
  manda) toman los tickets de las semanas retail del mes desde la API (`ticketsDelSistema`, marca
  `tApi`; opción «· tickets del sistema» en el selector y aclaración en la nota). Es una aproximación
  al mes calendario del Excel; cuando Iván carga la columna, el generador la pisa. El informe público
  `?pres=` no lo usa (no hay sesión).
- **Logística, «Abastecimiento vs. venta»**: los meses sin período cerrado de Indicadores (el mes en
  curso, el anterior hasta que corra el ETL) toman las unidades vendidas de la API por semanas retail
  (`VENTA_API[ym]`, nota «Septiembre 2026 en vivo del sistema, mes en curso»).
- **`scripts/ventas-api-lineas.mjs`** (key por `VENTAS_API_KEY`): `csv <desde> <hasta> <salida.csv>`
  baja las líneas crudas y escribe el mismo CSV que el export «Estadística de venta» del sistema (sirve
  para `etl_indicadores.py` con `csv=True` y para «⇧ Cargar venta del mes»); `pesos YYYY-MM
  [--publicar]` arma la matriz de pesos por turno × día (la que Objetivos publica en
  `objetivos/pesosTurnos`) desde el campo `hora` de las líneas y reemplaza el Excel «PESOS TURNOS».
  ⚠ Hasta que la API aplique el descuento de cabecera, el importe de las líneas sale 1–3 % arriba del
  sistema: el CSV no sirve todavía para un cierre mensual oficial.
- **Lo que necesita campos nuevos en `/lineas`** (pedido al dev): ID ITEM y talle para el Reparto de
  Mercadería (la venta semanal por artículo × talle × sucursal), código de artículo y cliente para
  Regalías RUGE.

## Cadencia de la API (medido el 25/09/2026, 10:21–13:21)

108 consultas a Kids, Plaza y Diagonal 80 cada 5 minutos (`Downloads/medicion-api-ventas-2026-09-25.csv`):
la venta **cambia cada 30 minutos, en punto y a la media** (10:31 · 11:01 · 11:31 · 12:01 · 12:31 · 13:01, las
tres sucursales a la vez), así que la base de la API se carga con un job de media hora. El campo `actualizado`
viene **redondeado a la hora** y queda hasta 30 minutos atrás del corte real (a las 12:31 Diagonal ya traía
la venta de las 12:30 y decía «11:00»). Ningún 500 en las 3 horas, promedio 91 ms, máximo 420 ms. Con eso, el
refresco de 5 minutos del proxy alcanza de sobra; lo que falta pedirle al dev es que `actualizado` sea la hora
real de la última carga, para que el pill «hasta HH:MM» no mienta por media hora.

## Ajuste de cabecera resuelto (25/09/2026, tarde)

El dev aplicó el prorrateo del recargo/descuento del comprobante con la participación de cada línea
**truncada a 4 decimales** (el algoritmo del reporte del sistema, deducido de los comprobantes con 12 % de
recargo de Adidas Originals). Verificado línea por línea contra «Ventas agosto portal.csv», semana 24–30/08:
Originals 50.749.370 · Calle 12 92.376.157 · Kids 21.950.916 · Diagonal 80 89.544.347, **diferencia 0 en los
cuatro, 0 comprobantes distintos**. Con esto el CSV de `scripts/ventas-api-lineas.mjs` ya sirve para el
cierre mensual del ETL. Sigue pendiente del dev el bloqueo de la base (hoy hubo dos 500 con reintento en
`/lineas`) y la hora real en `actualizado`.

## Campos nuevos en `/v1/ventas/lineas` (25/09/2026, tarde)

El dev sumó por línea: **`idItem`** (100 % de las líneas), **`talle`** (todas las líneas de artículo; vacío en
Conceptos/envíos), **`codigo`** = el código del artículo del sistema (`RUG858`, `ADIJS2852`, `NB2T000172550`;
100 %), **`codigoArticulo`** = el código de barras del talle (EAN o etiqueta con «!»; vacío en RUGE) y
**`cliente` / `clienteCuit`** (vienen en el Depósito y en la web: «CLUB ESTUDIANTES RUGE CONTRATO» sin CUIT,
«CLUB ESTUDIANTES DE LA PLATA» 30-52841228-5; los remitos «Rem.0094-…» salen como líneas con cantidad).
Verificado con la semana 15–22/09 (10.000 líneas) y el Depósito de septiembre. Con esto quedan habilitados,
como trabajos aparte: la venta semanal por sucursal × ID ITEM × talle del **Reparto de Mercadería** (hoy se
sube la estadística de ventas) y el reporte de ventas por cliente de **Regalías / Entregas EDLP**.
