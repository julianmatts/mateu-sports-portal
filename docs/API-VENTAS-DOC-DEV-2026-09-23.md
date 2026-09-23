> Copia de la documentación que entregó el dev el 23/09/2026 (`DOCUMENTACION_API.md`), con la key
> tapada porque este repo es público. Lo que difiere de lo validado está en
> `API-VENTAS-VALIDACION-2026-09-23.md` (p.ej. `dias[].venta` acá es `dias[].v` en la API real).

# API de Ventas — Documentación para integración (Fase 1)

Esta API reemplaza los excels de ventas que hoy se cargan a mano en el Portal
(módulo **Indicadores**: Panel General y Mi Sucursal). Expone los mismos
números que hoy salen de esos excels, pero como endpoints JSON en vivo.

Este documento es para el equipo que va a **conectar el Portal a la API y
validar** que los números coinciden con lo que hoy entra por excel.

---

## 1. URL base y autenticación

**URL base:** `https://66-97-37-173.sslip.io`

Todos los endpoints bajo `/v1/...` requieren este header en cada request:

```
Authorization: Bearer <API KEY — la pasa Juli por otro canal; no va en el repo>
```

Sin ese header (o con una key incorrecta), la API responde `401`:

```json
{ "error": "API key inválida o ausente." }
```

El endpoint `GET /health` es público (no requiere key) y sirve para chequear
que la API está arriba:

```
GET https://66-97-37-173.sslip.io/health
→ 200 { "status": "ok" }
```

**CORS:** la API solo acepta requests desde el navegador si vienen del origen
`https://mateu-sports-portal.pages.dev` (el dominio del Portal). Un `fetch`
hecho desde Postman/curl/un script no tiene esa restricción; sí la tiene un
`fetch` hecho desde el navegador en otro dominio.

**Formato de error:** cualquier error de la API (validación, no encontrado,
error interno) devuelve siempre `{ "error": "<mensaje>" }` con el código HTTP
correspondiente (400, 401, 404, 500) — nunca HTML ni un stack trace.

---

## 2. Conceptos clave antes de comparar contra el excel

- **Semana retail = lunes a domingo.** Los endpoints de "semana" siempre
  reciben el **lunes** de la semana en formato `YYYY-MM-DD`. Si mandás
  cualquier otro día de la semana, la API responde `400`.
- **Sucursal "05" (Depósito) se excluye siempre**, en los dos endpoints de
  semana. No es un bug si no aparece.
- **Reglas de qué "cuenta" como venta** (aplican tanto a cantidad como a
  importe, línea por línea, antes de sumar):
  - Rubro **OTROS** → no aporta ni cantidad ni importe.
  - Rubro **VARIOS**, artículo **REDONDEO** → no aporta nada. El resto de
    VARIOS sí aporta cantidad e importe.
  - Rubro **CONCEPTOS**:
    - Empieza con "CREDITO A FAVOR" → aporta cantidad e importe.
    - Empieza con "INGRESO CUPON", o contiene "LLAVERO COMPRA GRANDE" →
      no aporta nada.
    - Empieza con "CONCEPTOS VARIOS" → no aporta nada.
    - Cualquier otro CONCEPTOS (promos/descuentos, envío) → aporta **solo
      importe**, no cantidad.
  - Cualquier otro rubro → aporta cantidad e importe normalmente.

  Esto significa que un `SELECT SUM(...)` directo sobre la tabla de
  comprobantes **no** va a coincidir con los totales de la API si el excel
  actual no aplica estas mismas exclusiones — es la causa más probable de
  cualquier diferencia chica que encuentren al validar.

- **Un comprobante nunca se divide.** Todas sus líneas se agrupan por
  `sucursal + número de comprobante` y se agregan juntas antes de aportar a
  ningún total.
- **Qué cuenta como "ticket":** un comprobante cuyo número **no** empieza
  con `Nc` (no es nota de crédito) **y** cuya cantidad agregada (ya aplicando
  las reglas de arriba) es mayor a 0. Una nota de crédito nunca suma un
  ticket, aunque sí resta de `venta`/`unidades`.
- **Qué vendedor se le asigna a un comprobante:** el de la línea con mayor
  `|importe|` (valor absoluto) dentro de ese comprobante — no el de la
  primera línea ni un promedio. Si esa línea no tiene vendedor cargado, el
  comprobante entero queda como `"SIN ASIGNAR"` (en los endpoints de
  semana; en líneas crudas de §6 sale `null`, no `"SIN ASIGNAR"`).
