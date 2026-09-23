# API de Ventas — Validación de la fase 1 (23/09/2026)

Resultado de cruzar la API que entregó el dev (`DOCUMENTACION_API.md`, copia sin la key en
`API-VENTAS-DOC-DEV-2026-09-23.md`; base `https://66-97-37-173.sslip.io`) contra lo que hoy
muestra el Portal. Este documento es **para pasarle al dev**: cada punto dice qué está pasando,
cómo se ve y qué tiene que cambiar. La key de la API no va en este repo (es público): se la
pasa Juli por otro canal.

## Resumen

La API está viva, responde rápido (0,2 s por semana), respeta el contrato de rutas, errores,
`Cache-Control` y el shape de `ventaEquipo`. **Todavía no se puede conectar al Portal** por
cinco cosas, en este orden de importancia:

| # | Qué | Efecto | Quién lo arregla |
|---|---|---|---|
| 1 | **El importe de cada línea viene bruto, sin el descuento de promoción** | La venta de TODAS las sucursales sale 2 a 10 % más alta que el sistema | dev (query) |
| 2 | **Las notas de crédito vienen con el signo al revés** | Una Nc suma en vez de restar (el doble de error por cada Nc) | dev (query) |
| 3 | **El criterio de agregación es el viejo**: desde el 17/09/2026 el Portal es EXACTO al sistema (ninguna línea se descarta, cada línea va a su vendedor) | Tickets, unidades y venta por vendedor no coinciden con Mi Sucursal | dev (agregación) — spec §4 reescrita |
| 4 | **CORS no funciona**: la respuesta no trae `Access-Control-Allow-Origin` ni con el Origin del Portal | Desde el navegador el `fetch` falla («Failed to fetch»), probado parado en `mateu-sports-portal.pages.dev` | dev, **o** lo resolvemos con un proxy en el Portal (ver §6) |
| 5 | **500 intermitentes** («Error interno del servidor») | 4 de ~70 llamadas; una tardó 19 s antes de fallar | dev (logs del server) |

Con 1 + 2 arreglados, la semana del 24/08 (cargada en el Portal con el criterio viejo, el mismo
que hoy aplica la API) daría **exacta**: en Kids y Plaza los tickets ya coinciden (263/263 y
255/255) y toda la diferencia de venta está en esas dos causas. Con 3, además, coincide con lo
que las sucursales ven hoy en Mi Sucursal.

## 1. Qué se probó

- `GET /health`, `GET /v1/ventas/semana/{lunes}` para el 24/08 y el 14/09, `…/sucursal/{slug}`
  para las 21 sucursales, `GET /v1/ventas/lineas` para Plaza (01) y Kids (02) del 24 al 30/08 y
  Diagonal 80 (10) del 14 al 20/09. Errores: fecha que no es lunes → 400 ✓, slug desconocido →
  404 ✓, semana futura → 200 `{}` ✓, sin key → 401 ✓.
- Contra el Portal: `ventaEquipo/<slug>/<lunes>` en Firebase (lo que cargó gerencia el 30/08
  para la semana del 24/08, y lo que cargaron las sucursales para la del 14/09).
- Contra el sistema: **el export «Ventas agosto portal.csv»** (la estadística detallada por
  línea de todo agosto), línea por línea contra `/v1/ventas/lineas`, por número de comprobante.
- Desde el navegador: `fetch` a la API con la pestaña abierta en el dominio del Portal.

## 2. Lo que anda bien

- Shape de `…/sucursal/{slug}` = el payload `ventaEquipo` del Portal (`vendedores[].dias[].{d,v}`,
  `rubros`, `total`). Ojo: la doc del dev dice `dias[].venta`; la API devuelve `v`, que es lo
  correcto (spec §5). No cambiar la API, corregir la doc.
- `/v1/ventas/lineas` trae `hora` (0–23) en todas las líneas: sirve para reemplazar también el
  Excel mensual de la matriz de pesos por turno. `vendedor: null` cuando no hay ✓. Paginado ✓.
- La agregación del endpoint de semana es **consistente con sus propias líneas**: recalculando
  las líneas crudas con la regla de la spec vieja se obtiene exactamente lo que devuelve
  `/semana` (Plaza 28.547.402 · 255 · 428; Diagonal 119.835.548 · 793 · 1.553). O sea: el
  problema no está en cómo suma, está en **qué importe lee** y en **qué regla aplica**.
- El domingo entra (Gonnet y Ecommerce traen `Do`).

## 3. Lo que hay que corregir

### 3.1 Importe bruto en vez de neto (la causa principal)

Mismo comprobante, misma línea, dos números:

