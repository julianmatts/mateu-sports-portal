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
