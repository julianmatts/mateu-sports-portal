# Respuesta al equipo de VentasApi — re-validación y evidencia del punto 3 (23/09/2026, tarde)

Para pasarle al Claude del equipo de la API. Contiene: (1) qué dio la re-validación de lo que
desplegaron hoy, (2) las respuestas a las tres preguntas sobre el punto 3 con casos reales sacados
de **su propio endpoint `/v1/ventas/lineas`** y del export «Estadística de venta» del sistema, y
(3) la definición exacta a implementar y cómo se acepta. Todo lo de acá se reproduce con
`scripts/validar-api-ventas.mjs` del repo del Portal.

## 1. Re-validación de lo desplegado hoy

| Punto | Estado | Cómo se ve |
|---|---|---|
| Notas de crédito | ✅ arreglado | Kids 24/08: unidades 390/390, Plaza 426/426, Diagonal 1.333/1.333 (Portal/API), antes diferían. En `/lineas` ya no hay Nc con importe positivo. |
| CORS | ✅ arreglado | `fetch` desde `https://mateu-sports-portal.pages.dev` resuelve (antes «Failed to fetch»). |
| 500 intermitentes | ❌ siguen | Hoy a las 14:22 (hora AR) dos 500 seguidos desde el navegador (`/semana/2026-09-14` y `/sucursal/kids`), a las 12:26 y 12:3x otros cuatro con curl, y `/lineas` falló en medio de una corrida. Con reintento del cliente sale, pero el reintento del lado del server no los está tapando. Medición de 30 llamadas espaciadas 3 s: ver el final de este documento. |
| Importe por línea | ⚠️ **a medias** | Lo que restaron (`Imp_dto`) corrigió parte (Adidas pasó de +169.613 a −70.385 vs. el Portal), pero **sigue faltando un descuento que el sistema prorratea en todas las líneas del ticket**. Ver 1.1. |

### 1.1 El descuento que falta

Mismos comprobantes que en el informe anterior, misma diferencia después del deploy:

| Comprobante (suc 02, Kids) | Línea | Sistema (export) | API hoy | Factor |
|---|---|---:|---:|---|
| FcC.0054-00236725 | CANGURO DEPORTIVO EDLP 26 KIDS NEGRO | 59.499,15 | 69.999 | ×0,85 |
| FcC.0054-00236723 | GUANTE PREDATOR GL MTC FSJ JR | 116.999,10 | 129.999 | ×0,90 |
| FcC.0054-00236731 | FLEX RUNNER 4 (PS) KIDS NEGRO | 80.999,10 | 89.999 | ×0,90 |
| FcC.0054-00236731 | BOTELLA PLASTICO C/SILICONA UNICORN | 17.999,10 | 19.999 | ×0,90 |
| FcC.0054-00236771 | ULTRA 6 PLAY FG/AG JR | 85.499,10 | 94.999 | ×0,90 |
| FcC.0054-00236771 | CUPON DE DESCUENTO 15%OFF EN EFECTIVO (rubro Otros) | 90 | 100 | ×0,90 |
| FcC.0054-00236771 | PROMO CUPONES (rubro Conceptos) | −90 | −100 | ×0,90 |
| FcC.0054-00236827 | PRAGA BOYS GRIS/VINO | 50.999,15 | 59.999 | ×0,85 |

Es un **descuento a nivel comprobante** (10 %, 15 %, 20 %: promo de medio de pago o similar) que
el reporte «Estadística de venta» del sistema aplica **proporcionalmente a cada línea, incluidas
las de cupón/promo** (por eso el +100 queda en 90 y el −100 en −90). No es `Imp_dto` de la línea.
Hay que encontrar en la base el campo de descuento del comprobante (cabecera) que usa ese
reporte y prorratearlo igual, o directamente leer el mismo campo/vista de importe neto que
consume el reporte. Para verificar: en Kids, semana del 24/08, quedan **26 de 318 comprobantes
con diferencia, que suman +329.320** contra el export; con esto corregido tiene que dar 0.

## 2. Punto 3 — respuestas a las tres preguntas

### 2.1 ¿De dónde sale el criterio «EXACTO»?

**Es una decisión de negocio de Julián Mateu, tomada el 17/09/2026**, no una inferencia del
Portal ni de `ventaEquipo`. El motivo: el encargado de cada sucursal compara la venta del Portal
con la que le muestra el sistema (TS). Con el criterio de §4 el Portal decía «llegaste a la meta» y
el sistema otro número (caso disparador: Diagonal 80, semana 37, una vendedora con 9.755.637 en el
Portal y 9.395.649 en el sistema), y el módulo perdía credibilidad. Desde ese día el Portal suma
las líneas del export tal cual y cada línea va al vendedor que la hizo; se aplicó tanto a la carga
semanal como al cierre mensual (validado: agosto 2026, las 21 sucursales dan exacto la suma del
export, diferencia 0,00). El documento de especificación de agosto que tienen quedó viejo en ese
punto: **el §4 se reescribió el 23/09/2026** con la regla vigente, y Julián lo confirma en el
mensaje que acompaña este documento.

