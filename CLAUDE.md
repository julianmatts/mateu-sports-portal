# CLAUDE.md — Portal Mateu Sports

Contexto del proyecto para Claude Code. Mantener corto y concreto.

## Qué es esto

Monorepo con las herramientas internas de **Mateu Sports** (cadena de retail
deportivo, zona La Plata) y un **portal** con login que las enlaza. Todo se
deploya a Cloudflare Pages desde GitHub. El idioma del proyecto es **español (Argentina)**.

## Estructura

```
mateu-sports-portal/
├── index.html          # EL PORTAL: login (email+PIN contra Firebase) + tiles a cada herramienta
├── netlify.toml        # leftover de cuando se usaba Netlify; ya no aplica, no usar de referencia
├── condiciones/        # Condiciones Comerciales (localStorage)
├── equipo/             # Área de Producto / transferencias (localStorage)
├── turnero/            # Turnero de proveedores (Firebase + EmailJS)
├── marcas/             # Asignación de Marcas (Firebase REST)
├── gestion-stock/      # Discontinuos por sucursal + Reporte Mensual + Meses de Stock
├── pedidos-semanales/  # Reposición semanal por sucursal y aprobaciones de Producto
├── managment/          # Desarrollo, OC y seguimiento de ingresos por proveedor
├── recepcion/          # Tablero de recepción preventa Adidas SS27
├── diagonal80/         # Apertura Diagonal 80 (propuesta vs. capacidad)
├── ubicaciones/        # "Buscador de Artículos": ubicaciones de depósito por sucursal
└── shared/             # código común (hoy casi vacío, para el futuro)
```

## Convención principal — NO romper

Cada herramienta es **un único `index.html` self-contained**: HTML + CSS + JS
todo inline, sin build, sin bundler, sin dependencias de node. Las libs externas
(fuentes de Google, xlsx, etc.) entran por `<link>`/`<script src>` desde CDN.
El logo de Mateu va **embebido como data URI base64** (no como archivo suelto).

Al editar: trabajar siempre dentro del `index.html` de la herramienta. No partir
en múltiples archivos salvo que se decida explícitamente centralizar algo en
`shared/`.

## Stack — quién hace qué

- **GitHub** → guarda el código y el historial.
- **Cloudflare Pages** → publica el sitio; **deploya solo con cada push** a `main`.
- **Firebase (Realtime Database vía REST, sin SDK)** → los datos en vivo, un
  proyecto por dominio: `discontinuos-mateu` (usuarios del portal + gestión de
  stock), `asignacion-marcas-mateu`, `pedidos-semanales-mateu`,
  `ubicaciones-mateu` (Buscador de Artículos) y el del turnero.
  `condiciones/` y `equipo/` usan **localStorage** (no tienen backend).
  No migrar Firebase a otra cosa sin que Juli lo pida: es la opción correcta
  para los datos multi-usuario en tiempo real.

Regla mental: **GitHub + Cloudflare Pages = el código. Firebase = los datos.**

## Cómo deployar

No hay build. El flujo es: editar → commit → push a `main`. Cloudflare Pages
republica solo en ~30s. Para probar local, abrir el `index.html` en el navegador.

Config en Cloudflare Pages: build command vacío, output directory = raíz (`/`).

## El portal (`index.html` raíz) y el login

Login centralizado **blando** (sin Firebase Auth; ordena accesos, NO es
seguridad real): email + PIN de 4 dígitos validado contra
`discontinuos-mateu-default-rtdb/usuarios`. Cada usuario tiene `rol`
(`admin` | `sucursal` | `outlet`), su `sucursal`/`outlet_id` y la lista
`herramientas`, que define qué tiles ve. Ya no hay contraseñas en el código:
la config del `<script>` es `TOOLS` (nombre, ícono y url de cada herramienta)
y las listas de sucursales/outlets.

- La sesión queda en localStorage (`mateu_portal_session`). Los módulos **no
  tienen login propio**: leen esa sesión y redirigen a `../` si falta o si el
  usuario no tiene la herramienta asignada.
- Gestión de usuarios (alta, herramientas, reseteo de PIN): ícono ⚙ del portal,
  visible solo para `julian@mateu.com.ar` (`ADMIN_SETTINGS_EMAIL`).
- El acceso a localStorage está envuelto en try/catch para no romper en
  previews sin storage. Mantener ese patrón.

## Branding / design tokens

Paleta Mateu Sports: **navy `#0B1527`**, **rojo `#CC0000`**, blanco, fondo
`#f5f7fc`. Tipografías: **Bebas Neue** (display), **Barlow Condensed**
(subtítulos/labels), **Barlow** (texto). Estética: minimalista, alta densidad
de información, limpia. Header navy con borde inferior rojo de 3px.

Nota: `condiciones/` es más viejo y usa navy `#002366` + fuente Inter. Si se
rediseña, alinear a los tokens de arriba; si no, dejarlo como está.

## Reglas

- Responder y comentar el código en **español**.
- No agregar frameworks ni build steps. Mantener todo self-contained.
- No tocar la config de Firebase de los módulos (URLs de las bases) salvo pedido explícito.
- Antes de un cambio grande en una herramienta, confirmá el alcance con Juli.
- Juli itera con correcciones puntuales: hacé cambios acotados y dirigidos, no
  reescrituras completas salvo que lo pida.
