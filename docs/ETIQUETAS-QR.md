# Etiquetas QR del salón — propuesta (26/09/2026)

Pedido de Juli: cuando esté la API de reporte de stock, imprimir desde el Buscador de Artículos
una **etiqueta con QR por artículo** que el cliente escanea con el celular y ve **los talles
disponibles en esa sucursal y en las demás + el precio de venta**. Todos los usuarios del
Buscador (encargado, depósito y puesto) tienen que poder imprimirla desde la tarjeta del artículo.

Maqueta visual: [`maquetas/etiqueta-qr.html`](maquetas/etiqueta-qr.html) (abrirla en el navegador;
render en `maquetas/etiqueta-qr.png`; imágenes para WhatsApp en `maquetas/wsp/`).

> **Estado 26/09/2026 (tarde): HECHO** — etapas A, B y D y las mejoras 1 a 5 («avanzá con 1 a 5», Juli), con
> el stock del índice del Buscador. Sumado a pedido de Juli el mismo día: **el precio también va en la
> etiqueta** (a mano por artículo hasta que lo traiga la API). Cómo quedó: sección «Etiquetas QR del salón»
> de `CLAUDE.md`. Falta: dominio corto, precio de la API (etapa C), reseña/WhatsApp de cada local y la prueba
> en una térmica real. Lo que sigue es el plan original.

---

## 1. La etiqueta

Tres formatos, mismo diseño (navy `#0B1527` · rojo `#CC0000` · blanco, Bebas Neue / Barlow
Condensed, la «m» azul-roja de `icons/logo-source.png` en el centro del QR):

| Formato | Para qué | Notas |
|---|---|---|
| **60 × 40 mm** (térmica) | la etiqueta por defecto: caja de calzado, colgante de indumentaria | QR de 23 mm: se lee a 20–30 cm con cualquier celular |
| **50 × 30 mm** (térmica) | etiquetadoras chicas, medias y accesorios | QR de 17,5 mm, frase corta |
| **105 × 74 mm** (cartel) | góndola / pared de running, impreso en hoja común y plastificado | QR de 36 mm, se lee desde 1 m |

Elementos, de arriba abajo: wordmark Mateu + **sucursal** · QR + gancho **«¿Está tu talle?»**
(navy/rojo) + bajada «Escaneá y mirá precio y talles disponibles, acá y en todas las sucursales» ·
pie navy con filo rojo: **código + descripción** (así el vendedor identifica la etiqueta sin
escanear, y sirve como etiqueta interna).

**Frases evaluadas** (la elegida es la primera; es la pregunta que se hace el cliente, no una
instrucción):
1. «¿Está tu talle?» + «Escaneá y mirá precio y talles disponibles» ← **propuesta**
2. «Escaneá para ver el precio y los talles disponibles» (la de Juli, más literal; queda como bajada)
3. «Tu talle, al toque» · «Precio y talles en 2 segundos» · «Escaneame» (más marketing, menos claras)

Sucursales Aurelius: `shared/marca.js` ya sabe la marca de la sesión → la etiqueta sale en
negro/rojo con el logo de Aurelius sin tocar nada del diseño.

## 2. Qué codifica el QR

Una URL corta, una por **artículo × sucursal**:

```
https://m.mateu.com.ar/q/ADIJS2852?s=10
```

- `ADIJS2852` = código del sistema (la clave del Buscador y de la API). `s=10` = NN de la
  sucursal donde se pegó la etiqueta: la página sabe cuál es «acá» y se puede medir por local.
- **Dominio corto propio** (`m.mateu.com.ar` o similar, custom domain de Cloudflare Pages): menos
  caracteres = QR con módulos más grandes = se lee mejor a 23 mm. Con
  `mateu-sports-portal.pages.dev/qr/?c=…` también anda, pero el QR sale más denso.
- Sin fecha ni precio adentro: la etiqueta **no vence**, todo se resuelve en vivo al escanear.

## 3. Lo que ve el cliente (página pública `qr/`)

`qr/index.html` self-contained, **sin sesión del Portal** (mismo patrón que `gestion-stock/?pres=`
y `reviews/?pres=`), pensada para celular:

1. **Producto + precio**: marca · disciplina · descripción · género · código · **precio grande**
   (Saira itálica, la tipografía «rendimiento») con «precio de lista» y la promo si hay.
