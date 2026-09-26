# API de Stock — Reporte de stock por sucursal (Buscador de Artículos)

Documento **autocontenido para el desarrollador de la API**, segunda entrega sobre la
base del sistema de ventas (la primera fue `API-VENTAS-FASE1.md`). Objetivo: **reemplazar
el Excel de stock que cada sucursal sube a mano** («📄 Cargar stock del día») para
alimentar el **Buscador de Artículos** del Portal (`ubicaciones/`), y de paso el reporte
de **reserva del depósito** que usa Reparto de Mercadería.

> Regla de oro, igual que en ventas: **respetá los campos y los criterios tal cual están
> acá.** El Portal ya lee un export del sistema con estas mismas columnas; si la API
> responde lo mismo, solo cambia de dónde lo lee. Las convenciones generales (HTTPS, key
> Bearer, `/v1/`, errores, cursor, proxy en Cloudflare) son **las mismas de
> `API-VENTAS-FASE1.md` §2**: no las repetimos.

---

## 1. Qué reemplaza

| Hoy | Frecuencia | Circuito actual | Lo reemplaza |
|---|---|---|---|
| Export **«stock diario»** del sistema por sucursal (Código barras · Código EAN · Descripción · Talle · Stock · Id.item…) | cada sucursal, todos los días o cuando se acuerda | el encargado / depósito lo baja del sistema y lo sube en el Buscador → Firebase | **Etapa 1** — `GET /v1/stock/sucursal/{NN}` |
| Reporte de **reserva del depósito** («reporte stock global» con `Stock` + `Días u.compra` por talle) | semanal (lunes) | Nehuen lo baja y lo sube en Reparto de Mercadería | **Etapa 1** — el mismo endpoint con `NN = 05` (Depósito), con `diasUltimaCompra` |
| Reporte de **stock por sucursal** abierto por talle (Completar curva, Vaciar reserva, paredes) | semanal | idem | **Etapa 1** — el mismo endpoint, todas las sucursales |
| Consulta puntual «¿en qué sucursal hay stock de X?» (Matts, el asistente) | por consulta | Matts lee lo que cada sucursal cargó en el Buscador | **Etapa 2** — `GET /v1/stock/articulo/{codigo}` |

Lo que **NO** viene de la API y sigue viviendo en el Portal (Firebase `ubicaciones-mateu`):
las **ubicaciones** en el depósito de cada sucursal (estantería · módulo), el sector del salón,
los comentarios, «Yo repongo», la memoria de ubicaciones y los EAN vinculados a mano en el
mostrador. La API trae el **stock**; el Portal le pega encima lo que la gente carga.

```
Navegador (Buscador) ──► Cloudflare Pages Function /api/stock ──► ESTA API ──► SQL Server
                          (key en Secret, cache, filtro por rol)
                                │
                                └──► Firebase ubicaciones-mateu (ubicaciones, comentarios… NO cambian)
```

---

## 2. Qué es «stock» acá — criterio OBLIGATORIO

1. **Stock = el mismo número que muestra el export «stock diario» del sistema** para esa
   sucursal, artículo y talle, en el momento de la consulta. Si el sistema distingue físico /
   disponible / reservado, **decinos cuál es el del export** y devolvé ese; los otros pueden
   venir en campos aparte (`stockFisico`, `reservado`) pero `stock` tiene que ser el del
   reporte. ⚠ Caso conocido: en el depósito el «reporte de stock» mostró el doble que el F9
   (204 vs 102): si hay dos formas de contar, tienen que quedar explícitas.
2. **Grano = sucursal × artículo × talle.** El talle es un **string tal cual lo rotula el
   sistema** (`"8.5"`, `"37/38"`, `"M"`, `"UNI"`, `"10K"`): no convertir, no normalizar, no
   pasar «37/38» a 378 como hace el export a Excel. Artículo sin talle → `"UNI"`.
3. **Se devuelven los talles con stock ≠ 0** (positivo o negativo, con signo). Por defecto
   los artículos con todos sus talles en 0 **no van**; `?ceros=1` los incluye (el Buscador los
   usa para marcar «quedó en cero»).
4. **Identidad del artículo = `codigo`, el código del sistema** (`ADIJS2852`, `NB2T000172550`,
   `RUG858`, el mismo `codigo` que ya devolvés en `/v1/ventas/lineas`). Es la clave del
   Buscador. Además viene el **`idItem`** (entero del sistema) porque varias sucursales cargaron
   así y el Portal cruza por los dos.
5. **`ean` es el código de barras del TALLE** (lo que hoy sale en la columna «Código EAN»):
   solo cuando es un número de 12 a 14 dígitos. Lo que el sistema tiene como etiqueta del
   proveedor con separadores (`ADUC18903A29!03!34`) va en `etiqueta`, **no en `ean`**. Hoy el
   Portal tiene que adivinar cuál es cuál mirando el contenido de la columna; con la API eso
   se termina.