Y una aclaración justa a su observación: `ventaEquipo` de Firebase **no se usó como verdad**. La
verdad es el **export «Estadística de venta» del sistema**, que se cruzó contra `/lineas`
comprobante por comprobante (mismas 318 líneas de Kids, mismos 318 comprobantes). Firebase solo
sirvió para la primera tabla, y ahí se marcaron sus propias limitaciones (cargas sin domingo,
cargas parciales).

### 2.2 Evidencia: dónde §4 y el sistema dan distinto

**Sobre el export completo de agosto 2026 (todas las sucursales, 117.489 líneas).** «Sistema» =
suma tal cual de las líneas del export, que es lo que muestra el TS; «§4» = su criterio actual
aplicado a esas mismas líneas. La venta casi no cambia; **los tickets bajan 11 % y las unidades
suben 5 %**, y eso mueve UPT y ticket promedio, que son los indicadores del Portal:

| Sucursal | Venta sistema | Venta §4 | Dif. | Tickets sistema | Tickets §4 | Unid. sistema | Unid. §4 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 01-MS Plaza Italia | 152.043.214 | 151.962.657 | −80.557 | 1.676 | 1.432 | 2.330 | 2.462 |
| 02-Mateu Kids | 131.132.935 | 131.056.321 | −76.614 | 1.869 | 1.623 | 2.338 | 2.343 |
| 06-MS City Bell | 313.756.071 | 313.637.989 | −118.082 | 2.905 | 2.519 | 4.488 | 4.652 |
| 10-MS Diagonal 80 | 225.748.293 | 225.936.993 | +188.700 | 1.973 | 1.677 | 3.071 | 3.292 |
| 12-MS Calle 12 | 487.244.487 | 487.123.452 | −121.035 | 4.732 | 4.082 | 6.975 | 7.276 |
| 14-Outlet Gonnet | 631.508.717 | 632.004.289 | +495.571 | 6.462 | 6.037 | 10.968 | 11.520 |
| 99-Ecommerce | 268.543.740 | 268.543.740 | 0 | 2.756 | 2.544 | 3.729 | 3.045 |
| **Total 21 sucursales** | **4.948.833.589** | **4.949.073.574** | **+239.985** | **46.494** | **41.270** | | |

(La tabla completa, sucursal por sucursal, está en el informe adjunto.)

**Casos concretos con las líneas crudas de `/v1/ventas/lineas` (los pueden repetir tal cual).**

**(a) Comprobantes con líneas de más de un vendedor.** §4 se lo da entero al de la línea de mayor
|importe|; el sistema le da a cada uno lo suyo. Kids 24–30/08: 11 de 318. Diagonal 80 14–20/09:
**169 de 912**. Ejemplo `GET /v1/ventas/lineas?desde=2026-08-24&hasta=2026-08-30&sucursal=02`:

```
2026-08-27 | FcC.0054-00236844 | Otros       | CUPON DE DESCUENTO 15%OFF EN EFECTIVO | cant 1  | imp 100   | vend NOE SALINAS DAIANA ELIZABETH
2026-08-27 | FcC.0054-00236844 | Conceptos   | PROMO CUPONES                         | cant -1 | imp -100  | vend LAMBARRI ATAHUALPA
2026-08-27 | FcC.0054-00236844 | 02-CALZADO  | RUNFALCON 6 EL C VLC KIDS NGR/BCO      | cant 1  | imp 89999 | vend LAMBARRI ATAHUALPA
```

Efecto acumulado en Diagonal 80, semana del 14/09, por vendedor (venta / tickets / unidades):

| Vendedor | §4 | Sistema |
|---|---|---|
| POLARI BRAIAN GABRIEL | 13.360.129 / 88 / 182 | 13.051.743 / 97 / 158 |
| AGA AXEL TOMAS DANILO | 11.961.481 / 78 / 121 | 11.777.189 / 91 / 96 |
| CASAO KEVIN ARMANDO M. | 10.451.694 / 66 / 107 | 10.397.599 / 74 / 72 |
| CASTRO VALENTIN DANIEL | 10.080.791 / 53 / 118 | 9.964.905 / 60 / 70 |
| APPIOLAZA LUA AGUSTINA | 58 tickets | 168 tickets |