- **Campo `actualizado`**: timestamp ISO (UTC) de la venta más reciente
  incluida en la respuesta — sirve para que el Portal muestre "datos hasta
  las HH:MM". Si no hay ventas en el rango, devuelve la hora actual.

---

## 3. Endpoint 1 — Totales de la semana (Panel General)

```
GET /v1/ventas/semana/{lunesISO}
```

- `lunesISO`: fecha del lunes de la semana, formato `YYYY-MM-DD`.
- Requiere `Authorization`.
- Devuelve `Cache-Control: public, max-age=300` (se puede cachear 5 min).

**Ejemplo:**

```
GET https://66-97-37-173.sslip.io/v1/ventas/semana/2026-08-24
Authorization: Bearer <API KEY — la pasa Juli por otro canal; no va en el repo>
```

**Respuesta 200:**

```json
{
  "semana": "2026-08-24",
  "actualizado": "2026-08-30T22:00:00Z",
  "sucursales": {
    "adidas": { "venta": 61286424, "tickets": 410, "unidades": 582 },
    "ecommerce": { "venta": 64126027, "tickets": 543, "unidades": 672 },
    "kids": { "venta": 22527529, "tickets": 263, "unidades": 392 }
  }
}
```

- `sucursales` es un mapa `slug → { venta, tickets, unidades }`. Ver §5 para
  la lista completa de slugs.
- Si una sucursal no tuvo ventas en la semana, directamente no aparece en el
  mapa (no sale con ceros).
- `venta` es el importe total en pesos, redondeado a entero (sin decimales).

**Errores:**
- `400` si `lunesISO` no es una fecha válida o no cae en lunes.

---

## 4. Endpoint 2 — Detalle por vendedor de una sucursal (Mi Sucursal)

```
GET /v1/ventas/semana/{lunesISO}/sucursal/{slug}
```

- `slug`: el identificador de sucursal del Portal (ver tabla en §5), ej.
  `plaza`, `kids`, `ecommerce`.
- Mismo formato de `lunesISO` y misma autenticación que el endpoint anterior.

**Ejemplo:**

```
GET https://66-97-37-173.sslip.io/v1/ventas/semana/2026-08-24/sucursal/plaza
Authorization: Bearer <API KEY — la pasa Juli por otro canal; no va en el repo>
```

**Respuesta 200:**

```json
{
  "semana": "2026-08-24",
  "actualizado": "2026-08-30T22:00:00Z",
  "vendedores": [
    {
      "nombre": "JUAN PEREZ",
      "venta": 8452100,
      "tickets": 61,
      "unidades": 88,
      "dias": [
        { "d": "Lu", "venta": 1200000 },
        { "d": "Ma", "venta": 950000 }
      ],
      "rubros": {
        "CALZADO": 5200000,
        "INDUMENTARIA": 3252100
      }
    }
  ],
  "total": { "venta": 22527529, "tickets": 263, "unidades": 392 }
}
```

- `vendedores` viene ordenado de mayor a menor venta. Vendedores con venta,
  tickets y unidades en cero no se incluyen.
- `dias` solo incluye los días de la semana (`Lu`..`Do`) en que ese vendedor
  tuvo venta — si un día no tuvo venta, no aparece en la lista (no sale con
  `venta: 0`).
- `rubros` es un mapa rubro → importe, solo con rubros que tuvieron importe
  distinto de cero para ese vendedor.
- `total` es el total de la sucursal completa (todos los vendedores).

**Errores:**
- `400` si `lunesISO` no es válido/no es lunes.
- `404` si `slug` no corresponde a ninguna sucursal conocida.

---

## 5. Tabla de sucursales (código interno → slug del Portal)

| Código | Slug del Portal |
|---|---|
| 01 | `plaza` |
| 02 | `kids` |
| 03 | `calle-55` |
| 04 | `aurelius-12` |
| 06 | `city-bell` |
| 07 | `aurelius-10` |
| 08 | `calle-47` |
| 09 | `adidas` |
| 10 | `diagonal` |
| 11 | `ensenada` |
| 12 | `calle-12` |
| 13 | `los-hornos` |
| 14 | `gonnet` |
| 15 | `originals` |
| 16 | `berisso` |
| 17 | `aurelius-cb` |
| 18 | `aurelius-5` |
| 19 | `calle-49` |
| 20 | `av-44` |
| 21 | `adidas-12` |
| 99 | `ecommerce` |