6. **Depósito (05)**: es una «sucursal» más para este endpoint. Trae además, **por talle**,
   `diasUltimaCompra` = días desde la última compra de ese talle (el «Días u.compra» del
   reporte; 0 = compró hoy; `null` si nunca). Varía entre talles del mismo artículo: no
   colapsarlo al artículo. Si el dato existe para las sucursales, devolverlo también.
7. `actualizado` = hasta cuándo refleja movimientos el stock (último movimiento procesado o
   hora del snapshot, con hora real, no redondeada).

---

## 3. Etapa 1 — Stock completo de una sucursal

```
GET /v1/stock/sucursal/{NN}[?ceros=1][&cursor=…]
```

`{NN}` = código de dos dígitos del sistema (tabla NN → slug en `API-VENTAS-FASE1.md` §3;
**acá el `05` Depósito SÍ vale**). Snapshot completo: el Portal pide todo y hace el diff
contra lo que tiene (es lo que hace hoy con el Excel).

```jsonc
{
  "sucursal": "16",
  "actualizado": "2026-09-25T14:32:10Z",
  "articulos": [
    {
      "codigo": "ADIJS2852",              // código del sistema = clave (obligatorio, nunca vacío)
      "idItem": 233282,                    // entero del sistema (obligatorio)
      "descripcion": "ZAPATILLA DURAMO SPEED M",
      "marca": "ADIDAS",
      "rubro": "CALZADO",                  // sin el prefijo NN-
      "subrubro": "HOMBRE",                // el género del sistema, sin NN-
      "disciplina": "RUNNING",             // null si no tiene
      "tipo": "CALZADO ADULTO",            // «Grupo 1» del sistema; null si no tiene
      "stock": 7,                          // suma de los talles (con signo)
      "talles": [
        { "talle": "8.5", "stock": 3, "ean": "4066765123456", "etiqueta": null, "diasUltimaCompra": 12 },
        { "talle": "9",   "stock": 2, "ean": "4066765123463", "etiqueta": null, "diasUltimaCompra": 12 },
        { "talle": "9.5", "stock": 2, "ean": null, "etiqueta": "ADIJS2852!01!95", "diasUltimaCompra": 48 }
      ]
    }
    // ... ordenados por codigo
  ],
  "cursor": "abc123"                       // presente si hay más páginas; repetir con &cursor=
}
```

- Página sugerida: 2.000 artículos (una sucursal grande tiene 4.000–6.000 con stock).
- Todo `talles[].talle` es string; `stock`, `idItem`, `diasUltimaCompra` son number.
- `marca`, `rubro`, `subrubro`, `disciplina`, `tipo` en MAYÚSCULAS, tal cual el sistema.
  Sirven para que el Portal no dependa del maestro mensual (`logistica/arts`) para un
  artículo que entró ayer.
- Sucursal sin stock → 200 con `articulos: []`; NN desconocido → 404.
- `Cache-Control: public, max-age=600` (10 min). El Buscador **no es en vivo al segundo**: hoy
  se carga una vez por día; con la API va a refrescar cada 30 min y a pedido con un botón.

### Cómo lo mapea el Portal (para que se entienda qué es crítico)

| Campo API | Columna del export de hoy | Uso en el Buscador |
|---|---|---|
| `codigo` | «Código barras» (sí, así la rotula el sistema: es el SKU) | **clave** del artículo, búsqueda, escáner, F8, picking |
| `idItem` | «Id.item» / «Articulo» | búsqueda y cruce con el F8 |
| `descripcion` | «Descripción» | tarjeta, búsqueda por texto |
| `talles[].talle` + `stock` | una fila por talle | chips de talle, «quedó en cero», Reparto (curva) |
| `talles[].ean` | «Código EAN» | resolver la etiqueta de la marca al escanear (mapa compartido `ean/`) |
| `diasUltimaCompra` | «Días u.compra» (solo el reporte del depósito) | «No repartir lo que ingresó hace menos de N días» |
| `actualizado` | fecha del archivo | «datos de las HH:MM», alerta de carga vieja |

---

## 4. Etapa 2 — Un artículo en todas las sucursales

```
GET /v1/stock/articulo/{codigo}          // también acepta ?idItem=233282 o ?ean=4066765123456
```

```jsonc
{
  "codigo": "ADIJS2852", "idItem": 233282, "descripcion": "…", "marca": "ADIDAS",
  "actualizado": "2026-09-25T14:32:10Z",
  "sucursales": {
    "16": { "stock": 7, "talles": [ { "talle": "8.5", "stock": 3 }, { "talle": "9", "stock": 2 } ] },
    "19": { "stock": 1, "talles": [ { "talle": "10", "stock": 1 } ] },
    "05": { "stock": 24, "talles": [ /* … con diasUltimaCompra */ ] }
  }
}
```

