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

## Conectar la base Firebase

1. Juli crea una base Realtime Database (p.ej. `recepciones-mateu`) con reglas
   abiertas (`.read`/`.write` = true), como el resto del portal.
2. Pega la URL en la constante **`FIREBASE_DB_URL`** arriba del `<script>` de
   `recepciones/index.html`, por ejemplo:
   ```js
   const FIREBASE_DB_URL = 'https://recepciones-mateu-default-rtdb.firebaseio.com';
   ```
3. Listo. Con la URL vacía el módulo corre en **modo demo** (banner naranja,
   datos de `mock-data.js`, no persiste).

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