**(b) Comprobantes que no son Nc y que §4 no cuenta como ticket** (cantidad agregada ≤ 0). Kids:
54 de 318 (47 cambios de producto −1/+1, 4 con líneas anuladas `%%%`, 1 devolución en factura,
2 otros). Diagonal 80: **115 de 912** (93 cambios, 7 devoluciones, 2 bolsas, 2 redondeo, 1
conceptos varios, 2 anuladas, 8 otros). Para el Portal todo comprobante que no es Nc es un ticket
(definición de Julián: es lo que el sistema muestra al filtrar por vendedor). Ejemplos:

```
2026-08-24 | FcC.0054-00236693 | 02-CALZADO | TOP VLC INF.ROSA/PLATA           | cant 1  | imp 62999  | vend CABRAL LORENA ELIZABETH
2026-08-24 | FcC.0054-00236693 | 02-CALZADO | TOP VLC INF.BLANCO/LILA          | cant -1 | imp -62999 | vend CABRAL LORENA ELIZABETH
2026-08-24 | FcC.0054-00236699 | 03-INDUMENTARIA | M/C 3S TEE 160 JR AZUL/BLANCO      | cant 1  | imp 34999  | vend LAMBARRI ATAHUALPA
2026-08-24 | FcC.0054-00236699 | 03-INDUMENTARIA | CAMPERA 3S FZ TR TT JR AZUL/BLANCO | cant -1 | imp -54999 | vend LAMBARRI ATAHUALPA
2026-08-24 | FcC.0054-00236699 | 03-INDUMENTARIA | CAMPERA 3S FZ TR TT JR AZUL/BLANCO | cant 1  | imp 54999  | vend LAMBARRI ATAHUALPA
2026-08-24 | FcC.0054-00236699 | 03-INDUMENTARIA | SHORT BAS NGR/BCO                  | cant -1 | imp -19999 | vend LAMBARRI ATAHUALPA
```

**(c) El par cupón +100 / promo −100.** El sistema carga en cada ticket con cupón una línea
«CUPON DE DESCUENTO 15%OFF EN EFECTIVO» de +100 en rubro **Otros** y una «PROMO CUPONES» de −100
en rubro **Conceptos**. §4 descarta el +100 (Otros no aporta) y cuenta el −100 (Conceptos aporta
importe): **cada uno de esos tickets queda 100 pesos abajo del sistema**. Kids, una semana: 127
tickets. Diagonal, una semana: 484. Es la causa de los «−76.614» y «−121.035» de la tabla de arriba.

```
2026-08-25 | FcC.0054-00236768 | Conceptos     | PROMO CUPONES                         | cant -1 | imp -100  | vend LAMBARRI ATAHUALPA
2026-08-25 | FcC.0054-00236768 | Otros         | CUPON DE DESCUENTO 15%OFF EN EFECTIVO | cant 1  | imp 100   | vend LAMBARRI ATAHUALPA
2026-08-25 | FcC.0054-00236768 | 04-ACCESORIOS | SET MINI PELOTAS MIX X3               | cant 1  | imp 49999 | vend LAMBARRI ATAHUALPA
2026-08-25 | FcC.0054-00236768 | 02-CALZADO    | ULTRA 6 PLAY FG/AG JR NEGRO/VRD FLUO  | cant 1  | imp 94999 | vend LAMBARRI ATAHUALPA
2026-08-25 | FcC.0054-00236768 | 04-ACCESORIOS | INFLADOR DRB DOBLE ACCION C/PICO      | cant 1  | imp 14999 | vend LAMBARRI ATAHUALPA
```

**(d) Unidades.** Las promos vienen con cantidad −1 («PROMO MEDIAS», «REGALO LLAVERO COMPRA
GRANDE», «PROMO 50% EN LA SEGUNDA UNIDAD»); §4 no les cuenta la cantidad y el sistema sí, por eso
§4 da más unidades (Diagonal: 1.553 vs 1.412 en la semana; agosto completo: +5 %).

### 2.3 WEB MATEU / WEB AURELIUS

Tienen razón en que **no son sucursales**: son valores del campo **Vendedor** (`Vendedor` /
`Nombre` del vendedor en la línea). Son los «vendedores» con los que el sistema factura la venta
web cuando sale del stock de una sucursal física. Fuente exacta, con sus propios datos:

- `GET /v1/ventas/semana/2026-08-24/sucursal/calle-12` devuelve hoy un vendedor `"WEB MATEU"`
  con 47 tickets y 6.612.839; en `/sucursal/aurelius-12`, `"WEB AURELIUS"` (8 tickets) y
  `"WEB MATEU"` (4).
- `GET /v1/ventas/lineas?desde=2026-08-24&hasta=2026-08-30&sucursal=12`: 90 líneas, 51
  comprobantes, 6.232.843 con `vendedor = "WEB MATEU"`. Ejemplo:

```
2026-08-24 | FcB.0110-00000259 | 04-ACCESORIOS | TRIPACK SOQUETE NGR/GR/BCO             | cant 1 | imp 9999  | vend WEB MATEU
2026-08-24 | FcB.0110-00000259 | 02-CALZADO    | SOFTRIDE CARSON KNIT ADP NGR/GRS/BCO   | cant 1 | imp 79999 | vend WEB MATEU
```

- En el export de agosto completo: `12-MS Calle 12` tiene 700 líneas (31.540.048) con vendedor
  `WEB MATEU`; `04-Aurelius Calle 12`, 53 líneas (5.686.329) con `WEB AURELIUS`; `99-Ecommerce`,
  2.696 líneas con `WEB AURELIUS` / `WEB MATEU` (ahí son sus vendedores normales).

Regla de negocio (Julián, 29/08/2026): esa venta es del canal web, no del local. Por eso en el
Portal las líneas con vendedor `WEB MATEU` o `WEB AURELIUS` en una sucursal distinta de 99 se
cuentan en `ecommerce` (venta, unidades, ticket y vendedor). Comparación del nombre en mayúsculas,
sin acentos, con espacios normalizados. El endpoint de totales no trae vendedores, así que el
Portal no puede corregirlo después: tiene que hacerlo la API.

## 3. Definición a implementar (reemplaza §4 de la spec de agosto)

1. Ninguna línea se descarta: cantidad e importe (neto, §1.1) de todas las líneas, con su signo.
2. Nc: todas sus líneas negativas (ya está).
3. Cada línea va al vendedor de esa línea. Vacío → `"SIN ASIGNAR"`.
4. Ticket = comprobante que no es `Nc*`, tenga o no unidades. Por vendedor: 1 por cada
   comprobante donde tiene al menos una línea. `total` de la sucursal y `/semana/{lunes}`:
   comprobantes distintos.
5. Vendedor `WEB MATEU` / `WEB AURELIUS` en sucursal ≠ 99 → cuenta en `ecommerce`.
6. `dias[].v` = importe del vendedor ese día; `rubros` = rubro crudo en MAYÚSCULAS sin `NN-`.
7. `/lineas` sigue siendo pass-through (con el importe neto y las Nc negativas).

Pseudocódigo y detalle en el documento «correcciones-api-ventas-para-claude.md» ya enviado.

## 4. Aceptación

Con importe neto + esta definición, para Kids (02), semana del 24/08 (`/sucursal/kids`):
`total = { venta: 21.950.916, tickets: 317, unidades: 391 }` (317 = 318 comprobantes − 1 Nc); en
`vendedores`, CABRAL LORENA ELIZABETH con 61 tickets (hoy 47) y NOE SALINAS con 53 (hoy 34). Para
Diagonal 80 (10), semana del 14/09: `{ venta: 116.639.535, tickets: 908, unidades: 1.412 }`,
APPIOLAZA LUA AGUSTINA con 168 tickets (hoy 58). Para Calle 12 (12), semana del 24/08: sin las
líneas WEB MATEU, 874 tickets (925 − 51) y esos 51 comprobantes sumados en `ecommerce`. Tolerancia
±1 por redondeo. Del lado del Portal se corre `scripts/validar-api-ventas.mjs lineas … <csv>` y
tiene que dar «con diferencia 0».

## 5. Medición de los 500

30 llamadas a `/v1/ventas/semana/2026-09-14/sucursal/plaza` espaciadas 3 s (hora Argentina):

| Resultado | Llamadas |
|---|---:|
| 200 en menos de 0,4 s | 19 |
| 200 pero en **~19,8 s** (un intento que muere por timeout y el reintento que sale) | 10 |
| 500 tras 34,8 s (falló también el reintento) | 1 |

Las lentas caen a intervalos regulares de **unos 30 segundos** (14:24:20, 14:24:47, 14:25:10,
14:25:37, 14:26:07, 14:26:37, 14:27:07, 14:27:37, 14:28:07, 14:28:34, 14:29:26): cada medio
minuto hay una ventana de ~20 s en la que la consulta queda bloqueada, no una vez por hora. El
reintento no arregla eso, lo esconde: el Portal esperaría 20 s en una de cada tres llamadas.
Pista: el bloqueo coincide con el proceso que sincroniza las ventas (locks sobre las tablas que
lee la API). Opciones del lado de la API: leer sin bloqueo (en SQL Server, `WITH (NOLOCK)` /
`READ UNCOMMITTED` o snapshot isolation), bajar el timeout de la consulta a 3–5 s con reintento
inmediato, o responder desde un cache propio de 5 minutos por semana (el
`Cache-Control: max-age=300` ya declara que se puede) y refrescarlo por detrás, así una llamada
nunca espera a la base.
