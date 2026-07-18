# Portal Mateu Sports — Monorepo

Un solo repositorio con **todas** las herramientas internas de Mateu Sports y un
portal con login que las enlaza. De acá se deploya todo a Netlify.

## Estructura

```
mateu-sports-portal/
├── index.html          ← EL PORTAL (login + tiles por rol)
├── netlify.toml        ← config de Netlify
├── .gitignore
├── README.md           ← este archivo
│
├── condiciones/
│   └── index.html      ← Condiciones Comerciales  ✅ ya está
├── equipo/
│   └── index.html      ← Área de Producto          ✅ ya está
├── turnero/
│   └── (poné acá tu index.html)   ⛔ falta tu archivo
├── marcas/
│   └── (poné acá tu index.html)   ⛔ falta tu archivo
└── shared/             ← código común (para más adelante)
```

**Quién maneja qué:**

- **GitHub** → guarda el código y su historial.
- **Netlify** → publica el sitio en internet (deploya solo cuando hacés push a GitHub).
- **Firebase** → base de datos en vivo del Turnero y de Marcas. **No se toca**, sigue igual.

---

## Paso 0 — Completá los 2 archivos que faltan

Antes de subir nada, copiá tus dos webs a sus carpetas, **siempre como `index.html`**:

| Carpeta | Qué archivo va | Nombre final |
|---|---|---|
| `turnero/` | tu HTML del Turnero (Firebase + EmailJS) | `index.html` |
| `marcas/` | tu HTML de Asignación de Marcas | `index.html` |

(Los de `condiciones/` y `equipo/` ya están puestos.)

---

## Paso 1 — Subir a GitHub

### Opción A — GitHub Desktop (recomendada, la más fácil)

1. Descargá **GitHub Desktop** desde https://desktop.github.com y logueate con tu
   cuenta de GitHub (si no tenés cuenta, creala gratis en https://github.com).
2. `File → Add Local Repository…` y elegí la carpeta `mateu-sports-portal`.
   Te va a decir que no es un repo: tocá **"create a repository"**.
3. Dejá el nombre `mateu-sports-portal`, marcá que sea **Private** y dale
   **Create Repository**.
4. Arriba vas a ver "Publish repository" → tocálo. Confirmá **Keep this code private**
   y **Publish**.
5. Listo: tu código ya está en GitHub.

### Opción B — Por la web (sin instalar nada)

1. Entrá a https://github.com/new, nombre `mateu-sports-portal`, marcá **Private**,
   **Create repository**.
2. En la pantalla siguiente: **"uploading an existing file"**.
3. Arrastrá **todo el contenido** de la carpeta `mateu-sports-portal` (incluidas las
   subcarpetas) a la zona de upload.
4. Abajo, **Commit changes**.

> ⚠ Si usás la web, asegurate de que se suban las **subcarpetas** (no solo el
> `index.html` de la raíz). GitHub Desktop maneja esto solo, por eso es más cómodo.

---

## Paso 2 — Conectar Netlify al repo

1. Entrá a https://app.netlify.com → **Add new site → Import an existing project**.
2. Elegí **GitHub** y autorizá (si te lo pide).
3. Seleccioná el repo **`mateu-sports-portal`**.
4. Configuración del deploy — dejalo así:
   - **Branch to deploy:** `main`
   - **Build command:** (vacío)
   - **Publish directory:** `.` (un punto, la raíz)
5. **Deploy site**.

En ~30 segundos tenés tu portal online en una URL tipo
`https://nombre-random.netlify.app`. Podés cambiarle el nombre en
**Site configuration → Change site name** (ej: `portal-mateusports`).

---

## Paso 3 — Cómo actualizar de ahora en más

Esta es la parte buena del setup. Cuando cambies cualquier herramienta:

1. Editás el archivo en tu compu.
2. **GitHub Desktop:** escribís un resumen abajo a la izquierda → **Commit to main**
   → **Push origin**. *(O por la web: subís el archivo nuevo y commit.)*
3. Netlify detecta el push y **republica solo**. No tenés que entrar a Netlify.

Cada cambio queda en el historial de GitHub, así que siempre podés volver atrás.

---

## Usuarios y accesos del portal

Se editan en el `<script>` arriba del archivo **`index.html`** (raíz). Está todo
comentado. Tres bloques:

- `USERS` → quién entra y con qué contraseña.
- `ROLE_ACCESS` → qué herramientas ve cada rol.
- `TOOLS` → nombre, descripción e ícono de cada herramienta.

Usuarios que vienen por defecto (**cambiá las contraseñas**):

| Usuario | Contraseña | Rol | Ve |
|---|---|---|---|
| `juli` | `mateu` | Administrador | las 4 |
| `david` | `producto` | Área de Producto | condiciones, marcas, equipo |
| `daniel` | `producto` | Área de Producto | condiciones, marcas, equipo |
| `deposito` | `deposito` | Depósito | turnero, equipo |

> 🔒 **Importante sobre el login:** es un control de acceso *blando*. Las contraseñas
> viajan dentro del código, así que sirve para **ordenar** quién usa qué, no como
> seguridad real (alguien técnico podría ver las contraseñas o entrar directo a
> `/turnero/`). Para la mayoría de los usos internos alcanza. Si algún día necesitás
> seguridad de verdad (datos sensibles, usuarios externos), eso se hace con
> **Firebase Authentication**, y lo vemos en ese momento.

---

## ¿Y los sitios viejos de Netlify?

`turnero-mateusports.netlify.app` y `asignacion-marcas.netlify.app` van a seguir
funcionando: no se rompen. Cuando confirmes que todo anda desde el portal nuevo,
podés:

- **Dejarlos** como están (no molestan), o
- **Apagarlos** en Netlify para no duplicar, o
- Mantenerlos como respaldo un tiempo.

Como el Turnero y Marcas comparten la **misma base de Firebase**, el sitio viejo y
el nuevo leen y escriben los mismos datos. No se duplica ni se pierde nada.

---

## Presupuesto de Compras (`presupuesto/`) — persistencia con Firebase

El módulo `presupuesto/index.html` guarda sus líneas (presupuesto vs. ejecutado por
proveedor/rubro/categoría/período) en **Firebase Realtime Database vía REST**, igual
que el resto de los módulos (marcas, pedidos-semanales, evaluaciones, etc.). No usa
backend propio ni Cloudflare KV: se deploya solo con el push, sin tocar el dashboard.

Toda la data va como un array bajo el nodo `/presupuesto.json` de su base. El objeto
`Store` del front solo hace `GET`/`PUT` a esa URL; si la red falla o la URL todavía
no está cargada, **cae a `localStorage`** para no perder lo cargado.

### Puesta en marcha (una sola vez, lo hace Juli)

1. En la **consola de Firebase**, creá una Realtime Database nueva para este módulo
   (sugerido: proyecto/base `presupuesto-mateu`). Copiá su URL, del tipo
   `https://presupuesto-mateu-default-rtdb.firebaseio.com`.
2. Poné las **reglas abiertas** (`.read` y `.write` en `true`), como el resto de los
   módulos (seguridad "blanda", ordena accesos, no es auth real).
3. Pegá esa URL en la constante **`FIREBASE_URL`** arriba del `<script>` de
   `presupuesto/index.html`.
4. Commit + push a `main` → Cloudflare republica en ~30s y el módulo queda guardando
   en Firebase.

Mientras `FIREBASE_URL` esté vacía, el módulo funciona igual pero guardando solo en
`localStorage` (por navegador). Al pegar la URL pasa a Firebase (compartido entre
dispositivos y personas).
