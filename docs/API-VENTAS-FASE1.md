# API de Ventas — Fase 1 (Panel General / Mi Sucursal)

Documento **autocontenido para el desarrollador de la API**. Es la primera (y por
ahora única) API a construir sobre el MySQL del sistema de ventas. Su objetivo:
**reemplazar los Excel de venta** que hoy se cargan a mano para alimentar el módulo
Indicadores del Portal (vistas «Panel General» y «Mi Sucursal»).

> Regla de oro: **respetá los shapes y los criterios tal cual están acá.** El
> frontend ya consume estas estructuras; si la API responde igual, el Portal solo
> cambia de dónde lee. Los criterios por línea son decisiones comerciales de Juli:
> no simplificarlos ni "corregirlos".

El contrato general de la migración (otros módulos, para más adelante) está en
`docs/API-CONTRATO-MYSQL.md`. Esta fase no depende de él.

---

## 1. Qué reemplaza

Hoy la info de ventas entra al Portal por dos Excel:

| Excel | Frecuencia | Circuito actual | Lo reemplaza |
|---|---|---|---|
| «Semana DD-MM-AA.xls» / «ventas semana DD-MM.xlsx» (estadística detallada por línea, todas las sucursales) | varias veces por semana | gerencia lo sube en el Portal («⇧ Cargar venta de la semana») → Firebase | **Etapa 1A** (endpoints de semana) |
| «Estadistica de venta - …» (detallado por línea, mes completo) | mensual | Juli corre un ETL local (Python) → JSONs estáticos en el repo | **Etapa 1B** (endpoint de líneas) |

**Etapa 1A es la prioridad**: con esos dos endpoints andando, la venta de la semana
en curso se ve en vivo y nadie sube más el Excel semanal. La 1B puede venir después.

```
Navegador ──► Cloudflare Pages (el Portal)
                  │
                  ├─ Etapa 1A: fetch a /v1/ventas/semana/…  ──►  ESTA API  ──► MySQL
                  │
                  └─ Firebase (objetivos, equipos, login, mensajes… NO cambian)

ETL local (script) ─ Etapa 1B: /v1/ventas/lineas ──► ESTA API ──► MySQL
```

Los objetivos (Meta/Mínimo/120), el equipo con sus horas y todo lo que tipea la
gente **siguen en Firebase**. Esta API solo trae la VENTA.

---

## 2. Convenciones

| Tema | Requisito |
|---|---|
| **Protocolo** | HTTPS obligatorio (el Portal es HTTPS; HTTP lo bloquea el navegador). |
| **CORS** | `Access-Control-Allow-Origin` con el dominio del Portal (Cloudflare Pages + dominio propio si lo hay). Manejar el preflight `OPTIONS`. |
| **Rutas** | Prefijo `/v1/` desde el día uno. |
| **Formato** | `Content-Type: application/json; charset=utf-8`. Números como number, no string. Fechas `YYYY-MM-DD`. |
| **Errores** | HTTP status correcto + `{ "error": "mensaje" }`. Semana/rango válido pero sin ventas → **200 con estructura vacía**, NO 404. Fecha malformada o que no es lunes → 400. |
| **Cache** | `Cache-Control: public, max-age=300` (5 min) en los endpoints de semana. |
| **Auth** | Fase 1: **API key fija** en header (`Authorization: Bearer <key>`), la key vive en el Portal. Alcanza para arrancar; el filtrado real por sucursal queda para una fase 2 (ver §7). ⚠️ Las credenciales de MySQL nunca viajan al Portal ni al chat: variables de entorno en tu server. |
| **Base URL** | Definila y avisá cuál es (ej. `https://api.mateu.com.ar`). El Portal la guarda en una constante. |

---

## 3. Semana retail y sucursales

- La semana es **retail: lunes a domingo**. `{lunesISO}` = la fecha del lunes
  (`2026-08-24`). Entran solo los comprobantes con fecha dentro de ese rango.
  Si la fecha recibida no es lunes → 400.
