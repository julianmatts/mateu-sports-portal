# Contrato de API — MySQL en vivo (Portal Mateu Sports)

Documento para **el desarrollador que construye las APIs sobre MySQL**. Define qué
endpoints necesita el Portal y —lo más importante— el **shape exacto del JSON** que
cada módulo ya sabe consumir hoy. Si las respuestas salen con este formato, el
frontend cambia solo de *dónde* lee el dato; la lógica de render no se toca.

> Regla de oro: **respetá el shape tal cual está acá.** Los módulos son
> `index.html` self-contained que ya parsean esta estructura. Cambiar nombres de
> campos o anidamiento obliga a reescribir el frontend.

---

## 1. Arquitectura y reparto de trabajo

```
Navegador ──► Cloudflare Pages (el Portal, no cambia el hosting)
                   │
                   ├─ fetch a los endpoints de ESTA API  ──►  API REST (tu dev)  ──► MySQL
                   │
                   └─ Firebase / D1  (evaluaciones, recepciones, pedidos, turnero,
                                       mensajes, login — NO salen de MySQL, quedan igual)
```

- **La API la hace el dev**, corriendo al lado del MySQL gestionado.
- **El Portal sigue en Cloudflare Pages** (deploy con push a `main`).
- Solo migran a MySQL los módulos que hoy **nacen de Excel**: Meses de Stock,
  Indicadores, Buscador de Artículos, Regalías, Marcas. El resto (datos que tipea
  la gente) se queda en Firebase.

---

## 2. Convenciones generales (aplican a TODOS los endpoints)

| Tema | Requisito |
|---|---|
| **Protocolo** | **HTTPS obligatorio.** El Portal es HTTPS; un endpoint HTTP lo bloquea el navegador (mixed content). |
| **CORS** | La API debe responder `Access-Control-Allow-Origin` con el dominio del Portal (el de Cloudflare Pages, p. ej. `https://mateu-sports-portal.pages.dev` y el dominio propio si lo hay). Manejar el `OPTIONS` (preflight). |
| **Base URL** | El Portal guardará la base en **una constante por módulo** (igual que hoy `FIREBASE_DB_URL`). Ej.: `const API_BASE = "https://api.mateu.com.ar"`. Definila y avisá cuál es. |
| **Formato** | `Content-Type: application/json; charset=utf-8`. Números como number (no string). Fechas `YYYY-MM-DD`. |
| **Errores** | HTTP status correcto + cuerpo `{ "error": "mensaje" }`. Sin dato para un período válido → **200 con estructura vacía** (ver cada módulo), NO 404. |
| **Autenticación** | Ver §3. El login del Portal es "blando"; definir con Juli si la API pide token. |
| **Cache** | Datos que cambian a ritmo diario. Recomendado `Cache-Control: public, max-age=300` (5 min) para no pegarle a MySQL en cada visita. |

### Versionado
Prefijá las rutas con `/v1/` desde el día uno (`/v1/meses-stock`). Barato ahora,
te salva de romper el Portal cuando cambie el modelo.

---

## 3. Autenticación (a definir con Juli)

El Portal tiene login blando: guarda en `localStorage` una sesión con `email`,
`rol` (`admin`/`sucursal`/`outlet`/`supervisor`) y su `sucursal`/`outlet_id`. No es
Firebase Auth ni seguridad dura.

Dos niveles posibles para la API, de menor a mayor esfuerzo:

1. **API key fija** en header (`Authorization: Bearer <key>`). Simple; la key vive
   como *secret* en el Portal. Evita que cualquiera pegue a la API desde afuera,
   pero no distingue usuarios.
2. **Filtrado por sucursal en el server** (recomendado para Indicadores): el
   Portal manda la sucursal de la sesión y la API devuelve **solo** esa. Hoy la
   seguridad de Indicadores es "no pidas el archivo de otra sucursal"; con la API
   pasa a ser real. Ver §5.

⚠️ **Nunca** pongas credenciales de MySQL en el código del Portal ni en el chat.
Viven como variables de entorno / secrets en el server de la API.

---

## 4. Módulo PILOTO — Meses de Stock

**Qué es:** ratio Stock/Ventas (meses de stock) por Sucursal → Rubro → Marca →
Segmento, con serie mensual. Hoy el Portal lee un único archivo
`gestion-stock/datos-meses-stock.js` que setea `window.STOCK_DATA`.