(El código `05`, Depósito, no es una sucursal de venta y no tiene slug — se
excluye siempre.)

---

## 6. Endpoint 3 — Líneas crudas paginadas (para el cierre mensual / Etapa 1B)

```
GET /v1/ventas/lineas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&sucursal=NN&cursor=...
```

Este endpoint **no aplica ninguna de las reglas de negocio de §2** — devuelve
las líneas tal cual salen de la base, para que el consumidor (Excel/ETL) las
procese como necesite. Está pensado para el cierre mensual, no para los
tableros en vivo.

**Parámetros:**
- `desde`, `hasta`: rango de fechas, formato `YYYY-MM-DD` (obligatorios).
  `hasta` no puede ser anterior a `desde`.
- `sucursal` (opcional): código de sucursal de 2 dígitos (`01`..`21`, `99`).
  Si no se manda, trae todas las sucursales.
- `cursor` (opcional): el valor de `cursor` que devolvió la página anterior,
  para pedir la siguiente. Es un string opaco — no intentar decodificarlo ni
  armarlo a mano, solo repetirlo tal cual.
- El tamaño de página lo define la API (10.000 filas por página).

**Ejemplo — primera página:**

```
GET https://66-97-37-173.sslip.io/v1/ventas/lineas?desde=2026-08-01&hasta=2026-08-31
Authorization: Bearer <API KEY — la pasa Juli por otro canal; no va en el repo>
```

**Respuesta 200:**

```json
{
  "lineas": [
    {
      "fecha": "2026-08-24",
      "hora": 14,
      "sucursal": "01",
      "vendedor": "JUAN PEREZ",
      "comprobante": "FcC.0057-00081234",
      "articulo": "REMERA BASICA",
      "rubro": "INDUMENTARIA",
      "cantidad": 2,
      "importe": 45000
    }
  ],
  "cursor": "MTAwMDA="
}
```

- `vendedor` puede venir `null` (comprobante sin vendedor asignado) — a
  diferencia de los endpoints de semana, acá **no** se agrupa como
  "SIN ASIGNAR".
- `sucursal` es el código de 2 dígitos (no el slug).
- Cuando `cursor` viene en `null`, no hay más páginas.
- Si el rango pedido supera 45 días, la API igual responde, pero es un rango
  no recomendado (pensado para uno o dos meses por request).

**Errores:**
- `400` si `desde`/`hasta` faltan o son inválidos, si `hasta < desde`, o si
  `sucursal` no es un código válido.

---

## 7. Cómo validar contra lo que hoy entra por excel

Sugerencia de proceso para esta primera validación (semana del 2026-08-24,
por ejemplo):

1. Entrar al Portal con un usuario que tenga acceso a Indicadores y anotar,
   para esa semana, los totales que hoy muestra Panel General (venta,
   tickets, unidades por sucursal) — los que salen del excel actual.
2. Pedir `GET /v1/ventas/semana/2026-08-24` y comparar sucursal por
   sucursal contra lo anotado en el paso 1.
3. Si hay diferencias, repetir el mismo chequeo para una sucursal puntual
   con `GET /v1/ventas/semana/2026-08-24/sucursal/{slug}` y comparar contra
   Mi Sucursal en el Portal — ahí se ve el detalle por vendedor, que ayuda a
   encontrar dónde está la diferencia.
4. Anotar cualquier diferencia (sucursal, día, magnitud) y pasarla — es la
   forma más rápida de detectar si hace falta ajustar alguna regla de §2.

**Punto pendiente de validación conocido:** el signo de `Imp_neto` en notas
de crédito (comprobantes que descuentan de la venta). La API ya replica la
lógica de signo de la query original de TS, pero todavía no se comparó contra
un caso real con notas de crédito en la semana — si en la semana elegida para
validar hubo notas de crédito, prestarle atención puntual a ese número.

---

## 8. Resumen rápido (cheat sheet)

| Qué necesito | Endpoint |
|---|---|
| Totales de todas las sucursales de una semana | `GET /v1/ventas/semana/{lunesISO}` |
| Detalle por vendedor de una sucursal | `GET /v1/ventas/semana/{lunesISO}/sucursal/{slug}` |
| Líneas crudas para cierre mensual/ETL | `GET /v1/ventas/lineas?desde=...&hasta=...` |
| Chequeo de que la API está viva | `GET /health` (sin auth) |

Cualquier duda sobre un número puntual, lo más rápido es probar el endpoint
directo con curl o Postman con el header `Authorization` y comparar la
respuesta cruda contra el Portal.