2. **Talles en esta sucursal**: chips por talle en la escala de la marca; los que no quedan van
   tachados; «último» cuando queda 1; equivalencia «US 8.5 = 42 AR» (reusa
   `lib/asistente-talles.mjs`); «stock actualizado HH:MM».
3. **En otras sucursales**: las que tienen stock, ordenadas por cercanía a la sucursal del QR
   (tabla fija de distancias entre locales), con sus talles, y el **Depósito central** como
   «te lo traemos en 48 hs» (decisión de Juli: si se muestra o no el depósito).
4. **Acciones** (cada una deja un dato):
   - «📲 Pedir que lo traigan a esta sucursal» → WhatsApp del local con el mensaje armado, o
     pedido que cae en la Bandeja / Buscador de la sucursal.
   - «🔔 Avisame cuando llegue mi talle» → teléfono/WhatsApp + talle = **demanda insatisfecha por
     talle** (hoy el Portal solo sabe qué texto se buscó y no apareció).
   - «🛒 Comprarlo online» → ficha del ecommerce por código, si existe.
   - «⭐ ¿Te atendieron bien? Dejanos tu reseña» → link a la reseña de Google de ESA sucursal
     (captación: es la métrica del módulo Reseñas).

**Qué NO muestra** (es público): ubicaciones en el depósito, sector del salón, comentarios,
stock del depósito abierto por talle si Juli decide que no, costos, nada de otros módulos.

## 4. De dónde salen los datos

```
Celular del cliente ──► qr/ (Pages, pública) ──► /api/qr?c=ADIJS2852&s=10 (Pages Function)
                                                     ├─► API del dev: GET /v1/stock/articulo/{codigo}   (talles por sucursal)
                                                     ├─► API del dev: precio (§8 de API-STOCK-BUSCADOR.md) ← NO EXISTE TODAVÍA
                                                     └─► Firebase: qrScans/<ym> (registro del escaneo)
```

- **Function `/api/qr`** (nueva, pública): key de la API en Secret, cache 10 min por artículo en
  memoria + R2 como `/api/ventas`, **tope de pedidos por IP** (es pública), y devuelve SOLO lo de
  la lista de arriba. Nunca el shape completo de la API.
- **Precio**: hoy ninguna API lo trae. Se pidió en `API-STOCK-BUSCADOR.md` §8 (`precio.lista`,
  `promo`, por sucursal si varía). Es la misma «Lista de precios» que espera Regalías: un solo pedido.
- **Sin API todavía**: los **talles ya se pueden mostrar HOY** con el índice compacto que usa
  Matts (`ubicaciones-mateu/sucursales/<slug>/indice`, sembrado en las 8 sucursales que cargan
  stock, con talles en las que lo abren). Sirve para probar la etiqueta y la página en una
  sucursal (Calle 49 o Berisso) antes de que el dev entregue; el precio quedaría como «consultá
  al vendedor» hasta entonces. Con la API, la Function cambia de fuente y las etiquetas
  impresas siguen valiendo.

## 5. Impresión desde el Buscador

- Botón **«🏷 Etiqueta QR»** en la tarjeta del artículo (`ubicaciones/index.html`, `artCardHtml`,
  al lado de «💬 Comentar» / «🔄 Yo repongo»), **para todos los roles** (encargado, depósito y
  puesto).
- Abre la hoja **«Imprimir etiqueta»**: vista previa, formato (60×40 · 50×30 · cartel), cantidad
  (1 por defecto; «una por unidad en stock» para etiquetar la caja de cada par) y **Imprimir** →
  `window.print()` con `@page { size: 60mm 40mm; margin: 0 }`, una etiqueta por página. Con la
  térmica configurada al tamaño de la etiqueta, el navegador imprime directo (Chrome recuerda la
  impresora y «sin márgenes»). Sin diálogo intermedio: tocar «Imprimir» ya abre la impresión.
- **Impresión masiva**: desde la lista de resultados y desde «⚡ Nuevos sin ubicar», «🏷 Imprimir
  etiquetas de los N» (lo que acaba de entrar es justo lo que hay que etiquetar) y, al cerrar el
  resumen de una carga de stock, «Imprimir etiquetas de los nuevos». Hojas A4 con la grilla de
  etiquetas autoadhesivas (p.ej. 65 por hoja de 38×21 mm; el formato se elige).