**Fuente en MySQL:** las filas del reporte RATIO (Año, Mes, Sucursal, Rubro, Marca,
Segmento, Stock, Ventas, Ratio, + comentarios). Reglas de agregación **críticas**
(un intento previo dividió las marcas /2 y rompió todo — NO repetir):

- `rubro.serie[mes]` = fila `Marca="Total", Segmento="Total"` de ese sucursal/rubro/mes. **Tal cual, sin dividir.**
- `marca.serie[mes]` = fila `Marca=<marca>, Segmento="Total"`. **Tal cual, sin dividir.**
- `segmentos[SEG].serie[mes]` = fila `Marca=<marca>, Segmento=<SEG>` con `SEG ≠ "Total"`.
- El agregado top-level `{stock,ventas,ratio}` de cada segmento = su serie del **último mes** disponible.
- `suc.serie[mes]` = suma de `rubro.serie` de todos los rubros de esa sucursal.
- **Excluir** de la columna C las filas basura `"Total"` y `"Sucursal"`. **NO** crear una pseudo-marca `"Total"`.

### Endpoint

```
GET /v1/meses-stock
GET /v1/meses-stock?anio=2026
```

### Respuesta (shape EXACTO — así lo consume el módulo hoy)

```jsonc
{
  "meses": ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO"],
  "thresholds": {
    "CALZADO":       [4, 6],
    "INDUMENTARIA":  [3, 5],
    "ACCESORIOS":    [3, 5],
    "PRODUCTO":      [4, 6]
  },
  "sucursales": {
    "14-Outlet Gonnet": {
      "rubros": {
        "ACCESORIOS": {
          "serie": {
            "ENERO":  { "stock": 6207, "ventas": 2766, "ratio": 2.24 },
            "FEBRERO":{ "stock": 5938, "ventas": 3196, "ratio": 1.86 }
            // ... un objeto por mes presente
          },
          "marcas": {
            "Trendy": {
              "serie": {
                "ENERO": { "stock": 30, "ventas": -1, "ratio": -30 }
                // ... por mes
              },
              "segmentos": {
                "VARIOS": {
                  "stock": 39, "ventas": 5, "ratio": 7.8,   // = último mes de la serie
                  "serie": {
                    "ENERO": { "stock": 30, "ventas": -1, "ratio": -30 }
                    // ... por mes
                  }
                }
              },
              "status": "exceso"   // ver tabla de status abajo
            }
            // ... más marcas
          }
        }
        // ... más rubros: CALZADO, INDUMENTARIA, PRODUCTO
      }
    }
    // ... una entrada por sucursal, clave = nombre exacto "NN-Nombre"
  }
}
```

**Notas de campos**
- `ratio` puede ser `number` o `null` (cuando no hay dato para computarlo). `ventas`
  puede venir negativo (devoluciones). Respetar los signos, no forzar a 0.
- `status` de cada marca (string): `"sano"` | `"exceso"` | `"faltante"` | `"sindato"`.
  Es la clasificación del último mes contra el `threshold` del rubro. Si el dev no
  lo calcula, el Portal lo puede derivar; **preferible que venga del server**.
- La **clave de sucursal** debe ser idéntica a la que ya se usa (`"14-Outlet Gonnet"`),
  porque Indicadores y otros módulos cruzan por ese string.

### Comentarios de encargados (opcional, 2ª fase)
Hoy viven en `STOCK_COMMENTS` dentro del mismo `.js`. Si se migran:

```
GET /v1/meses-stock/comentarios
```
```jsonc
[
  { "id": 0, "sucursal": "14-Outlet Gonnet", "rubro": "CALZADO", "marca": "Nike",
    "texto": "comentario del encargado",
    "respuesta": "respuesta de Área de Producto",   // opcional
    "estado": "resuelto" }                            // "resuelto" si hay respuesta
]
```

---

## 5. Módulo — Indicadores de Sucursal

**Qué es:** UPT, tickets/hora, ticket promedio, dotación, por sucursal y por
persona. Es la **home** de los roles `sucursal`/`outlet`. Hoy lee **archivos
particionados**: uno por sucursal (con personas) + un `cadena.json` (agregados sin
personas). **Ese particionado es la seguridad**: el navegador de una sucursal nunca
baja las personas de otra. La API debe preservar ese principio.

### Endpoints

```
GET /v1/indicadores/periodos                         → lista de períodos
GET /v1/indicadores/objetivos                        → metas por formato
GET /v1/indicadores/{periodo}/cadena                 → 20 sucursales, SIN personas
GET /v1/indicadores/{periodo}/sucursal/{sucursalId}  → UNA sucursal, CON personas
```