| Comprobante | Artículo | Sistema (export) | API | Descuento que falta |
|---|---|---:|---:|---|
| FcC.0057-00229037 (Plaza) | M/C EDLP HOME 26 BCO/RJO | 98.999,10 | 109.999 | 10 % |
| FcC.0057-00229079 (Plaza) | KARMEN II WNS NEGRO | 95.999,20 | 119.999 | 20 % |
| FcC.0057-00229068 (Plaza) | GOLETTO IX TF F5 NGR/PLT | 89.999,10 | 99.999 | 10 % |
| FcC.0054-00236725 (Kids) | CANGURO DEPORTIVO EDLP 26 KIDS | 59.499,15 | 69.999 | 15 % |

En Kids, 27 de los 318 comprobantes de la semana tienen esta diferencia y suman **+589.318**,
que es la diferencia total de la semana (+589.175). En Plaza, 41 de 300 comprobantes,
**+1.060.466** de +1.061.669. El resto de las sucursales muestra el mismo patrón (§4).
**Lo que el Portal necesita es el importe neto por línea, el que muestra la «Estadística de
venta» del sistema** (con la promoción ya descontada). Las líneas «PROMO CUPONES −100» /
«CUPON DE DESCUENTO +100» siguen viniendo aparte y está bien: en el sistema también.

### 3.2 Notas de crédito con el signo al revés

En el export del sistema **todas** las líneas de una Nc vienen negativas (el artículo y también
las líneas de promo). En la API vienen al revés:

| Comprobante | Línea | Sistema | API |
|---|---|---:|---:|
| NcB.0054-00000339 (Kids) | F50 HYPERFAST LEAGUE JR | −1 × −129.999 | +1 × +129.999 |
| NcB.0057-00000428 (Plaza) | M/C SL SJ TEE WNS | −1 × −39.999 | +1 × +39.999 |
| NcB.0076-00000042 (Diagonal) | VOMERO 18 / SHORT DF / LLAVERO | (negativas) | +299.999 / +69.999 / +7.999 |
| NcB.0076-00000042 (Diagonal) | REGALO LLAVERO / PROMO CUPONES | (positivas) | −7.999 / −100 |

Efecto: Del Valle (Kids) da −129.999 en el Portal y +129.999 en la API. Regla: **multiplicar
por −1 todas las líneas de un comprobante cuyo número empieza con `Nc`**, en `/lineas` y en la
agregación. Esto era el «punto pendiente» de la doc del dev: confirmado que está mal.

### 3.3 El criterio cambió: el Portal es EXACTO al sistema (Juli, 17/09/2026)

La spec de agosto pedía descartar rubros (Otros, Redondeo, cupones…) y atribuir el
comprobante entero al vendedor de la línea más grande. **Eso ya no se usa en ningún lado**:
desde el 17/09 la carga semanal y el cierre mensual del Portal suman todas las líneas tal cual
y cada línea va al vendedor que la hizo, porque el encargado tiene que ver el mismo número que
le da el sistema. La spec `API-VENTAS-FASE1.md` §4 quedó reescrita con la regla nueva:

- **Ninguna línea se descarta.** Cantidad e importe de todas las líneas, con su signo.
- **Cada línea va a SU vendedor** (venta, unidades, día y rubro). Vendedor vacío → `SIN ASIGNAR`.
- **Ticket** = comprobante que no es Nc, **tenga o no unidades** (gift cards, señas y entregas
  a cuenta cuentan). Por vendedor: cuenta 1 para cada vendedor que tenga al menos una línea en
  él. Para el `total` de la sucursal: **comprobantes distintos** (no la suma de los vendedores;
  un ticket compartido es uno solo para el local).
- El día es el de la fecha del comprobante.

Cómo se ve hoy en Diagonal 80, semana del 14/09 (el Portal cargado con el criterio nuevo):

| | Portal (EXACTO) | API (criterio viejo) |
|---|---:|---:|
| Tickets | **908** = los 912 comprobantes menos 4 Nc | 793 (descarta los que quedan con cantidad 0) |
| Unidades | 1.412 | 1.553 (no resta las promos) |
| Venta | 116.639.535 | 119.835.548 (bruto + Nc al revés) |
| Tickets de Appiolaza | 168 | 58 (solo los comprobantes donde su línea es la mayor) |

### 3.4 Omnicanalidad: WEB MATEU / WEB AURELIUS