- Solo sucursales con stock ≠ 0. Código / idItem / EAN desconocido → 404.
- Lo usa Matts (`consultar_stock`) y la tarjeta «en otras sucursales» del Buscador. Es una
  consulta puntual, muchas por día: tiene que responder en < 1 s.

---

## 5. Lo que ya sabemos que rompe (aprendido de los exports)

- **Etiquetas con separadores en la columna EAN** (Addnice, Givova, Head): ver §2.5. Nunca en `ean`.
- **Talles dobles** («37/38») y talles de niño en escala US («10K», «1Y»): strings tal cual.
- **El export viene ordenado por código y las primeras filas son las raras**: cualquier
  heurística por muestra falla. Por eso los campos van tipados y explícitos.
- **Descripción vacía o numérica**: si el sistema no tiene descripción, `null`, no el
  Id.item ni el código repetido.
- **Un mismo EAN en dos artículos** (pasó en Calle 47): si en la base ocurre, devolvelo igual
  pero avisá; el Portal se queda con el que dice el mapa compartido.
- **Bloqueo de la base cada ~30 s** (el de la API de ventas): este endpoint devuelve páginas
  grandes; si la consulta cae en la ventana de bloqueo, mejor esperar del lado de la API que
  devolver 500 al toque (el proxy reintenta, pero un snapshot a medias no sirve).

---

## 6. Seguridad

Igual que ventas: key Bearer fija, la llama solo la Pages Function del Portal (la key nunca
llega al navegador). El filtro «una cuenta de sucursal solo ve la suya» lo hace el proxy con
el token de sesión del Portal; para la API todas las sucursales son iguales. El stock entre
sucursales no es dato sensible (los vendedores ya lo consultan entre locales por teléfono).

---

## 7. Aceptación — cómo validamos

1. Una sucursal baja el export «stock diario» del sistema y, en el mismo momento, pedimos
   `GET /v1/stock/sucursal/{NN}`. Comparamos **artículo por artículo y talle por talle**:
   stock, Id.item, EAN. Tiene que dar **exacto** (diferencia 0; hay un script del Portal que
   cruza los dos, como `validar-api-ventas.mjs`).
2. Lo mismo con el reporte de reserva del depósito (`05`), incluyendo `diasUltimaCompra`.
3. Berisso y Calle 49 tienen las cargas más completas (con talle y EAN): son las de la prueba.

Checklist de entrega:

- [ ] `GET /v1/stock/sucursal/{NN}` con el shape de §3, paginado por cursor, `05` incluido.
- [ ] `stock` = el número del export «stock diario»; qué stock es (físico/disponible) documentado.
- [ ] `talle` string tal cual el sistema; `ean` solo numérico 12–14 dígitos, `etiqueta` aparte.
- [ ] `codigo` e `idItem` nunca vacíos; `marca` / `rubro` / `subrubro` / `disciplina` / `tipo` sin `NN-`.
- [ ] `diasUltimaCompra` por talle (al menos en el depósito).
- [ ] `actualizado` con hora real.
- [ ] Sucursal sin stock → 200 vacío; NN desconocido → 404; `Cache-Control: max-age=600`.
- [ ] (Etapa 2) `GET /v1/stock/articulo/{codigo}` con `?idItem=` y `?ean=`.
- [ ] Validación de §7 contra un export del mismo momento, junto con Juli.

---

## 8. Etapa 2b — Precio de venta (para las etiquetas QR del salón)

Agregado el 26/09/2026. El Portal va a imprimir **etiquetas con QR** que el cliente escanea en el
salón y ve **precio + talles disponibles** en esa sucursal y en las demás (`docs/ETIQUETAS-QR.md`).
El stock sale de §3/§4; el **precio** hoy no existe en ninguna API, así que se pide acá:

- En `GET /v1/stock/articulo/{codigo}` (§4) y en cada artículo de `GET /v1/stock/sucursal/{NN}`
  (§3), sumar:

```jsonc
"precio": {
  "lista": 189999,            // PVP vigente de la lista de precios minorista, número entero en $
  "listaNombre": "MINORISTA", // qué lista es (la misma que imprime el ticket)
  "vigenteDesde": "2026-09-20",
  "promo": null               // o { "precio": 159999, "nombre": "3x2 running", "hasta": "2026-10-05" } si el sistema tiene un precio promocional activo
}
```

- Es **el precio que se cobra en caja** para ese artículo, el que figura en la etiqueta física.
  Si el precio varía por sucursal (outlets), el de la sucursal pedida en §3 y, en §4, un
  `precio` por sucursal dentro de `sucursales[NN]` además del general.
- `null` si el artículo no tiene precio cargado (no 0).
- Es el mismo dato que Regalías está esperando como «Lista de precios» en `/v1/ventas/lineas`:
  con una sola definición alcanza para las dos cosas.