- `{periodo}` = `2026-05`. `{sucursalId}` = `14-Outlet-Gonnet` (o el id que uses).
- **Seguridad server-side (recomendado):** el endpoint de sucursal debe validar que
  el usuario de la sesión tiene permitido ese `sucursalId` (por API key mapeada, o
  token). `admin`/`supervisor` pueden pedir cualquiera; `sucursal`/`outlet` solo la
  suya. Así se cierra el agujero de "pido otro archivo por URL".

### `GET /v1/indicadores/periodos`
```jsonc
{ "periodos": [
  { "id": "2026-06", "label": "Junio 2026", "dias": "01/06–28/06",
    "habiles": 24, "semanas": 4, "mesStock": "JUNIO" }
]}
```

### `GET /v1/indicadores/objetivos`
```jsonc
{ "MS":       { "tickets_hora": 1.3,  "upt": 1.85, "ticket_promedio": 118000 },
  "Adidas":   { "tickets_hora": 1.75, "upt": 1.55, "ticket_promedio": 185000 },
  "Outlet":   { "tickets_hora": 1.45, "upt": 2,    "ticket_promedio": 95000 },
  "Aurelius": { "tickets_hora": 0.8,  "upt": 1.6,  "ticket_promedio": 155000 },
  "Kids":     { "tickets_hora": 1.1,  "upt": 1.55, "ticket_promedio": 80000 } }
```

### `GET /v1/indicadores/{periodo}/cadena`  (SIN personas)
```jsonc
{
  "periodo": "2026-05",
  "meta": { "dias": "27/04–31/05", "habiles": 30, "semanas": 5 },
  "mesStock": "MAYO",
  "sucursales": [
    { "sucursal": "01-MS Plaza Italia", "tickets": 1747, "unidades": 3357,
      "importe": 192777704.19, "tickets_todos": 1747, "dev_i": -411289.88,
      "dev_u": -10, "importe_neto": 192366414.31, "unidades_netas": 3347,
      "horas_contr": 2253.69, "h_act": 1151, "personas": 12, "cobertura": 100,
      "formato": "MS" }
    // ... una por sucursal. NUNCA incluir el array "vendedores" acá.
  ]
}
```

### `GET /v1/indicadores/{periodo}/sucursal/{sucursalId}`  (CON personas)
```jsonc
{
  "periodo": "2026-05",
  "meta": { "dias": "27/04–31/05", "habiles": 30, "semanas": 5 },
  "mesStock": "MAYO",
  "sucursal": "14-Outlet Gonnet",
  "formato": "Outlet",
  "summary": {
    "sucursal": "14-Outlet Gonnet", "tickets": 5589, "unidades": 11089,
    "importe": 591158027.44, "tickets_todos": 5589, "dev_i": -1304981.8,
    "dev_u": -19, "importe_neto": 589853045.63, "unidades_netas": 11070,
    "horas_contr": 3894.39, "h_act": 2610, "personas": 24, "cobertura": 100,
    "semanas": [
      { "n": 1, "rango": "27/04–03/05", "tickets": 1033, "unidades_netas": 2001,
        "importe_neto": 106738728.32, "h_act": 453, "horas_contr": 621.4 }
      // ... una por semana
    ]
  },
  "vendedores": [
    { "sucursal": "14-Outlet Gonnet", "vendedor": "BENITEZ BRIANT NAHUEL",
      "sector": "Vend. Part Time Tarde", "grupo": "Ventas",
      "tickets": 289, "unidades_netas": 568, "importe_neto": 31825159.76,
      "horas_contr": 178.73, "h_act": 141, "dias": 29,
      "cubre": false, "propuesto": false,
      "semanas": [
        { "n": 1, "rango": "27/04–03/05", "tickets": 47, "unidades_netas": 91,
          "importe_neto": 4891049, "h_act": 21, "horas_contr": 26.62 }
        // ... por semana
      ] }
    // ... una por persona que registró ventas
  ]
}
```

**Notas**
- `grupo` (para la sección Plantilla/Dotación): `Jefatura` | `Ventas` | `Caja` | `Refuerzos`.
- `cubre: true` = persona que cubre en otra sucursal (se excluye de la dotación fija).
- La **Plantilla/Dotación** se deriva de `vendedores`; el Buscador de Artículos la
  reusa. No hace falta un endpoint aparte: sale de este mismo.

---

## 6. Módulo — Ventas de la semana en curso (Panel General y Mi Sucursal)