- Cada sucursal se identifica por su **slug** del Portal. El sistema las codifica
  `NN-Nombre`; mapa código → slug:

  | NN | slug | NN | slug | NN | slug |
  |---|---|---|---|---|---|
  | 01 | `plaza` | 09 | `adidas` | 16 | `berisso` |
  | 02 | `kids` | 10 | `diagonal` | 17 | `aurelius-cb` |
  | 03 | `calle-55` | 11 | `ensenada` | 18 | `aurelius-5` |
  | 04 | `aurelius-12` | 12 | `calle-12` | 19 | `calle-49` |
  | 06 | `city-bell` | 13 | `los-hornos` | 20 | `av-44` |
  | 07 | `aurelius-10` | 14 | `gonnet` | 21 | `adidas-12` |
  | 08 | `calle-47` | 15 | `originals` | 99 | `ecommerce` |

  El `05` (Depósito) no es una sucursal de venta: **se excluye**. Si aparece un
  código nuevo sin slug, excluirlo y loguearlo (no inventar slugs).

---

## 4. Criterios por línea y agregación (el corazón — OBLIGATORIO)

Cada línea de venta trae al menos: fecha, sucursal, vendedor, nº de comprobante,
artículo, rubro, cantidad, importe. Antes de sumar, cada línea aporta
`(cantidad, importe)` según su **rubro** (en MAYÚSCULAS, sin el prefijo `NN-`:
«01-VARIOS» y «VARIOS» son lo mismo) y su **artículo**:

| Rubro | Regla |
|---|---|
| `OTROS` | no suma nada |
| `VARIOS` | artículo `REDONDEO` → nada; el resto → cantidad + importe |
| `CONCEPTOS` | artículo que empieza con `CREDITO A FAVOR` → cantidad + importe; que empieza con `INGRESO CUPON` o contiene `LLAVERO COMPRA GRANDE` → nada; que empieza con `CONCEPTOS VARIOS` → nada; **el resto (promos/descuentos, envío) → solo importe** |
| todo lo demás | cantidad + importe |

Comparaciones de artículo en MAYÚSCULAS y sin acentos.

**Agregación por comprobante** (clave `sucursal + nº de comprobante`, atómico —
nunca partir un comprobante):

- `venta` / `unidades` del comprobante = Σ de sus líneas según la tabla. Los
  importes negativos (notas de crédito, devoluciones) **restan tal cual**: no
  forzar a 0, no tomar valor absoluto.
- **Ticket** = comprobante que **NO** es nota de crédito (nº que empieza con `Nc`)
  y con cantidad > 0.
- **Vendedor del comprobante** = el de la línea de mayor `|importe|`; vacío →
  `"SIN ASIGNAR"`. El comprobante entero se atribuye a ese vendedor y al día de
  su fecha.
- Importe por rubro del comprobante: sumar el importe de cada línea que cuenta
  importe, bajo su rubro (sin prefijo `NN-`).

---

## 5. Etapa 1A — Venta de la semana (en vivo)

```
GET /v1/ventas/semana/{lunesISO}                    → TODAS las sucursales, solo totales (Panel General)
GET /v1/ventas/semana/{lunesISO}/sucursal/{slug}    → UNA sucursal, con vendedores (Mi Sucursal)
```

