# Control de Recepciones — Depósito Central

Módulo del Portal Mateu Sports para que Compras (Juli y Julián) controlen los
ingresos de mercadería del depósito central: cargar **remitos de ingreso** y
**pedidos de compra (OC)** —importando el Excel o a mano—, ver el detalle semana
a semana con cortes por marca/rubro/disciplina/tipo, y controlar **ingresos vs
pedido** en unidades y en $.

## Cómo funciona (igual que el resto del portal)

`index.html` **self-contained** (HTML + CSS + JS inline, sin build), estética del
portal (navy `#0B1527` / rojo `#CC0000`, Bebas Neue + Barlow). Lee la sesión del
Portal desde `localStorage` (no tiene login propio) y guarda los datos en
**Firebase (Realtime Database vía REST)**, como los demás módulos. El cruce
*ingresos vs pedido* se calcula en el cliente (no hay backend).

- `recepciones/index.html` — el módulo.
- `recepciones/mock-data.js` — datos de prueba para el **modo demo**.
- `import.js` (raíz) — parseo de Excel en el navegador (SheetJS por CDN) + mapeos
  de importación por marca.

### Qué se puede hacer

- **Panel**: KPIs (unidades e **$ ingresado**, remitos, marcas activas,
  cumplimiento de OC) y gráficos por semana / marca / rubro.
- **Remitos** y **Pedidos**: detalle, **importar Excel** (con preview) o alta
  manual, **eliminar** (con confirmación) y **exportar a Excel** la vista actual.
- **Ingresos vs pedido**: control por línea con resumen de estados, avance y
  totales en unidades y $, exportable.
- **↻ Recargar** en la barra de filtros trae los últimos datos de la base (es
  multi-usuario).

## Base Firebase

La base ya está conectada: la URL está en la constante **`FIREBASE_DB_URL`**
arriba del `<script>` de `recepciones/index.html`
(`https://recepciones-mateu-default-rtdb.firebaseio.com`), con reglas abiertas
(`.read`/`.write` = true), como el resto del portal. Si esa constante queda vacía,
el módulo cae a **modo demo** (banner naranja, datos de `mock-data.js`, no
persiste).

### Estructura en la base

```
recepciones/
  pedidos/<nro>   = { nro, fecha, comprador, proveedor, marca, moneda, creado_en,
                      lineas:[ {rubro,disciplina,tipo,cantidad,costo_unitario} ] }
  remitos/<nro>   = { nro, fecha, proveedor, marca, pedido_nro, semana, creado_en,
                      lineas:[ ... ] }
```

`<nro>` es el número de OC/remito (se sanitizan los caracteres que Firebase no
permite en claves). El `importe` (cantidad × costo) se calcula en el cliente; la
`semana` (ISO) se calcula al guardar el remito y se persiste.

## Carga histórica de ingresos (reporte "Estadistica de remitos")

El histórico se cargó con `scripts/cargar-remitos-estadistica.mjs`, que reforma el
reporte matriz por mes que exporta el sistema de stock (una fila por
artículo-en-remito, con cantidad/valorizado en la columna del mes) a documentos de
remito. Agrupa por remito+marca, agrega líneas por rubro/disciplina/tipo (=Grupo 1),
`fecha` = 1° del mes y escribe con PATCH (merge, no pisa lo existente).

```
npm i xlsx
node scripts/cargar-remitos-estadistica.mjs "Estadistica de remitos ....xlsx" https://recepciones-mateu-default-rtdb.firebaseio.com          # dry-run
node scripts/cargar-remitos-estadistica.mjs "Estadistica de remitos ....xlsx" https://recepciones-mateu-default-rtdb.firebaseio.com --commit  # carga
```

Detecta los meses solos (columnas `MM-YY Cantidad`), así que sirve para reportes de
meses posteriores. Correr sin `--commit` primero para ver que los totales cuadren.
Carga inicial (ene→jul 2026): 1765 remitos, 666.987 unidades.

## Carga de pedidos (OC) de Nike

Las OCs de Nike (formato "Resumen Pedido": modelo × talles) se cargan con
`scripts/cargar-pedido-nike.mjs`:

```
node scripts/cargar-pedido-nike.mjs "Pedido Nike Calzado julio 26.xlsx" https://recepciones-mateu-default-rtdb.firebaseio.com          # dry-run
node scripts/cargar-pedido-nike.mjs "Pedido Nike Calzado julio 26.xlsx" https://recepciones-mateu-default-rtdb.firebaseio.com --commit  # carga
```

- Toma las filas con `Total Unidades > 0` (saltea la fila "TOTAL"). cantidad =
  Total Unidades, costo = Precio Whsl.
- **Traduce la taxonomía de Nike a la nuestra** (para que cruce con los ingresos):
  `rubro` = CALZADO (o `--rubro`), `disciplina` = `DISC_MAP[Categoria]`, `tipo` =
  `TIPO_MAP[Genero]`. Ajustá esas tablas en el script si algo no cruza.
- El **nº de OC y la fecha salen del nombre del archivo** (mes → 1° de mes). Como
  hay varias OCs por mes, mantené nombres distintos por archivo.
- El dry-run imprime la traducción (Categoria→disciplina, Genero→tipo) y avisa lo
  que no mapea, para revisar antes de cargar.

### Cruce Ingresos vs pedido (agregado)

El control compara **por marca + rubro + disciplina + tipo** (agregado, no por nº
de OC), porque los ingresos no traen OC. Ojo: mezcla todo el histórico de ingresos
con las OCs cargadas, así que hasta tener las OCs de todos los meses, lo pedido
queda chico frente a lo ingresado. (Mejora futura: filtrar el cruce por período.)

## Importar Excel

Botón **Importar Excel** en Remitos o Pedidos:

1. Elegir marca (para pedidos; define el mapeo) y archivo.
2. Se parsea en el navegador y se **previsualiza** cómo quedó mapeado.
3. Si algo no matchea, editar el mapeo (JSON) y **Re-procesar**.
4. **Confirmar** → se guarda en Firebase. Nunca se guarda sin previsualizar.

### Agregar la plantilla de importación de una marca nueva

Los formatos varían por proveedor. Los mapeos viven en `import.js`
(`MAPPINGS["<Marca>|pedido"]` y el fijo `MAPPINGS["ingreso"]`). Un mapeo define
`sheet`, `headerRow`, `const` (valores fijos como la marca), `fields` (campo
canónico → encabezado real del Excel), `valueMap` (traduce códigos, ej. `FTW`→
`Calzado`) y `defaults`.

Campos canónicos — cabecera: `nro, fecha, proveedor, marca, comprador?,
pedido_nro?`; línea: `rubro, disciplina, tipo, cantidad, costo_unitario`.

**Estado actual:** las plantillas por marca y la de `ingreso` están marcadas
`_pendiente: true` con encabezados placeholder (`TODO_…`). Cuando llegue un Excel
de muestra de cada proveedor / del export de stock, completar los encabezados
reales y poner `_pendiente: false`. La UI avisa mientras un mapeo esté pendiente.

## Nota sobre `xlsx`

En el navegador SheetJS entra por CDN (`<script src>`), como el resto de las libs
del portal — sin build. Para usar `import.js` desde Node (tests/scripts):
`npm i xlsx`.