**Qué es:** la zona **«En curso»** de Indicadores muestra la venta provisoria de la
semana: total por sucursal en el **Panel General** (vista de todas las sucursales,
gerencia) y el detalle por vendedor con día a día en **Mi Sucursal** (home del
encargado). Hoy ese dato entra **a mano**: gerencia sube el export detallado del
sistema («⇧ Cargar venta de la semana») o Juli corre `scripts/cargar-venta-semana.py`,
y queda en Firebase (`recepciones-mateu`, nodo `ventaEquipo/<slug>/<lunesISO>`).

**Esta API reemplaza esa carga manual**: si MySQL tiene las líneas de venta del día,
el Portal lee la semana en vivo directo de acá y nadie sube más el Excel. Solo migra
la **venta**; los objetivos (Meta/Mínimo/120), el equipo con sus horas y todo lo que
tipea la gente siguen en Firebase.

### Semana y sucursales

- La semana es **retail: lunes a domingo**. `{lunesISO}` = fecha del lunes
  (`2026-08-24`). Entran solo los comprobantes con fecha dentro de ese rango.
- Cada sucursal se identifica por su **slug** (el mismo del Portal). Mapa código
  `NN` del sistema → slug (idéntico a `PFX_SLUG` de `cargar-venta-semana.py`):

  | NN | slug | NN | slug | NN | slug |
  |---|---|---|---|---|---|
  | 01 | `plaza` | 09 | `adidas` | 16 | `berisso` |
  | 02 | `kids` | 10 | `diagonal` | 17 | `aurelius-cb` |
  | 03 | `calle-55` | 11 | `ensenada` | 18 | `aurelius-5` |
  | 04 | `aurelius-12` | 12 | `calle-12` | 19 | `calle-49` |
  | 06 | `city-bell` | 13 | `los-hornos` | 20 | `av-44` |
  | 07 | `aurelius-10` | 14 | `gonnet` | 21 | `adidas-12` |
  | 08 | `calle-47` | 15 | `originals` | 99 | `ecommerce` |

  El `05` (Depósito) **no** es una sucursal de venta: se excluye.

### Criterios por línea (OBLIGATORIOS, en el server)

Son los criterios de Juli; los aplican igual el ETL mensual y la carga semanal
(`criterio_linea` / `veCriterioLinea`). Cada línea aporta `(cantidad, importe)`
según su rubro (en MAYÚSCULAS, sin el prefijo `NN-`) y artículo:

| Rubro | Regla |
|---|---|
| `OTROS` | no suma nada |
| `VARIOS` | artículo `REDONDEO` → nada; el resto → cantidad + importe |
| `CONCEPTOS` | artículo que empieza con `CREDITO A FAVOR` → cantidad + importe; que empieza con `INGRESO CUPON` o contiene `LLAVERO COMPRA GRANDE` → nada; que empieza con `CONCEPTOS VARIOS` → nada; el resto (promos/descuentos, envío) → **solo importe** |
| todo lo demás | cantidad + importe |

**Agregación por comprobante** (clave `sucursal + nro de comprobante`, atómico):
- `venta` y `unidades` del comprobante = Σ de sus líneas según la tabla de arriba.
  Los importes negativos (notas de crédito, devoluciones) **restan tal cual**.
- **Ticket** = comprobante **que NO es nota de crédito** (`Nc…`) y con cantidad > 0.
- **Vendedor del comprobante** = el de la línea de mayor `|importe|` (vacío →
  `"SIN ASIGNAR"`).
- El comprobante entero se atribuye a ese vendedor y al día de su fecha.

### Endpoints

```
GET /v1/ventas/semana/{lunesISO}                    → TODAS las sucursales, solo totales (Panel General)
GET /v1/ventas/semana/{lunesISO}/sucursal/{slug}    → UNA sucursal, con vendedores (Mi Sucursal)
```

- **Seguridad igual que Indicadores (§5):** el endpoint de totales es solo para
  `admin`/`supervisor`; el de sucursal valida que la sesión pueda ver ese `slug`
  (sucursal/outlet solo la suya). El detalle por vendedor de una sucursal **nunca**
  viaja en el endpoint de totales.
- Semana sin ventas todavía → **200** con `sucursales: {}` / `vendedores: []` (no 404).
- El dato es "en vivo": alcanza con que refleje MySQL al momento del request (con el
  `Cache-Control: max-age=300` de §2 alcanza y sobra). `actualizado` = timestamp ISO
  de hasta cuándo están cargadas las ventas.

### `GET /v1/ventas/semana/{lunesISO}`  (solo totales)