- El endpoint de totales **nunca** incluye el detalle por vendedor.
- Sirve para cualquier semana (en curso o pasada); el Portal pide la que necesita.
- `actualizado` = timestamp ISO de hasta cuándo hay ventas cargadas en MySQL (la
  venta más reciente del rango, o el último sync — lo que mejor represente "el
  dato llega hasta acá").

### `GET /v1/ventas/semana/{lunesISO}` (solo totales)

```jsonc
{
  "semana": "2026-08-24",
  "actualizado": "2026-08-27T18:40:00Z",
  "sucursales": {
    "plaza":  { "venta": 98411230, "tickets": 812, "unidades": 1540 },
    "gonnet": { "venta": 121004500, "tickets": 1103, "unidades": 2411 }
    // ... una entrada por slug con venta en la semana; sin ventas aún → {}
  }
}
```

### `GET /v1/ventas/semana/{lunesISO}/sucursal/{slug}` (con vendedores)

```jsonc
{
  "semana": "2026-08-24",
  "actualizado": "2026-08-27T18:40:00Z",
  "vendedores": [
    {
      "nombre": "BENITEZ BRIANT NAHUEL",
      "venta": 18922400,        // entero; puede ser negativo
      "tickets": 151,
      "unidades": 302,          // entero
      "dias": [                  // solo días con importe ≠ 0, en orden Lu→Do
        { "d": "Lu", "v": 2410000 },
        { "d": "Ma", "v": 3180500 }
        // "d" ∈ "Lu"|"Ma"|"Mi"|"Ju"|"Vi"|"Sa"|"Do"
      ],
      "rubros": {                // importe por rubro crudo (sin "NN-"), solo ≠ 0
        "CALZADO": 12400000,
        "INDUMENTARIA": 5222400
      }
    }
    // ... ordenados por venta descendente; sin ventas aún → []
  ],
  "total": { "venta": 121004500, "tickets": 1103, "unidades": 2411 }
}
```

- `venta`/`unidades`/`dias.v`/`rubros.*` redondeados a entero.
- Vendedores con todo en cero no van.
- `rubros` es el rubro **crudo** del sistema; el Portal ya lo colapsa a
  Calzado/Indumentaria/Accesorios.
- No incluir metas ni objetivos (vienen de Firebase).
- Slug desconocido → 404 `{ "error": "sucursal desconocida" }`.

---

## 6. Etapa 1B — Líneas crudas (para el cierre mensual)

Reemplaza el Excel mensual: el ETL del Portal (script, no el navegador) baja las
líneas del período y calcula lo demás (los criterios finos del cierre quedan de
nuestro lado). No necesita CORS; sí la misma API key.

```
GET /v1/ventas/lineas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD[&sucursal=NN][&cursor=…]
```

```jsonc
{
  "lineas": [
    {
      "fecha": "2026-08-24",
      "hora": 16,                      // hora del día (0–23); null si no está
      "sucursal": "01",               // código NN del sistema
      "vendedor": "BENITEZ BRIANT NAHUEL",
      "comprobante": "FcC.0057-00081234",
      "articulo": "ZAPATILLA RUNNING X",
      "rubro": "CALZADO",             // tal cual el sistema (con o sin NN-, pero consistente)
      "cantidad": 1,
      "importe": 189000.5             // acá sí con decimales, sin redondear
    }
  ],
  "cursor": "abc123"                   // presente si hay más páginas; repetir el request con &cursor=
}
```

- **Sin criterios ni agregación**: líneas tal cual, incluidas las de promos,
  redondeo, conceptos y notas de crédito. El consumidor filtra.
- Paginado por cursor (tamaño de página a tu criterio, p. ej. 10.000 líneas).
- Rango máximo sugerido: 45 días por request (un mes retail entra siempre).
- Bonus si `hora` viene: también reemplaza el Excel mensual de venta por
  sucursal×hora×día (la matriz de pesos por turno del Portal).

---

## 7. Seguridad (fase 1 vs. después)

El login del Portal es "blando" (sesión en localStorage, sin auth real). Fase 1:
la API key fija evita que cualquiera de afuera consuma la API, pero no distingue
usuarios. Aceptado para arrancar.

Fase 2 (cuando esta API esté estable): tokens por rol para que
`GET …/sucursal/{slug}` valide en el server que una cuenta de sucursal solo pida
la suya (`admin`/`supervisor` pueden todas). Diseñar la fase 1 sin cerrar esa
puerta (p. ej. dejar el chequeo de slug como un middleware vacío).

---

## 8. Aceptación — cómo validamos

1. Elegimos una semana cerrada de la que tenemos el Excel real.
2. El Portal ya calcula esa semana desde el Excel (payload en Firebase
   `ventaEquipo`): comparamos **venta, tickets y unidades por sucursal y por
   vendedor** contra la respuesta de la API. Deben dar **iguales** (tolerancia:
   ±1 por redondeo).
3. Si difieren, el 99% de las veces es por los criterios de §4 (promos que
   suman cantidad, REDONDEO contado, Nc contadas como ticket, comprobante
   partido entre vendedores).

Checklist de entrega:

- [ ] HTTPS + CORS al dominio del Portal (incluye `OPTIONS`).
- [ ] `GET /v1/ventas/semana/{lunesISO}` (totales, sin vendedores).
- [ ] `GET /v1/ventas/semana/{lunesISO}/sucursal/{slug}` (con vendedores, `dias`, `rubros`).
- [ ] Criterios por línea de §4 aplicados tal cual; ticket = comprobante no-`Nc` con cantidad > 0; vendedor = línea de mayor `|importe|`.
- [ ] Semana sin ventas → 200 vacío; fecha que no es lunes → 400; slug desconocido → 404.
- [ ] API key Bearer + `Cache-Control: max-age=300`.
- [ ] Pasar la **base URL** y la key a Juli.
- [ ] (1B) `GET /v1/ventas/lineas` con paginado por cursor.
- [ ] Validación de §8 contra una semana conocida, junto con Juli.