Los vendedores **WEB MATEU** y **WEB AURELIUS** que facturan en una sucursal física son venta
de la web: el Portal los **reasigna a Ecommerce (99)** al cargar (regla de Juli del 29/08). La
API los deja en la física: en la semana del 24/08, Calle 12 trae «WEB MATEU» con 47 tickets y
6.612.839, y Aurelius 12 «WEB AURELIUS» (8) + «WEB MATEU» (4). Por eso Calle 12 da 782 tickets
en la API y 735 en el Portal. La regla tiene que aplicarse en la API (el endpoint de totales
no trae vendedores, así que el Portal no puede corregirlo después): esas líneas suman a
`ecommerce` con su vendedor. En Ecommerce (99) son vendedores reales y quedan.

### 3.5 CORS

Ni el `GET` con `Origin: https://mateu-sports-portal.pages.dev` ni el preflight `OPTIONS`
devuelven `Access-Control-Allow-Origin` / `Access-Control-Allow-Headers`. IIS responde 204 al
OPTIONS pero sin los headers, así que el navegador bloquea la llamada. Si se corrige del lado
del server: `Access-Control-Allow-Origin: https://mateu-sports-portal.pages.dev`,
`Access-Control-Allow-Headers: Authorization`, `Access-Control-Allow-Methods: GET, OPTIONS`,
también en la respuesta al OPTIONS. La alternativa (recomendada) está en §6.

### 3.6 500 intermitentes

`{"error":"Error interno del servidor."}` en `…/semana/2026-08-24` (dos veces), en
`…/sucursal/plaza` (dos veces seguidas) y en `…/sucursal/aurelius-10` (una vez, después de
19 s). Repetir la misma llamada da 200. Parece un problema de conexión a MySQL o de pool bajo
concurrencia: hay que mirar los logs del server. El Portal va a reintentar una vez y caer a
Firebase si falla, pero conviene que no pase.

### 3.7 Menores

- `actualizado` no es consistente entre endpoints: para la semana del 14/09, `/semana` dice
  `2026-09-21T00:00:00Z` y `/sucursal/diagonal` dice `2026-09-19T20:00:00Z`. El Portal lo
  muestra como «datos hasta…», así que tiene que ser el mismo criterio en los dos.
- `/lineas` trae las líneas **anuladas y recargadas** como pares −1/+1 con el artículo
  prefijado `%%%` (`%%%MATIS XXI F5 KIDS`), mientras que el export las muestra como una sola
  línea 0 × 0. Netean a cero, no cambian totales, pero conviene saberlo para el ETL (1B):
  no contar esos artículos y no contarlas como líneas.
- La doc del dev dice que `dias[]` trae `venta`; la API devuelve `v`. La API está bien.

## 4. Tablas por sucursal

Portal = `ventaEquipo` en Firebase. Tickets y unidades como Portal/API; ✓ = iguales.

### Semana del 24/08/2026 (Portal cargado el 30/08 con el criterio viejo, el mismo de la API)

| Sucursal | Venta Portal | Venta API | Dif. | % | Tickets P/A | Unid. P/A |
|---|---:|---:|---:|---:|:--:|:--:|
| adidas | 61.116.811 | 61.286.424 | +169.613 | 0,3 % | 407/410 | 576/582 |
| adidas-12 | 55.673.039 | 55.935.433 | +262.394 | 0,5 % | 415/417 | 576/579 |
| aurelius-10 | 17.081.844 | 17.635.180 | +553.336 | 3,2 % | 120/123 | 176/180 |
| aurelius-5 | 32.828.426 | 34.215.519 | +1.387.093 | 4,2 % | 212/218 | 308/315 |
| aurelius-cb | 21.293.039 | 23.233.847 | +1.940.808 | 9,1 % | 136/141 | 211/219 |
| av-44 | 33.342.060 | 35.000.078 | +1.658.018 | 5,0 % | 348/352 | 687/696 |
| berisso | 34.034.289 | 34.980.049 | +945.760 | 2,8 % | 314/314 ✓ | 547/551 |
| calle-12 | 86.113.660 | 94.941.520 | +8.827.860 | 10,3 % | 735/782 | 1302/1369 |
| calle-47 | 35.144.755 | 37.107.477 | +1.962.722 | 5,6 % | 313/317 | 576/587 |
| calle-49 | 40.224.101 | 41.638.044 | +1.413.943 | 3,5 % | 363/368 | 724/732 |
| calle-55 | 21.964.937 | 22.507.521 | +542.584 | 2,5 % | 295/296 | 568/570 |
| city-bell | 62.675.496 | 64.735.928 | +2.060.432 | 3,3 % | 490/493 | 858/869 |
| diagonal | 89.641.844 | 93.725.728 | +4.083.884 | 4,6 % | 663/663 ✓ | 1333/1343 |
| ecommerce | 60.513.695 | 64.126.027 | +3.612.332 | 6,0 % | 567/543 | 644/672 |
| ensenada | 22.729.796 | 23.913.438 | +1.183.642 | 5,2 % | 241/242 | 374/389 |
| gonnet | 80.918.036 | 107.464.767 | +26.546.731 | 32,8 % | 794/1034 | 1504/1954 |
| kids | 21.938.354 | 22.527.529 | +589.175 | 2,7 % | 263/263 ✓ | 390/392 |
| los-hornos | 37.944.806 | 39.388.639 | +1.443.833 | 3,8 % | 364/365 | 601/608 |
| originals | 49.414.377 | 50.975.605 | +1.561.228 | 3,2 % | 280/288 | 391/402 |
| plaza | 27.485.733 | 28.547.402 | +1.061.669 | 3,9 % | 255/255 ✓ | 426/428 |
| aurelius-12 | (sin carga) | 39.033.603 | | | —/238 | —/344 |