- **QR generado en el navegador sin CDN**: `shared/qr.js` (encoder MIT vendoreado, ~10 KB), así
  imprime aunque el salón esté sin internet (la búsqueda ya funciona offline).
- Al imprimir se guarda `qrEtiquetas/<slug>/<clave>` = `{n, ts, por, formato}` para saber qué
  artículos ya tienen etiqueta (chip «🏷 etiquetada» en la tarjeta) y reimprimir lo que cambió.

## 6. Mejoras que se pueden sumar (a decidir)

Ordenadas por lo que aportan / lo que cuestan:

1. **Registro de escaneos** (`qrScans/<ym>/<id>` = artículo, sucursal, hora): qué artículos
   generan interés, en qué local y a qué hora; cruce con la venta de la semana (**escaneos que
   NO terminaron en venta** = artículo que interesa y no se vende: precio, talle o exhibición).
   Se ve en un panel dentro del Buscador (Actividad) y en Mi Sucursal.
2. **Demanda insatisfecha por talle** («Avisame cuando llegue mi talle»): alimenta el Reparto de
   Mercadería (qué talle le falta a qué sucursal con un cliente esperando) y dispara el aviso al
   cliente por WhatsApp cuando ese talle entra al stock de esa sucursal (Function que compara el
   stock nuevo con los pedidos pendientes).
3. **Un QR genérico por sucursal** («Buscá cualquier producto»): cartel en la entrada / probador
   que abre la misma página con un buscador y la cámara del celular para leer el código de barras
   de la marca (el mapa `ean/` ya resuelve la etiqueta al artículo). Cubre lo que no tiene etiqueta
   QR propia.
4. **Reseña de Google** desde la página: el botón «Dejanos tu reseña» con el link directo a la
   ficha del local es la vía de captación más barata que hay. Se mide en el módulo Reseñas.
5. **Precio con promociones y cuotas**: «3 cuotas sin interés», «2×1», precio tachado: necesita
   que la API traiga la promo (§8) o una tabla de promos por marca cargada desde el Portal.
6. **«Pedir que lo traigan»** integrado: en vez de WhatsApp, el pedido cae en la Bandeja de la
   sucursal destino + la de origen con artículo y talle, y el vendedor lo confirma; queda el
   circuito medido (cuántos traslados por pedidos de clientes).
7. **Matts para el cliente**: «¿Qué talle me conviene?» / «¿Cuál es mejor para pádel?» con el
   modo puesto (asesor de producto, sin datos internos). Es prender lo que ya existe en la página.
8. **Etiqueta Aurelius** y **etiqueta de outlet** (con «precio outlet» destacado) como variantes
   del mismo diseño.
9. **Etiqueta con foto del artículo** (cartel de góndola): cuando haya fotos por código (hoy no
   hay); el ecommerce las tiene.
10. **Alerta de etiqueta vieja**: artículo con etiqueta impresa que cambió de precio → aviso en el
    Buscador «reimprimir». Solo si la etiqueta física lleva el precio impreso (la propuesta NO lo
    lleva, a propósito: el precio vive en la página).

## 7. Etapas sugeridas

| Etapa | Qué | Depende de |
|---|---|---|
| **A** | `shared/qr.js` + botón «🏷 Etiqueta QR» + hoja de impresión (3 formatos, masiva) + registro de etiquetas impresas | nada: se puede hacer ya |
| **B** | `qr/` pública + Function `/api/qr` leyendo el **índice del Buscador** (talles), precio «consultá al vendedor», registro de escaneos, botón de reseña | nada: prueba piloto en Calle 49 / Berisso |
| **C** | Function cambia a la API del dev (`/v1/stock/articulo` + precio §8); precio en la página | API de stock + precio |
| **D** | «Avisame cuando llegue mi talle» + «Pedir que lo traigan» + panel de escaneos vs. venta | B + WhatsApp del local |

Dominio corto: pedirlo en paralelo (DNS de `mateu.com.ar` → Cloudflare Pages custom domain), así las
primeras etiquetas ya salen con la URL definitiva y no hay que reimprimir.
