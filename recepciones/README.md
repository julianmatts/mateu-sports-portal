# Control de Recepciones — Depósito Central

Módulo del Portal Mateu Sports para que Compras (Juli y Julián) controlen los
ingresos de mercadería del depósito central: cargar **remitos de ingreso** y
**pedidos de compra (OC)** —importando el Excel o a mano—, ver el detalle semana
a semana con cortes por marca/rubro/disciplina/tipo, y controlar **ingresos vs
pedido** en unidades y en $.

## ⚠️ Es el primer módulo con backend D1

El resto del portal usa **Firebase** (o localStorage). Este módulo, por pedido
explícito del spec, usa **Cloudflare D1 (SQLite)** a través de **Pages Functions**
(`functions/api/[[route]].js`). Se apoya en la infra de Pages que el portal ya usa
(`functions/enviar-oc.js`). No migra nada del resto: D1 es exclusivo de acá.

## Piezas

| Archivo | Qué es |
|---|---|
| `recepciones/index.html` | Frontend self-contained (dark theme). Lee la sesión del Portal, pega contra `/api/*`. |
| `functions/api/[[route]].js` | API (Pages Functions) sobre D1. Binding `env.DB`. |
| `schema.sql` | Migración: tablas, índices y la vista `v_control`. (en la raíz del repo) |
| `import.js` | Parseo de Excel en el navegador (SheetJS por CDN) + mapeos por marca. (en la raíz) |
| `wrangler.toml` | Binding D1 `DB` → base `mateu_recepciones`. (en la raíz) |

## Aplicar la migración

1. Crear la base D1 (una sola vez):
   ```
   wrangler d1 create mateu_recepciones
   ```
   Copiar el `database_id` que imprime y pegarlo en `wrangler.toml`
   (reemplaza `<pendiente-pegar-database_id>`).

2. Correr el schema (remoto y/o local):
   ```
   wrangler d1 execute mateu_recepciones --file=./schema.sql            # remoto
   wrangler d1 execute mateu_recepciones --file=./schema.sql --local    # local (pages dev)
   ```

## Correr local

```
wrangler pages dev
```

Levanta el portal + las Pages Functions con la D1 local. Entrar por el Portal
(login) → tile **Control de Recepciones**. El módulo pide `/api/*`; si se abre el
`index.html` suelto por `file://` no hay API y se ve el estado de error.

> El `deploy` real a Cloudflare Pages sigue siendo push a `main` (no cambia el
> flujo). Falta pegar el `database_id` y crear/asociar la base D1 en el proyecto
> de Pages antes de que `/api` funcione en producción.

## Importar Excel

Flujo (en la UI, botón **Importar Excel** de Remitos o Pedidos):

1. Elegir marca (para pedidos; define el mapeo) y archivo.
2. Se parsea en el navegador y se **previsualiza** cómo quedó mapeado.
3. Si algo no matchea, editar el mapeo (JSON) y **Re-procesar**.
4. **Confirmar** → se postea el JSON limpio a la API.

Nunca se guarda sin previsualizar.

### Agregar la plantilla de importación de una marca nueva

Los formatos varían por proveedor. Los mapeos viven en `import.js`
(`MAPPINGS["<Marca>|pedido"]` y el fijo `MAPPINGS["ingreso"]`) y **también se
pueden guardar en la tabla `import_mapping`** para editarlos sin tocar código
(`GET/POST /api/mappings`).

Un mapeo define:

```js
{
  sheet: 0,            // nombre o índice de hoja
  headerRow: 1,        // fila (1-based) de los encabezados
  const: { marca:'Nike' },                 // valores fijos
  fields: {                                // campo canónico -> encabezado REAL del Excel
    nro:'OC', fecha:'Fecha', proveedor:'Proveedor',
    rubro:'Rubro', disciplina:'Deporte', tipo:'Tipo',
    cantidad:'Cant.', costo_unitario:'Costo U$'
  },
  valueMap: { tipo:{ FTW:'Calzado', APP:'Indumentaria', ACC:'Accesorios' } }, // traduce códigos
  defaults: { disciplina:'' }              // si la celda viene vacía
}
```

Campos canónicos —
cabecera: `nro, fecha, proveedor, marca, comprador?, pedido_nro?`;
línea: `rubro, disciplina, tipo, cantidad, costo_unitario`.

**Estado actual:** las plantillas por marca y la de `ingreso` están marcadas
`_pendiente: true` con encabezados placeholder (`TODO_…`). Cuando llegue un Excel
de muestra de cada proveedor / del sistema de stock, completar los encabezados
reales y poner `_pendiente: false`. La UI avisa mientras un mapeo esté pendiente.

## API (resumen)

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/dimensiones` | Valores distintos para los filtros. |
| GET | `/api/pedidos?marca=` | Pedidos con sus líneas. |
| POST | `/api/pedidos` | Alta/import de un pedido (atómico). |
| GET | `/api/remitos?marca=&semana=` | Remitos con sus líneas. |
| POST | `/api/remitos` | Alta/import de un remito (atómico). |
| GET | `/api/control?marca=&rubro=&disciplina=&tipo=` | `v_control` + `pct` + `estado`. |
| GET/POST | `/api/mappings` | Leer/guardar mapeos de import. |

`estado` del control: `pendiente` (0 recibido) · `parcial` · `completo` · `excedido`.

## Nota sobre `xlsx`

En el navegador, SheetJS entra por CDN (`<script src>`), como el resto de las
libs del portal — no hace falta build. Para usar `import.js` desde Node (tests o
scripts): `npm i xlsx`.
