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