Lecturas: los tickets casi iguales en todos lados confirman que el universo de comprobantes es
el mismo; la venta más alta es §3.1 + §3.2. **Gonnet y Ecommerce no son de la API**: el Portal
cargó esa semana el sábado a la noche («estadística Lu-Sa») y les falta el domingo, que la API
sí trae. **Calle 12 y Aurelius 12** son §3.4 (vendedores WEB). Los tickets de más del Portal
en Ecommerce (567 vs 543) son esos mismos vendedores WEB reasignados.

### Semana del 14/09/2026 (Portal cargado por cada sucursal con el criterio EXACTO)

| Sucursal | Venta Portal | Venta API | Dif. | % | Tickets P/A | Unid. P/A |
|---|---:|---:|---:|---:|:--:|:--:|
| aurelius-12 | 66.446.265 | 70.970.514 | +4.524.249 | 6,8 % | 407/385 | 552/585 |
| aurelius-5 | 60.115.639 | 61.611.729 | +1.496.090 | 2,5 % | 373/343 | 495/492 |
| berisso | 49.037.756 | 49.642.356 | +604.600 | 1,2 % | 492/428 | 738/796 |
| calle-49 | 54.456.804 | 55.837.332 | +1.380.528 | 2,5 % | 550/488 | 867/976 |
| diagonal | 116.639.535 | 119.835.548 | +3.196.013 | 2,7 % | 908/793 | 1412/1553 |
| plaza | 37.704.948 | 38.267.140 | +562.192 | 1,5 % | 393/350 | 562/603 |

Acá se suman las tres causas (§3.1, §3.2 y §3.3). Calle 55 quedó afuera (subió una carga
parcial de 46 tickets) y el resto de las sucursales no cargó esa semana en el Portal.

## 5. Cómo volver a validar cuando el dev corrija

```bash
VENTAS_API_KEY=<la key> node scripts/validar-api-ventas.mjs semana 2026-08-24
VENTAS_API_KEY=<la key> node scripts/validar-api-ventas.mjs sucursal 2026-08-24 kids
VENTAS_API_KEY=<la key> node scripts/validar-api-ventas.mjs lineas 2026-08-24 2026-08-30 02 "C:/Users/julia/Downloads/Ventas agosto portal.csv"
```

`semana` imprime la tabla Portal vs. API de las 21 sucursales; `sucursal` compara vendedor por
vendedor, día por día y rubro por rubro; `lineas` recalcula la semana desde las líneas crudas
con el criterio EXACTO del Portal y, si se le pasa el export del sistema, cruza comprobante
por comprobante y lista las líneas que difieren. Objetivo de aceptación: **diferencia 0 en
venta, tickets y unidades** contra el export del sistema (tolerancia ±1 por redondeo), no
contra Firebase (que puede tener cargas parciales o sin domingo).

## 6. Cómo conectar el Portal (propuesta)

En vez de que el navegador llame a la API directo, poner una **Pages Function** en el Portal
(`/api/ventas/semana/{lunes}[/sucursal/{slug}]`) que reenvíe a la API con la key guardada como
Secret de Cloudflare, igual que `publicar-stock` y `asistente`. Ventajas: **no hace falta CORS**
(mismo origen), **la key no viaja al navegador ni al repo** (que es público: una key en el
`index.html` es una key publicada) y se puede **validar el rol** con el token de sesión de
`acceso.js` (una cuenta de sucursal solo puede pedir su slug; es la «fase 2» de seguridad de la
spec, sin tocar la API). Del lado de Indicadores: leer la semana viva de `/api/ventas/…` con
reintento y caer a `ventaEquipo` de Firebase si no responde; la carga manual queda como plan B
y la semana de la API se marca «en vivo · datos hasta HH:MM». Esto se arma cuando la API
devuelva los números correctos (§3.1 a §3.4).