```jsonc
{
  "semana": "2026-08-24",
  "actualizado": "2026-08-27T18:40:00Z",
  "sucursales": {
    "plaza":  { "venta": 98411230, "tickets": 812, "unidades": 1540 },
    "gonnet": { "venta": 121004500, "tickets": 1103, "unidades": 2411 }
    // ... una entrada por slug con venta en la semana
  }
}
```

### `GET /v1/ventas/semana/{lunesISO}/sucursal/{slug}`  (con vendedores)

Shape idéntico al payload `ventaEquipo` que el módulo ya consume hoy:

```jsonc
{
  "semana": "2026-08-24",
  "actualizado": "2026-08-27T18:40:00Z",
  "vendedores": [
    {
      "nombre": "BENITEZ BRIANT NAHUEL",
      "venta": 18922400,          // Σ importe de sus comprobantes (redondeado, puede ser negativo)
      "tickets": 151,
      "unidades": 302,
      "dias": [                    // día a día, solo días con importe ≠ 0, en orden Lu→Do
        { "d": "Lu", "v": 2410000 },
        { "d": "Ma", "v": 3180500 }
        // "d" ∈ "Lu"|"Ma"|"Mi"|"Ju"|"Vi"|"Sa"|"Do"
      ],
      "rubros": {                  // importe por rubro (clave = rubro sin "NN-", solo ≠ 0); opcional
        "CALZADO": 12400000,
        "INDUMENTARIA": 5222400
      }
    }
    // ... ordenados por venta descendente
  ],
  "total": { "venta": 121004500, "tickets": 1103, "unidades": 2411 }
}
```

**Notas**
- `venta`/`unidades` redondeados a entero; `tickets` entero por definición.
- `rubros` alimenta el «Mix de la semana» de cada vendedor: mandar el rubro **crudo**
  del sistema (el Portal ya lo colapsa a Calzado/Indumentaria/Accesorios).
- No incluir `metaTienda`/`minimoTienda` (vienen de Firebase `objetivos/`; el Portal
  ya los resuelve por su lado).

---

## 7. Qué hace el Portal una vez que la API está lista

Por cada módulo, el cambio en el frontend es acotado:
1. Agregar `const API_BASE = "https://…"` (+ header de auth si aplica).
2. Reemplazar la carga estática (`<script src="datos-…js">` / `fetch('data/…json')`)
   por `fetch(API_BASE + '/v1/…')`.
3. Mantener el **empty state** cuando la respuesta viene vacía (sin dato para el período).
4. Meses de Stock: como el shape es idéntico, se puede setear `window.STOCK_DATA`
   con la respuesta y el resto del módulo funciona sin tocar.
5. Ventas de la semana (§6): Indicadores pasa a leer estos endpoints en vez de
   `ventaEquipo` en Firebase; el botón «⇧ Cargar venta de la semana» y el script
   quedan como plan B por si la API se cae.

**Eso lo hacemos nosotros en este repo, módulo por módulo, cuando el endpoint
correspondiente esté disponible.** No hace falta que todo salga junto: se puede ir
uno por uno (piloto = Meses de Stock).

---

## 8. Checklist para el dev de la API

- [ ] HTTPS + CORS al dominio del Portal (incluye preflight `OPTIONS`).
- [ ] Rutas bajo `/v1/`.
- [ ] `GET /v1/meses-stock` con el shape de §4 y las reglas de agregación (¡sin dividir marcas /2!).
- [ ] `GET /v1/indicadores/periodos`, `/objetivos`, `/{periodo}/cadena`, `/{periodo}/sucursal/{id}` con los shapes de §5.
- [ ] `cadena` NUNCA incluye `vendedores`; el endpoint de sucursal SÍ.
- [ ] `GET /v1/ventas/semana/{lunesISO}` y `.../sucursal/{slug}` con los shapes de §6, aplicando los **criterios por línea** y la agregación por comprobante tal cual (ticket = comprobante no-Nc con cantidad > 0; vendedor = línea de mayor |importe|).
- [ ] El endpoint de totales de ventas NUNCA incluye vendedores; el de sucursal valida el slug de la sesión.
- [ ] Sin dato → 200 con estructura vacía, no 404.
- [ ] Definir esquema de auth con Juli (§3) y pasar la `API_BASE`.
- [ ] Confirmar que las **claves de sucursal** coinciden con las que ya usa el Portal (`"NN-Nombre"` en Indicadores/Meses de Stock, slug en Ventas — §6 trae la tabla NN→slug).
```
