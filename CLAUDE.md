# CLAUDE.md — Portal Mateu Sports

Contexto del proyecto para Claude Code. Mantener corto y concreto.

## Qué es esto

Monorepo con las herramientas internas de **Mateu Sports** (cadena de retail
deportivo, zona La Plata) y un **portal** con login que las enlaza. Todo se
deploya a Cloudflare Pages desde GitHub. El idioma del proyecto es **español (Argentina)**.

## Estructura

```
mateu-sports-portal/
├── index.html          # EL PORTAL: login por rol + tiles a cada herramienta
├── netlify.toml        # leftover de cuando se usaba Netlify; ya no aplica, no usar de referencia
├── condiciones/index.html   # Condiciones Comerciales (localStorage)
├── equipo/index.html        # Área de Producto / transferencias (localStorage)
├── turnero/index.html       # Turnero de proveedores (Firebase + EmailJS)
├── marcas/index.html        # Asignación de Marcas (Firebase REST)
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
- **Firebase** → base de datos en vivo. **Solo** la usan `turnero/` y `marcas/`.
  `condiciones/` y `equipo/` usan **localStorage** (no tienen backend).
  No migrar Firebase a otra cosa sin que Juli lo pida: es la opción correcta
  para los datos multi-usuario en tiempo real.

Regla mental: **GitHub + Cloudflare Pages = el código. Firebase = los datos.**

## Cómo deployar

No hay build. El flujo es: editar → commit → push a `main`. Cloudflare Pages
republica solo en ~30s. Para probar local, abrir el `index.html` en el navegador.

Config en Cloudflare Pages: build command vacío, output directory = raíz (`/`).

## El portal (`index.html` raíz)

Login **blando** (las contraseñas viajan en el código; sirve para ordenar
accesos, NO es seguridad real). La config está en el `<script>`, en 3 bloques
comentados arriba de todo:

- `USERS` → usuarios y contraseñas.
- `ROLE_ACCESS` → qué herramientas ve cada rol (`admin`, `producto`, `deposito`).
- `TOOLS` → nombre, descripción, ícono y `url` (la carpeta) de cada herramienta.

El acceso a localStorage está envuelto en try/catch para no romper en previews
sin storage. Mantener ese patrón.

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
- No tocar la config de Firebase de `turnero/`/`marcas/` salvo pedido explícito.
- Antes de un cambio grande en una herramienta, confirmá el alcance con Juli.
- Juli itera con correcciones puntuales: hacé cambios acotados y dirigidos, no
  reescrituras completas salvo que lo pida.
