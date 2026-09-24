# API de ventas — conexión del Portal (24/09/2026)

Cómo Indicadores (Mi Sucursal / Panel General) lee la venta de la semana en curso desde el
sistema, y qué hay que configurar en Cloudflare para que ande. La API en sí (rutas, criterio,
validación) está en `API-VENTAS-FASE1.md` y los informes del 23 y 24/09.

## Qué hace

```
navegador ──► /api/ventas?semana=…[&sucursal=…] ──► functions/api/ventas.js ──► https://66-97-37-173.sslip.io/v1/ventas/…
   (Indicadores)     mismo origen, sin CORS            lib/ventas-proxy.mjs             (key Bearer en un Secret)
                                                        cache 5 min + respaldo 24 h
```

- **La key nunca baja al navegador**: vive en el Secret `VENTAS_API_KEY` de Cloudflare Pages y
  la usa solo la Function. El repo es público, así que tampoco va en ningún archivo.
- **Cache en el proxy** (`lib/ventas-proxy.mjs`): cada respuesta se guarda en memoria del isolate y
  en R2 (bucket `LEGAJOS`, prefijo `_cache/ventas/`). Menos de 5 min: se sirve sin tocar la API.
  Entre 5 min y 24 h: se sirve al toque y se refresca de fondo. Una ruta que falló (500 de la
  API, timeout) no se vuelve a pedir por 60 s. Así el bloqueo de ~20 s cada 30 s que hoy tiene
  la base del sistema no lo ve el encargado: como mucho lo paga la primera consulta del día.
- **Permisos en la Function, no en el navegador**: el mail de la sesión viaja en el header
  `X-Mateu-Email` (y el token de `acceso.js` en `X-Mateu-Tok`); rol y sucursal salen de
  `discontinuos-mateu/usuarios`. `admin` y `supervisor` ven cualquier sucursal; `sucursal` y
  `outlet` solo la propia (los totales de la semana les llegan filtrados); el resto, 403. Con
  el ingreso por servidor activo el token es obligatorio.
- **Indicadores** (`indicadores/index.html`, bloque «API de ventas del sistema»): al abrir hace
  `GET /api/ventas` una vez (se recuerda 10 min en sessionStorage). Con `disponible:true`:
  - **Semana en curso** (lunes de hoy o posterior): `fetchVentaEquipo` y `fetchVentaEquipoTotal`
    piden primero al proxy y, si no responde, caen a `ventaEquipo` de Firebase. El payload de
    la API tiene el mismo shape que `ventaEquipo` y viene marcado `fuente:'api'`.
  - **Semanas anteriores**: primero `ventaEquipo` (lo que cargó gerencia o el encargado) y solo
    si no hay nada, la API. Así una semana que nadie cargó igual aparece.
  - Si el encargado sube su Excel en una semana viva, en esa visita se muestra lo suyo
    (`_veManual`); al recargar vuelve a mandar el sistema.
  - En pantalla: pill **«● en vivo · hasta DD/MM HH:MM»** en «Cómo viene el equipo» (Mi Sucursal)
    y **«vivo»** en vez de «prov» en la tabla del objetivo semanal del Panel General.
- Sin el Secret (o abriendo el HTML suelto): `disponible:false` y todo sigue por `ventaEquipo`
  como siempre. Nada se rompe.

## Configurar en Cloudflare (lo hace Juli, una vez)

1. Cloudflare → Workers & Pages → proyecto **Pages** `mateu-sports-portal` (el de
   `mateu-sports-portal.pages.dev`, no el Worker del mismo nombre) → Settings → Variables and
   Secrets → **Add** → tipo **Secret**, nombre `VENTAS_API_KEY`, valor = la key de la API.
2. Deployments → último deploy → ⋯ → **Retry deployment** (un Secret nuevo recién se ve en el
   deploy siguiente).
3. Verificar: abrir `https://mateu-sports-portal.pages.dev/api/ventas` → `{"disponible":true}`.
4. Entrar a Mi Sucursal o al Panel General: la semana en curso tiene que salir con el pill
   «● en vivo».

Opcionales: `VENTAS_API_BASE` (variable, si el dev cambia el host) y un binding R2 `VENTAS_CACHE`
si se quiere un bucket propio para el cache (hoy usa `LEGAJOS`).

## Cómo probar sin Cloudflare

`node --test lib/ventas-proxy.test.mjs` prueba la Function con la API y Firebase simulados
(permisos por rol, cache fresco/viejo, API caída, una sola consulta en vuelo, memoria de fallos).
Para probarlo en el navegador contra la API real se puede servir el repo con un servidor de
node que monte `manejar()` de la librería en `/api/ventas` con la key leída de un archivo fuera
del repo (así se validó el 24/09/2026: Panel General y Mi Sucursal de Kids, semana del 21/09).

## Pendiente del lado de la API (dev)

- Descuento de cabecera del comprobante en el importe (Kids 24/08: 26 comprobantes, +329.320).
- El bloqueo de la base cada ~30 s (el cache lo tapa, no lo arregla).
- **500 en 0,15 s justo después de un 500 de 16–20 s** (visto el 24/09 al conectar, repitiendo la misma
  llamada cada 4 s: Kids 14/09 → 500 en 20,6 s, y las dos llamadas siguientes —Plaza y Kids— 500 en
  0,12 s; un minuto después, lo mismo). No es una sucursal ni una semana en particular: mientras dura
  la ventana de bloqueo, cuando una llamada agota sus reintentos las siguientes fallan al instante,
  como si el pool de conexiones quedara agotado o roto. Es lo que hay que mirar en el log de la API.
