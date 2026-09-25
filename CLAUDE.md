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
├── equipo/             # Área de Producto: F8s de David/Daniel (Firebase turnero-mateu, nodo equipo/); reseteado a cero 24/08/2026
├── turnero/            # Turnero de proveedores (Firebase + EmailJS)
├── marcas/             # Asignación de Marcas (Firebase REST)
├── gestion-stock/      # Discontinuos por sucursal + Reporte Mensual + Meses de Stock
├── pedidos-semanales/  # Reposición semanal por sucursal y aprobaciones de Producto
├── managment/          # Desarrollo, OC y seguimiento de ingresos por proveedor
├── diagonal80/         # Apertura Diagonal 80 (propuesta vs. capacidad)
├── ubicaciones/        # "Buscador de Artículos": ubicaciones de depósito por sucursal
├── indicadores/        # Indicadores de Sucursal: UPT, tickets/hora, ticket promedio + meses de stock, por sucursal y persona. Es la HOME de los roles sucursal/outlet.
├── data/indicadores/   # salida particionada (un JSON por sucursal + cadena.json) que consume el módulo
├── regalias/           # Liquidador de Regalías RUGE/EDLP (Estudiantes): clasifica ventas, aplica escalas, exporta el Excel del mes y genera la presentación comercial (plantilla-presentacion.html, embebida en index.html)
├── evaluaciones/       # Evaluaciones de Supervisor: carga semanal operativa+actitudinal por sucursal, ranking, gráficos y vista de encargado. Escribe a Firebase (base evaluaciones-mateu). Ver "Evaluaciones de Supervisor" abajo.
├── barrida/            # «Reparto de Mercadería» (ex Análisis de Reserva Depósito Central): pestaña «Barrida de reserva» (cruce semanal de la reserva del depósito con las ventas por sucursal → reposición posible y reserva parada) y pestaña «Reparto inicial» (lo que entró, remito por remito, desde la estadística de remitos). Firebase: reusa recepciones-mateu (nodo barrida/). Ver "Análisis de Reserva Depósito Central" y "Reparto inicial" abajo.
├── objetivos/          # Objetivos de Venta Semanal: gerencia carga el objetivo (Meta) de venta por sucursal por semana (subiendo el Excel "PMS Objetivos" o a mano) → dashboard vs. real; cada sucursal ve su objetivo en Indicadores. Firebase: reusa recepciones-mateu (nodo objetivos/). Ver "Objetivos de Venta Semanal" abajo.
├── capacitaciones/     # Academia de Ventas FUNCIONAL: cursos y programas del capacitador, avance por persona con quiz, certificados, equipo/ranking y encuestas. Ver "Academia de Ventas" abajo. (Las pantallas .dc.html son el prototipo original de Design; quedan de referencia.)
├── tareas/             # Tareas de la Sucursal: Cambio de precios, Sectores de marcas, Limpieza (checklist) y Vidrieras (alerta por días sin cambios), con foto antes/después y comparativa. Firebase: reusa recepciones-mateu (nodo tareas/). Ver "Tareas de la Sucursal" abajo.
├── logistica/          # Envíos e Ingresos: dashboard de logística (unidades enviadas a cada sucursal + ingresos al depósito por mes/rubro/subrubro/disciplina/marca). Pantalla inicial de logistica@ y deposito@. Firebase: reusa recepciones-mateu (nodo logistica/). Ver "Envíos e Ingresos" abajo.
├── reviews/            # Reseñas de Google por sucursal: buenas/malas, captación sobre tickets y evolución mes a mes, con estética de ficha de Google. Solo lectura; los datos salen del Excel de Iván vía scripts/gen-reviews.py. Ver "Reseñas de Google" abajo.
├── functions/api/      # Pages Functions: publicar-stock, academia-ia y asistente (Matts). Ver "Matts" abajo.
├── lib/                # código JS común versionado y testeable (hoy: evaluacion.js = cálculo puro de Evaluaciones + tests con node --test)
└── shared/             # código común del shell (calendario retail, etc.)
```

## Convención principal — NO romper

Cada herramienta es **un único `index.html` self-contained**: HTML + CSS + JS
todo inline, sin build, sin bundler, sin dependencias de node. Las libs externas
(fuentes de Google, xlsx, etc.) entran por `<link>`/`<script src>` desde CDN.
El logo de Mateu va **embebido como data URI base64** (no como archivo suelto).

Al editar: trabajar siempre dentro del `index.html` de la herramienta. No partir
en múltiples archivos salvo que se decida explícitamente centralizar algo en
`shared/`.

**Íconos = SVG, no emojis.** Windows 7 y navegadores viejos no dibujan los emojis
a color (salen como recuadros □). Por eso `shared/iconos.js` reemplaza al vuelo
todos los emojis del DOM por su SVG inline equivalente (self-contained, sin CDN,
con MutationObserver para lo que se genera por JS). **Todo módulo nuevo debe
incluirlo** con una línea en el `<head>`: `<script src="../shared/iconos.js" defer></script>`
(en el Portal raíz la ruta es `shared/iconos.js`). Se pueden seguir usando emojis
en el código como hasta ahora: el script los convierte. Si falta un ícono nuevo,
sumar la entrada al mapa `ICONS` de ese archivo.

**Header unificado del shell (`shared/header.js`).** Todos los módulos usan el
mismo header que Indicadores: botón **Menú** rojo (abre el drawer lateral con
las herramientas de la sesión), logo centrado que vuelve al Portal y el
calendario retail a la derecha. Se incluye con una línea en el `<head>`:
`<script src="../shared/header.js" defer></script>` (después de `iconos.js`).
El script inyecta header + drawer + calendario solo; clases con prefijo `msh-`
y publica la variable CSS `--msh-h` (alto real del header) para que las barras
sticky del módulo cuelguen de `top:var(--msh-h,67px)`. Los controles que antes
vivían en el header propio van en una barra secundaria `.msh-subbar`; los nodos
que el JS del módulo sigue escribiendo (whoName, salir, etc.) quedan como stubs
ocultos. Herramienta nueva → sumar la entrada al mapa `TOOLS` de `header.js`
(y del Portal e Indicadores). **Indicadores y el Portal raíz tienen su header
propio: ahí NO se incluye.**

## Stack — quién hace qué

- **GitHub** → guarda el código y el historial.
- **Cloudflare Pages** → publica el sitio; **deploya solo con cada push** a `main`.
- **Firebase (Realtime Database vía REST, sin SDK)** → los datos en vivo, un
  proyecto por dominio: `discontinuos-mateu` (usuarios del portal + gestión de
  stock), `asignacion-marcas-mateu`, `pedidos-semanales-mateu`,
  `ubicaciones-mateu` (Buscador de Artículos) y el del turnero.
  `regalias/` guarda en **`recepciones-mateu`, nodo `regalias/`** (10/09/2026): `ledger`
  (acumuladores por temporada), `keywordsEDLP` y `liquidaciones/<YYYY-MM>` (líneas ya leídas +
  asignaciones a mano de cada mes liquidado; índice liviano en `liquidacionesIdx`). Al entrar se
  reabre la última liquidación, así recargar la pestaña no obliga a cargar todo de nuevo. Se guarda
  como «borrador» al liquidar y como «guardada» con «Guardar mes en el ledger» (un mes guardado solo
  se pisa con ese botón). localStorage queda como copia del navegador; el ledger viejo de cada
  navegador se fusiona a la base una sola vez (`regalias_ledger_migrado`).
  `condiciones/` usa **localStorage** (no tiene backend). `equipo/` guarda los
  F8s y el control manual en la base del turnero (`turnero-mateu`, nodo `equipo/`).
  `evaluaciones/` escribe a su propia base Firebase `evaluaciones-mateu`.
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
(`admin` | `sucursal` | `outlet` | `supervisor` | `capacitador` | `deposito` | `puesto`),
su `sucursal`/`outlet_id` y la lista `herramientas`, que define qué tiles ve.

**Roles operativos de sucursal (24/08/2026)** — la cuenta `sucursal` queda para
encargado/subencargado (es la única que ve Mi Sucursal):
- **`deposito`** (p.ej. `NN-deposito@`): opera el Buscador de Artículos con todo
  (asignar/desasignar, cargar stock del día, editar estanterías) + las herramientas
  que se le asignen, pero **NUNCA `indicadores`** (se filtra en
  `herramientasEfectivas` y el propio módulo lo rebota). NO administra perfiles
  (`canManage` false; cargar stock/estanterías usa `canStock`). Su home es la
  grilla del Portal.
- **`puesto`** (p.ej. `NN-consulta@`): quiosco del salón a la vista de clientes.
  El Portal lo redirige SIEMPRE a `ubicaciones/` (también con `?ver=bandeja`);
  `header.js` no le monta Menú/drawer y el logo va sin link; `tutorial.js` no
  aparece. En el Buscador: solo pestaña Buscar, sin perfiles fijos; puede
  **comentar** artículos eligiendo qué perfil firma (la selección se olvida al
  cerrar la hoja). «Salir» pide el **PIN de la cuenta** antes de cerrar la
  sesión (`salirPuesto`), así un cliente no desloguea el quiosco. Ya no hay contraseñas en el código:
la config del `<script>` es `TOOLS` (nombre, ícono y url de cada herramienta)
y las listas de sucursales/outlets.

- **Orden del panel de las sucursales (07/09/2026)**: las cuentas `sucursal`/`outlet` ven
  tiles y drawer siempre en el mismo orden, el que tenía Diagonal 80: Mi Sucursal → Buscador →
  Marcas → Gestión de Stock → Pedidos Semanales → Evaluaciones → Tareas; lo demás va después.
  Lo fija `ORDEN_SUCURSAL`/`ordenarSucursal` dentro de `herramientasEfectivas` (solo ordena,
  no agrega herramientas; `inicio` sigue mandando). No depende del orden guardado en `usuarios/`.
- La sesión queda en localStorage (`mateu_portal_session`). Los módulos **no
  tienen login propio**: leen esa sesión y redirigen a `../` si falta o si el
  usuario no tiene la herramienta asignada.
- Gestión de usuarios (alta, herramientas, reseteo de PIN): ícono ⚙ del portal,
  visible solo para `julian@mateu.com.ar` (`ADMIN_SETTINGS_EMAIL`).
- **Pantalla inicial y tiles acotados por usuario (03/09/2026)**: dos campos opcionales
  del registro en `usuarios/`, editables desde el ⚙ (columna «Pantalla inicial» y check
  «Solo estas» en admins, también en el alta). `inicio` = clave de `TOOLS` a la que el
  Portal redirige al entrar (`toolInicio()` en `render()`; tiene que estar entre sus
  herramientas; `?ver=bandeja` y `?ver=portal` no redirigen, y «← Volver» de la Bandeja
  vuelve ahí). `soloHerramientas:true` = un **admin** ve SOLO las herramientas marcadas,
  en ese orden, en vez de todas (`herramientasEfectivas`). Caso de uso: `producto@` es
  admin (lo exigen el Control de Pedidos Semanales y el Dashboard de stock) pero su
  Portal es Área de Producto + Marcas + Gestión de Stock + Pedidos Semanales, con Área
  de Producto como inicio. Los campos se leen al loguearse (sesiones ya abiertas los
  toman al volver a entrar). El nombre del usuario en drawers/mensajes (`nombreCorto`, 4
  copias: Portal, `header.js`, Indicadores, `notificaciones.js`) escribe «RRHH» en mayúsculas.
  **Perfiles fijos en el código** (`PERFILES_FIJOS` en el
  `index.html` raíz, pedido de Juli 04/09/2026): pisan esos tres campos al loguearse y al
  normalizar una sesión abierta, así no dependen del ⚙ (la fila del ⚙ lo avisa). Hoy:
  `producto@` (las 4 herramientas de arriba, inicio Área de Producto), `rrhh@` (solo
  Recursos Humanos, inicio ahí) y `capacitaciones@` (solo Academia de Ventas, inicio ahí;
  07/09/2026 — ese día la cuenta se renombró de `capacitacion@` a `capacitaciones@`).
- **Bandeja de entrada — quién publica (04/09/2026)**: en el **Tablero** y en los **avisos**
  de la campana solo escriben los mails de `PUBLICAN_TABLERO` (`index.html` raíz:
  julian@, cristian.campion@ y rrhh@; helper `puedePublicarTablero`). El resto lee el
  tablero, ve una nota y usa Directos. Es «por ahora»: para abrirlo, sumar mails a la
  lista. Los módulos que publican avisos solos (reporte semanal de equipo/, Academia) no
  pasan por ese filtro. La base `mensajes-mateu` se **reinició** ese día (tablero, directos,
  avisos y lecturas borrados; respaldo en `Descargas/respaldo-mensajes-mateu-2026-09-04.json`).
- **Diseño de la Bandeja (05/09/2026)**: pestañas segmented; el **Tablero es un muro**
  (tarjetas `.post` más nuevo arriba, avatar con iniciales `avatarHtml`, etiqueta del autor
  `ETIQ_AUTOR` —Gerencia/Supervisor/RRHH—, chip de destino, «nuevo» = posterior a la
  última lectura; la caja de publicar `.tb-compose` elige destinatarios con **chips**
  `MSG_DEST` + select para sumar una sucursal/outlet puntual). **Directos** es una sola
  tarjeta `.dm-wrap` con lista (avatar, hora, no leídos) + conversación con separadores
  por día (`diaEtiqueta`) y textarea que crece (`autoGrow`). Horas en 24 hs (`fechaBonita`).
- El acceso a localStorage está envuelto en try/catch para no romper en
  previews sin storage. Mantener ese patrón.
- **Bloqueo por inactividad (04/09/2026, `shared/bloqueo.js`)**: las cuentas de encargado
  (roles `sucursal`/`outlet`) que pasan **5 minutos** sin actividad en cualquier módulo ven
  una cortina navy y tienen que ingresar el PIN de la cuenta para seguir (la sesión no se
  cierra; lo que estaban haciendo queda igual). `header.js` lo carga solo en todos los
  módulos con header unificado; el Portal e Indicadores lo incluyen con una línea en el
  `<head>`. Última actividad y estado bloqueado en localStorage (`mateu_bloqueo_act` /
  `mateu_bloqueo_lock`, compartidos entre pestañas; el Portal los limpia al entrar/salir).
  PIN validado contra `usuarios/<mail>` como el login. Minutos y roles se cambian en las
  constantes del script o con `window.MATEU_BLOQUEO = {minutos, roles}` antes de cargarlo.
  `puesto`, `deposito` y gerencia no se bloquean.

## Dispositivos autorizados y PIN nuevo obligatorio (`shared/acceso.js`, 21/09/2026)

Pedido de Juli: que un encargado no pueda pasarle usuario y PIN a alguien de afuera (caso: un ex
supervisor). Sigue siendo seguridad **blanda** (todo en el cliente, bases con reglas abiertas): frena
a quien recibió un usuario y un PIN, no a un programador. La barrera dura (login en una Pages
Function + reglas de Firebase cerradas) queda como etapa futura.

- **Dispositivo autorizado**: las cuentas de los locales (`ROLES` = sucursal · outlet · deposito ·
  puesto) solo entran desde un dispositivo aprobado. El dispositivo es un id al azar en localStorage
  (`mateu_dev_id`; código corto de 4 letras = `Acceso.codigo()`, para confirmarlo por teléfono).
  Primer ingreso desde uno nuevo → queda `pendiente`, la pantalla de ingreso muestra «Dispositivo sin
  autorizar» con el código y botón Reintentar, y sale un directo por la Bandeja a `APRUEBAN`
  (julian@ y cristian.campion@). El resto de los roles no se bloquea: solo se registra el ingreso.
- **Panel 🔒 Dispositivos** (botón en el header del Portal, solo `APRUEBAN`, con badge de pendientes;
  link directo `./?ver=portal&disp=1`; `openDispositivos`/`renderDispositivos`): aprobar / rechazar
  pendientes, bloquear u olvidar dispositivos por cuenta, **«⏻ Cerrar sesiones»** de una cuenta
  (`accesos/cierre/<mailKey>` = ts: toda sesión con `loginTs` anterior vuelve al ingreso; los
  dispositivos siguen aprobados) y los últimos 100 ingresos del mes (entró · sin autorizar ·
  bloqueado · PIN equivocado).
- **Sesiones abiertas**: `header.js` carga `acceso.js` solo (Portal e Indicadores lo incluyen a mano,
  SIN defer). En cada carga de página `Acceso.revalidar()` confirma (a lo sumo una vez por minuto) que
  el dispositivo siga aprobado y que no haya un cierre posterior al ingreso; si no, borra la sesión y
  manda al Portal con el motivo (`mateu_acceso_msg` → `Acceso.MENSAJES`). Sin conexión no toca nada.
  La sesión lleva `acc` (= devId) y `loginTs` (`Acceso.sellar`); una sesión con `acc` de otro
  dispositivo (localStorage copiado) se cierra. **Las sesiones que ya estaban abiertas al activar el
  control se dieron por buenas** (decisión de Juli): registran su dispositivo solas como aprobado con
  `origen:'previo'` hasta `GRACIA_HASTA` (29/09/2026); después, sesión sin sello = volver a entrar
  (y pedir aprobación). Revisar esos «ya estaba adentro» en el panel y bloquear lo que no corresponda.
- **PIN nuevo obligatorio**: toda cuenta sin `usuarios/<mail>/pinCambio` ≥ `PIN_DESDE` (21/09/2026)
  tiene que crear su PIN al entrar (`pedirPinNuevo` en el Portal: 4 dígitos, distinto del actual, no
  de la lista `PIN_FACILES`). Va DESPUÉS del chequeo de dispositivo, así alguien de afuera no llega a
  cambiarle el PIN a una cuenta. Las sesiones abiertas también: `revalidar` consulta `pinCambio` y
  manda al ingreso (flag local `mateu_pin_ok` para no consultar más). «Resetear PIN» del ⚙ borra
  `pinCambio` (vuelve a 1111 y obliga a crear uno). Para obligar a todos de nuevo: subir `PIN_DESDE`.
  **Los puestos de consulta no cambian PIN** (`PIN_SIN_CAMBIO`): quedaron todos en **1905** (16
  cuentas, 21/09/2026; respaldo de `usuarios/` en `Descargas/respaldo-usuarios-2026-09-21.json`).
- **Clave maestra (21/09/2026, pedido de Juli)**: con el **mail de cualquier cuenta + el PIN PROPIO** de
  alguien de `MAESTRAS` (`shared/acceso.js` y copia en `lib/acceso-servidor.mjs`) se entra a esa cuenta,
  sin pedir dispositivo aprobado ni PIN nuevo. Alcance: **julian@ = `todas`** las cuentas;
  **cristian.campion@ = `locales`** (sucursal · outlet · deposito · puesto · deposito-tablet; no abre
  rrhh@/producto@ porque sería subirle el rol — para abrirlo, pasar su entrada a `'todas'`). Nunca abre
  la cuenta de otro de la lista. **Vale desde CUALQUIER dispositivo** (Juli, 23/09/2026: «al igual que
  yo, Cristian tiene que poder entrar desde cualquier dispositivo aunque no esté autorizado»). Hasta ese
  día exigía un «dispositivo conocido» (donde ese mail ya había entrado con su cuenta, o aprobado para la
  cuenta destino) y por eso a Cristian no le abría nada: la anotación del dispositivo propio se lanzaba sin
  esperar y la redirección del Portal a Indicadores la cortaba. Ese candado se sacó; lo que queda: (1) el
  dispositivo que gerencia **bloqueó** para ese mail en el panel 🔒 (`accesos/dispositivos/<su
  mailKey>/<devId>` en `revocado`) no sirve — al entrar con su cuenta el dispositivo queda anotado con
  `origen:'propio'`, informativo, `verificarLogin` espera esa escritura y `revalidar` la repite una vez por
  pestaña; (2) no vale mientras el PIN propio esté sin renovar (`pinCambio` < `PIN_DESDE`); (3) con el
  ingreso por servidor, el tope de intentos por cuenta + IP. El error es el genérico. La sesión
  lleva `maestra:<mail>` (y el token `m`): `revalidar` no le pide dispositivo ni PIN nuevo, y se cierra
  con «⏻ Cerrar sesiones» de la cuenta o de quien entró. La cortina de inactividad y «Salir» del puesto
  (`verificarPin`) también la aceptan; `pin-cambiar` y `publicar-stock` NO. En el registro de ingresos
  sale «Clave maestra · entró <mail>» (`r:'maestra'`, `por`). Tests en `lib/acceso-servidor.test.mjs`.
- **Firebase** (`discontinuos-mateu`, nodo `accesos/`): `dispositivos/<mailKey>/<devId>` = `{estado:
  aprobado|pendiente|revocado, cod, etq, ua, alta, ultimo, origen: login|previo, por, en}`,
  `cierre/<mailKey>` y `log/<YYYY-MM>/<id>` = `{ts, mail, rol, dev, cod, etq, r: ok|pendiente|
  revocado|pin}`.
- **Ingreso por servidor — etapas 1 y 2 (21/09/2026, código listo; se activa cuando Juli cargue los
  Secrets, pasos en `docs/ACCESO-SERVIDOR-SETUP.md`)**. `functions/api/acceso.js` →
  `lib/acceso-servidor.mjs` (toda la lógica; `node --test lib/acceso-servidor.test.mjs`, base simulada).
  Secrets en Cloudflare Pages: `FIREBASE_SA` (JSON de la cuenta de servicio de discontinuos-mateu; la
  Function firma un JWT RS256 con WebCrypto y pide el access_token a Google; plan B `FIREBASE_SECRET`)
  y `SESSION_SECRET` (⚠ **no cambiarlo nunca**: firma los PIN; opcional `PIN_PEPPER`). Sin ellos `GET
  /api/acceso` → `disponible:false` y **todo sigue por el camino del navegador** (`Acceso.servidor()`
  lo averigua y lo recuerda 10 min; cada función tiene las dos ramas).
  **Etapa 1**: los PIN pasan a `usuariosPriv/<mailKey>` = `{h, cambio, ts}` (HMAC con el secreto, no el
  PIN) y salen de `usuarios/`, que sigue público para que los módulos resuelvan mails y roles. La
  migración es sola al primer ingreso de cada cuenta + botón ámbar **«Pasarlos al servidor»** en el ⚙
  (`avisoMigracionPin` → acción `migrar`, que además pone `accesos/config/migrado:true`: desde ahí un
  `pin` escrito en `usuarios/` ya no vale). Tope de intentos: 5 por cuenta+IP cada 15 min y 40 por
  cuenta por hora (`accesos/intentos/<mk>`). Acciones: `login` (PIN → dispositivo → `{usuario sin pin,
  debeCambiarPin, token}`; el token no se entrega hasta cambiar el PIN), `pin-cambiar`,
  `pin-verificar` (lo usa `Acceso.verificarPin`: cortina de `bloqueo.js`, «Salir» del puesto y del
  kiosco) y `pin-reset` (solo julian@: 1111, o 1905 en el puesto; también da el PIN inicial en el alta).
  `publicar-stock.js` valida con la misma librería. **Etapa 2**: `accesos/` solo se toca desde la
  Function: `estado` (la revalidación de la sesión abierta y la gracia de las previas), `disp-lista`,
  `disp-set` y `cierre` exigen el **token de sesión** (HMAC, 30 días, va en `session.tok`) de un mail
  de `APRUEBAN`; una sesión vieja sin token tiene que salir y volver a entrar para administrar.
  Reglas finales de la base (último paso del setup): `usuariosPriv` y `accesos` cerrados y `"$otro"`
  abierto (una regla abierta en la raíz no se puede cerrar más abajo). Las constantes de roles/fechas
  están duplicadas en `shared/acceso.js` y en la librería: mantener en sintonía.
- Las pantallas compartidas no cambian PIN: `PIN_SIN_CAMBIO` = puesto y deposito-tablet.
  `recepciones/control` incluye `acceso.js` (para validar el PIN de «Salir» por servidor).
- No cubierto (etapa 3, sin empezar): los DATOS. `usuarios/` sigue escribible y cada módulo lee y
  escribe Firebase directo con reglas abiertas; la sesión vive en localStorage. Cerrarlo = Firebase
  Auth con token emitido por el login + reglas por base, empezando por RRHH.

## Branding / design tokens

Paleta Mateu Sports: **navy `#0B1527`**, **rojo `#CC0000`**, blanco, fondo
`#f5f7fc`. Tipografías: **Bebas Neue** (display), **Barlow Condensed**
(subtítulos/labels), **Barlow** (texto). Estética: minimalista, alta densidad
de información, limpia. Header navy con borde inferior rojo de 3px.

Nota: `condiciones/` es más viejo y usa navy `#002366` + fuente Inter. Si se
rediseña, alinear a los tokens de arriba; si no, dejarlo como está.

## Reporte Mensual de stock — presentación pública

La presentación del mes (`gestion-stock/?pres=YYYY-MM`, deck generado desde
`gestionStock/<ym>` de Firebase) es **pública**: no pide sesión del Portal
(pedido de Juli 03/09/2026: David comparte el link con gente que todavía no
tiene usuario). En `init()` el chequeo de `?pres=` va ANTES del gate de sesión;
el resto del módulo sigue gateado. El deck solo muestra agregados del mes.

**Diseño del deck (03/09/2026, `gsPresHtml` + `gsPresTot`):** **todo en claro, portada
incluida** (04/09, pedido de Juli: se probó navy, carbón y tapa navy + cuerpo claro; quedó
unificado en claro, mismo fondo `#f5f7fc` del portal): tarjetas blancas, texto navy, cabeceras
de tabla en dos filas (indicador + unidad) y totales **neutros** (gris, sin navy ni rojo), logo
en oscuro. **Sellos Mateu** tipo certificado (`sello()`: SVG con anillo de texto) en la portada
(logo + «datos certificados» + fecha de carga), en cada bloque (con su número) y en el pie.
Tablas sin barras dentro de las celdas; los chips de variación llevan signo («▲ +55» /
«▼ −115») y cada tabla cierra con la leyenda de lectura (`tblLegend`). En Indicadores, la
tabla **«Discontinuos mes a mes»** (`discMM`: una columna por informe cargado, celda
sombreada por magnitud, «Repite N de M» y punto rojo para las sucursales con discontinuos en
todos los informes; `gsPresTot` expone `disc` por slug).
**Variación del ratio (06/09, pedido de Producto):** en «Meses de stock» cada ratio lleva
al lado el chip `msVar` con la variación % vs. el mes anterior cargado («▲ +12%» / «▼ −8%»,
columna «vs. Jul 26» en la tabla, total y «Cobertura total» del rubro). El color NO sigue la
regla «más = peor»: verde si se acercó al rango saludable (3 a 5), rojo si se alejó, gris si
se movió dentro del rango o no cambió; sin mes anterior sale «—». El ratio por sucursal del
mes previo viaja en `gsPresTot(...).msSuc[rubro][slug]` (el `hist` de las sparklines).
**Foco del mes (06/09, pedido de Juli): el Reporte Mensual es la base de trabajo de Daniel
y David.** `shared/foco-stock.js` (`window.FocoStock`, se incluye SIN `defer`) calcula desde
`mesesStock` del mes + los ratios del anterior, con las reglas del deck (< 3 riesgo · 3 a 5
saludable · ≥ 6 exceso; el Depósito se excluye): por rubro, **Achicar stock** (≥ 6, con las
unidades por encima de 6 meses de venta), **Reponer** (< 3, con lo que falta para 3 meses) y
**Vigilar** (en rango pero pegada al borde y moviéndose para el lado malo). Operadores fijos en
`OPERADORES`: Daniel → calzado; David → indumentaria + accesorios. Se ve en dos lugares:
(1) el deck, bloque `.foco` al pie de cada rubro (`focoHtml`), de solo lectura; (2) **`equipo/`
(la pantalla inicial de `producto@`)**, sección «Foco del mes» arriba del Dashboard
(`cargarFocoMes`/`renderFocoMes`: baja el último `gestionStock/<ym>/mesesStock` y el anterior),
una tarjeta por operador con **checklist** (✓ trabajada + ✎ nota) y progreso «N/M trabajadas».
El checklist se comparte en `turnero-mateu/equipo/foco/<ym>/<rubro>__<slug>` =
`{hecho, nota, por, ts}`. El generador `scripts/gen-presentacion-stock.js` carga el helper
antes del script del módulo.
**Regla de color (04/09):** navy = magnitud (barras Top 5, barras bajo los números, stock
apilado navy+acero, óptimo/saludable), **rojo solo alerta** (crítico, exceso, ▲ empeoró),
ámbar la zona intermedia y un verde apagado únicamente en ▼ mejoró. Clase `.f-nav` para las
barras de magnitud;
números en Saira itálica 800 (la tipografía «rendimiento» del módulo), KPIs con
conteo animado, delta ▲/▼ (más = peor, rojo) y **sparkline de los últimos 6 meses
cargados** (`gsRenderPresentacion` baja los meses anteriores para la tendencia);
paneles «Top 5» por indicador; tablas con barra proporcional al máximo de la columna
y chips de variación; horas de descarga con guías de 55/80 hs y promedio; meses de
stock como gráfico de zonas (escala 0–12, flecha si se pasa) + tabla. Animaciones
por IntersectionObserver con fallback (Win7) y `prefers-reduced-motion`; imprime
con todo visible. Para probar el diseño sin navegador ni sesión:
`node scripts/gen-presentacion-stock.js 2026-09 salida.html` (ejecuta el script del
módulo con un DOM simulado y datos reales de Firebase).

## Presentación de regalías — publicar en Cloudflare (`regalias/`, 10/09/2026)

La presentación del mes se comparte por link desde un **proyecto aparte de Cloudflare Pages por
subida directa**, `regalias-ruge-mateu` → https://regalias-ruge-mateu.pages.dev. **NO se commitea al
portal**: el repo `julianmatts/mateu-sports-portal` es público y la presentación es confidencial
(Netlify quedó sin créditos, por eso no se usa). En el paso ⑦, además de «Generar presentación
(.html)» (para verla local), está **«☁ Publicar en Cloudflare»** (`publicarPresentacion`): en el
mismo clic abre `CF_PAGES_DASH` (`dash.cloudflare.com/?to=/:account/pages/view/<proyecto>`, sin ID de
cuenta en el código) y baja `regalias-<mes>-<año>.zip` con la presentación como `index.html` (el
navegador no puede bajar una carpeta y Pages acepta un único zip; `zipUnArchivo` + `crc32` = zip sin
comprimir, sin librería). El panel `#pubPasos` indica Create deployment → soltar el zip → Save and
Deploy, con «Copiar link». Publicar un mes reemplaza al anterior (el link es uno solo).

## Entregas EDLP (pestaña de `regalias/`, 06/09/2026)

Digitaliza el Excel «RUGE 2026 – Seguimiento de Entregas por Canal» de Juli (carpeta
`Desktop/EDLP 2026/Control Entregas EDLP 2026- Segumiento por Canal/`). El módulo
`regalias/` tiene ahora **dos pestañas** (`.mtabs`, sticky bajo el header): «⚽ Liquidación de
regalías» (todo lo de siempre, envuelto en `#vistaLiq`) y «📦 Entregas EDLP» (`#vistaEnt`;
link directo `regalias/?tab=entregas`; la última pestaña queda en localStorage `regalias_tab`).
Código en el mismo `index.html`, bloque «ENTREGAS EDLP» (funciones con prefijo `en`).

- **Modelo**: `articulos/<id>` = maestro de la temporada (código, artículo, color, género,
  silueta, origen, proveedor, línea, `oc:{'2026-01':n}` = orden de compra por mes,
  `pedido:{spf,tp,plantel,fem,res,juv,prot}`, `noSuma` (las medias tubo del Excel:
  «NO SUMA UNIDADES»), `nota`, `orden`, `nuevo`). La **ENTREGA no se tipea**: es la suma de
  `entregas/<id>` = movimientos `{art, canal, codigo, cant, comprobante, fecha, nota, origen:
  excel|import|acum|manual, por, ts, archivo}`. Resta = pedido − entrega (negativa = se
  entregó de más). `id` del artículo = código (`RUG858`); sin código → `X-<slug del nombre>`.
- **Canales** (`EN_CANALES`): Mayoristas = SuperFútbol (`spf`) y TiendaPincha (`tp`); Contrato
  = Plantel Prof. (`plantel`), Femenino (`fem`), Reserva (`res`), Juvenil (`juv`), Protocolo
  (`prot`). `EN_ALIAS` traduce lo que dice el sistema (categoría del remito «FUTBOL
  PROFESIONAL»/«FPF», «FF», «FJ»… o el cliente «SUPERFUTBOL S.R.L.-…») a canal; PRENSA /
  FOTOGRAFÍA no tienen canal (se eligen a mano o quedan afuera, como en el Excel).
- **Vistas**: Resumen (KPI por canal = hoja RESUMEN ENTREGAS, pendientes y últimas entregas),
  Control general (grilla artículo × canal Pedido | Entrega | Resta, **pedido editable en la
  celda**, clic en Entrega = detalle/alta, filtro por línea/canal/estado, «Ver OC por mes»,
  ⇩ Excel), Por canal (= hojas «ANÁLISIS <canal>»: KPIs + apertura por línea con estado),
  Entregas (ledger: **⇧ Importar del sistema** / + Cargar a mano / ✎ ✕) y Artículos y OC
  (maestro + **⇧ Importar el Excel de seguimiento**, que lee la hoja CONTROL GENERAL y
  actualiza artículos/OC/pedidos sin pisar entregas; opción de cargar la columna ENTREGA como
  saldo inicial solo donde no hay nada).
- **Importar del sistema** (`enDetectarEntregas`): detecta por contenido columna(s) de código
  `RUGnnn`, cantidad, comprobante (`Rem.`/`Fc.`), categoría/cliente (con arrastre hacia abajo
  en pivots) y descripción; soporta el export de remitos (Categoría · Nro comprobante · Código
  · Cantidad), el listado Cliente · Artículo · Código · Cantidad y los pivots por cliente
  (varios bloques por hoja, cada uno con su cliente arriba). **Dedupe** por canal+comprobante+
  código. Check «El archivo trae el acumulado a la fecha» (auto si no hay comprobante y dice
  «Suma de…»): carga solo la **diferencia** contra lo ya entregado (así se replica el VLOOKUP
  al pivot de MAYORISTAS del Excel sin duplicar). Códigos desconocidos crean el artículo
  marcado «NUEVO».
- **Firebase**: reusa `recepciones-mateu`, nodo aparte `entregasEdlp/<temporada>/`
  (`EN_DB` + `enNodo()`; temporada = `CONFIG.temporadaVigente`). Sembrado el 06/09/2026 desde
  el Excel «al 03-06-26»: 92 artículos, 241 entregas como «Saldo inicial · Excel de
  seguimiento» (fecha 29/06/2026); totales validados exactos contra el Excel (25.152 pedido /
  21.297 entregado). La fila duplicada «calzas cortas arquero 3» del Excel se cargó como
  «calza larga arquero 3».
- **Clientes del sistema (Juli, 09/09/2026 — no confundir)**: `SUPERFUTBOL S.R.L.-30709250716` es
  **«Pincha Store»**, el local físico del estadio (otro cliente) → canal `spf`; `CLUB ESTUDIANTES DE
  LA PLATA.-30528412285` es **«Tienda Pincha»**, la web de venta del club → canal `tp`; `CLUB
  ESTUDIANTES RUGE CONTRATO.-88888888` es el cliente con el que se remiten las entregas por contrato,
  **sin discriminar disciplina**. Los nombres de los canales en pantalla ya son esos (`EN_CANALES`
  lleva `cliente`); en el código los ids `spf`/`tp` no cambian.
- **Mapa remito → disciplina** (`entregasEdlp/<temporada>/remitos/<nro corto>` = `{canal, origen:
  drive|excel|manual, por, ts, nota}`; `canal:'x'` = fuera del control: prensa, fotografía, RRHH):
  resuelve la disciplina de cada remito del cliente del contrato. Fuente humana: el Drive «REMITOS
  ENTREGAS CONTRATOS RUGE 2026 → CONTRATO PROFESIONAL → <disciplina>» donde el depósito sube el
  remito firmado con el archivo nombrado por el número (`54096.jpg` = Rem.0094-00054096;
  `enNroRem` saca el número corto sin ceros). ⚠ **La lista de Drive se carga por partes al scrollear**:
  la primera lectura (09/09 mediodía) vio solo 27 de los 53 archivos de Fútbol Profesional; la
  relectura completa (09/09 noche, `tr[role=row][data-id]` + scroll de a 250 px) confirmó los 24
  remitos que había tomado del Excel y sumó la NcI 6708 → Plantel, 53920 (no está en el reporte) y
  54064 → carpeta «Campaña socios» = `x` (fuera del control, 50 RUG858 de julio). Mapa al 09/09/2026:
  Fútbol Profesional 52, Femenino 11, Reserva 11, Juvenil 5 (+ 53922 a mano, camisetas RUG259/261),
  Protocolo 3, **Prensa y fotografía** (`prensa`: 53866 + 53880) y **Campaña socios** (`socios`:
  54064): estas dos son disciplinas del contrato desde el 09/09/2026 (pedido de Juli, como Protocolo),
  así que `x` queda solo para lo que de verdad no entra (RRHH). Con eso el contrato concilia EXACTO
  con la estadística de ventas: 13.255 brutas.
- **Desborde entre renglones del contrato (regla de Juli 09/09/2026 para las medias)**: un renglón
  con `tomaDe:<id>` + `tomaArts:[…]` se llena primero, hasta su `cantidad`, con las unidades de esos
  artículos del otro renglón; el excedente queda en el origen (`enCalcContrato`, en orden de
  `orden`; la tabla muestra «← se completa con … · tomó N» y «→ cedió N»). Hoy: «media» y «media 2»
  (300 c/u) toman de «medias entrenamiento» (arts RUG942 + RUG943 + RUG533 pico) solo las comunes
  RUG942/943; la pico RUG533 solo cuenta como entrenamiento; las tubo (`noSuma`) no cuentan nunca.
  Se edita en el ✎ del renglón («Se completa con el excedente de otro renglón»). La misma regla
  existe **por artículo** para el control general / por canal (`enCalc`, campo `tomaDe:[ids]` del
  artículo, editable en el ✎ como «Se completa con la entrega de…»): la media de juego no existe como
  código (`X-MEDIA-…-HOME/AWAY`, nota «= media entrenamiento + tubo»), así que se completa canal por
  canal hasta su pedido con RUG943 / RUG942 y el excedente queda en la media de entrenamiento; las
  celdas muestran ↙N (tomó) / ↗N (cedió) y el detalle lo aclara. Las medias tubo figuran como
  constancia (cantidades por disciplina, en cursiva) sin sumar: bloque «MEDIAS TUBO» al pie de la
  tabla del contrato y filas `noSuma` en control general / por canal.
- «Por canal» lista todo lo que tiene pedido **o entrega** en el canal (los «sin pedido» también,
  p.ej. 2 manga larga + 2 crop en Protocolo), así el total de la tabla cierra con la tarjeta; se
  quitó el tilde «Solo artículos con pedido». `#vistaEnt.wrap` va a todo el ancho de la pantalla. Se edita en Entregas →
  **«🗂 Remitos → disciplina»** (`enModalRemitos`: cambiar la disciplina reescribe las entregas ya
  cargadas de ese remito; «fuera del control» las saca) y en la propia importación (elegir la
  disciplina en una fila la copia a las demás filas del mismo remito y queda guardada).
- **Reporte de ventas por cliente** («Reporte ventas ruge mayorista y contrato 2026.xlsx»: Cliente ·
  Día · Rubro · Nro.comprobante · Artículo · Código barras · una columna «Mes Cant.» + «Mes Imp.» por
  mes): el detector lo reconoce por la fila con ≥2 encabezados «… Cant.» (`mesCols`, `det.mensual`)
  y genera **un movimiento por mes** con `ym` y `fecha` = mes + Día; el cliente manda el canal
  (`EN_ALIAS` incluye los CUIT) y las filas del contrato pasan por el mapa. Las **variantes** de código
  (`RUG858SS`, `RUG844A`) suman al artículo base con nota «variante …» (check en la importación;
  desmarcado crean artículo). Las NcA/NcI vienen con cantidad negativa y entran como devolución.
  **El 09/09/2026 se reemplazó el saldo inicial del Excel por el reporte completo** (429 movimientos,
  24.291 u.; respaldo del saldo en el `seed-entregas-2026.json` de la sesión del 06/09): SuperFútbol
  4.019, Tienda Pincha 7.628, Plantel 9.013, Femenino 771, Reserva 648, Juvenil 975, Protocolo 154.
  Quedaron sin disciplina el remito 54064 (jul, 50 RUG858) y la NcI 6708 (−12 RUG887): la importación
  los vuelve a mostrar hasta que Juli los asigne. **Conciliación 09/09/2026 (tarde)**: mayoristas exactos
  (4.019 / 7.628); contrato 13.200 = 13.255 del reporte − 17 (prensa 53866 + fotografía 53880, fuera
  del control) − 38 (54064 y NcI 6708 sin disciplina). Ojo: `RX_COD` acepta hasta 3 letras al final
  (`RUG858SS` = sin sponsor, Femenino/Reserva); con `[A-Z]?` esos 35 renglones (556 u.) no entraban. 15 códigos del reporte no estaban en el maestro
  (RUG944–948, 957–959, 974/975, 464/466, 533, 601, 796) y se crearon marcados «NUEVO».
- **Vista «📜 Contrato» (09/09/2026)**: cruza el contrato oficial con lo entregado. **El contrato
  oficial es la «PROPUESTA DE SPONSOR TÉCNICO EdeLP – MATEU 2025 (07.10.2024)»** (docx en
  Descargas; cláusula 6.1: **13.000 prendas anuales sin cargo** según el ANEXO I = 50 renglones
  Tipo · Producto · Cantidad: Juego / Tiempo Libre / Entrenamiento). ⚠ No confundir con el
  «CONTRATO PERTENENCIA SPONSORIZACION» (PDF escaneado, deporte amateur y colegio: 2.094 prendas +
  425 medias) ni con el anexo «Pedido CONTRATO EDLP 2026 - ANEXO prop inicial y devolución
  martín» (13.162 / 12.102: negociación por disciplina, no el contrato). Firebase
  `entregasEdlp/<temporada>/contrato` = `{fuente, total, items:{<id>:{orden, tipo, producto,
  cantidad, arts:[ids de artículo]}}}`, sembrado el 09/09/2026 con el anexo y un **mapeo
  producto → códigos RUG hecho por nombre** (p.ej. «camiseta home» = RUG858 + RUG974 + RUG975;
  «media» = medias home + RUG950; gorro, chinelas, guantes, cuellos, botineros, socks y térmicas
  cortas sin artículo). `enCalcContrato`: entregado = todo lo que salió a las 5 disciplinas del
  contrato en el año (por `fecha`; **excluye** los artículos `noSuma` = medias tubo RUG949/950/957/958/959:
  regla de Juli 09/09/2026, la tubo es la pantorrillera que completa la media de juego = media
  entrenamiento + tubo, así que el renglón «media» del anexo se cumple con RUG943 y «media 2» con
  RUG942), por renglón y por disciplina; lo entregado sin renglón se lista abajo con un select
  para asignarlo (juveniles «pertenencia» RUG259/261/464/466/250/796 y kids quedan ahí).
  ✎ por renglón (`enModalContratoItem`: cantidad, tipo, producto y checklist de artículos, avisa
  si ya está en otro renglón), «+ Renglón», «⇩ Excel» (`enExportarContrato`). Al 09/09/2026:
  12.644 entregadas (11.902 en renglones + 742 fuera del anexo) = 97,3 %.
- **Criterio de Juli (09/09/2026) para leer el cruce**: el ANEXO I es un marco para dar orden; lo
  que manda es el total de **13.000 prendas anuales**, y el reparto por renglón varía según el uso
  de la temporada. Mientras el total no llegue a 13.000, las entregas siguen por contrato aunque un
  renglón esté pasado (p.ej. camiseta home) y otros con faltante. No plantear cada excedente por
  renglón como «se factura»: la cláusula 8.4 se aplica al total. Las medias comunes son un solo
  artículo para juego y entrenamiento (no hay «de más» real ahí); «mochilas» del anexo = solo RUG845
  (bolsos y morrales van sin renglón).
- Pendiente/no digitalizado: el corte S1/S2 (ene-jun / jul-ago) de las hojas ANÁLISIS
  SUPERFUTBOL/TIENDAPINCHA (el pedido es un solo número por canal).

## Discontinuos — comentario por artículo (`gestion-stock/`, 17/09/2026)

Pedido de Juli: en la lista de discontinuos de la sucursal, **poder comentar cada artículo como
en los F8** («producto separado para problemas», «producto cruzado», «no aparece», «diferencia
con otro artículo»…). Antes la sucursal solo podía avisarlo por afuera del portal.

- **Dónde**: columna **Comentario** al final de la tabla «Detalle de artículos» y de la de «Sin
  envío a outlet» de la vista de sucursal. Sin comentario, la celda muestra «+ Comentar»; con
  comentario, un chip azul con el motivo y el detalle (el título del chip trae todo + quién y
  cuándo). El modal (`abrirComentario`) tiene el **motivo** (lista fija `MOTIVOS_DISC`, la misma
  idea que `MOTIVOS_F8`), un **detalle** libre y «Quitar comentario».
- **Quién escribe**: la cuenta de la sucursal (incluido su `deposito`) y gerencia
  (`puedeComentar` = admin o `session.sucursal === slug`). El resto lo ve de solo lectura (chip
  como `span`, sin modal).
- **Quién lo ve**: el **outlet** que recibe (columna «Comentario de la sucursal» en su vista y en
  el checklist de recepción) y, en el Dashboard, el **Área de Producto** (`producto@`, que ya es
  admin) y el **supervisor**. Las tres pantallas tienen el filtro **Comentario (todos / con
  comentario / sin comentar)** y la vista de sucursal cuenta «N con comentario» al lado de los
  resultados. El Dashboard abre además con la tarjeta **«Comentarios de las sucursales»**
  (`comentariosCardHtml`/`comentariosDelMes`): todos los del mes, del más nuevo al más viejo, con
  sucursal · código · descripción · motivo · detalle · quién y cuándo, y «⧉ Copiar» para WhatsApp;
  respeta el filtro por sucursal del panel.
- **El supervisor entra al módulo de SOLO LECTURA** (17/09/2026): el Portal le suma
  `gestion-stock` en `herramientasEfectivas` y en el módulo `esGerencia()`/`esSoloLectura()` le
  dan el Dashboard pero le ocultan las solapas Reporte Mensual y Meses de Stock, la pestaña
  Control, «Cargar Discontinuos» y el ⚙; tampoco puede comentar. Ve todas las sucursales (no se
  filtra por `session.sucursales`: hoy Cristian cubre todo).
- **Aviso por la Bandeja** (`avisarComentario`, best-effort): cuando **la sucursal** comenta le
  llega un directo a `COM_AVISADOS` = `producto@` y `cristian.campion@`. Es **uno por sucursal y
  por día** (flag `comentariosAvisos/<ym>/<slug>/<YYYY-MM-DD>`), para no inundar la Bandeja si
  comenta 20 artículos; el detalle se lee en el módulo. Gerencia comentando no dispara aviso.
- **En los Excel**: la última columna del «Exportar detalle para envío» pasó a ser
  «COMENTARIO / OBSERVACIONES» y se llena sola; el checklist del outlet cambia OBSERVACIONES por
  «COMENTARIO DE LA SUCURSAL»; el export general suma la columna en la hoja de cada sucursal.
- **Firebase** (`discontinuos-mateu`, nodo nuevo): `comentariosDisc/<YYYY-MM>/<slug>/<clave>` =
  `{motivo, nota, codigo, articulo, descripcion, marca, por, ts}`. La **clave** es la del artículo
  del mes (`comKey` = `articuloKey` saneada para Firebase: `cod:<código>`, o `art:<texto>` si no
  tiene código), así el comentario sigue al artículo aunque se repita en varios renglones.
  Agrupado por slug: cada sucursal baja solo lo suyo (seguridad blanda, como el resto).
  El comentario es **por mes**: un artículo que repite el mes siguiente se comenta de nuevo (así
  se ve si el problema sigue).
- Pendiente si Juli lo pide: que Producto/el supervisor **respondan** el comentario (hoy es uno
  solo por artículo, editable por la sucursal y por gerencia).

## Meses de Stock — cómo regenerar `datos-meses-stock.js` desde el Excel

El dashboard de Meses de Stock (`gestion-stock/`) no lee el Excel: lee
`gestion-stock/datos-meses-stock.js`, que se genera desde el reporte
`RATIO <año> ok.xlsx` (hoja "Ratios", ~115k filas, columnas
Año/Mes/Sucursal/Rubro/Marca/Segmento/Stock/Ventas/Ratio + Comentarios Encargados
+ Comentarios Área de Producto).

**Carga mensual (lo habitual desde 08/2026):** Juli sube el export mensual del
sistema tal cual (p.ej. `RATIO JULIO.xls`, formato jerárquico con filas de
totales y columna `Vtas.cant.`) en la pantalla «Actualizar datos» del módulo:
el uploader lo detecta solo, lo parsea con las reglas del generador y **fusiona**
el mes nuevo con los ya publicados (no los pisa). El lector es tolerante (08/09/2026):
busca los encabezados en **cualquier hoja** y en las **primeras 30 filas**, compara los
nombres de columna sin puntos ni espacios (`Vtas.cant.` = `Vtas. Cant.` = `Ventas`), y si
el archivo no trae columna **MES** lo deduce del nombre («RATIO AGOSTO.xls», `msMesDeNombre`).
⚠️ **El sistema cambia los encabezados de un mes al otro.** Julio vino
`Mes · Sucursal · Rubro · Marca · SEGMENTO · Stock · Vtas.cant. · ratio` y agosto
`Año · Mes · Sucursal · Rubro · MARCA · SubRub · Stock · Ventas · Ratio`: el segmento pasó a
llamarse **SubRub** y apareció una columna **Año**. Sin reconocer el segmento, el archivo NO se
detecta como jerárquico, cae al lector plano y ahí el daño es silencioso: suma las filas de
totales con las de detalle (stock ~3× inflado), inventa la marca «Total» y **no fusiona** —
publicar eso borraba ene–jul. Por eso `seg` acepta `SEGMENTO`/`SUBRUB`/`SUBRUBRO` y, si viene
columna `AÑO`, ese año manda sobre el del campo de la pantalla. **Y para que el próximo rename no
vuelva a depender de un programador (09/09/2026):** si ningún alias pega, la columna de segmento se
busca **por contenido** — la columna de texto, con pocos valores distintos, que trae la fila «Total»
de cada marca (lo avisa en el resumen); y si aun así no aparece pero el archivo TIENE filas de
totales, la carga **se frena con un error** en vez de leerse plana. Ojo: las filas «Total» están al
FINAL del archivo, así que esas dos búsquedas recorren todas las filas, no las primeras N.
Cuando no encuentra los encabezados, el error **lista las hojas y los encabezados que leyó**
en vez de un mensaje genérico. ⚠️ El export tiene que traer el **mes completo con todos los
rubros**: si sube uno solo (p.ej. el de Calzado), los demás quedan sin ese mes y figuran «sin
dato» — el resumen de la carga lo avisa en ámbar. Publica con el botón
**«Publicar al portal»**: commitea `datos-meses-stock.js` a `main` y Cloudflare deploya solo.
Plan B: descargar el `.js`, reemplazar y push a mano.

**Quién puede publicar (09/09/2026, pedido de Juli: «que Daniel pueda cargarlo todos los meses
sin mi confirmación»).** El commit lo hace la Pages Function **`functions/api/publicar-stock.js`**
con un token de GitHub que vive **en Cloudflare**, no en el navegador:
- `GET /api/publicar-stock` → `{disponible, quienes}`; el módulo lo consulta al abrir
  «Actualizar datos» (`msCargarPubApi`) y muestra el botón si el mail de la sesión está en la
  lista (`msPuedePublicarServidor`).
- `POST` con el `.js` **ya en base64 como cuerpo de texto plano** y los datos chicos en headers
  (`X-Mateu-Email`, `X-Mateu-Pin`, `X-Mateu-Meta`). Va así a propósito: el dataset pesa ~3 MB
  (4 MB en base64) y hacerle `JSON.parse` + base64 dentro de la Function quemaría el CPU;
  la Function solo lo revisa y lo reenvía (el cuerpo de GitHub se arma concatenando, después de
  validar que el base64 no tenga caracteres raros).
- El endpoint es público, así que el permiso se valida ahí: **mail en la lista + PIN correcto**
  contra `discontinuos-mateu/usuarios` (mismo criterio que el login), y solo se puede escribir
  ESE archivo y solo si empieza con `window.STOCK_DATA = {`. El token nunca baja al navegador.
- **`GITHUB_TOKEN` configurado el 11/09/2026** en el proyecto **Pages** `mateu-sports-portal` (el de
  `mateu-sports-portal.pages.dev`) → Settings → Variables and Secrets, como *Secret*, vence el
  **11/09/2027** — fine-grained, acceso SOLO a `mateu-sports-portal`, permiso «Contents: Read and
  write». Un secreto nuevo toma efecto recién en el deploy siguiente (Deployments → ⋯ → Retry
  deployment); se verifica con `GET /api/publicar-stock` → `"disponible":true`.
  ⚠️ En «Workers & Pages» hay además un **Worker con el mismo nombre** (solo archivos estáticos,
  con «Latest build failed»): NO es el que publica el sitio y ahí no se pueden cargar variables. Opcional `PUBLICAN_STOCK` (mails separados por coma; por defecto
  `julian@mateu.com.ar,producto@mateu.com.ar` — `producto@` es la cuenta de Daniel y David).
  ⚠️ Los tokens fine-grained **caducan**: cuando pase, la Function devuelve «GitHub rechazó el
  token del servidor» y hay que renovarlo en Cloudflare.
- **Respaldo**: sin `GITHUB_TOKEN` configurado, `disponible:false` y el módulo cae al camino
  viejo (token fine-grained en localStorage `gs_github_token` del navegador de Juli). Sin
  ninguno de los dos NO se muestra el botón: aparece una nota que deja «Descargar
  datos-meses-stock.js» como acción principal y el link «Tengo el token…». Antes salía un
  `prompt()` pidiendo un token de GitHub a quien no lo tenía — ese era el «error» que reportaba
  Daniel el 08/09/2026 y por el que agosto nunca se publicó.

**Forma correcta de regenerar el año completo — usar el generador:**

```
node gestion-stock/generar-datos-meses-stock.js "ruta/RATIO 2026 ok.xlsx" 2026
```

Es self-contained (solo `fs`+`zlib`, sin npm) y aplica el mapeo correcto. Después:
commit + push. Solo si hay que hacerlo a mano (o tocar el generador), seguir estas
reglas **exactas** (un intento previo dividió las marcas por 2 → stock a la mitad;
NO repetir):

- **`rubro.serie[mes]`** = fila `Marca="Total", Segmento="Total"` de ese
  sucursal/rubro/mes. Es el total real del rubro. **Tal cual, sin dividir.**
- **`marca.serie[mes]`** = fila `Marca=<marca>, Segmento="Total"` (= suma de sus
  segmentos). **Tal cual, sin dividir por 2.** ⚠️ Acá estuvo el bug.
- **`segmentos[SEG].serie[mes]`** = fila `Marca=<marca>, Segmento=<SEG>` (SEG ≠
  "Total"). El agregado top-level `{stock,ventas,ratio}` del segmento = su serie
  del **último mes**.
- **`suc.serie[mes]`** = Σ `rubro.serie` de todos los rubros de la sucursal.
- **NO** crear la pseudo-marca `"Total"` como si fuera una marca. Excluir de col C
  las filas basura `"Total"` y `"Sucursal"`.
- **Comentarios** (`STOCK_COMMENTS`): una entrada por fila con col J (Encargados)
  no vacía → `texto`; si además tiene col K (Área Producto) → `respuesta` +
  `estado:"resuelto"`; `id` secuencial 0..N.
- PRODUCTO es un rubro raro (las "marcas" son tipos de producto, sin fila Total,
  segmentos que sobre-suman) y está excluido de los KPIs; dejarlo como el archivo
  actual salvo pedido.

`msCorregirDatos()` en el `index.html` es una red de seguridad: si un `.js` viene
crudo (con la marca "Total"), duplica las marcas al vuelo. Si se genera bien
siguiendo lo de arriba, no hace falta que actúe. Ver memoria
`meses-stock-marcas-mitad`.

## Indicadores de Sucursal — datos y seguridad

**Nombre visible (21/08/2026):** el módulo se llama **«Mi Sucursal»** para los roles
`sucursal`/`outlet` y **«Panel General»** para gerencia (admin/supervisor). El nombre se
resuelve en el render según `session.rol` en los cuatro lugares: `nombreTool()` del Portal,
el drawer de `shared/header.js`, `nombreModulo()` en `indicadores/` (drawer + `<title>`) y
`shared/tutorial.js`. En el código y en este archivo se sigue hablando de "Indicadores".
Ícono del módulo: `🏪` (frente de local). Si la sucursal no tiene datos (sin entrada en
`SLUG_SUC`), el chip y el drawer muestran el slug embellecido (`nombreBonito`: "diagonal"
→ "Diagonal"; lo mismo hace `header.js`). Los dos drawers (Indicadores y `header.js`)
tienen un ítem fijo **«📬 Bandeja de mensajes»** → `../?ver=bandeja` (es la única vía de
las sucursales a la Bandeja, porque no ven la grilla del Portal). El botón «?» del tutorial
se corre a `bottom:92px` cuando la pantalla tiene la campana `#notifWidget`, para no taparla.
El toast de un aviso/mensaje nuevo (`.notif-toast`, Portal e Indicadores) sale de la campana
**hacia la izquierda**, a su altura (con puntita), no hacia arriba. En el Portal, «← Volver» de
la Bandeja y el clic en el logo del header (`#topLogo`) llevan a `./indicadores/` (Mi Sucursal /
Panel General) para sucursal/outlet y siempre que se llegó con `?ver=bandeja`; para admin en
la grilla, vuelven a la grilla (`volverAlInicio()`).

**Dos zonas (23/08/2026).** La pantalla (Mi Sucursal y Cadena) está partida en dos bandas
con cabecera propia, para que no se mezclen las dos líneas de tiempo: **«En curso»**
(banda azul intenso `#zonaViva` / `#zonaVivaCad` — tokens `--vivo*` —, pill «● provisorio»: Objetivo del mes, Objetivo
de la semana + equipo, **Indicadores de la semana** y Reposición — todo Firebase, mes/semana
abiertos) y **«Cierre»** (`#zonaCierre` / `#zonaCierreCad`, pill «✓ oficial»: los cuatro
indicadores con el switch Mes/Sem 1…4 y todo el análisis del último mes cerrado — JSON del
ETL). El **selector de período vive en la cabecera de Cierre** (`#selPer` se mueve al
`#selPerHost` de la vista activa en `pintarZonas()`), no en la barra global.
**Pestañas (29/08/2026, reemplazan al nav «Ir a»):** se ve **UNA zona por vez** con el
segmented `.zona-tabs` («● En curso · provisorio» azul / «✓ Cierre · oficial» navy;
sticky arriba en Mi Sucursal; en Cadena va PRIMERO en la rk-bar — pestaña → Línea → KPI,
y el grupo KPI solo se muestra en Cierre porque únicamente filtra el ranking). `setZonaTab()` guarda
la elección en localStorage `ind_zona_tab` (default: En curso) y `pintarZonas()` aplica
el display de las zonas + el estado `.on`; sin secciones vivas (Ecommerce) se fuerza
Cierre y la pestaña viva se oculta. La **impresión/PDF saca las dos zonas juntas** igual
(`@media print` fuerza `display:block`, salvo `.zona.z-empty`). La mini-barra `#kpiBar`
lee la grilla de la pestaña activa (`kpiBarGrid`: En curso → `#kpisSem`/`#kpisSemCad`
con contexto «Sem N · provisorio»; Cierre → `#kpis`/`#kpisCad`). En Cadena, la sección
«Indicadores de la semana» (`#kpisSemCadBox`, la pinta `pintarKpisSemCad`
desde `pintarObjCad`) agrega los cuatro KPIs de la semana a la línea filtrada
(numeradores/denominadores sumados; UPT y ticket prom. en la pasada 1, tickets/venta
por hora con las horas asignadas de los equipos en la pasada 2) vs. el mes cerrado —
las ex cajitas «UPT semana / Ticket prom. / Tickets/h» de la tarjeta del objetivo,
que ahora solo conserva Mínimo y ★ 120%.
**Cierre de Cadena con análisis (29/08/2026):** además de KPIs generales / Ranking /
Comparación, el Cierre de la vista Cadena suma la tarjeta **«Venta neta»** del mes
(`cadAggFiltrada` ahora devuelve `venta`; sparkline con `serieCadena('venta')`),
**«La venta semana a semana»** agregada (`renderSemCad`, suma las `semanas` de
`cadena.json`; sin el filtro por semana de la vista sucursal) y **«Cobertura vs.
demanda» + «Tickets por hora y día»** agregados (`renderAnalisisCad`: baja el detalle
de cada sucursal de la línea — cacheado, solo gerencia — y suma las curvas horarias;
el gráfico de cobertura se compartió en `covChart()`). Todo respeta el filtro por
línea (los chips repintan también estas secciones) y excluye Ecommerce, como los
KPIs generales.
`pintarZonas()` pone las fechas en los títulos (`_zonaSem`/`_zonaMes`, que setean
`renderObjetivo` / `renderObjCadena` / `objetivoMesHtml`).
Regla: todo número vivo lleva el pill `.pprov`; los cerrados, nunca.
**Disposición canónica (30/08/2026, pedido de Juli — las cuatro vistas alineadas):**
En curso (sucursal y Cadena): Objetivo del mes → Indicadores del mes en curso
(`#puenteBox` / `#puenteBoxCad`, secciones `.sec-cont`) → Objetivo de la semana →
Indicadores de la semana (`#kpisSemBox` / `#kpisSemCadBox`, `.sec-cont`) → operativas
(sucursal: F8 para armar + Reposición; Cadena: F8 control). Cierre (ambas): **Objetivo
del mes cerrado** (`secObjMesCierre`/`renderObjMesCierre` con la meta de
`objetivos/meses` vs. la venta neta oficial; en Cadena `secObjMesCadCierre`/
`renderObjMesCadCierre`, mismo universo meta↔venta por línea) → KPIs → **La venta
semana a semana** (subida al 3.º lugar en sucursal, decisión A1) → el resto del
análisis. La **tira resumen se repartió por período**: chip «Mes %» arriba de Objetivo
del mes (`#vivaStripMes[Cad]`), chips Hoy/Semana/Ritmo/UPT/Ticket prom. arriba de
Objetivo de la semana (`#vivaStripSem[Cad]`); el **selector de semana** vive en el
`sec-head` de «Objetivo de la semana» (ya no en la cabecera de la banda). El Cierre de
Cadena suma el **switch «Mes / Sem 1…N»** (`kpiSegCad`/`semSelCad`/`cadSucVista`,
decisión D1: filtra KPIs generales y Comparación; horas del mes repartidas por semana,
banner `#filtroBannerCad`), y la zona viva de Cadena un **insight corto agregado**
(`#diagSemCad` en `pintarKpisSemCad`, decisión E1: % de meta, sucursales en ritmo,
KPI más flojo). «La venta semana a semana» (las dos vistas) muestra el **% vs. la
meta PMS semanal** adentro de cada barra y como columna (`semLunesISO`/`metaSemana`:
lunes desde el rango del ETL + metas de `objetivos/semanas`, cache async). Los F8 de
«F8 para armar» arrancan **cerrados** (sin `open`).
**Análisis del mes EN CURSO (30/08 tarde, pedido de Juli — siempre que haya venta
provisoria cargada):** la zona viva de sucursal suma **«La venta semana a semana»
prov** (`secSemViva`/`renderSemViva`: barras por semana del mes abierto con el % vs.
la meta PMS; pico en azul `--vivo`, ≥2 semanas con venta) y **«Quién vende cada rubro»
prov** (`secRubrosViva`/`renderRubrosViva`: participación+mix acumulados desde los
`rubros` de ventaEquipo; solo CALZADO/INDUMENTARIA/ACCESORIOS). Cobertura, heatmap y
plantilla NO tienen versión viva (no hay dato horario ni dotación hasta el ETL). La
zona viva de Cadena suma el **«Ranking del mes en curso» prov**
(`secRankingViva`/`pintarRankingViva`: un bloque `.rk-kpi` enmarcado por KPI con las
sucursales de la línea, % vs. el objetivo de su formato y **cuántas semanas cargadas
tiene cada una**; usa `_mesCadData`, Ecommerce no rankea); por eso los **chips de KPI
se ven en las dos pestañas** de Cadena (filtran ambos rankings). Estética del ranking
del Cierre: **todos los bloques `.rk-kpi` enmarcados** (borde superior navy; Prioridad
rojo) y los valores `.rk-val` en tipografía «rendimiento» (Saira itálica 800).
**Indicadores de la semana** (`renderKpisSemana`; sección `#kpisSemBox` que desde el
30/08 va **pegada debajo de «Objetivo de la semana»** como continuación — clase
`.sec-cont`, título chico, sin label «Resumen»; lo mismo `#kpisSemCadBox` en Cadena.
Sin venta cargada muestra un empty state en vez de desaparecer. El
acumulado del mes — la ex tabla «El puente», hoy **«Indicadores del mes en curso»,
tarjetas KPI con el mismo formato que las de la semana** (30/08: acumulado, % del
objetivo con semáforo, delta y valor del cerrado, sparkline semana a semana y nota de
horas; la columna «Sem N» de la tabla vieja no se repite porque son las tarjetas de la
semana) — sigue **dentro de «Objetivo del mes»** en `#puenteBox`, y desde el 30/08
**también existe en la vista Cadena** (`#puenteBoxCad`, `cargarMesCad`/`pintarPuenteCad`:
baja ventaEquipo+equipo de cada sucursal por semana de fondo, agrega numeradores y
denominadores por línea filtrada; % del objetivo solo con una línea elegida). El
`#puenteBox` de sucursal suma además el desplegable **«Cómo viene el equipo · mes»**
(acumulado por vendedor de las semanas publicadas: venta, participación, tickets, UPT,
ticket prom., semanas con venta) — SOLO en la vista de una sucursal, no en Cadena
(pedido de Juli: en el agregado se hace eterno)): UPT, ticket promedio,
tickets/hora y venta/hora de la semana elegida con la venta de `ventaEquipo` y las horas
asignadas del equipo (solo los días que ya tienen venta: `eqHorasDias`), cada uno vs. el
objetivo de la línea, vs. el mes cerrado (`kpisCerrado`: con horas asignadas si ese
período tiene equipo guardado; si no, tickets/venta por hora se marcan «no comparable») y
vs. la semana anterior; el acumulado (semana · mes en curso acumulado · mes
cerrado · objetivo) calcula tickets/venta por hora solo con las semanas que
tienen horas (`kpisAcum`), y hay un insight corto de la semana. Los KPIs del mes cerrado
quedan como sección aparte en la zona Cierre. En Cadena, la tabla del objetivo
semanal suma **UPT sem. y Ticket prom. sem.** por sucursal con su % vs. el cierre, y el
agregado de la línea. La Reposición avisa «hace N semanas» si el análisis tiene ≥7 días.
**Afinado 23/08 (tarde):** la cabecera de «En curso» es del **mes abierto** («Agosto 2026 ·
mes abierto») y lleva el **selector de semana** (`#semHost` / `#semHostCad`; lo pinta
`renderObjetivo` / `renderObjCadena`) + una **tira resumen** (`#vivaStrip`, `pintarResumenVivo`
sobre `_resumenVivo`: semana % · ritmo · mes % · UPT · ticket prom.; también va en «⧉ Copiar»
vía `resumenVivoTxt`). **Ritmo esperado** (`ritmoSemana` / `ritmoEsperado`): con la matriz de
pesos turno×día (`fetchEqPesos` en sucursal, `fetchPesosSlug` en Cadena, promedio si no hay)
calcula qué % de la meta «debería» estar vendido con los días cargados; un día sin venta dentro
de lo transcurrido (feriado) sale de la curva; semana completa → `{completa:true}` y no se
muestra. Sale bajo la barra del objetivo semanal (`.ritmo`), en el insight de la semana y como
columna «Ritmo» (+ «✓ completa») en la tabla de Cadena. **Equipo vigente** (`equipoVigente`):
si la semana no tiene equipo con horas, usa el último guardado anterior (nota «equipo de Sem N»)
— así tickets/hora de la semana y de la anterior siempre salen; Cadena suma la columna
«Tickets/h sem.» (delta vs. cierre solo en base «Horas asignadas»). El desplegable «Cómo viene
el equipo» abre solo la primera vez que se ve esa semana (`ind_eq_visto_<slug>|<sem>` en
localStorage; `_eqOpenState` recuerda el toggle dentro de la visita).

`indicadores/` es un `index.html` self-contained que **lee la sesión del Portal**
(no tiene login propio) y es la **pantalla de inicio de los roles `sucursal` y
`outlet`**: el Portal los redirige a `./indicadores/` al entrar (ver
`herramientasEfectivas` + el redirect en `render()` del `index.html` raíz). El rol
`admin` ve el selector de sucursal + la vista "Cadena (comparar todas)".

**Seguridad en la capa de datos, no en el render.** El módulo NO trae un JSON con
las 20 sucursales: pide solo `data/indicadores/<periodo>/<SUCURSAL>.json` (su
sucursal, con personas) + `cadena.json` (agregados de las 20, SIN personas). Así el
navegador de una sucursal nunca se baja las personas de otra. Es seguridad "blanda"
(archivos estáticos en Cloudflare Pages, como el resto del portal): ordena accesos,
no es auth real — un usuario decidido podría pedir otro archivo por URL.

**Cómo regenerar los datos.** El cálculo (UPT, tickets/hora, etc.) vive en
`scripts/etl_indicadores.py`, que lee los Excel de ventas + staff y ya emite tanto
el JSON combinado por período como la **salida particionada** (`out/indicadores/…`):
`objetivos.json`, `periodos.json`, `<periodo>/cadena.json` y un `<periodo>/<NN-Nombre>.json`
por sucursal. Corre en la máquina de Juli (Python 3.12 + pandas instalados 03/08/2026;
también sirve el sandbox); después se copia `out/indicadores/2026-NN/` a `data/indicadores/`
del repo y se agrega el período a mano en `periodos.json` (el ETL solo escribe los períodos
que procesó — los que no tienen archivo se saltean con aviso). Desde julio 2026 el export
de ventas es el Excel **detallado por línea** ("Estadistica de venta - …": 6 columnas base +
Artículo + Rubro + un par Cantidad/Importe por mes calendario; `formato='detallado'` en
`PERIODOS`): se cargan todos los pares y el índice día+día-de-semana deja solo el período
retail (así el 29-30/6 del par de junio entran a julio retail). ~~Aplica los **criterios de
Juli por línea** (`criterio_linea()`: Otros no suma; REDONDEO no; PROMOS/descuentos solo
importe; CREDITO A FAVOR ambos; INGRESO CUPON y LLAVERO COMPRA GRANDE afuera; ENVIO solo
importe) y agrega por comprobante atómico (metadata = línea de mayor importe).~~ **Desde el
17/09/2026 el cierre mensual va con el mismo criterio que la carga semanal: la venta del
portal es EXACTO la del sistema** (constante `EXACTO` arriba de `criterio_linea()`; ponerla
en `False` vuelve a todo lo tachado). Cuatro cosas cambiaron, y las cuatro apuntan a lo
mismo — que el total de cada sucursal sea la suma de la columna Importe del export:
(1) **ninguna línea se descarta** (`criterio_linea` devuelve `(True, True)`);
(2) **una fila por comprobante × VENDEDOR** en vez de una por comprobante: cada línea suma
para quien la hizo, no para el de la línea más grande (los tickets se cuentan con
`nunique()`, así que un ticket compartido le cuenta 1 a cada vendedor y 1 —no 2— a la
sucursal; el `lin` del mix por rubro ya trae su propio vendedor y no se mergea);
(3) **entran los comprobantes sin unidades** — gift cards, señas, entregas a cuenta: eran
$72,1M en agosto 2026, y el filtro `cantidad > 0` los dejaba afuera;
(4) **la venta del local incluye a TODOS los vendedores**: antes `suc` se armaba con `vm`
(solo los "medibles", los que tienen horas de contrato) y quedaban afuera los eventuales,
la venta sin asignar y la web facturada en la sucursal — en Calle 12 eran $30M de agosto.
Los medibles siguen aparte: `suc.tickets_med` (campo nuevo) son los tickets con horas
cargadas y `cobertura` pasó a ser `tickets_med / tickets`; las horas de tickets/hora y
venta/hora siguen saliendo solo de ellos. En el módulo, la nota de cobertura usa
`tickets_med` con fallback a `tickets` (los períodos viejos no lo traen).
⚠️ **Esto mueve los KPIs del cierre**: agosto 2026 pasó de UPT 1,66 · TPH 1,17 · TP
$115.404 a **UPT 1,55 · TPH 1,27 · TP $110.729** (más tickets sobre las mismas horas y
unidades). Validado: las 21 sucursales de agosto dan **exacto** la suma del export
(4.882.304.876, diferencia 0,00). Al cambiar el criterio hay que **regenerar todos los
períodos** para no comparar meses con criterios distintos. ⚠️ El export
consolidado viejo (por comprobante) venía SIN las líneas de promo → importes sin descontar;
`formato='consolidado'` queda soportado pero no usarlo si está el detallado. Staff:
`Sucursales staff.xlsx` en Descargas.
Los objetivos por formato y la regla nombre→formato viven fijos en ese script — NO tocar
el cálculo salvo pedido. Desde el 26/08/2026 el ETL además emite **`rubros`** (venta neta
por CALZADO/INDUMENTARIA/ACCESORIOS/… por vendedor y por sucursal, cada línea atribuida
al vendedor de su comprobante; aditivo, no cambia ningún número): lo consume la sección
**«Quién vende cada rubro»** (`secRubros`/`renderRubros`) del análisis del mes en
`indicadores/` — participación + mix propio por vendedor, referente ★ y sugerencias de
mentoreo (el que domina el rubro le tira tips al que lo tiene flojo). Oculta en Ecommerce
y en períodos sin el dato. Los KPIs usan la tipografía «rendimiento» (Saira itálica 800,
la de meses de stock) con el color del semáforo en el número; al scrollear pasadas
las tarjetas aparece la **mini-barra fija** `#kpiBar` (`kpiBarScroll`, lee las
tarjetas ya renderizadas, clic = volver). Los filtros (mes/sucursal/semana) usan el
**dropdown propio** `dropSel()` (el `<select>` queda oculto como estado y dispara
su `change` normal; `pintarZonas` mueve el wrapper). **Solo Ecommerce y Outlet
Gonnet abren los domingos**: `pesosSinDomingo()` anula el domingo de la matriz de pesos
para el resto (importa con la curva promedio, fallback de Diagonal 80). **Diagonal 80
reparte por día con su propia venta (14/09/2026)**: `CURVA_VENTA_SUC` + `conCurvaVenta` (en
`fetchEqPesos` y `fetchPesosSlug`) toman las últimas `CURVA_VENTA_SEM` (4) semanas completas de
`ventaEquipo/<slug>` (terminadas y con venta los 6 días), promedian el % de cada día y reescalan
la matriz base (el reparto entre turnos dentro del día no cambia); marca `curvaVenta` y los textos
lo aclaran. Al 14/09: Lu 12,5 · Ma 15,2 · Mi 15,3 · Ju 15,0 · Vi 18,7 · Sá 23,4 %. El objetivo
semanal se abre además **por día** (tira «Objetivo por día» del local con real y % cuando
hay venta diaria, y objetivo diario por vendedor en su desplegable — `eqPesosDia`,
`eqSharesDia`, `objDiasHtml`).

**Regla de calendario del cierre mensual (Juli, 07/09/2026): los totales de venta del MES
van por MES CALENDARIO, tal como se carga el export; el calendario retail queda solo para la
venta SEMANAL.** Los dos criterios no cierran entre sí y por ahora se acepta así. Mayo, junio
y julio 2026 quedaron con el criterio viejo (retail: 27/04–31/05, 01/06–28/06, 29/06–26/07).
**Agosto 2026 (07/09/2026)**: **01/08–31/08**, 26 hábiles; las semanas del mes siguen siendo
retail Lu–Do, así que la 1.ª (01–02/08) y la 6.ª (31/08) quedan parciales. El export del
sistema vino como **CSV** («Ventas agosto portal.csv»: `;`, latin1, una fila de cabecera, UN par
Cantidad/Importe) → `csv=True` en `PERIODOS`. Para completar bordes desde otro archivo existe
`extra_det={archivo, mes, dias}` (no se usa en agosto). `--solo YYYY-MM` procesa un único período (los otros
tardan ~2 min cada uno). Las **altas de mitad de mes** que no están en el staff ni en el
padrón (`ALTAS_MES`) cuentan como vendedores con las horas reales de su venta (franja
diaria, como los eventuales), marcadas `propuesto`. `APERTURAS` (sucursal → fecha de
apertura) prorratea las horas de contrato por los hábiles desde la apertura (Diagonal 80
abrió el 10/08: ×0,60; si no, tickets/hora salía a la mitad). **Diagonal 80 ya tiene datos**: está en
`SLUG_SUC` de Indicadores como `10-MS Diagonal 80` (el nombre del sistema y de Meses de
Stock; `SOLO_OBJ_SUC` quedó vacío); julio y anteriores dan empty state.

Alternativa sin Python (cuando solo se tiene el JSON del ETL, no los Excel):
`node scripts/gen-indicadores.mjs indicadores-2026-05.json indicadores-2026-06.json`
produce exactamente los mismos archivos particionados. Es lo que se usó para poblar el
repo la primera vez.

**Meses de stock** reutiliza `gestion-stock/datos-meses-stock.js` (mismo nombre de
sucursal como clave); no se duplica el dato. Sin dato en el período → empty state.

El mapa slug de Portal → sucursal de datos (`SLUG_SUC` / `OUTLET_SUC` en el módulo)
lo validó Juli (14/07/2026). `diagonal` y `deposito` no tienen datos de venta todavía
→ empty state.

**Plantilla / Dotación**: sección `secPlantilla` del módulo que lista a la gente de
la sucursal por rol y régimen (headcount + FT/PT), desde los `vendedores` del período
(quien registró ventas). **El Buscador de Artículos reutiliza esta misma dotación**:
en su panel de perfiles (encargado/admin) hay "⇩ Importar dotación desde Indicadores",
que lee `data/indicadores/<último-periodo>/<SUC>.json`, mapea grupo→rol de perfil
(Jefatura→encargado, Ventas→vendedor, Caja→cajera, Refuerzos→depósito), excluye
coberturas (cada persona en su sucursal fija) y **REEMPLAZA** `perfiles` de esa
sucursal (pisa avatares/ajustes a mano; lo dispara el encargado). No se duplica el dato.

## Buscador de Artículos (`ubicaciones/`) — carga de stock

«📄 Cargar stock del día» (encargado) acepta **dos modelos de Excel**, autodetectados:

- **Export plano** (una hoja: Código · Descripción · Stock · Ubicación opcional
  «EST n - MOD n» o «En-Mn»): modal de mapeo de columnas (`abrirModalMapeo`).
  Puede venir **SIN fila de encabezados** (el stock pelado de Diagonal: Id.item ·
  SKU · Descripción · Stock): `detectarColumnasDatos` reconoce las columnas por
  contenido (números grandes = Id.item, chicos = stock, texto con espacios =
  descripción, texto corto = SKU), el selector de fila tiene la opción «Sin
  encabezados» y hay columna **Id.item opcional** (→ `articulo`). La carga solo
  actualiza stock/descripción y preserva ubicaciones y lo demás ya asignado.
  ⚠ **La descripción es opcional y solo acepta texto (07/09/2026)**: si no se detecta
  columna, el select queda en «No importar» (antes caía en la col A = Id.item, y en
  Diagonal una carga pisó las 4.341 descripciones con un número; se recuperaron desde
  el export del 24/08 + la planilla de Drive del 27/08 + Calle 49/barrida/maestro adidas).
  `esDescBasura()` descarta descripciones vacías, `#N/A`, iguales al código o numéricas,
  tanto al parsear como al fusionar (`sincronizarStock` conserva la guardada), y la
  previsualización avisa en rojo si la columna elegida no trae texto.
- **Planilla de Drive de la sucursal** (modelo «UBICACION DEPOSITO», el que usa
  Diagonal 80): hojas `UBICACION CALZADO / INDUMENTARIA / ACCESORIOS` (grilla por
  casillero `E#-M#` con columnas UBICACIÓN · Contador · Articulo (Id.item) · Codigo
  (SKU) · Descripcion · Stock) + hoja `Base de Datos` (stock completo del día).
  `abrirModalDrive` lee **todas** las hojas de ubicación juntas (cargar una por vez
  borraría las otras: lo que no viene en el Excel cuenta como eliminado), ignora los
  casilleros `#N/A`, y **NO suma** el stock de un artículo repetido en varios módulos
  (cada fila trae el total). Checkbox para incluir `Base de Datos` (los no ubicados
  quedan en SIN UBICAR). Un link permite forzar el otro modo.
- **Planilla de Drive en LISTA** (modelo de Berisso, 17/09/2026): dos hojas —«UBICACION»
  (una fila por artículo: SKU · Id.item · descripción · stock · ubicación «E20-M26») y
  «STOCK» (el stock completo del día)—, con encabezado **solo en algunas columnas**. Va
  por el modal de mapeo, que ahora reconoce por CONTENIDO lo que no tiene rótulo: la
  **ubicación** (se mira qué parte de lo que TRAE parece una ubicación, no cuántas filas
  están llenas: antes la columna se descartaba por «casi vacía» y las ubicaciones no se
  importaban nunca), la **descripción**, y el **código de marca vs. Id.item** («Articulo»
  rotula uno u otro según la planilla; si esa columna trae números del sistema y hay otra
  con el SKU, el código es el SKU —la clave del módulo— y la numérica va a `articulo`; si
  no, se perdían las filas sin Id.item: 383 de 2.403 en Berisso). Los `#N/A` del BUSCARV
  no cuentan al mirar una columna. La **hoja de stock completo se suma en la misma carga**
  con un tilde (como «Base de Datos» en el modelo por casilleros). Dos reglas más: el
  **talle** solo se busca si el archivo trae varias filas por artículo (si no, la
  heurística se quedaba con la columna de stock) y, **con ubicación y sin talle, el
  artículo repetido en dos módulos NO suma stock** (cada fila trae el total). **Cambio de
  clave transparente** (`sincronizarStock`): el artículo que estaba guardado por Id.item y
  ahora llega con su SKU hereda ubicación y fecha de alta en vez de entrar como nuevo.
- **Clave del artículo = SKU de marca** (columna «Codigo»), igual que Calle 49. El
  **Id.item** se guarda en `articulo` y se busca por él (búsqueda, escáner, picking);
  la tarjeta lo muestra como `#233282` y el export lo lleva en su columna.
- Validado 21/08/2026 con el archivo real de Diagonal 80: 4.191 artículos, 2.175
  ubicados, 30 estanterías, re-importación idempotente.
- **Stock por talle (27/08/2026, opcional)**: el modal de mapeo del export plano
  tiene columna **«Talle» opcional** (autodetectada por encabezado `TALLE`/`Talla`/
  `Size`; en archivos sin encabezado se elige a mano). Si el export viene abierto
  por talle (una fila por artículo+talle), el stock se agrupa por código como
  siempre y además se guarda el desglose en `talles: [{t,c}]` (array — los talles
  «7.5» tienen punto, ilegal como clave Firebase). La tarjeta lo muestra como chips
  (`40 2 · 41 1`; talle en 0 = chip apagado con el número en rojo) y el export ⇩
  Excel suma la columna «Talles». **Sin la columna se carga solo el total como
  siempre**; una carga sin talle borra el desglose anterior (no se muestran talles
  viejos como vigentes). La planilla de Drive no cambia.
  **14/09/2026**: el talle también se detecta **por contenido** (`colTallePorContenido`, `RX_VAL_TALLE`):
  en el export sin encabezados de Diagonal nunca se buscaba y los talles no salían; el encabezado acepta
  además «Nro Talle», «Medida», «Curva», «T.». La vista previa avisa en rojo si hay varias filas por
  artículo y no se eligió la columna de talle.
- **Memoria de ubicaciones (14/09/2026)**: un artículo con ubicación que deja de venir en el Excel se
  guarda en `sucursales/<slug>/ubicMemoria/<clave>` = `{ubicaciones, fechaAlta, codigo, ts}` y, cuando
  vuelve en una carga posterior, recupera su lugar (si la estantería/módulo sigue) y su fecha de alta (no
  sale como «nuevo»). Causa: una carga del 09/09 en Diagonal no trajo RUGE y otros; al volver entraron sin
  lugar. Se restauraron 445 artículos (117 RUGE) desde `Downloads/respaldo-ubicaciones-diagonal-2026-09-07.json`
  + `movimientos/` posteriores (marcadas «· recuperada»); respaldo previo en `…-2026-09-14.json`.
- **Lista de retiro con talles del F8 (27/08/2026)**: al importar el F8 en la Lista
  de retiro, el parser captura la **curva de talles** (las columnas entre la cabecera
  y el TOTAL, solo en el formato con columna DESTINO; el formato matriz no las trae)
  y el recorrido impreso muestra por artículo un renglón por destino con cantidad y
  talles («CITY BELL ×4 — 40×2 · 41»). Talles de letra en orden de ropa (XS→S→M→L→XL),
  ×1 se omite. ⚠ **El F8 trae VARIAS curvas de talle (10/09/2026)**: arriba de ORIGEN hay
  una fila por curva (1 = niños 10/10-/11…, 2 = US 3/3.5/4…, 3 = 17…42, 4 = 30…56, 5 = 30.5…,
  6/7 = UNI/XXS/XS/S…), numeradas en la columna que va justo antes de los talles (col. G), y
  cada artículo lleva en esa columna el número de SU curva. `f8DetectarCurvas` las detecta y
  el rótulo sale de la fila de la curva del artículo; antes se usaba siempre la de más abajo
  (a una zapatilla le salían XXS/XS…) y el número de curva se sumaba como un talle («7×2»).
  Filas con «Todo» o vacío en esa columna toman la curva del mismo código en otra fila;
  «UNI» = talle único; sin curva conocida la línea va solo con la cantidad (no se inventan
  talles). Validado con los F8 de Daniel y David (abr–ago 2026): suma de talles = total. Los destinos **«Todo X» sin unidades** ahora entran a la lista (antes
  se descartaban por total 0) marcados «TODO lo que haya», sin cantidad ni talles.
- **Dos depósitos en Diagonal 80 (27/08/2026)**: el mapa `DEPOSITOS_SUC` de
  `ubicaciones/index.html` asigna rangos de estantería → piso (slug `diagonal`:
  E1–E26 = **Subsuelo**, E27 en adelante = **2° piso**; el piso se deduce del
  número en el nombre de la estantería, `depositoDe()`). La etiqueta del piso
  aparece en las ubicaciones de la tarjeta/export, la hoja de asignación (con
  separador por piso), la pestaña Estanterías (cabecera por piso), los recorridos
  de F8/retiro y las impresiones/auditoría. Sucursal nueva con más de un
  depósito = agregar su entrada al mapa.
- **«Yo repongo» (01/09/2026)**: se vendió un artículo que estaba exhibido y el
  vendedor se hace cargo de reponerlo en la exhibición. Botón `🔄 Yo repongo` en la
  tarjeta (al lado de «Comentar», en todos los modos): abre una hoja con **dónde está
  en el depósito** (ubicaciones + stock + talles), avisa si quedó en cero, y firma —
  en el **puesto** eligiendo el perfil como en Comentar, en sucursal con el perfil
  activo. Queda pendiente en una lista compartida de la sucursal (botón con badge al
  lado del historial; en el quiosco va arriba a la derecha) hasta que alguien toca
  **«✓ Repuesto»**, desde el drawer o desde la propia tarjeta; el ✕ lo saca si se
  tomó por error. Un pendiente por artículo. Firebase: nodo `reposicion/<id>` de la
  sucursal `{artKey,codigo,descripcion,ubic,por,avatar,ts,hecho:{por,ts}}`, se baja
  en cada poll junto con las consultas y `podarConsultas` borra los repuestos de más
  de 7 días. Decisión de Juli: pizarra simple, sin vencimientos ni aviso al encargado
  (eso queda para más adelante si hace falta controlar el cumplimiento).
- **Actividad (04/09/2026)**: la pestaña abre con **«🚫 Lo que buscan y no aparece»**
  (búsquedas sin resultado de los últimos 7 días, agrupadas por texto, con cuántas veces,
  quiénes y hace cuánto: o el artículo está y falta cargarlo, o es demanda que no tenemos)
  y **«🔄 Reposición del salón»** (repuestos de la semana, los que siguen pendientes y
  quiénes repusieron). Antes `renderActividad` descartaba con `if(!c.key) return` toda
  consulta sin artículo, así que las búsquedas de texto no llegaban a ninguna pantalla;
  ahora el ranking de buscadores también las cuenta.
- **Búsquedas guardadas solas (01/09/2026)**: el historial de consultas ya no depende
  de tocar la tarjeta. Toda búsqueda queda registrada a los 1,4 s de dejar de tipear
  (desde 3 caracteres): un solo resultado → el artículo; varios → el texto y cuántos
  dio; sin resultados → también (sirve para saber qué piden y no está). Mientras se
  sigue tipeando se refina la MISMA fila (`zap` → `zapatilla run`, ventana de 3 min) y
  se mantiene el dedupe de 10 min por perfil. Tocar una búsqueda del historial la
  repite en el buscador.
- **Etiquetas de marca — código de barras EAN/UPC (04/09/2026)**: las etiquetas de
  Under Armour, adidas, Nike… traen el EAN del talle, no el código del sistema, y el
  export de stock NO puede traer ese dato (Juli). Se resuelve con un **mapa compartido
  por todas las sucursales** en `ubicaciones-mateu/ean/<gtin13>` =
  `{codigo, descripcion, t (talle), slug, por, ts}` + índice `ean/suf/<últimos 11>` →
  clave (tolera la lectora que recorta el primer dígito; si llegó recortado se guarda
  como `p<dígitos>`). Primera vez: «Sin resultados» + botón **«Vincular a un artículo»**
  (también en el toast del escaneo; puesto y encargado pueden) → hoja
  `abrirSheetVincularEan`: buscar el artículo, elegir talle opcional, guardar. Desde ahí
  el escaneo lo encuentra en cualquier sucursal (`eanResolver` = `eanLocal` por los
  `eans` del artículo + `eanRemoto` por el mapa, cacheado por promesa). Normalización
  en `gtin13`/`mismoEan`: solo dígitos, UPC-A de 12 = EAN-13 con cero adelante,
  igualdad por sufijo de 11 cuando uno vino recortado. Búsqueda, escaneo y Lista de
  retiro lo usan.
- **Importar el stock CON los EAN (08/09/2026, el reporte del sistema ya los trae)**: el
  mapeo de la carga tiene columna **«Código de barras» opcional** → `eans: [{e,t}]` por
  artículo (un EAN por talle si el export viene abierto). Cómo los toma:
  - **Detección**: el encabezado (`RX_EAN`) manda, pero se **valida el contenido**
    (`columnaEsEan`: mayoría de números de 12-14 dígitos) — la hoja «Base de Datos» de la
    planilla de Drive llama «Código de barras» al SKU y NO es un EAN. Sin encabezado que lo
    diga, se busca la columna por contenido (`colEanPorContenido`; en el export pelado,
    `eanShare` en vez del largo promedio, así no se confunde con el Id.item).
  - **La celda**: `eanDigits` acepta el EAN como número, con guiones/espacios, con `.0` de
    más y en notación científica **completa**; una científica recortada («7,7912E+12»,
    Excel ya perdió dígitos) se **descarta** en vez de inventar un código. `eansDeCelda`
    parte una celda con varios códigos.
  - **Reporte que identifica por EAN** (sin columna de código del sistema): el modal lo
    detecta y ofrece **resolver cada EAN al artículo** (índice `eanIndexCargar` = los `eans`
    ya cargados + todo el mapa compartido; `eanIdxBuscar` tolera el dígito recortado). Sin
    resolver, cada talle entraría como un artículo distinto — lo avisa en rojo. Las filas con
    un EAN que nadie vinculó todavía no se cargan y se listan en la vista previa.
  - **Se fusionan, no se pisan**: los EAN nuevos se suman a los del artículo (tope
    `EAN_MAX_ART` = 80), así una carga sin la columna no borra los vinculados a mano.
  - **Se comparten**: al terminar la carga, `eanCompartir` publica en el mapa `ean/` los
    códigos que no estaban (de a 250, sin pisar nunca un vínculo existente), así sirven en
    todas las sucursales. El resumen de la carga muestra cuántos y el ⇩ Excel del módulo
    suma la columna «Cód. barras». Tests: `node --test lib/ean.test.js`.
- **Berisso «no me toma el EAN» (23/09/2026)** — dos causas, las dos arregladas: (1) el export
  «stock diario» del sistema trae **«Código barras» = el SKU** y **«Código EAN» = el EAN**, y viene
  ordenado por código, así que en las primeras filas (Addnice…) «Código EAN» trae la etiqueta del
  proveedor con el talle pegado (`ADUC18903A29!03!34`), no un número: `columnaEsEan` miraba las
  primeras 200 filas (63 %) y descartaba la columna → la carga entraba **sin ningún EAN**. Ahora
  muestrea toda la columna salteando filas (Berisso da 88 %) y, con varios encabezados que suenan a
  código de barras, `detectarEncabezado` elige el primero cuyo CONTENIDO es EAN. (2) **El mapa
  compartido `ean/` estaba sucio**: una carga de Calle 49 del 09/09/2026 con la columna de código
  apuntando al género/subrubro publicó 6.982 EAN (Nike, Adidas, Puma, 47 Street…) vinculados a
  «02-HOMBRE», «03-DAMA», «06-UNISEX», «VARIOS», y `eanCompartir` nunca pisa lo que ya está, así que
  las cargas correctas posteriores no lo corregían: en cualquier sucursal, escanear una etiqueta
  Nike «tomaba el código» pero resolvía a un artículo que no existe. Se reparó con un script de la
  sesión (6.675 reescritas desde los `eans` de los artículos de las sucursales + el export de
  Berisso, 307 borradas; respaldo `Descargas/respaldo-ean-ubicaciones-2026-09-23.json`) y Berisso
  recibió sus 5.994 EAN directo en `articulos/<key>/eans` (respaldo `respaldo-ubicaciones-berisso-…`).
  Candados nuevos: `eanCodigoBasura` (`RX_COD_BASURA`) — un vínculo a género/subrubro/rubro cuenta
  como «sin vincular» en `eanRemoto` y en `eanIndexCargar`, y `eanCompartir` no publica un «artículo»
  con más de `EAN_MAX_ART` (80) códigos ni uno basura. Además **`mismoEan` tolera el EAN-13 leído con
  12 dígitos** (la lectora que recorta el primer dígito: «le faltan números»): antes `gtin13` lo
  tomaba por UPC-A y no coincidía nunca; ahora se compara por los últimos 11 cuando lo leído no
  llega a 13. Tests en `lib/ean.test.js`.
  **Revisión de las demás sucursales (mismo día)**: con el mapa reparado, todo lo que dicen los
  locales (Calle 49, Aurelius 12 y 5, Plaza, Diagonal, Berisso) coincide entre sí y con el export del
  sistema; Ensenada carga sin EAN (su planilla no los trae). La única otra falla estaba en **Calle
  47**: su planilla del 23/09 traía 33 EAN repetidos en dos artículos (la curva de una campera Puma
  también en un pantalón Givova, la de una Nike en un Under Armour, Salomon en Fila…), y `eanLocal`
  devolvía el primero que encontraba. Se limpiaron (respaldo `respaldo-ubicaciones-calle-47-…`) y
  la carga ahora lo resuelve sola: un EAN que viene en dos artículos queda solo en el que dice el
  mapa compartido `ean/<gtin>` (si el mapa no lo conoce, en ninguno, y no se comparte); el resumen
  de la carga lo cuenta en ámbar («Códigos de barras que el Excel traía en dos artículos»).
- **Etiquetas con el código del proveedor y el talle pegado (15/09/2026, reclamo de Calle 49 por
  Givova)**: la etiqueta de Givova escanea `CGE26010109033S` (sin el prefijo de marca y con el talle
  al final, sin símbolo) y el artículo es `GIVCGE26010109033`. `codigoConTallePegado` prueba el
  código tal cual y sin las 3 letras de marca, y exige que lo que sobra sea un talle (del artículo o
  `RX_TALLE_PEGADO`); si hay más de un artículo posible no elige. **Head** mete color/curva antes del
  talle (`HFDC516CPH29CP39`, `HFDC52243H294338`, `HFDA63001SML01XS`): ese tramo (2-3 letras o 2
  dígitos, + 2 dígitos opcionales) se acepta solo si el talle final es uno del artículo. Se ignoran
  los separadores que meten algunas lectoras (`HFDC516PNH29!PN!37`). Lo usan la búsqueda, el escaneo
  y la Lista de retiro. Con el historial de Calle 49 resolvió 33 búsquedas sin resultado (15 Givova,
  12 Head, 3 Atomik `26111344301WB37` → `ATM26111344301WB`) sin cambiar ningún código que ya
  andaba. No se resuelven las que llegan con el primer carácter recortado (`5010103041S`): es la
  configuración de la lectora.
- **Sin conexión (10/09/2026, reclamo del puesto «a veces no busca»)**: la búsqueda es
  local (catálogo en memoria), así que tiene que seguir andando aunque se corte internet.
  `fetchJSON` lleva tope de tiempo (15 s; el catálogo 90 s) — antes un pedido colgado no
  fallaba nunca. `refrescarDatos` **nunca pisa con vacío**: un pedido fallido devuelve
  `undefined` y se conserva lo anterior (antes un corte a mitad de la descarga dejaba
  `articulos` en `{}` y el puesto no encontraba nada por 10 min). Aviso `avisoSinConexion`
  («la búsqueda sigue funcionando con los datos de las HH:MM»), refresco inmediato con el
  evento `online`, un solo ciclo de polling por «generación» (`pollGen`: los ciclos colgados
  ya no se suman al apagar/prender la pantalla) y el catálogo se serializa para comparar solo
  cuando se baja, no cada 5 s. El EAN que no se pudo consultar muestra «No se pudo consultar…
  ↻ Reintentar» y el error no queda en `_eanCache`. El puesto monta la pantalla a los 8 s
  aunque los perfiles no respondan.
- **Plano de la sucursal (14/09/2026, Ensenada)**: el plano que dibuja la sucursal en Excel (una hoja
  por planta: «Salon», «Deposito», «Deposito 2»; cada mueble es una celda combinada **celeste
  `FF8FC1E3`**, lo blanco con rótulo es PC/caja/baño/probador/vidriera y lo blanco sin rótulo es un
  hueco) se convierte con `python scripts/gen-plano-sucursal.py "<xlsx>" <slug>` en
  **`shared/planos-sucursal.js`** (`window.PLANOS_SUC[<slug>]`, fusiona con las otras sucursales) y lo
  dibuja **`shared/plano-suc.js`** (`window.PlanoSuc`: `bloque`/`svg`/`celdaEst`/`celdaNombre`, SVG con CSS
  `ps-` propio; proporción de celda del Excel en `aspecto`). En el salón cada mueble es un **sector**; en
  un depósito, una **estantería**: las numeradas conservan el número y las que tienen nombre reciben los
  números libres (Ensenada: 1–7 en Depósito, 8/9/17/18 en Depósito 2 junto a 10–16; nombre «Estantería 5 ·
  ind. hombre»; los muebles sin rótulo = «Sin nombre N», decisión de Juli). El cruce con el Buscador es
  **por número de estantería** (`est<N>`). En el Buscador: pestaña Estanterías con el plano (verde = con
  artículos, tocar lleva a la tarjeta) y **«🗺 Crear las N estanterías del plano»** (pide módulos por
  estantería; orden = depósito por depósito, por número); botón **«🗺 Plano»** en la tarjeta del artículo
  (sus estanterías en rojo); el piso sale del plano cuando hay más de un depósito dibujado (`depositoDe`,
  antes que `DEPOSITOS_SUC`); **«Yo repongo»** muestra el depósito y deja tocar el **sector del salón** de
  donde se sacó (`sector:{id,nombre}` en `reposicion/<id>`, arranca con el último usado para ese artículo)
  y el pendiente lleva «🏬 Va en el salón» + desplegable «🗺 Ver en el plano». En **Tareas → Sectores de
  marcas**, «Dónde» se puede elegir tocando el plano del salón y el 📍 de la tarjeta lo abre. Sucursal
  nueva = correr el generador con su Excel (sin tocar código).
  **Berisso (24/09/2026)**: su plano («PLANO DEPOSITO BERISSO.xlsx», dos hojas «Depo Arriba Calzado» y «Depo Arriba
  Ind.», sin salón) está dibujado con **formas** (Insertar → Formas), no con celdas: el generador ahora lee el dibujo
  (`leer_formas`) y lo pasa a una grilla cuadrada de `UNIDAD_EMU` (aspecto 1): rectángulo gris con rótulo = estantería,
  blanco con rótulo / globo = servicio, rayado = **pared** (tipo nuevo `pared`, gris en `plano-suc.js`); flechas, vidrios
  e imágenes se ignoran; los girados 90° se enderezan. El número sale de lo que sigue a «Estantería» («IND. HOMBRE
  ESTANTERIA 1» = 1): **1–6 indumentaria y 7–23 calzado, los mismos que Berisso ya usa en el Buscador**; los muebles con
  nombre (Accesorios ×4, Medias ×3, Calzado verano, Reservas, Garantías, Pelotas, Bolsos, Mochilas) toman 24–36 y el
  botón «🗺 Crear las N estanterías del plano» los ofrece. Nombres de las plantas (Juli): **«Depósito izquierda · calzado»**
  (7–23) y **«Depósito derecha · indumentaria»** (1–6), fijados en `NOMBRES_PLANTA` del generador. Sin salón dibujado, `renderPlanoBox` pone los dos primeros
  depósitos arriba, y todo lo del sector del salón queda oculto.
  **El plano vive debajo de la búsqueda (17/09/2026, pedido de Juli)** — desde el 18/09 **debajo de los
  resultados** (`#planoBox` va después de `#searchResults`: primero se ve el artículo, después el plano): panel `#planoBox`
  (`renderPlanoBox`, plegable y recordado en localStorage `ubic_plano_open`) con el salón y el/los
  depósitos uno al lado del otro — en celular una tira deslizable horizontal. **Ocupa todo el ancho de la
  ventana** (17/09 tarde, «quedaron chicos»: el panel es full-bleed con `width:100vw` + `margin-left:
  calc(50% - 50vw)`) y va en **dos escalones** (pedido de Juli del mismo día): arriba,
  a la izquierda el **Salón** y a la derecha el **depósito principal**, mitad y mitad con 28 px de
  separación y hasta 70vh de alto (a 1800 px: 866×700 cada uno); abajo, los **depósitos secundarios**
  más chicos (hasta 30vh), porque el Depósito 2 de Ensenada casi no se usa. `renderPlanoBox` arma
  `.pp-fila1` (salón + primer depósito) y `.pp-fila2` (el resto); en celular se apilan. **El depósito
  donde está lo buscado sube arriba** (18/09/2026, pedido de Juli): `reordenarPlanos` (lo llama
  `pintarPlanoSel`) mueve la tarjeta ya dibujada de ese depósito a la fila de arriba y baja las demás,
  sin rehacer los SVG; si el artículo también está en el principal, o no hay búsqueda (la búsqueda
  vacía llama a `seleccionarArt(null)`), vuelve el orden natural. Tocar un plano lo abre **en grande** en el modal
  (`abrirPlanoGrande`, hasta 78vh; `#modalBody.plano-big` lo ensancha y `cerrarModal` saca la clase). Al buscar un artículo
  (un solo resultado se elige solo; con varios, tocando la tarjeta) se **resalta en rojo con destello**
  (`PlanoSuc.destellar`, animación `ps-flash`) dónde está guardado —su estantería, que sale de la
  ubicación— y dónde se exhibe —el sector del salón—, y la cabecera del panel dice estantería · módulo ·
  depósito · sector (`ARTSEL`, `pintarPlanoSel`, `seleccionarArt`). Anda igual en el **puesto** del salón.
  ⚠ **El sector del salón se marca a mano** (decisión de Juli 17/09/2026: no se deduce de la descripción):
  botón «🏬 Sector del salón» en la tarjeta (encargado, depósito y puesto) → hoja con el plano
  (`abrirSheetSector`); se guarda en **`articulos/<key>/salon` = `{id, nombre, por, ts}`**, lo ve todo el
  local y el sector que se elige en «Yo repongo» también lo deja marcado. `sincronizarStock` lo conserva
  (y lo recupera de `ubicMemoria`), así la carga del día no lo borra.
- **Artículos nuevos sin ubicar** (prioridad del depósito): «nuevo» = `fechaAlta`
  posterior a la **primera carga** de la sucursal (cada carga graba un único
  timestamp; así el día 1 no se marca todo) y ≤ `NUEVO_DIAS` (7). Se destacan con
  banner ámbar arriba de Buscar («⚡ N artículos nuevos sin ubicar» + «Ver nuevos»),
  filtro «⚡ Nuevos» en la cabecera de SIN UBICAR (se activa solo al cerrar el
  resumen de una carga con nuevos), etiqueta «⚡ Nuevo · ingresó hoy/ayer/hace N
  días» en la tarjeta (borde ámbar), siempre primeros en la lista y marcados con ⚡
  en la impresión. Dejan de ser "nuevos" al ubicarlos (`esNuevo`, `nuevosLista`).
- **Puente con el escáner del sistema (`scripts/puente-escaner/`, 09/09/2026)**: un
  script de AutoHotkey corre de fondo en la PC del salón, detecta la ráfaga de la
  lectora cuando el vendedor escanea **parado en el sistema** (tipeo velocísimo, se
  descarta lo que tipea una persona) y publica el código en
  `ubicaciones-mateu/scanBridge/<slug>` = `{codigo, ts, pc, test?}` (el `ts` lo pone el servidor con `.sv`).
  El Buscador lo escucha (`iniciarScanBridge`) y dispara `procesarEscaneo`, el MISMO
  circuito que la lectora local: resuelve el EAN de la etiqueta, resalta la tarjeta y
  registra la consulta. Una pasada de lectora, las dos pantallas. Escucha por SSE y
  cae a **polling cada 2,5 s** si el navegador no tiene `EventSource` (Win7 con IE),
  si la conexión falla o si no abre en 4 s (el `open` apaga el polling); anda en los
  modos `puesto` **y** `sucursal` (la cuenta del local también sirve, no solo
  `NN-consulta@`). El código `PUENTE-TEST` (menú de la bandeja → «Probar el puente»)
  no busca nada: muestra «Puente conectado ✔», que es la prueba de punta a punta.
  Cada escaneo se atiende UNA vez (`sbVistos`, marca = `ts|codigo`): **en cada
  reconexión Firebase reenvía el último valor del nodo**, y sin eso el quiosco
  repetía solo el escaneo anterior. Lo primero que se lee al conectar se ignora
  (es lo que quedó guardado), **salvo que sea de menos de 60 s** — si no, una pasada
  hecha justo antes de que la pantalla empiece a escuchar se perdía en silencio.
  **Cada pantalla sigue a UNA PC (12/09/2026, reclamo del puesto «toma las búsquedas de los
  otros puestos y me las pisa»)**: `scanBridge/<slug>` es de la SUCURSAL, así que un escaneo en
  cualquier PC del salón le cambiaba la búsqueda a todas las pantallas (y cada una lo registraba
  en el historial con el perfil de SU puesto). Ahora `sbAceptar(pc)` filtra por la PC elegida
  (`ubic_scan_pc_<slug>` en localStorage: `'<PC>'` · `''` ninguna · `'*'` todas; sin elegir anda
  como siempre **mientras se haya visto una sola PC** —`ubic_scan_pcs_<slug>`—, y al aparecer la
  segunda deja de seguir escaneos ajenos y avisa). **La pantalla se vincula SOLA** (12/09/2026, pedido de Juli «que no tengan que elegir»): el
  puente escucha el teclado de TODA la PC, así que si alguien escana con esa pantalla a la vista,
  la lectora escribe en la página (`sbMarcarLocal` en el handler de la lectora local) **y** el
  puente de esa misma PC publica el mismo código; cuando llega el eco (`sbEsEco`, ventana de 8 s)
  esa PC es la propia → se empareja sin preguntar y el eco no se reprocesa. Respaldos para la
  pantalla donde nunca escanean: **`?pc=NOMBRE`** en la URL (lo abre «Vincular la pantalla de esta
  PC» del menú del puente, v2.1 del `.ahk`; el evento `storage` avisa a las otras pestañas) y el
  botón **📡 Escáner** (`abrirModalEscaner`; en el puesto va en el pie, en la cuenta de sucursal en
  la barra de estado). El cartel de «Probar el puente» OFRECE emparejar, nunca lo hace solo: la
  prueba la reciben todas las pantallas de la sucursal. El escaneo ajeno no se pierde: lo
  registra en el historial la pantalla de la PC donde se escaneó.
  **Se vincula sola (12/09/2026, pedido de Juli: «que no tengan que elegir la PC»)**: el puente
  escucha el teclado de TODA la PC, así que al escanear con el Buscador abierto pasan las dos
  cosas juntas — la lectora escribe en la página y el puente de ESA PC publica el mismo código.
  Si lo que llega del puente es el **eco** de un escaneo que la pantalla acaba de leer por teclado
  (`sbMarcarLocal` en el `keydown` + `sbEsEco`, ventana `SB_ECO_MS` = 8 s), esa PC es la suya: se
  empareja sola y el eco no se vuelve a procesar. El botón 📡 Escáner queda para corregir a mano o
  para una pantalla sin lectora propia; el puente suma **«Vincular la pantalla de esta PC»** en el
  menú de la bandeja, que abre `ubicaciones/?pc=<NOMBRE>` (parámetro que empareja sin escanear; el
  evento `storage` repinta el botón en las otras pestañas). AHK v2.1.
  Prueba sin Firebase ni PC del salón: `npx --yes http-server -p 8777 -s .` +
  `node scripts/probar-puente-escaner.mjs sse|poll puesto|sucursal` (Playwright con
  Chromium, intercepta la base con datos de prueba).
  ⚠️ La **v1 no publicaba nada**: el PUT a Firebase se hacía asincrónico y el objeto
  `WinHttpRequest` se liberaba al salir de la función, así que Windows cancelaba el
  envío (ahora es sincrónico y se lee el status); además juntaba las teclas con
  `Input` letra por letra (se le escapaban caracteres de las lectoras rápidas → ahora
  `InputHook`, con el `Input` viejo solo de respaldo), no aceptaba el Enter del pad
  numérico ni las lectoras sin tecla final, y del lado del Buscador escribía el texto
  en el campo de búsqueda en vez de pasar por `procesarEscaneo` (una etiqueta EAN no
  encontraba nada). Causas de campo que no son bugs: el sistema corriendo **como
  administrador** (Windows no le deja ver las teclas a un programa común: hay que
  ejecutar el puente como administrador) y **Windows 7 sin TLS 1.2** (KB3140245).
  Todo eso está en `scripts/puente-escaner/LEEME.txt`, que es lo que se les manda a
  las sucursales.

## Área de Producto (`equipo/`) — Control F8

`equipo/index.html` self-contained (lee la sesión del Portal). David (Indumentaria &
Accesorios) y Daniel (Calzado) suben sus F8s; el módulo los cruza contra la
estadística de transferencias del sistema. Calibrado con archivos reales 25/08/2026.

- **F8 (.xlsx)**: parser por encabezados (fila con `ORIGEN`; soporta layouts
  distintos: con/sin columna MARCA, ORIGEN en col A o B, columna DESTINO por fila o
  matriz con una columna por sucursal). El rótulo `TOTAL` puede estar en cualquier
  fila de la cabecera y el valor 1-2 columnas a la derecha (merges). La **fecha del
  F8 sale del nombre del archivo** (`F8 18-08-2026.xlsx`); re-subir el mismo F8
  (operador+archivo+fecha) REEMPLAZA al anterior. La marca sale de la columna MARCA
  si existe; si no, por prefijo del código (`BRAND_MAP2`). ⚠ `RUGE-EDLP` con guion:
  la `/` es ilegal como clave Firebase y hacía fallar el guardado en silencio.
  **Destino `Todo <sucursal>` sin unidades** = mandar todo lo que haya: entra al
  cruce con control laxo (hubo envío → «Hecho», cuenta como exacto sin comparar
  cantidades; nada → «No ejecutado»); plan mostrado como «Todo» (regla de Juli 26/08).
- **Transferencias (.csv ;-separado, latin1)**: el sistema lo exporta en VARIAS
  variantes (con/sin fila de encabezado `…;Enviado;…`, con/sin Id.item, y el orden
  origen/código/destino cambia). Las columnas se detectan por **contenido puro**:
  sucursales = prefijo `NN-` (1ª origen, 2ª destino), código = la columna con letras
  que no es sucursal, enviado = la del rótulo «Enviado» o la primera decimal
  (`1,00`/`1.00`) tras código y destino, Id.item = enteros largos; filas «Total» se
  saltean. Queda **guardado en Firebase**: lo sube uno y lo ven todos; subir
  otro lo reemplaza («✕ quitar» lo borra).
- **Cruce**: clave `origen+código+destino` (normalización `nrmF8`/`nrmT` con mapa
  `DEST_MAP_F8`, pliega acentos). Estados: Exacto / Con diferencia / No ejecutado.
  El control se agrupa por la **sucursal que ENVÍA**; 100% = mandó todo exacto.
  Calendario por sucursal×fecha + tarjetas + tabla con filtros y **⇩ Excel**.
  **«Enviados sin F8»**: transferencias no pedidas en ningún F8 — chip en los
  números del cruce (clic lo lista), opción en el filtro de casos y línea 📤 por
  sucursal en las tarjetas. Incluye TODO lo transferido (también cupones/perchas):
  es la foto fiel del export.
  **Reporte semanal**: botón «📋 Reporte semanal» en Control F8 → ranking 🟢/🟡/🔴
  por efectividad, con «⧉ Copiar» (WhatsApp) y «📣 Publicar en la Bandeja»
  (`mensajes-mateu/avisos`); banner recordatorio vie-dom si la semana no salió
  (flag `equipo/reporteSem/<semanaISO>`).
  **Tolerancia** (pedido de Juli 27/08: entre el F8 y el envío hay ventas/fallas):
  selector en Control F8 (exacta/±10/±20/±30, default ±10%), compartida en
  `equipo/config/tolerancia`; línea con envío dentro del margen = cumplida
  (badge «±Tolerancia»); enviar cero nunca se tolera. El reporte declara la vara.
- **Circuito F8 → sucursal (27/08/2026)**: al subir un F8 se REPARTE por sucursal
  de origen a `equipo/f8suc/<slug>/<f8id>` (mapa `SLUG_EQ` canónico→slug del
  Portal) con aviso opcional por directo de la Bandeja. La sucursal lo ve en
  **Mi Sucursal → «F8 para armar»** (`secF8` en `indicadores/`): visto al abrirlo,
  dos descargas (ver abajo), y **confirmación artículo por artículo** (✓ enviado / ✗ +
  motivo de `MOTIVOS_F8`). En equipo/: tabla «Seguimiento del circuito»
  (recibido/visto/descargado/confirmado) y el cruce suma dos estados: 
  **Justificado** (✗ con motivo, sin transferencia — cuenta para la efectividad) y
  **⚠ CRÍTICO** (✓ de la sucursal SIN transferencia real = intento de engaño).
  Aviso doble a cada cuenta de la sucursal: directo por la Bandeja + **mail real**
  (EmailJS: servicio del turnero + template `template_s38ov8s`, conectado 27/08).
  **Recorrido de armado**: el Buscador de Artículos (`ubicaciones/`) tiene pestaña
  «F8s» (badge de pendientes; el puesto no la ve): cruza el F8 con el stock local
  (Id.item, respaldo código) y ordena el picking por estantería/módulo, con
  imprimir/descargar; la confirmación ✓/✗+motivo también se puede hacer ahí
  (misma escritura en `f8suc`). **Control en el Panel General (30/08)**: la vista
  Cadena de `indicadores/` suma la sección «F8 para armar · control» (`secF8Cad`,
  `renderF8Cad`/`pintarF8Cad`): baja `equipo/f8suc` completo (solo gerencia) y
  muestra quién está al día y quién tiene F8 sin confirmar (tabla: sucursal, F8,
  artículos, hace cuántos días, estado sin abrir/visto/descargado), con el filtro
  por línea. El detalle sigue en equipo/.
- **Descargas del F8 (11/09/2026, pedido de Juli)** — `shared/f8-descargas.js`
  (`window.F8Descargas`, se incluye SIN defer). Las usan Mi Sucursal («F8 para armar») y la
  pestaña **F8s del Buscador de Artículos**, que es donde lo ve, lo baja y lo confirma la
  **cuenta de depósito** de la sucursal (no entra a Mi Sucursal). El aviso de F8 nuevo también
  le llega por la Bandeja (`cuentasDeSucursal` suma el rol `deposito`); link directo `ubicaciones/?tab=f8s`.
  ⚠ **Mail real (EmailJS) solo a las cuentas `sucursal`/`outlet`** (11/09/2026): `deposito.<suc>@` y
  `consulta.<suc>@` son mails ficticios — rebotaban y agotaron los créditos de EmailJS. `notificarF8`
  los saltea por rol (`ROLES_SIN_MAIL`) y por prefijo (`mailFicticio`); solo reciben el directo.
  Dos botones. **«⇩ Descargar F8»** (`descargarF8`, ExcelJS por cdnjs) arma la
  **planilla OFICIAL del operador** solo con las líneas de la sucursal: **Daniel** = hoja
  `Hoja1`, logo arriba a la izquierda, «F / 8», fecha, «DANIEL» + nro «NF8-…», 7 curvas en
  G1:G7 con los talles desde la I, encabezado negro en la fila 7 (ORIGEN · MARCA · CODIGO ·
  ARTÍCULO · DESCRIPCIÓN · DESTINO) y TOTAL en la AI; **David** = hoja `F8`, logo en B3:C8,
  «F8 ACCESORIOS» + fecha, 6 curvas en G3:G8 con talles desde la H, encabezado en la fila 9
  (sin MARCA) y Total en la AF. **«🖨 Planilla de recorrido»** (`abrirRecorrido`) abre una hoja
  imprimible (A4 apaisado) con cada artículo agrupado por estantería/módulo según las
  ubicaciones del Buscador (`ubicaciones-mateu/sucursales/<slug>/articulos|estanterias`,
  cruce por Id.item y código como en su pestaña F8s; pisos de Diagonal en `DEPOSITOS`, copia del mapa del Buscador),
  destino con cantidad y talles, stock por talle con las mismas fichitas de la tarjeta del Buscador
  (cero en rojo, con borde los talles que pide el F8; la lista de retiro del Buscador también las lleva,
  `pickingStockTallesHtml`), «sin ubicar» / «no está en el
  stock» aparte y firmas; desde ahí «Descargar Excel» (`recorridoExcel`). Las dos marcan
  `descargado`. **Corregir la confirmación** (mismo día): en un F8 ya confirmado cada fila tiene «✎ Corregir»
  (Mi Sucursal `f8EdCelda`/`f8EdGuardar`, Buscador `f8uEdCelda`/`f8uEdGuardar`; gerencia no corrige) → ✓/✗ +
  motivo → PATCH solo de `conf/lineas/<i>` = `{ok, motivo, ed:{ts, por, antes:{ok, motivo}}}` + `conf/editado`;
  la fila dice «(corregido)» y el Seguimiento de equipo/ «· corregida». Los F8 abiertos quedan abiertos al repintar.
  ⚠ **La pestaña F8s no se repinta sola (12/09/2026, reclamo del depósito: «se la pasa actualizando»)**:
  el polling general del Buscador corre cada 5 s y antes rehacía toda la pestaña en cada vuelta (parpadeo del
  «Cargando F8s…», scroll perdido, marcas a medio hacer). Ahora los F8 se consultan cada `F8_REFRESH_MS`
  (**5 min**; 30 s le pareció demasiado seguido a Juli — un F8 nuevo llega una o dos veces por día y además
  avisa por la Bandeja, y entrar a la pestaña o el botón **«↻ Buscar F8 nuevos»** (`f8Actualizar`) consultan al toque)
  y el HTML se rehace SOLO si lo bajado es distinto de lo que está en pantalla (`_f8Hash` vs. `_f8HashPintado`,
  `refrescarF8sAuto`) y nadie está marcando (`f8Ocupado`: marcas sin enviar, una corrección abierta o el foco
  dentro de la pestaña); los ✓ / ✗ / ✎ Corregir repintan SU celda (`f8uCeldaHtml`/`f8uRepintarCelda`, td con
  `data-f8c`), no la tabla. `renderF8s` = bajar + `pintarF8s`; `pintarF8s` = solo DOM (conserva el scroll). Para eso **equipo/ guarda más datos al repartir** (`parseF8` +
  `f8DetectarCurvas`, copia de la de ubicaciones/): por línea `m` marca, `ds` descripción,
  `cv` lo que dice la columna de curva («4», «Todo», «UNI»), `k` curva resuelta, `x` la
  columna H del de Daniel y `q = [[índice de talle, unidades]]`; por doc `curvas =
  [{n, t:[rótulos]}]` y `hdr = {nro, titulo}`. Los F8 repartidos antes no tenían talles: se
  completaron el 11/09 los de 14-08 (David) y 19-08 (Daniel), que estaban en Descargas
  (verificado línea por línea); 21, 24 y 26-08 bajan con el total solo y una nota. Sin
  `curvas` en el doc se usan las del operador horneadas en `F8_CURVAS_DEF`.
- **Firebase** (`turnero-mateu`, nodo `equipo/`): `f8s/<id>` (objeto por id, alta
  con PATCH — así las subidas simultáneas no se pisan), `ctrl` (registro manual,
  legacy), `transf` (export vigente `{archivo,subido,por,filas:[[o,c,d,art,env]]}`),
  `f8suc/<slug>/<f8id>` (reparto + tracking + conf), `config` (tolerancia),
  `reporteSem/<semana>` y `foco/<ym>/<rubro>__<slug>` (checklist del «Foco del mes», ver
  Reporte Mensual). Eliminar un F8: botón 🗑 en el Historial (PATCH null).
- **Foco del mes (06/09/2026)**: sección arriba del Dashboard (pantalla inicial de
  `producto@`) con la base de trabajo mensual de Daniel (Calzado) y David (Indumentaria +
  Accesorios) que sale de «Meses de stock» del último Reporte Mensual: sucursales a achicar
  (≥ 6 meses), a reponer (< 3) y a vigilar, con ratio, variación % vs. el mes anterior,
  unidades de más / faltantes, checkbox ✓ y nota ✎ compartidos. Reglas en
  `shared/foco-stock.js`; link «Ver el Reporte Mensual →» al deck.
  **Descarte de gerencia** (`FOCO_ADMIN` = julian@): botón ✕ en cada ítem → motivo opcional
  → `{descartado:true, motivoDesc}`; se ve tachado, no se puede marcar, no cuenta en el N/M
  ni en el cierre; ↩ lo vuelve a incluir. **Cierre del mes** (`renderFocoCierre`,
  `FocoStock.evaluar`): cuando hay un Reporte Mensual más nuevo, el foco del mes anterior
  se evalúa con sus ratios: **resuelta** (entró a 3–5) · **mejoró** (se acercó ≥10 % de lo
  que le faltaba) · sin cambio · **empeoró** · sin dato; cumplimiento % = resueltas +
  mejoraron / evaluadas (verde ≥70, ámbar ≥40, rojo), «declaró trabajadas X de N» y alerta
  ⚠ por las marcadas como trabajadas que no mejoraron. Tarjeta por operador debajo del foco
  con detalle desplegable, «⧉ Copiar» y (Juli) «📣 Enviar por la Bandeja». **Aviso
  automático**: la primera vez que alguien abre el módulo con el reporte nuevo cargado, se
  manda el resumen por directo `producto@ → julian@` (`FOCO_CIERRE_AVISO`) y se marca
  `equipo/focoCierre/<ym>/avisado`; solo para meses ≥ `FOCO_DESDE` (2026-09, cuando arrancó
  el checklist; los cierres anteriores se ven pero no se avisan solos).

## Evaluaciones de Supervisor

`evaluaciones/` es un `index.html` self-contained **igual que el resto**: lee/escribe
a Firebase por REST (base `evaluaciones-mateu`). Carga operativa+actitudinal
por sucursal, con ranking, gráficos, seguimiento de puntos de mejora y vista de
encargado. Se evaluó pasarlo por Pages Functions + D1 para tener permisos en el
server, pero Juli eligió mantenerlo consistente con el resto (seguridad blanda).

- **Dos tipos de evaluación (24/08/2026)**: la **visita SEMANAL** (el detalle de cada
  recorrida de Cristian) y la **evaluación MENSUAL, que es la oficial** — la que cuenta
  para la nota final de la sucursal. El selector «Tipo» está en Ranking, formulario,
  Gráficos y vista de encargado; **la vista por defecto es la mensual**. La mensual se
  nutre de las semanales: el form muestra las visitas del mes (tarjetas con nota y
  «Ver»), en cada ítem los valores semana a semana con una **sugerencia**
  (`E.sugerirMensual`: promedio de puntos → valor más cercano, en `lib/evaluacion.js`
  con tests) y un botón «⤓ Precargar ítems desde las semanas» que llena los vacíos.
  Una semana ISO pertenece al mes de su **jueves** (`mesDeSemana`). Árbol: la mensual
  va en `evaluaciones_mensuales/<suc>__<YYYY-MM>` (campo `mes`; mismo formato que la
  semanal); las semanales siguen en `evaluaciones/<suc>__<semana>`. Los
  **puntos_mejora nacen SOLO de las semanales** (circuito operativo); la mensual
  guarda sus planes en sus items.
- **Notificaciones por la Bandeja** (directos `mensajes-mateu`, best-effort): al
  **guardar una evaluación** (estado enviada) les llega a gerencia
  (`GERENCIA_MAILS`), al supervisor (`SUPERVISOR_MAIL` = cristian.campion@) y a la
  cuenta de la sucursal evaluada (se resuelve con
  `discontinuos-mateu/usuarios` → `emailsDeSucursal(slug)`); cuando el encargado
  **marca resuelto un punto** o deja un **descargo**, le llega a Cristian.
- **Descargo del encargado en los puntos de mejora**: botón «💬 Agregar descargo» en
  su vista (ej.: "no tenemos insumos de limpieza") → `puntos_mejora/<id>/comentario`
  (+ por/en); el supervisor lo ve en el form y en el detalle.
- **Campana flotante compartida**: `shared/notificaciones.js` (la misma campana del
  Portal/Indicadores como componente del shell: se inyecta sola, no hace nada si la
  página ya tiene `#notifWidget` o no hay sesión). Se incluye con una línea en el
  `<head>` **antes de `tutorial.js`** (así el «?» se corre arriba de la campana):
  `<script src="../shared/notificaciones.js" defer></script>`. Hoy la incluye
  `evaluaciones/`; cualquier módulo puede sumarla con esa línea.

- **Cálculo** (`lib/evaluacion.js`): única fuente de verdad del puntaje/nota
  (Bien 10 · Regular 5 · Mal 0; Operativa/50 + Actitudinal/50; A≥80 B≥60 C≥40 D<40).
  Es UMD isomórfico (browser + node): lo usan el módulo, el generador y los tests
  (`node --test lib/evaluacion.test.js`). NO cambiar la escala sin que Juli avise.
- **Base Firebase**: `evaluaciones-mateu` (ya conectada; la URL está en la constante
  `EVAL_DB_URL` en `evaluaciones/index.html` y en el Portal para el badge). Reglas
  abiertas (`.read`/`.write` true), como el resto. Árbol:
  `evaluaciones/<suc>__<semana>` + `puntos_mejora/<pushid>`. Si `EVAL_DB_URL` queda
  vacía, cae a modo demo con `evaluaciones/mock-data.js` (no persiste).
- **Rol nuevo `supervisor`** (además de admin/sucursal/outlet): su alcance (qué
  sucursales ve/edita) se carga en el ⚙ del Portal (multiselect →
  `usuarios/<mail>/sucursales` en `discontinuos-mateu`), y el módulo lo lee de
  `session.sucursales`. Gerencia = `admin`; encargado = cuenta de `sucursal`/`outlet`.
  Hoy hay un solo supervisor: `cristian.campion@mateu.com.ar` (cubre todo).
- **Alcance por rol es "blando" (en el cliente)**, como el resto del portal: ordena
  accesos, no es barrera dura.
- **Datos de demo** (`node scripts/gen-evaluaciones-mock.mjs`): regenera
  `evaluaciones/mock-data.js`. Reusa `lib/evaluacion.js` para el puntaje.
- **Cruce con Meses de Stock** (§ ratio): lee `window.STOCK_DATA` de
  `gestion-stock/datos-meses-stock.js` con el mismo mapa slug→nombre que Indicadores.

**Puesta en marcha (crear la base y pegar la URL): ver `docs/EVALUACIONES-SETUP.md`.**

## Análisis de Reserva Depósito Central

`barrida/` (carpeta/URL se mantiene; el nombre visible es **«Reparto de Mercadería»** desde el
11/09/2026 — antes "Análisis de Reserva Depósito Central"; se cambia en `TOOLS` del Portal, de
`header.js` y de Indicadores, en `tutorial.js` y en el `<title>`) es un `index.html` self-contained (lee la sesión del Portal, sin
login propio). Lo corre el **depósito / gerencia** semana a semana (típico: los lunes) para
decidir la reposición de la semana anterior. La ve el rol `admin` o quien tenga la
herramienta `barrida` en su lista; las sucursales NO entran acá (ven su aviso en
Indicadores, ver abajo).

- **Entrada = subir Excel** (client-side, SheetJS por CDN, no se sube nada hasta
  guardar). **Ya no hay pestaña «Cargar» (07/09/2026, pedido de Juli): la carga es una tarjeta
  compacta arriba de Reposición** (`cargaHtml`/`wireCarga`): tres botones ⇧ Ventas por sucursal ·
  Reserva depósito · Stock por sucursal (opcional), selector de semana, Procesar y 💾 Guardar en
  la misma pestaña, más una línea de resumen (artículos, reponibles, unidades, parada, curvas,
  fuentes de prioridad, guardada/sin guardar). El botón usado manda el tipo (`cargarFilesComo`:
  una hoja con Sucursal va a ventas o stock según el botón; la reserva siempre a reserva); la
  tarjeta acepta arrastrar archivos (se clasifican solos). Con ventas + reserva **se procesa
  solo**. Reposición es la primera pestaña (`state.tab='reposicion'`).
  **El stock por sucursal se guarda por semana** (pedido de Juli 07/09: se sube una vez por
  semana y lo usan todas las barridas de esa semana, otro día u otra compu): al subirlo,
  `guardarStockSemana()` escribe `barrida/stockSuc/<lunesISO>` = `{meta:{archivo,hoja,subido,por,
  semana,ids,filas}, data:{<id>:{<slug>:[[talle,cant],…]}}}` (solo talles positivos, como pares).
  Al abrir el módulo o cambiar la semana, `cargarStockSemana()` trae el `meta` (liviano) y el botón
  muestra «✓ Stock por sucursal · de la semana»; `asegurarStockData()` baja el `data` recién al
  procesar. `stockRows()` unifica las dos fuentes (archivo cargado manda; `R.stockOrigen` =
  archivo|base). Un archivo nuevo pisa el guardado; Guardar la barrida también guarda el stock si
  no quedó bajo esa semana. Dos hojas: **ventas por sucursal** (columna `Sucursal` + `ID ITEM` +
  columnas por talle) y **reserva del depósito** (sin `Sucursal`, `ID ITEM` +
  columnas por talle). Puede ser un archivo con las dos hojas o dos archivos: se
  autodetecta cuál es cuál por los encabezados. Cruce por **`ID ITEM`**, abierto por
  talle. ⚠️ La hoja de reserva trae una columna final **`Total`** (suma de la fila):
  se excluye de los talles a propósito; si se contara, **duplicaría el stock**.
  **Columnas descriptivas (corregido 08/09/2026)**: el export real es `Sucursal · Rubro ·
  Marca · Grupo 1 · Disciplina · Subrubro · Articulo · Id Item · Codigo de barras · talles`
  (la reserva, igual pero sin `Sucursal`). El sistema llama **«Grupo 1»** al tipo de producto
  (CALZADO ADULTO), **«Disciplina»** a CASUAL/RUNNING/FUTBOL 11 y **«Subrubro»** al género
  (02-HOMBRE, 03-DAMA). Hasta el 08/09 el mapa posicional estaba corrido y el filtro
  «Subrubro» mostraba disciplinas; ahora hay **un filtro por cada uno** (Tipo de producto ·
  Disciplina · Subrubro, los dos últimos multi-selección) y los valores se muestran sin el
  prefijo numérico (`opts`/`fmulti` aplican `stripNN`; el valor real no cambia). La hoja
  «reporte stock global» rotula la columna Marca con el nombre de la marca filtrada
  («Puma»): por eso el respaldo posicional sigue haciendo falta.
- **Salida = dos alertas por sucursal**: **Reposición** (artículo con reserva Y venta
  en una sucursal → sugerido por talle = `mín(vendido, reserva)`; los talles donde
  `vendido > reserva` van en **rojo** + pill ⚠ falta en el artículo = reserva no
  alcanza, señal de recompra a la marca; filtro "Solo con faltante de talle").
  La columna **Talles** es un **casillero por talle** (`talleChip`, rediseñada 08/09/2026:
  antes era la línea «41 1/13», en la que no se sabía qué era cada número): arriba el talle,
  en grande **cuántas unidades van** y abajo el porqué («de 13» = lo que hay en reserva;
  en rojo «pedía 3» = la reserva no alcanzó y por prioridad le tocó menos). Los talles de
  «Completar curva» usan el mismo casillero en verde («+1 · no tiene»). El tilde
  **«Solo lo que se puede mandar»** (ex «Solo con talle disponible») oculta las líneas sin
  nada para bajar: hay reserva del artículo pero no en los talles que la sucursal vendió.
  Botón **⇩ Excel** (las tres pestañas exportan): estilo ExcelJS como el OC de
  Managment — membrete, header navy, autofiltro, freeze. La de **Reposición** replica
  la planilla física del depósito ("REPOSICIÓN CALZADO / ADIDAS"): título dinámico
  según el rubro/marca filtrado + columnas **Código · Artículo (ID ITEM) · Descripción
  · Destino · [talles = cantidad a mandar] · Total**; talles faltantes en rojo. Desde el
  07/09/2026 (pedido de Juli) la de Reposición va **sin fila de resumen y sin las analíticas**
  (Vendido · Reserva · Falta · Prioridad · Meses stock · Categoría), todo en negrita, filas de
  alto 25, fondo blanco y bordes finos en todas las celdas (sin bandas ni separadores gruesos). Parada y Compras: header navy +
  autofiltro (Compras antepone Categoría y tiñe rojo/verde según sin/con reserva). Los tres
  exports **repiten el membrete y los encabezados arriba de cada hoja al imprimir**
  (`pageSetup.printTitlesRow`; Reposición además repite Código..Destino a la izquierda con
  `printTitlesColumn`) — pedido de Juli 08/09/2026.
  Y **Reserva parada**
  (reserva y CERO venta en toda la cadena). El Depósito y filas basura (`Sucursal`)
  se excluyen de la demanda; se puede filtrar `Varios/Facturación` (gift cards,
  cupones). El grano fino es art×sucursal.
- **Vista Compras** (pestaña `compras`, **solo para `COMPRAS_MAILS`** = julian@ y julian.demarco@ —
  pedido de Juli 08/09/2026: al depósito no le sirve; para sumar a alguien, un mail más en esa
  constante. Sin permiso la pestaña se saca del DOM y `setTab`/`viewCompras` rebotan a Reposición):
  mirada por **artículo global** (no por sucursal), ranking por vendido en la cadena,
  en tres grupos: **mejores vendidos SIN reserva** = reponer a la marca (recomprar),
  **mejores vendidos CON reserva** = solo seguimiento, y **artículos frenados** (= la
  reserva parada). "Mejores" usa un umbral `Vendidos ≥` (default 3, ajustable); el
  badge del tab y los KPIs usan ese umbral. Incluye un resumen "a quién reponer" por
  marca de lo sin reserva. Se guarda en el payload (`compras`) para el histórico.
- **Prioridad de reposición (07/09/2026, pedido de Juli — «que no queden en duda»)**: hasta ahora
  cada sucursal pedía `mín(vendido, reserva)` por su cuenta y varias podían pedir la misma
  reserva de un talle (eso era el rojo). Ahora en `computar` hay un **reparto por artículo ×
  talle**: si la suma de lo pedido entra en la reserva, todas reciben lo suyo; si no, se reparte
  en orden de `cmpPrioridad`: **1) vendido del artículo** en la sucursal esa semana (empate: lo
  vendido de ese talle), **2) meses de stock** de la sucursal en la **marca-rubro** (último mes
  de `gestion-stock/datos-meses-stock.js`, cargado lazy en `cargarStockData` al procesar; sin
  dato de la marca cae al rubro; sin dato, al final), **3) categoría** de la sucursal
  (`asignacion-marcas-mateu/asignacion_marcas`, mapa `SLUG2MARCAS`, `CAT_RANK` cat1 > cat2 =
  aurelius = adidas > outlet; respaldo `CAT_SEED`). `prioInfo(slug,marca,rubro)` → `pr:{ms,
  msNivel, cat, catRank}` en cada fila; `prio`/`prioDe` = puesto entre las sucursales del
  artículo. El talle recortado guarda `s < v` (`rec`); `faltaEn` (global) = algún talle con
  `s < v`; la vista muestra «v/r → s» en rojo, columna «Prioridad» con tooltip (`prioTxt`), el
  export suma Prioridad · Meses stock · Categoría y la pantalla Cargar un banner con las
  fuentes usadas (`prioFuentes`, también en `meta`). El mismo comparador ordena el reparto de
  «Completar curva».
- **Completar curva (07/09/2026, pedido de Juli)**: tercera hoja **opcional**, el **stock por
  sucursal abierto por talle** (mismo layout que ventas: Sucursal · … · ID ITEM · talles). Por
  encabezados no se distingue de ventas: `clasificarHoja` mira el nombre de la hoja y del
  archivo («stock»/«existencia» → stock, «venta» → ventas; si no, ventas) y el chip de Cargar
  tiene «↔ es stock por sucursal» (`swapVentasStock`). **No es una pestaña: es el tilde
  «Completar curva de talles» de Reposición** (`filtros.curva`, al lado de «Solo con talle
  disponible», deshabilitado sin hoja de stock; pedido de Juli 07/09 tarde). Con el tilde,
  `reposFiltradas()` fusiona en cada fila de reposición los talles de curva de esa sucursal
  (`curvaFaltan`, `curvaU`; `sugerido` pasa a ser reposición + curva y `sugRep` guarda la
  reposición sola) y agrega filas `soloCurva` (pill verde) para sucursales que no vendieron
  pero tienen el artículo incompleto; los chips verdes «41 +1/6» van a continuación de los de
  reposición (`curvaChips`) y el badge muestra «(+N)». Definición (`computar`, `R.curva`): la
  sucursal **tiene stock en ≥ `minTalles` talles** (default **2**: un talle suelto es un resto,
  no una curva) y le faltan talles con stock ≤ 0 en la sucursal y > 0 en reserva; por defecto
  se **excluyen los artículos sin venta en ninguna sucursal** (`ventaCadena`, = reserva parada;
  control «Incluir artículos sin venta»). Reparto (`aplicarUnidadesCurva`): por artículo ×
  talle se descuenta primero lo de Reposición (`usoRep`) y el resto va a las sucursales en
  orden de `cmpPrioridad`, `unidades` por talle (1/2/3) hasta agotar (`agotado`, chip gris
  «agot.»); un talle que ya va por Reposición se marca `ya`. Controles (solo con el tilde):
  unidades, «al menos N talles», «solo huecos internos» (`marcarInternos`/`rankTalle`),
  «incluir sin venta». Export ⇩ Excel: la cantidad del talle = reposición + curva, subtítulo
  «+ COMPLETAR CURVA DE TALLES». Se guarda `barrida/barridas/<lunes>/curva/<slug>` **solo si el
  tilde estaba puesto** = `[{…, sugerido, prio, pr, talles:[{t,r,s}] (faltantes),
  tiene:[{t,q}]}]` + `meta.archivo_stock` y `meta.curva_param` (`activa`…); al abrir del
  histórico el tilde vuelve como se guardó. La sucursal lo ve en Indicadores (bloque «talles
  para completar la curva» dentro de «Reposición disponible») y el **Picking** lo suma al armar
  el pick (check «Incluir Completar curva», `curvaDe`).
- **Panel de Reposición reordenado (08/09/2026)**: los 6 selects, los 5 tildes y el botón de
  Excel estaban todos sueltos en la misma línea. Ahora es una tarjeta `.fpanel` con dos filas:
  arriba **qué mirar** (Sucursal · Rubro · Marca · Tipo · Disciplina · Subrubro · Buscar) y
  abajo, separadas por una línea, las opciones agrupadas en **Mostrar** (solo lo que se puede
  mandar · excluir Varios · solo con faltante) y **Sumar al pedido** (Completar curva · Vaciar
  la reserva chica), con «Limpiar filtros» y ⇩ Excel a la derecha. Debajo, **chips con los
  filtros puestos** (`chipsFiltros`, ✕ para sacar uno de a uno), los parámetros de curva y
  vaciado como bloques `.fmodo` (verde y azul, en el mismo orden que sus tildes, con cuántas
  unidades aporta cada uno) y una **tira de resumen arriba de la tabla** (`.resu`: líneas,
  unidades a bajar con el desglose por venta/curva/vaciado, líneas con faltante, artículos y
  sucursales) — antes ese total estaba solo al pie. La explicación larga de la tabla pasó a un
  desplegable **«¿Cómo se lee esta tabla?»** (`<details class="ayuda">`), abierto la primera vez
  y después como lo deje el usuario (localStorage `barrida_ayuda`).
- **Vaciar la reserva chica (08/09/2026, pedido de Juli)** — es un **MODO de la vista, no un
  extra**: al tildarlo la lista queda SOLO con los artículos de poca reserva (`R.vacArts`,
  `reposFiltradas` filtra por ahí), con el título «Vaciar la reserva chica» y su propio Excel
  (`vaciado-reserva-<lunes>.xlsx`). La primera versión los sumaba a la reposición normal y se
  seguía viendo todo lo demás: no servía para la tarea, que es limpiar el depósito. En
  **calzado e indumentaria**
  (`esVaciable`), un artículo con muy poca reserva no tiene sentido en el depósito: conviene
  repartir lo que queda y que viva en las sucursales. Tilde **«Vaciar la reserva chica»** en
  Reposición (apagado por defecto) + dos controles: «reserva del artículo de hasta N unidades»
  (default **5**, sumando TODOS los talles) y «dejar el talle si todas ya tienen N o más»
  (default **3**). Se calcula en `computar` (candidatos: las sucursales que lo **vendieron**
  esta semana o que lo **tienen en stock**) y el reparto lo hace `aplicarVaciado()` con los
  parámetros de pantalla: por talle, sobre lo que queda después de la reposición normal, **de
  a una unidad por vuelta** en orden de `cmpPrioridad`. **Excepción**: si TODAS las candidatas
  ya tienen `minSuc` o más de ese talle, el talle **se deja** en el depósito (`R.vacDejados`,
  casillero gris «se deja») para no pasarles el límite de stock del local; necesita la hoja de
  stock por sucursal (sin ella se baja todo y lo avisa). **Mínimo del artículo (10/09/2026,
  pedido de Juli)**: control «Mandar solo si la sucursal tiene del artículo» (`filtrosVac.minArt`,
  default **2**; «sin mínimo» = 0): la sucursal con menos de N unidades del artículo (todos los
  talles) queda **afuera de ese artículo entero en el modo vaciado — también de la reposición por
  venta** (caso PUM31273108: Gonnet lo vendió pero ya no tenía, Calle 55 tenía 1; una unidad suelta
  no arma nada). `aplicarVaciado` arma `R.vacFuera` (id → {slug: stock}), no descuenta su
  reposición de la reserva (esas unidades se reparten entre las que sí lo tienen) y, si ninguna
  llega al mínimo, deja los talles (`vacDejados` con `sinSuc`). `reposFusionadas` pone esas filas en
  cero con el aviso «no va · tiene N» (se ven destildando «Solo lo que se puede mandar»); el ⇩ Excel
  y el guardado las omiten; `meta.vaciado_param.minArt`. Necesita la hoja de stock por sucursal.
  La separación «Reparto inicial» / «Barrida» por días desde la última compra (idea de Juli del
  10/09/2026) quedó hecha el 11/09: ver «No repartir lo nuevo» abajo.
  Los artículos que se vacían salen del
  reparto de «Completar curva» (bajan enteros igual). En pantalla: casilleros azules
  «+N · vaciar» y filas <span>solo vaciado</span> (sucursales que no lo vendieron pero lo
  tienen). En el ⇩ Excel la cantidad del talle = reposición + curva + vaciado. **Al guardar,
  el vaciado se SUMA a la reposición de cada sucursal** (no va en un nodo aparte: para el local
  es la misma mercadería que baja, y así lo ven sin cambios Indicadores y el Picking), con el
  campo `vaciado` por fila y `meta.vaciado_param`. ⚠️ Pendiente que definió Juli: usar la
  **curva de talles** (velocidad de venta por talle) como criterio adicional.
- **No repartir lo nuevo — «Días u.compra» (11/09/2026, pedido de Juli)**: el reporte de stock del
  depósito ahora trae, **por talle**, dos columnas: `Stock` y `Días u.compra` (días desde la última
  compra de ese talle). Viene con **dos filas de encabezado**: arriba el talle repetido dos veces y
  abajo «Stock | Días u.compra | Stock | …» (+ `Total | Total` al final, que se descarta; el total de
  días es el mínimo de la fila). `detectarCols` lo reconoce (`conDias`: alguna columna de la zona de
  talles dice «compra»/«días») y toma el rótulo del talle de la fila de ARRIBA; cada talle queda con
  `idx` (stock) y `diasIdx`. `filasDeHoja` devuelve `dias:{talle:d}`. Sin esa columna todo sigue
  igual. Los días **varían entre talles del mismo artículo** (p.ej. CAVEN III: 7–9.5 con 0 días y
  10–11 con 48), así que el filtro es **por talle**. **0 días = compró hoy** (validado: los artículos
  en 0 son justo los de los remitos 0005-00047640/43, los últimos de septiembre).
  Control en el grupo «Ingreso» del panel: tilde **«No repartir lo que ingresó hace menos de [N]
  días»** (`filtros.sinNuevos` + `filtros.diasNuevo`, default 10, se recuerdan en `barrida_prefs`;
  cambiar el número ya prende el tilde). Se aplica en `computar`: el talle con compra de hace menos
  de N días sale de la reserva repartible (`R.nuevos[t]={q,d}`, `R.nuevoU`; `R.totalDepo` = todo lo
  que hay) → no baja **por venta, ni por curva, ni por vaciado** (un artículo con mercadería nueva no
  es «reserva chica»). Compras y el snapshot del histórico usan `totalDepo`; un artículo con solo
  mercadería nueva y sin venta no es reserva parada. Como cambia lo que se reparte, el cambio llama a
  `recalcular()`, que rehace el cruce con los archivos y lo ya bajado de la base (`state._proc`, lo
  guarda `procesarBarrida`) y deja la semana «sin guardar». En pantalla: casillero violeta
  **«nuevo · N d»** (`esNuevoRet(d)`: `d.nv` unidades nuevas, `d.nd` días; se ve con «Ver los talles
  que no hay», no cuenta como faltante ni «hay que comprar», no va al Excel), pill «nuevo · sin
  repartir», «Stock reserva» con «+N» nuevas y en la tira de resumen «N u. nuevas sin repartir».
  Una barrida abierta del historial no trae días: el control queda deshabilitado. Se guarda
  `meta.dias_param = {reservaConDias, activa, dias, unidades, articulos}`. El «Reparto inicial» lee el
  reporte nuevo igual (`repReserva` usa `filasDeHoja`), todavía sin usar los días.
- **Pestañas por usuario e Historial (11/09/2026, pedido de Juli)**: `logistica@` y `deposito@`
  (`SOLO_REPARTO_MAILS`) ven solo **Barrida de reserva** y **Reparto inicial** (se les quita Reserva
  parada; Compras ya era solo de `COMPRAS_MAILS`). La pestaña «Histórico» **ya no existe para nadie**:
  es el botón **«🕘 Historial»** a la derecha de la barra de pestañas, que abre un panel (`#histPop`,
  fuera de `#view`, `pintarHistorial`/`abrirHistorial`/`cerrarHistorial`) con **buscador** por fecha
  («08/09», «2026-09»), mes o año; «Abrir →» llama a `abrirBarrida`. Se cierra con clic afuera o Esc.
- **Barridas por MARCA + RUBRO (13/09/2026, pedido de Juli)**: el depósito barre «Adidas calzado»,
  «Nike calzado», «X indumentaria»… por separado. Antes cada «Guardar semana» escribía la semana
  entera y la marca siguiente pisaba a la anterior. Ahora `computar` devuelve `R.segmentos`
  (`segDe(marca,rubro)` = marca normalizada + rubro sin «NN-») y `guardarBarrida` baja la semana
  guardada y la **fusiona** (`fusionarSemana`): conserva las filas de reposición / curva / parada /
  compras de las OTRAS marcas-rubros y reemplaza solo las de las que trae el archivo (compras solo
  guarda lo de lo barrido); recalcula `meta.totales` (`totalesSemana`) y registra
  `meta.partes/<marca|rubro>` = `{marca, rubro, articulos, unidades, generado_en, generado_por,
  archivos}`. Si esa marca-rubro ya estaba guardada pide confirmación (no al volver a guardar una
  semana abierta del historial). `reservaHist/<lunes>` se escribe con PATCH (suma). La tarjeta de
  carga muestra «Ya guardado esta semana: Adidas · CALZADO …» (`cargarPartesSemana` /
  `partesSemanaHtml`; en ámbar ↻ la que se pisaría). Mi Sucursal y el Picking no cambian: leen
  `barridas/<lunes>`, que ahora tiene todo lo barrido en la semana. **El stock por sucursal también
  se guarda por partes**: `stockSuc/<lunes>/partes/<firmaSegs>` = `{meta:{…, segs, marcas}, data}`;
  `cargarStockSemana` junta los meta de todas las partes (con el formato viejo `{meta,data}` de
  respaldo) y `asegurarStockData` fusiona los data (la carga más nueva manda). Si el stock guardado
  no trae la marca-rubro que se está barriendo, la tarjeta lo avisa. «No repartir lo que ingresó
  hace menos de N días» **viene prendido por defecto** (prefs `v:2`: el valor apagado de las
  preferencias viejas no se toma). En el **Reparto inicial**, los ingresos sin remito
  (`repNuevosSinRemito`) se limitan a las marcas-rubros de los remitos marcados, o a los filtros
  Marca/Rubro si no hay remitos (`repFiltroSegSel`), así un reparto de Puma no arrastra lo nuevo de Nike.
- **Reparto por artículo, no por sucursal (08/09/2026, aclaración de Juli)**: el depósito agarra
  el artículo y lo reparte a todas las sucursales de una (ir local por local sería doble trabajo).
  Por eso el orden por defecto de la tabla y del Excel es **`sortRep.k='art'`**: los artículos que
  más unidades bajan primero y, dentro de cada uno, las sucursales por prioridad.
- **Qué queda en el depósito (08/09/2026)**: columna **«Queda»** por artículo = reserva −
  todo lo repartido (`restantePorArt()` sobre `reposFusionadas()`, que son las filas con curva y
  vaciado sumados y SIN los filtros de navegación); en azul los que salen enteros, y la tira de
  resumen cuenta cuántos artículos quedan en cero.
- **Se repite de la semana pasada (08/09/2026)**: al procesar, `cargarSemanaPrevia()` baja la
  reposición de la última barrida guardada anterior (`barridas/<lunes>/reposicion`, agregada por
  `id|slug`) y la fila lleva el chip **↻ repite** con cuántas unidades se le habían sugerido:
  o no se ejecutó el envío, o el artículo rota y hay que recomprarlo. Tilde «Solo lo que se
  repite» y contador en la tira. (De paso, `cargarHistKeys` pasó a `?shallow=true`: bajaba TODAS
  las barridas enteras solo para leer las claves.)
- **Curva de talles (08/09/2026, pedido de Juli)**: `curvaDeTalles()` calcula con la venta de la
  semana de todas las sucursales cuánto pesa cada talle, agrupado por **rubro + tipo de producto**
  (CALZADO ADULTO y CALZADO NIÑO tienen escalas distintas); ordenados de más a menos: **fuerte**
  = primer 60 % de la venta acumulada, **medio** hasta el 90 %, **flojo** la cola. Se usa en dos
  lados: el rótulo del casillero se tiñe (navy pleno / claro / apagado, con el % en el tooltip) y
  el control **«Solo talles que rotan»** de Completar curva no gasta reserva en los de la cola.
  Validado con el export real: en calzado adulto los fuertes son 8.5 · 8 · 9 · 9.5 · 7.5 (escala
  US), y el 47/48 caen en la cola.
- **Preferencias del depósito (08/09/2026)**: filtros, tildes, parámetros de curva/vaciado y orden
  se recuerdan en el navegador (`localStorage barrida_prefs`; la búsqueda no).
- **Sugerido vs. enviado (08/09/2026)**: cuarto botón opcional **«⇧ Transferencias»** en la
  tarjeta de carga: se sube el export de transferencias del sistema (CSV `;`-separado latin1 o
  Excel) y `parseTransf` cruza lo que la barrida sugirió con lo que realmente salió del depósito.
  Columnas por CONTENIDO, igual que el Control F8 de `equipo/` (mantener en sintonía), con dos
  arreglos propios: **la columna de sucursal se valida contra `NAME2SLUG`** (el rubro y el
  subrubro también empiezan con «NN-»: 02-CALZADO, 02-HOMBRE) y **el código de artículo empieza
  con letras y trae dígitos**, desempatando por cantidad de valores distintos. Reconoce el export
  simple (origen · destino · código · enviado) y el **pivot anual con una columna por mes**
  («Estad transferencias <año>»), del que toma el mes de la semana de la barrida y lo avisa.
  Solo cuenta lo que sale del depósito (`esDeposito`, con acentos plegados: el sistema escribe
  «05-Depósito»); si el export no trae ninguna salida del depósito, cuenta todo y lo aclara.
  Cruce por **Id.item** con respaldo por código. En la tabla, columna **«Enviado»** con estado
  (✓ completo · ⚠ parcial · ✗ sin salir · + sin estar en la barrida), tilde «Solo lo que falta
  enviar» y un **% de cumplimiento** en la tira de resumen. Si esa semana ya está guardada, el
  cruce se guarda en `barridas/<lunes>/transf` y vuelve al abrirla del histórico.
- **Reparto automático + tope de calzado + agrandar la curva (11/09/2026, pedido de Juli)** — reemplaza
  lo de los tildes que se describe más arriba:
  - **«Completar curva» y «Vaciar la reserva chica» se aplican SIEMPRE** («no encuentro escenario donde no
    quiera»): ya no hay tildes. La curva va siempre que haya stock por sucursal (`R.conStock`) y el
    vaciado siempre que haya artículos de reserva chica; `reposFusionadas` suma los dos a las filas, el
    guardado siempre graba `curva/<slug>` y suma el vaciado a la reposición. Sus parámetros (bloques
    verde y azul) quedan siempre a la vista. El ex «modo» vaciado es ahora un filtro de vista: grupo
    **«Ver solo»** con `filtros.verSoloCurva` / `filtros.verSoloVac` (título y Excel «Vaciado» cuando
    está puesto «Reserva chica»).
  - **Tope de calzado** (`filtros.topeCalzado`, default **3**, select «Calzado · Tope por talle en la
    sucursal»: sin tope / 2–5): con lo que se le manda, la sucursal no pasa de N unidades de ese talle,
    aunque haya vendido más. Se aplica en `computar` (objetivo = mín(vendido, N − lo que tiene); campos
    `d.tiene` y `d.top`; totales en `R.tope`), en `aplicarUnidadesCurva` (`capDe`) y en `aplicarVaciado`
    (`cabe`: si ninguna puede recibir, el talle «se deja» con `tope`). Necesita el stock por sucursal;
    cambiarlo llama a `recalcular()`. Casillero «de 13 · tiene 2» y, con «Ver los talles que no hay»,
    gris «— · tiene 3» para los que no van.
  - **Agrandar la curva** (`filtrosCur.centralHasta`, default **3**, select «Talles centrales con poco
    stock»: no agrandar / llevar a 2 / llevar a 3 si alcanza): en los talles **centrales** (la misma
    tabla del Reparto inicial, `centralesDe` → `repCentrales`; al procesar se bajan los editados de
    `repartoConfig/centrales`) donde la sucursal tiene 1 o 2, `computar` arma `row.engrosa=[{t,r,q,s}]`
    (y crea la fila de curva aunque no le falte ningún talle). `aplicarUnidadesCurva`, después de los
    talles faltantes y con la reserva que queda, sube por **rondas en orden de prioridad**: todas a 2
    y, si alcanza, a 3 (cuenta lo que tiene + lo que le va por venta; respeta el tope). Casillero verde
    «+1 · tiene 1» (`engChips`). Se guarda dentro de `curva/<slug>/talles` con `tiene` (Indicadores:
    columna «Te mandan»; `abrirBarrida` lo separa de los faltantes por ese campo).
  - **Abrir a más sucursales** (Juli 11/09/2026, a partir del informe «reparto automático vs. manual» de
    Puma: el depósito, a mano, le manda a sucursales que NO tienen el artículo cuando lleva días en la
    reserva y lo que baja por venta igual deja mercadería parada). Cuarto paso automático, después de
    venta → vaciado → curva (`aplicarReparto()` = `aplicarVaciado` + `aplicarUnidadesCurva` +
    `aplicarAmpliar`), con la reserva que dejaron los otros. **Artículo**: calzado o indumentaria, sin
    mercadería nueva, cuya compra más nueva (mínimo de «Días u.compra» entre sus talles, `ampBase` en
    `computar`) es de hace **N días o más, N = el mismo número de «Ingreso»** (`filtros.diasNuevo`,
    default 10: lo más nuevo va por el Reparto inicial); no entra si es reserva chica. **Candidatas**:
    sucursales con menos del mínimo del artículo del vaciado (`filtrosVac.minArt`, 2) que esa semana no
    reciben nada de él, con la marca en Asignación de Marcas (`repCandidatos`/`repAsig`, igual que el
    Reparto inicial; sin asignación cargada no entra) y con menos de 6 meses de stock en la marca-rubro.
    **Nunca Aurelius** (Juli: trabaja canal moda y modelos puntuales de cada marca, p.ej. en adidas solo
    Originals) **ni los locales Adidas** (`ampExcluida`). **Y al revés tampoco (11/09/2026, caso Court Vision
    Low negro NIKDH2987002 del informe Nike automático vs. manual): un artículo que en el stock por sucursal
    está SOLO en Aurelius es modelo del canal moda: se abre ÚNICAMENTE a Ecommerce, la web de Aurelius**
    (`AMP_WEB_AURELIUS`; es lo que hizo el depósito a mano con ese artículo: 11 pares a ecom). A la web no se
    le aplica el tope de 6 meses de stock (su ratio es el de toda la web). Ni Mateu ni outlets; contador
    `R.ampAurelius` en el bloque turquesa. Ese día eran 103 de los 452 Nike con stock. **Los outlets recién desde los 40 días**
    (`filtrosAmp.outletDias`, editable en pantalla). **Cuánto**: curva de arranque de `repRepartirArt`
    (2 en los centrales —«hasta 3 si alcanza»—, 1 en el resto, mínimo 3 talles y algún central, sin
    excedente) y queda 1 por talle en el depósito; la que tiene 1 unidad suelta cuenta como que no lo
    tiene (si no, recibía un talle suelto); respeta el tope de calzado. Si lo que sobra del artículo
    queda en menos de 3 talles (después de dejar la reserva) no se abre: sería una curva rota
    (`R.ampSinCurva`). Pantalla: bloque turquesa
    «Abrir a más sucursales» (parámetros + unidades/líneas/artículos + cuántos artículos viejos no
    tienen ninguna sucursal para abrir o no arman curva), casilleros turquesa «+N · abrir», pill
    «sucursal nueva», «Ver solo: Otras sucursales», suma al ⇩ Excel. Al guardar se SUMA a
    `reposicion/<slug>` (campo `ampliar`, `soloAmpliar` + `diasDeposito` en las filas nuevas;
    `meta.ampliar_param`), así Indicadores y el Picking no cambian. Prueba 11/09 con los reportes reales
    de Puma (escrituras a Firebase bloqueadas): 32 artículos califican, 22 se abren (201 u. en 35
    líneas), 10 sin sucursal para abrir y 13 que no arman curva. ⚠ En
    los artículos con más diferencia del informe (CARINA MIA, REBOUND V6) no hay a quién abrir: ya los
    tienen las 11 sucursales de línea y lo que falta son Aurelius (excluida) y outlets (tienen menos de
    40 días), así que esa diferencia no la explica esta regla.
- **Amarillo = va menos, rojo = no va nada; talles en orden (11/09/2026, pedido de Juli)**: en la
  columna Talles, el casillero que **recibe algo pero menos de lo pedido** (`0 < s < v`, la reserva no
  alcanzó y por prioridad le tocó menos) es **amarillo** (clase `corto`, pill «⚠ recortado» también
  amarillo); **rojo** (`rec`) queda solo para los que **no reciben nada** (`s = 0`: se lo llevó otra
  sucursal, o «no hay» con borde punteado). Lo nuevo retenido pasó a **violeta** para no confundirse con
  el amarillo. En el ⇩ Excel, igual: celda en 0 roja, celda con menos de lo pedido amarilla
  (`BRAND.cortoBg/cortoTxt`). Los casilleros de la fila (reposición + curva + vaciado + «se deja») van
  en **un solo recorrido de menor a mayor talle** (`cmpTalle`; `curvaChips`/`vacChips`/`dejChips`
  devuelven `[{t,h}]` y la fila los intercala; a igual talle, reposición primero).
- **Dos rojos distintos en los talles (08/09/2026, no se entendían)**: el casillero rojo decía
  siempre «pedía N» y mezclaba dos cosas. Ahora `talleChip` separa **«no hay»** (borde punteado,
  `d.r<=0`: el depósito no tiene NINGUNA de ese talle — no se la llevó nadie, hay que pedírsela
  a la marca) de **«de R · pedía V»** (hay stock pero no alcanza y por prioridad le tocó menos).
  El pill de la fila también: **⚠ hay que comprar** (`sinStockEn`) vs. **⚠ recortado**.
- **Por defecto NO se muestra lo que no se puede reponer (08/09/2026, pedido de Juli)**: para
  armar la barrida solo sirven los talles que bajan. `filtros.verRojos` (default **false**) oculta
  los casilleros que quedan en 0 —el depósito no tiene el talle, o se lo llevó otra sucursal— y
  los pills ⚠ de la fila; el ⇩ Excel tampoco lleva esos ceros ni sus columnas. El tilde
  **«Ver los talles que no hay»** (grupo Mostrar) los trae de vuelta, y el contador
  «N con faltante de talle» de la tira de resumen funciona como interruptor. «Solo con faltante
  de talle» lo prende solo. Los recortados que igual mandan algo (`s>0`) se ven siempre.
- **La tabla ya no se corta (08/09/2026)**: `main` pasó de 1200 a **1600 px** de ancho y los
  casilleros de la columna Talles van en un `div.tw` con `max-width:560px` y `flex-wrap`, así
  envuelven en vez de estirar la tabla fuera de la pantalla (a 1440 px ya no hay scroll lateral).
- **Tarjeta de carga plegada (08/09/2026)**: con la barrida procesada queda una sola línea
  (chips ✓ de los archivos, la semana, ↻ Reprocesar y 💾 Guardar); «⇧ Archivos» la despliega y
  «▴ plegar» la vuelve a cerrar (`state.cargaOpen`). Pasó de ~130 px de alto a 46.
- **Ingreso reciente / crónica**: NO hay columna de fecha ni SKU en recepciones, así
  que se resuelve con el **histórico semanal** guardado: un artículo que aparece por
  primera vez en la reserva = *ingreso reciente* (se separa de "parada"); "semanas"
  cuenta cuántas semanas seguidas lleva en reserva. En una sola semana el ~65% de los
  SKUs no vende → la lista "parada" cruda es ruidosa; el valor sale del filtro
  *crónica (3+ semanas)* que se acumula semana a semana.
- **Firebase**: **reusa la base `recepciones-mateu`** (la del Depósito Central, ya
  existe con reglas abiertas). Se descartó crear una base propia `barrida-mateu` para
  no depender de un alta manual; los datos viven en un nodo aparte `barrida/…` sin
  tocar el árbol `recepciones/…`. Constante `FIREBASE_DB_URL` en `barrida/` y
  `BARRIDA_URL` en `indicadores/`. Árbol: `barrida/barridas/<lunesISO>` con
  `{meta, reposicion:{<slug>:[...]}, curva:{<slug>:[...]}, parada:[...], compras:[...]}`,
  `barrida/reservaHist/<lunesISO>` (snapshot `{idItem:total}` para ingreso reciente /
  semanas) y `barrida/ultima` (puntero al último lunes). La reposición se guarda
  **agrupada por slug de sucursal** para que cada sucursal baje solo lo suyo (seguridad
  blanda, como Indicadores).
- **Aviso a la sucursal**: vive en **`indicadores/`** (la home de sucursal/outlet).
  La sección `secBarrida` lee `recepciones-mateu/barrida/ultima` + `.../reposicion/<slug>`
  y muestra "Reposición disponible" con lo que esa sucursal puede pedir del depósito.
  Sin dato → la sección no aparece. Usa el mapa `SUC2SLUG` (nombre→slug).

**Puesta en marcha: ya funciona (usa `recepciones-mateu`, que está en vivo). No hace
falta crear ninguna base.**

## Asignación de Marcas — Fichas por marca (`marcas/`, 13/09/2026)

Pedido de Juli: **detalle por marca de lo que va a cada tipo de local**. Antes el único detalle
era «Disciplinas ▸ / Modelos ▸» sucursal por sucursal en texto libre (83 de 243 asignaciones de
calzado, con grafías sueltas: «oRIGINALS», «futbo»). Ahora hay un botón **«📋 Fichas por marca»**
(solo admin) que abre un modal ancho: se elige la marca y hay **una columna por tipo de local**
(`TIPOS_LOCAL`: Cat 1 · Cat 2 · Mateu Kids · Ecommerce · Aurelius · Tiendas Adidas · Outlets;
`tipoDeSuc` = `suc.cat`, salvo `ms-kids` → kids y `ms-ecom` → ecom). Por tipo: **disciplinas /
líneas** (chips de `FICHA_DISC` por rubro + «otra»), **modelos puntuales**, **género** (Hombre /
Dama / Unisex / Niño), **precio máximo PVP** y **nota**. Solo se muestran los tipos que tienen la
marca asignada («Ver todos los tipos de local» los trae). Abajo, **excepciones por sucursal**: solo
los campos cargados pisan a los de su tipo (`fichaEfectiva`). Vacío = no restringe.
**«⤓ Traer lo cargado por sucursal»** (`fiImportar`) lee el texto libre de cada sucursal y lo
propone en su tipo (disciplina conocida → chip; «niño» → género; el resto → modelo), para revisar y
guardar. El modal «Disciplinas ▸» de cada sucursal muestra la ficha vigente (★ = excepción) y, para
admin, «ficha de la marca ▸».
- **Firebase**: nodo APARTE `asignacion-marcas-mateu/asignacion_marcas_fichas/<calzado|indumentaria>/<marca>`
  (clave = nombre sin acentos ni símbolos, `fichaKey`) = `{marca, tipos:{<tipo>:{disc, modelos,
  genero, precioMax, nota}}, exc:{<sucId>:{…}}, por, ts}`. No va dentro de `asignacion_marcas.json`
  porque «Guardar» de la asignación hace PUT del documento entero y la borraría. Se guarda marca por
  marca (PUT de esa marca; una ficha vacía se borra) con control por `ts` (avisa si otro la guardó
  mientras se editaba). No pasa por `asignacion_marcas_log`.
- **La usa el Reparto de Mercadería** (`barrida/`): `cargarCategorias` baja también las fichas
  (`cargarFichasMarcas`, `PRIO.fichas`) y `repAsig` descarta la sucursal si la ficha efectiva de su
  tipo no acepta el artículo (`fichaDe` / `fichaPasa`): **género** (niño/infante ↔ Niño; unisex
  entra en Hombre/Dama/Unisex) y, con el tilde «respetar disciplinas», **disciplina o modelo** (basta
  uno: la disciplina se busca en disciplina/descripción/tipo del artículo, el modelo en la
  descripción; un artículo sin disciplina no se descarta por disciplina). Aplica al Reparto inicial
  y a «Abrir a más sucursales» (los dos pasan por `repCandidatos`); la reposición por venta no. La
  ficha se suma a la nota de prioridad. **El precio NO se aplica**: los reportes no traen el PVP
  (queda informativo). Las reglas fijas del código (Mateu Kids solo niño, Aurelius nunca en «abrir»)
  siguen igual. Probado 13/09 con tests en node (herencia, excepción, género, disciplina, modelo).
- **Segunda tanda (13/09/2026, Juli cargando marca por marca)**: la ficha suma **«Curva»** (`plana`:
  '' normal · `nino` x1 plana en niño · `todo` x1 plana; en `repRepartirArt` el candidato `plana` recibe 1
  por talle, sin 3.ª unidad ni excedente), **«Prioridad en el reparto»** (`orden`, 1 = primera; en
  `cmpReparto` va después de la prioridad de niño) y **«Niño: cualquier disciplina o modelo»**
  (`ninoLibre`: la restricción de disciplina/modelo aplica solo al adulto). **Con ficha, el texto libre
  viejo de la sucursal (`b.d`) ya no filtra** (se contradecían). Las disciplinas del chip se comparan con
  las del sistema por equivalencias (`FICHA_DISC_RX`: Sandalias = CALZADO VERANO, Pádel = PADDLE, Fútbol =
  FUTBOL 11/5…; la lista `FICHA_DISC` se cruzó con el maestro `logistica/arts`). **Niño siempre prioriza
  Mateu Kids y Outlet Gonnet** (sector de niños, todas las marcas: `NINO_PRIO`, primero en `cmpReparto` y en
  `cmpPrioridad` de la barrida; en el Reparto inicial Gonnet entra a los destinos por defecto para niño).
  Cargado ese día (asignación rev 8 + fichas, respaldo previo en el scratchpad de la sesión): Adidas
  (Aurelius 12 y CB también niño Originals, x1 plana), Asics (solo D80 prioridad 1, CB 2 y Aurelius 5 con
  GEL-1130/GEL-NYC/GEL-KAYANO 14), Addnice y Footy (solo niño, todos los Mateu y outlets), 47 Street (dama
  casual; Cat 2, outlets y Ecommerce), Converse (Aurelius primero, casual; Mateu/outlets solo Chuck Taylor
  All Star clásicas), Crocs (Crocband y Classic, todos menos tiendas Adidas), Dr Martens (solo Aurelius 5),
  Fila (Aurelius Disruptor/Uproot/Superbubble; Cat 1 y Ecommerce solo niño; Cat 2 y outlets running adulto +
  niño todo), Kappa (solo outlets), Le Coq Sportif (Cat 2 y outlets, running y casual) y Montagne (Cat 2 y
  outlets, adventure y running, adulto), New Balance (en Mateu solo D80 1.ª y CB 2.ª; Aurelius sigue) y Nike
  (Cat 1 y Ecommerce todo; Cat 2 running/training/fútbol; outlets running; Aurelius los «alocados» Jordan,
  Dunk, Air Force). Después (asignación rev 11): Olympikus, Kappa y Under Armour solo outlets
  (outletizadas); ON solo Ecommerce 1.ª, D80 2.ª, CB 3.ª y Aurelius 5 casual; Salomon solo Cat 1 y Ecommerce,
  adventure; Timberland solo Aurelius 5 y 12; The North Face solo Diagonal 80; Umbro prioritaria solo en Cat
  2 y outlets, fútbol; Vans solo Aurelius.
- **Marca estratégica «por meses de stock» (13/09/2026, Puma)**: tilde de la ficha a nivel marca
  (`prioMS:true`, «Repartir por meses de stock»): en `cmpReparto` y en `cmpPrioridad` de la barrida, después
  de niño (Kids/Gonnet) y de deportes (D80/CB), va primero la sucursal con menos meses de stock de la marca,
  antes que la venta y la categoría (`fichaPrioMS`). Puma: todos los Mateu en todas las categorías, sin
  restricción de disciplina. Adidas y Nike (también estratégicas) todavía no lo tienen prendido.
- **Paredes de exhibición de running (13/09/2026, Juli)**: los locales exhiben por pared (hombre de un lado,
  dama del otro) dividida en sectores por disciplina, y cada marca necesita un mínimo de modelos para
  destacarse. Columna = 9 apoyacalzados con cada modelo ×3 en vertical = 3 modelos (`PARED_MOD_COL`). Mínimo
  en running: **Adidas 6 columnas (18 modelos), Nike y Puma 4 (12), el resto 2 (6)** (`PARED_COLS`,
  `PARED_COLS_DEF`). Solo Mateu Cat 1 y Cat 2 (no Kids, Ecommerce, Aurelius ni outlets). `calcParedes(stockRows)` cuenta
  por sucursal × marca × subrubro (HOMBRE/DAMA) los artículos de calzado running con stock en
  `PARED_MIN_TALLES` (**3**) talles distintos y **al menos uno central** del subrubro (tabla de centrales del
  Reparto inicial, `paredCentrales`/`paredValido`). **Unisex por talles** (`talleGenero`/`paredCuenta`, Juli):
  hasta el 39 AR (7 US/UK) es dama y desde el 40 (7.5) hombre; cada subrubro se evalúa con sus talles, así un
  unisex que llega hasta el 39 suma solo en dama (lo mismo para la prioridad, con los talles del artículo
  que entra). Se exige a las marcas con running en el stock cargado que la sucursal tiene
  asignadas y cuya ficha deja running en ese subrubro (`repAsig` con un artículo sintético). Se muestra como
  desplegable «🧱 Paredes de running incompletas» arriba de la Barrida de reserva y del resultado del Reparto
  inicial (`paredesHtml`), y en `cmpReparto` la sucursal con la pared incompleta de esa marca-subrubro pasa
  adelante (`paredIncompleta`, después de niño, «Prioridad» de la ficha y deportes; antes que meses de stock)
  en el Reparto inicial y en «Abrir a más sucursales». Para contar hace falta marca/disciplina/subrubro de cada
  artículo del stock por sucursal: desde este cambio `guardarStockSemana` guarda también
  `stockSuc/<lunes>/partes/<firma>/metas/<id>` = `[marca, rubro, disciplina, subrubro, tipo]` y
  `asegurarStockData` las baja (las cargas anteriores no las traen: con esas no hay alerta hasta volver a subir
  el stock). **Casual con la misma lógica (13/09/2026)**: `PARED_DISC = ['running','casual']` (`paredDisc`:
  casual/lifestyle/urbano); las columnas mínimas salen de la ficha de la marca (`pared:{running, casual}`,
  editable en Asignación de Marcas → Fichas por marca, «Pared (columnas)», solo calzado; `paredCols`).
  **En la Barrida (14/09/2026)**: la pared incompleta también pesa en «Vaciar la reserva chica» (`cmpVaciado`:
  niño → deportes → pared → `cmpPrioridad`) y en «Abrir a más sucursales» la sucursal con la pared incompleta
  entra aunque tenga 6+ meses de stock de la marca. La reposición por venta y Completar curva no la usan (no
  suman modelos nuevos). Mínimos de casual cargados: Adidas 4, Puma 2, Nike 2, 47 Street 2, Head 2, Atomik 2,
  Le Coq Sportif 2. Running
  sin dato en la ficha usa la regla general; **casual sin dato no se controla**. Juli dicta los mínimos de
  casual marca por marca por chat y se cargan directo en las fichas. **Adventure (21/09/2026)**: tercera disciplina controlada
  (`PARED_DISC` suma `adventure`; `paredDisc`: adventure/outdoor/trekking/montaña), sin dato no se controla, y el editor de
  fichas suma el campo «adventure». Cargado: Montagne 2 y Salomon 2. Ese día ninguna sucursal llegaba a 6 modelos de Montagne
  running; en adventure hombre llegaban Los Hornos, Plaza Italia, Calle 49 y Berisso (Ensenada 5) y en dama solo las dos primeras.
- **«Modelos automáticos» (13/09/2026, Puma en Aurelius; Juli eligió la regla automática antes que una lista
  fija)**: campo `autoPct` del bloque de la ficha: al tipo de local le van los modelos que en los últimos
  `AUTO_MESES` (6) meses tuvieron ese % o más de sus envíos del depósito a ese tipo (sin contar outlets).
  Barrida lo calcula desde logística (`logistica/arts` + `logistica/meses/<ym>/envios`, sucursal → slug →
  tipo) agrupando por modelo = dos primeras palabras de la descripción (`modeloDe`, sin WNS/JR/PS…), una vez
  por mes nuevo de logística, y lo guarda en `barrida/modelosTipo` = `{mes, meses, generado, data:{<rubro>:
  {<marca>:{<modelo>:{<tipo>:u}}}}}` (`cargarAutoModelos` / `autoShare`). Un modelo sin historia no entra (se
  agrega a mano en «Modelos puntuales», que suma con la regla); sin datos de logística no se descarta nada.
  Puma → Aurelius con 50 %.
- **Meses de stock por SUBRUBRO (13/09/2026, Juli: «ver por rubro, disciplina y subrubro para abastecer a
  las que menos cobertura tienen»)**: `mesesStockDe(slug, marca, rubro, genero)` toma primero el segmento de
  la marca del género del artículo (DAMA / HOMBRE / NIÑO / INFANTE / UNISEX de `datos-meses-stock.js`), después
  la marca y después el rubro (`msNivel` = subrubro | marca | rubro; `prioInfo` recibe el género en la
  barrida, el vaciado, la curva y el Reparto inicial). ⚠ El reporte RATIO **no trae disciplina**: ese nivel
  no existe en el dataset. Básquet se sumó a los deportes de especialidad (`RX_DEPORTE`), que siguen yendo
  antes que los meses de stock.
- **«Outlets como local de línea» (13/09/2026)**: tilde de la columna Outlets de la ficha (`comoLinea`), para
  marcas de PVP bajo (hoy Atomik y Head): los outlets entran a los destinos por defecto del Reparto inicial
  y a «Abrir a más sucursales» sin esperar `filtrosAmp.outletDias` (`fichaOutletLinea`). Además: Skechers
  (running H/D, Cat 1 y Cat 2 menos Ensenada, outlets; salió de Kids), Head (casual todos; running solo
  outlets; fútbol Cat 2 y outlets; básquet D80 y Cat 2; calzado verano Cat 2; hockey y tenis D80 y CB),
  Atomik (niño todo en todos; casual adulto en Cat 1, Cat 2 menos Ensenada y outlets), Salomon + Los Hornos
  y Reebok solo outlets. Pendientes de Juli: Training de Head, Puma, Havaianas y las marcas con artículos
  sin asignar (Topper, Rider, DC Shoes…).
- **Ecommerce se trabaja como un Cat 1 (Juli 13/09/2026)**: en la ficha, si la columna Ecommerce está
  vacía toma la de Cat 1 (`fichaDe` en barrida, `fichaEfectiva` en marcas; la columna dice «vacío = como Cat
  1»). Solo llevan columna propia 47 Street (va a Ecommerce y no a Cat 1) y Adidas (Juli le sumó Originals y
  Skate).
- **Deportes de especialidad (13/09/2026, Juli)**: en hockey, vóley, rugby, pádel, tenis y boxeo la
  prioridad la tiene **Diagonal 80** (casa matriz especializada en deportes) y después **City Bell**
  (`DEPORTE_PRIO` + `RX_DEPORTE` sobre disciplina/tipo del artículo): en `cmpReparto` después de niño y de
  la «Prioridad» de la ficha; en `cmpPrioridad` de la barrida después de niño y antes de la venta.

## Reparto inicial (pestaña de `barrida/`, 10/09/2026)

Pedido de Juli: **diferenciar la barrida de reserva del reparto inicial, en dos pestañas**. La
pestaña «Reposición» pasó a llamarse **«Barrida de reserva»** (sin cambios: reporte de stock +
estadística de ventas) y se sumó **«Reparto inicial»**, que reparte lo que **entró** y se alimenta
de la **estadística de remitos**. Código en el bloque «REPARTO INICIAL» de `barrida/index.html`
(funciones `rep*`, estado `state.rep`).

- **Entrada**: el CSV pivot «Estad remitos <año>.csv» (una columna Cant.recibido + Costo por mes,
  encabezados de texto vacíos → las columnas se reconocen por contenido en `repParseRemitos`: nro
  de remito `0005-000…`, ID ITEM, código, marca, rubro, subrubro, disciplina, tipo), el Excel
  «Remitos de ingreso» (mismo pivot con encabezados) o un export con columna Remito + columnas de
  talle. Se elige el **mes de ingreso** y se marcan los remitos (los ya repartidos se ocultan).
- ⚠ **El export de remitos NO trae talles.** Cada artículo se abre con la curva que tiene hoy en la
  **reserva del depósito** (el mismo reporte de stock de la Barrida, `repReserva`; también sirve el
  stock global con las filas «Depósito»), repartida entre sus remitos por la cantidad de cada uno
  (`repTallesDe`, mayor resto). Si la reserva tiene menos que lo que entró, se reparte lo que hay y
  la tira lo avisa («N u. de los remitos ya no están en la reserva»). **Abierta por talle
  (13/09/2026, Juli: lo más probable es que la saquen así para repartir curvas y no totales)**: si el
  export trae los talles se usan exactos, sin estimar, en cualquiera de las tres formas que lee
  `repParseRemitos`: columnas por talle (con columna Remito), **una fila por remito × artículo × talle**
  con columna «Talle» (por nombre `Talle/Talla/Size`, o por contenido: ≥90 % de valores que son talles
  y pocos distintos) + Cantidad, o **el pivot mensual con columna de talle** (guarda `tallesMes` y el
  selector de mes sigue andando: `repUDe` / `repTallesMes`). Todavía sin validar con el export real.
- **A quién y en qué orden** (`repCandidatos`/`cmpReparto`): la marca tiene que estar en la
  **Asignación de Marcas** de la sucursal (`asignacion_marcas/data` = calzado, `data_indumentaria`;
  accesorios mira las dos; sin asignación cargada entra igual con el rango más bajo; marcas «niño»
  solo para artículos de niño; si la marca tiene disciplinas, la del artículo tiene que estar —
  tilde); **Mateu Kids (`SOLO_NINO`) no recibe adulto**. Orden: ya lo recibió en un reparto
  anterior (memoria, tilde) → marca principal/niño > especial > secundaria → **categoría** →
  **venta** de la marca en el rubro el último mes de Meses de Stock (`ventasMarcaDe`, en tres
  niveles respecto de la que más vende) → **meses de stock** (menos = antes). Destinos por defecto:
  todas menos los outlets; Diagonal 80 entra (`SUC_EXTRA`, la Barrida todavía no la toma).
- **Cuánto** (`repRepartirArt`): talles centrales 2 unidades (hasta 3 si alcanza), resto 1; a una
  sucursal no se le manda una curva rota (mínimo de talles + algún central); el excedente se sigue
  repartiendo de a una por talle (tilde); **queda ~1 curva en el depósito** (1 por talle con 2 o
  más, en el remito que más tiene del artículo). Todo parametrizable en «2 · Cómo repartir».
- **Talles centrales** (`CENTRALES_DEF`, editables en pantalla y compartidos en
  `barrida/repartoConfig/centrales`): calzado dama 37/37.5/38 AR + **US Women 7/7.5/8**; en una curva **unisex** (rotula US Men) la dama es
  **5.5/6/6.5** (clave `calz-unisex-dama`) y el hombre 8.5/9/9.5 — sale de la tabla de talles US Men / US Women / AR
  de New Balance que Juli aplicó a la tabla general el 15/09/2026 (verificado con el stock por sucursal de NB del
  14/09: unisex 4–13, dama 5–11); Puma UK
  4.5/5/5.5), hombre 41/41.5/42 AR + US 8.5/9/9.5 (Puma UK 8/8.5/9); indumentaria dama S-M, hombre
  y unisex M-L, niño 10-12 (+10A/12A/YM). Los US/UK se calibraron con la estadística de ventas real
  del 08/09/2026. Calzado niño/unisex/infante no tiene regla: los talles del medio del artículo.
- **Un artículo en varios remitos** se reparte junto (una curva por sucursal) y cada unidad sale del
  remito que más le cubre / que ya le está dando a esa sucursal.
- **Salida**: vista «Por remito» (una tarjeta por remito con cada artículo, sucursales en orden de
  prioridad en una grilla con una columna por talle —centrales resaltados— y al pie las filas «Repartido» y «Queda en el depósito» por talle con su total, rediseño del 14/09/2026), «Por sucursal» y «Sin repartir»
  (con el motivo); ⇩ Excel con **una hoja por remito** (para imprimir en su ubicación) + resumen por
  sucursal; 🖨 Imprimir.
- **Ajuste a mano antes de guardar (18/09/2026, pedido de Juli)**: en la vista «Por remito», cada artículo
  tiene **✎ Editar** (solo con el reparto sin guardar; un reparto abierto del historial no se edita): las
  celdas de la grilla pasan a ser casilleros numéricos por sucursal × talle, ✕ saca una sucursal y
  «+ Agregar sucursal…» suma cualquiera de `REP_SUC` (queda marcada «a mano», sin prioridad). Lo que hay
  para repartir del artículo en ese remito (`repPool` = repartido + queda) no cambia: lo que se le saca a
  una sucursal vuelve a «Queda en el depósito» y lo que se agrega sale de ahí (la celda se ajusta al tope
  y avisa). Los ajustes viven en `state.rep.manual['<remito>|<idItem>'] = {<slug>:{<talle>:u}}` y
  `repCalcular` los **vuelve a aplicar arriba de cada recálculo** (`repAplicarManual` + `repRetotalizar`),
  así cambiar un parámetro no los pisa; «✓ Listo» saca las sucursales en cero y, si quedó igual al
  automático, descarta el ajuste (`repEditPodar`); «↺ volver al automático» por artículo y «descartar» en
  la tira de resumen («N editados a mano»). Al tipear no se redibuja la pantalla (`repEditCelda` actualiza
  totales de fila, pie, remito y resumen) para no perder el foco al tabular. Un artículo que «quedaba todo
  en el depósito» también se puede repartir a mano (sale de «Sin repartir»). Guardar, ⇩ Excel, Mi Sucursal
  y Picking toman lo editado sin cambios; el artículo se guarda con `editado:true` y `meta.totales.editados`.
  Cargar otra estadística de remitos o guardar limpia los ajustes.
  **Remito mal cargado: la edición ya no recorta al remito (24/09/2026, Nehuen, TIMTB110361713: los talles del
  remito venían corridos y la curva real empieza en 35)**: en la grilla de edición hay **«+ Agregar talle»** (Enter/Tab
  suma la columna; `ov._talles`, clave que no es sucursal) y una celda puede llevar **más de lo que trae el remito**
  (o un talle que no trae): se reparte igual, el pie «Queda en el depósito» muestra **«+N» en ámbar** y el artículo
  lleva el pill «remito corregido: 35 +2 · 36 +2» (`x.corregido`, por talle lo de más). `repPool` sale de la propuesta
  automática (`lineasAuto` + `quedaAuto`), no de lo editado, así reaplicar el ajuste no infla el pool. Se guarda
  `corregido` en el artículo y `meta.totales.corregidos`; Mi Sucursal y el Picking leen las líneas sin cambios.
  **Talles dobles de las ojotas (mismo día, Havaianas)**: `repEsTalle` no reconocía «37/38» / «39/40», así que en el
  export con columnas por talle esas columnas se salteaban, el remito quedaba en cero y no aparecía en la lista.
  **La Barrida de reserva también se edita a mano (24/09/2026, pedido de Juli)**, con el mismo modelo: botón ✎ al final de
  la columna Talles de cada línea (solo con la barrida procesada desde los archivos: una semana abierta del historial no
  trae la reserva por talle y no se edita) → casilleros numéricos por TODOS los talles que el artículo tiene en el
  depósito, cada uno con su tope («hasta N» = reserva repartible del talle, `R.reservaT` de `computar`, menos lo que se
  llevan las otras sucursales; al pasarse se recorta y avisa); botones «✓ Listo», «↺ volver al automático», «✕ no
  mandarle nada» (la línea queda en cero con el pill «no va · a mano») y «+ Agregar otra sucursal a este artículo…»
  (cualquiera de `REP_SUC`; queda marcada «sucursal agregada a mano», sin prioridad). El ajuste es la cantidad FINAL de
  la línea: reemplaza a la suma de venta + curva + agrandar + vaciado + abrir. Vive en `state.manualBar['<id>|<slug>'] =
  {talle: u}` (+ `manualBase` = lo automático al abrir) y `aplicarManualBar` lo aplica al final de `reposFusionadas()`,
  así cambiar un parámetro lo vuelve a aplicar; «Listo» saca los talles en cero y, si quedó igual al automático,
  descarta el ajuste. Al tipear no se redibuja (`barEditCelda`: actualiza «A reponer», «Queda» del artículo y el total
  de la tira). En pantalla: casilleros ámbar «a mano», pill «✎ a mano» (tooltip con lo que proponía el automático),
  la tira suma «N a mano» al desglose y «N ajustadas a mano · descartar». Excel: la celda es la cantidad a mano; una
  línea puesta en cero no va a la planilla. **Guardar**: la línea editada reemplaza a lo automático en
  `reposicion/<slug>` (talles `[{t,v,r,s}]` con la cantidad final, `editado:true`, `vaciado`/`ampliar` en 0), sale de
  `curva/<slug>` (la cantidad a mano ya incluye la curva) y `meta.editados` cuenta las líneas; Mi Sucursal y el Picking
  la leen sin cambios. Procesar archivos nuevos o abrir del historial descarta los ajustes. Probado 24/09 en el
  navegador con los reportes de Puma (252 líneas): tope por talle, sucursal agregada, línea en cero, Excel y el
  payload del guardado (interceptando las escrituras).
  **Vara de convergencia (23/09/2026, preocupación de Juli: «siempre aparecen cosas»)**: en cada artículo editado el
  reparto guarda también la **propuesta automática** (`auto` = líneas que proponía el portal, `quedaAuto`) y `dif` =
  `{lineas, lineasAuto, u}` (`repDifAuto`: sucursales cuya curva quedó distinta y unidades que cambiaron de destino);
  `meta.totales` suma `lineas`, `editLin` y `editU`, y la tira de resumen dice «N de M líneas distintas de la propuesta ·
  U u.». `node scripts/editados-reparto.mjs [días]` lista el % por reparto guardado. Al 23/09 había solo 2 repartos
  guardados (NB 21/09 y Salomon 22/09, los dos 100 % a mano, sin propuesta guardada) y ninguna barrida de septiembre: la
  medición depende de que el depósito GUARDE cada reparto en el portal (se le pidió a Nehuen por la Bandeja ese día).
- **El hueco entre los dos reportes (12/09/2026, planteo de Juli)**: esta pestaña sale de la
  estadística de **remitos** y la Barrida del reporte de **stock** con «Días u.compra», así que un
  artículo puede tener compra de hace pocos días (la Barrida no lo reparte: lo ve nuevo) y no figurar
  en ningún remito de la lista — sin nadie que lo reparta. Ahora el corte en días es **UNO SOLO para
  las dos pestañas** (`state.filtros.diasNuevo`, editable desde las dos; en el Reparto está en el
  grupo «Ingreso» del panel 2) y el Reparto inicial, además de los remitos marcados, suma solo esos
  artículos: `repNuevosSinRemito` (talles con `dias < N` que no vienen por un remito elegido y que no
  se repartieron en los últimos N días según la memoria) los mete como un artículo más con el remito
  virtual `REP_NUEVO`, que sale en su propia tarjeta **«Ingresó hace poco · sin remito»** (violeta,
  hoja «Sin remito» en el Excel). Se puede armar el reparto **solo con eso**, sin marcar ningún
  remito. El tilde «Sumar lo que ingresó hace poco y no está en los remitos» lo apaga. La tarjeta
  virtual NO marca remitos como repartidos (no lo son): lo que evita repetirla es la memoria por
  artículo. `repReserva` ahora guarda también `dias`, `meta` y `conDias` (y se cachea por archivo);
  cada artículo muestra hace cuántos días entró lo que hay en el depósito, y si ya pasó los N días
  aclara que lo toma la Barrida. Sin la columna «Días u.compra» en el reporte de stock, la tarjeta de
  selección lo avisa y no se detecta nada. Probado 12/09 con «Estad remitos 2026.csv» + el reporte de
  stock con días de Puma: de 17 artículos nuevos, 16 venían en los remitos de septiembre y 1
  (BORUSSIA C TT, compra de hace 7 días) no estaba en ninguno → se repartió por la tarjeta nueva.
- **Lo repartido le llega a la sucursal (12/09/2026)**: al guardar, además del documento del
  reparto se escribe **`barrida/repartoSuc/<slug>/<key>`** = `{fecha, por, u, arts:[{id, codigo,
  desc, marca, rubro, genero, remito, sugerido, talles:[{t,s}]}]}` — cada local baja SOLO su nodo,
  misma seguridad blanda que la reposición de la barrida, y los talles van con el mismo shape para
  no tocar a los consumidores. Se poda lo de más de `REP_SUC_DIAS` (60) días al guardar, y borrar un
  reparto también borra lo de cada sucursal. Lo leen dos:
  **Mi Sucursal** (`indicadores/`, sección **«Mercadería nueva que te baja»** `secReparto` /
  `renderRepartoSuc`+`paintRepartoSuc`, en la banda «En curso» justo debajo de «Reposición
  disponible»): el último reparto abierto con artículo · código · marca · talles · unidades, y los 3
  anteriores plegados. Es de solo lectura y no hay que pedirlo — ya está decidido que baja, a
  diferencia de la reposición.
  **Picking**: `repartoDe(slug)` junta **todos los repartos pendientes** de esa sucursal (13/09/2026:
  se reparte por marca, así que puede haber varios): los de los últimos `REP_PICK_DIAS` (30) días,
  menos lo que ya se llevó un picking de ese destino (cada picking guarda `origen.repartos` = claves
  usadas; con filtro de marca/rubro solo cuenta esa parte); el mismo artículo en dos repartos suma
  talles. El check **«Incluir los Repartos iniciales pendientes»** viene marcado; al elegir el destino
  avisa cuántos repartos (con fechas) y unidades tiene esperando,
  si el artículo ya venía por la barrida le suma los talles, y las sucursales que solo tienen reparto
  entran igual a la lista de destinos (`DATA.bar.repSlugs`).
- **Firebase** (`recepciones-mateu/barrida/`): `repartos/<AAAA-MM-DD_HHMMSS>` = `{meta, remitos,
  porSuc}` (porSuc agrupado por slug, por si después lo lee Indicadores/Picking),
  `remitosRepartidos/<nro>` = `{rep, fecha, por}` y `repartoHist/<idItem>/<slug>` = `{t:[[talle,q]],
  ts, rep}` (memoria de 120 días). «Borrar» un reparto guardado devuelve sus remitos a pendiente y
  lo descuenta de la memoria.
- Probado el 10/09/2026 con «Estad remitos 2026.csv» (2.102 remitos) + el reporte de stock del
  depósito de Puma: 9 remitos de septiembre → 540 u. a 14 sucursales, 77 quedan.
- **Ajustes tras la prueba manual de Nehuen (14/09/2026, Atomik y New Balance)**:
  - **Stock por sucursal en el Reparto inicial** (botón en la tarjeta de carga, `repStockPorId` → `REP_STOCK`):
    en los reingresos la sucursal que ya tiene el artículo cuenta como que lo tiene (`tiene` = mayor entre lo
    enviado hace poco y su stock) y solo se le completa la curva; también alimenta las paredes.
  - **Curva del depósito después de las curvas base**: primero cada sucursal recibe su curva; la del depósito
    sale de lo que sobra, solo si el artículo tiene `curvaDesde` unidades o más (default 12, «Dejar curva si
    el artículo tiene») y solo si llega a `reservaMin` (default 6, «Reserva mínima»); si al final queda
    menos de ese mínimo, se reparte todo.
  - **Calzado unisex** usa los centrales de hombre y dama juntos (`calz-unisex`, editable). Pero si uno de los dos subrubros no tiene sus centrales completos (menos de 2 de los 3), el artículo se toma como del otro (MR530CK: 5.5/6/6.5 de dama y solo el 9 de hombre → dama; los talles de hombre van como el resto).
  - **Aurelius Calle 10 se trabaja como outlet** (`COMO_OUTLET` en `catDe`; en marcas `tipoDeSuc` → outlet):
    sale de los destinos por defecto del Reparto inicial y sigue las reglas de outlets en «Abrir».
  - **La Barrida respeta la ficha de la marca** (`fichaBloquea`): la reposición por venta, Completar curva y
    Vaciar la reserva chica no le mandan a una sucursal lo que su ficha excluye (caso Atomik adulto en
    Ensenada) ni adulto a Mateu Kids; `R.fueraFicha` cuenta las líneas descartadas.
  - Pendiente: el reporte de stock que mostraba el doble que el F9 del depósito (204 vs 102, 12 vs 6).
  - **«Modelos que no van»** (campo `sinModelos` de la ficha, `fichaPasa` lo aplica siempre, aun sin «respetar
    disciplinas»): New Balance 9060 / 530 / 740 / 204 / 1906 son exclusivos de Aurelius → Cat 1 los excluye;
    Ecommerce (que es la web de Mateu y de Aurelius) tiene New Balance asignada con columna propia: solo esos
    modelos. Atomik en Diagonal 80: solo niño (excepción de la ficha).
  - **Reglas fijas por sucursal (17/09/2026, informe Puma automático vs. manual)** — `reglaSucursal` en
    `barrida/`, antes que la ficha (la usan `repAsig` y `fichaBloquea`, o sea Reparto inicial, «Abrir» y la
    Barrida): **Calle 49 no trabaja niño** (`SIN_NINO`, calzado e indumentaria); **Aurelius no recibe niño** (mismo día, informe Crocs; va antes que la ficha, así que pisa el «niño Originals» de
    Adidas en Aurelius 12), **salvo Aurelius City Bell, que recibe niño —calzado e indumentaria— solo de Adidas, Nike,
    Crocs y Puma, y de Vans solo calzado** (`AUR_NINO_MARCAS`); **subrubro VARIOS va a todos, Mateu Kids incluido**
    (Juli 23/09/2026: medias, gorros, accesorios sin género; `repGrupo` marca `G.varios` y «solo niño» de Kids, la
    marca asignada «solo niño» y el texto libre viejo lo dejan pasar; no es niño, así que no lleva la prioridad de Kids/Gonnet).
    **Outlet Gonnet (sector de niños) también entra a los destinos por defecto del Reparto inicial con VARIOS**, como
    con niño (mismo día; en `repCalcular`, `kidsA || C.G.varios`); sigue ordenando como outlet, después de las de línea; **los Aurelius (línea y
    Calle 10) no reciben fútbol ni deportes** (`RX_AUR_DEPORTE` sobre disciplina/tipo), salvo un modelo que su
    ficha nombre. **Aurelius Calle 10 toma la mercadería de la columna Aurelius** de la ficha (en `barrida/`
    `fichaDe` y en `marcas/` `tipoDeSuc`/`fichaEfectiva`); de la columna Outlets solo la «Prioridad» (New
    Balance). Para destinos por defecto y días de outlet sigue contando como outlet (`COMO_OUTLET`).
    **Aurelius = solo moda (24/09/2026, reparto Adidas: un short de RUNNING se abría a los tres Aurelius)**: la
    regla pasó a ser positiva — en calzado e indumentaria Aurelius (línea y Calle 10) recibe solo la disciplina de
    moda (`RX_AUR_MODA`: CASUAL, ORIGINALS, JORDAN, CALZADO VERANO, lifestyle/urbano, jeans); RUNNING, TRAINING,
    ADVENTURE, NATACIÓN… quedan afuera como el fútbol, salvo el modelo que su ficha nombre (Asics GEL, Nike P-6000).
    Sin disciplina en el artículo se mira el tipo con `RX_AUR_DEPORTE`. Vale en Reparto inicial, «Abrir» y Barrida.
    **Y la causa de que los Aurelius salieran PRIMEROS (1, 2 y 3 de 14)**: la Asignación de Marcas de
    INDUMENTARIA solo está cargada para los Aurelius y las tiendas Adidas; los Mateu no tienen nada y entraban con
    el rango más bajo («sin asignación cargada») en toda la indumentaria de Adidas / Nike / Puma. Ahora `repAsig`,
    si la sucursal no tiene asignación de indumentaria, usa la de CALZADO de la marca (principal / secundaria /
    niño; nota «asignación de calzado (indumentaria sin cargar)») y las disciplinas del texto libre de calzado no
    filtran la ropa. Cuando Juli cargue la asignación de indumentaria en `marcas/`, manda esa sola.
  - **Calzado niño/infante — curva progresiva o chata (17/09/2026)**: no usa la tabla de centrales. Select
    «Calzado niño» en «2 · Cómo repartir» (`param.ninoCurva`, default `prog`): **progresiva** = la mitad más chica
    de los talles del artículo x1 y la más grande x2 (8 talles → 4 x1 + 4 x2; impar, la mitad grande lleva el del
    medio), **chata** = x1 en todos. `repCentrales` devuelve `per` (unidades por talle) y `repRepartirArt(…, per)`
    lo usa como base y tope (sin 3.ª unidad); «Abrir a más sucursales» también. En la Barrida (`centralesDe`)
    niño sigue con los talles del medio.
  - **Calzado de verano según el calendario (17/09/2026, informe Crocs automático vs. manual)**: Nehuen repartió
    Crocs en septiembre con menos profundidad y sin centrales porque la temporada recién arranca. **Regla FIJA de la
    lógica, sin tilde ni parámetro en pantalla** (Juli: no sumar un tilde por cada criterio; `veranoTranquilo` / `esCalzadoVerano`:
    disciplina o tipo con verano/sandalia/ojota/chinela): **de octubre a febrero** (`VERANO_MESES`) va la curva de
    siempre; **de marzo a septiembre** `repCentrales` devuelve `tranquila:true` con `per` = x1 en todos los talles, sin
    centrales ni 3.ª unidad, y el reparto corre con `criterio:'abrir'` y `excedente:false` (tampoco aplica «Niño y
    fútbol: repartir todo»): lo que sobra queda en el depósito. Manda la fecha del día en que se arma el reparto.
    **Térmicas (18/09/2026), misma regla con la temporada al revés**: indumentaria cuyo tipo o disciplina dice TERMICA
    (REMERAS TERMICAS y CALZAS TERMICAS; los accesorios no entran), temporada alta **abril a agosto** (`TERMICA_MESES`),
    tranquila de septiembre a marzo. **Más líneas (mismo día, Juli «OK todo menos camperas», elegidas con los envíos ene–ago 2026 por tipo)**: por TIPO de
    artículo entero, indumentaria de invierno = CAMPERAS DE INVIERNO · CHALECOS · CONJUNTOS (alta abril–agosto) y de
    verano = MUSCULOSAS · BERMUDAS · TOPS · MALLAS (alta octubre–febrero; los SHORTS se sacaron: curva normal todo el año); `RX_TIPO_INVIERNO` / `RX_TIPO_VERANO`.
    Las CAMPERAS comunes NO entran (decisión de Juli); buzos, pantalones, calzas y accesorios tampoco. Las reglas viven en el mapa `TEMPORADAS` (`fueraDeTemporada(a, G)`): sumar una línea
    estacional = una entrada más. Verificado ese día contra el maestro `logistica/arts`: la regla de verano toma toda la
    disciplina CALZADO VERANO (398 artículos, 32 marcas: Rider, Havaianas, Crocs, Adidas…), no solo Crocs; quedan afuera
    los Crocs que el sistema tiene como CASUAL (Santa Cruz, Lined Clog/pantufla, Swiftwater), que no son de verano.
    **Orden de talles de niño en escala US** (`ordenTallesNino`, mismo informe): la escala infantil da la vuelta
    (C6·C8·C10·C12 y después J1·J2·J3; 10K…13.5K y después 1Y…); ordenados por número, la curva progresiva daba x2 a
    los chicos. Se detecta por letra (J/Y vs. C/K) o por contenido (curva que llega a 10–13.5 y trae talles ≤ 3.5: el
    tramo chico corrido desde el mínimo es juvenil). Pendiente del mismo informe (sin decidir): el manual no le mandó
    Crocs niño a Diagonal 80 ni a Aurelius Calle 10, y priorizó a Ecommerce y Outlet Av. 44, que en el automático
    quedaron últimos.
  - **Cuatro criterios fijos más (20/09/2026, Juli: «avanzar 1, 3, 5 y 6»; bloque «CRITERIOS FIJOS DEL REPARTO» arriba de
    `repCandidatos`, sin tildes)**. **(1) Profundidad según el local** (`repPerfil` → `perfil` del candidato): **honda** =
    Cat 1 y Ecommerce (y Mateu Kids / Outlet Gonnet en niño): curva base + 3.ª unidad en centrales, o la curva profunda en
    criterio «profundidad»; **base** = Cat 2, Aurelius, tiendas Adidas y outlets de marca «como local de línea»: curva base
    SIN 3.ª unidad; **chata** = outlets: x1 por talle (entra como `plana`). Antes todas recibían la misma curva. También
    rige en «Abrir a más sucursales». **(3) Tope por meses de stock** (`REP_MS_TOPE` = 6, `repMsExcedida`): con 6+ meses de
    la marca (dato de marca o subrubro, no el del rubro) la sucursal sale de los candidatos; no se aplica a pared
    incompleta, reingreso (tiene stock o memoria) ni a la que vendió el artículo esa semana; quedan en `a.msFuera` y en el
    texto de la regla / motivo de «Sin repartir». **Si TODAS las candidatas están pasadas el tope no se aplica** (21/09/2026, New Balance:
    solo D80 y City Bell, las dos con 6+ meses → quedaban 120 pares sin repartir): se reparte igual, los meses de stock solo
    ordenan y la regla lo aclara (`msIgnorado`). **Desde el 21/09/2026 (tarde) el tope YA NO EXCLUYE** (Juli, Montagne: 3 de 5
    sucursales afuera y 64 de 80 pares en el depósito): la sucursal con 6+ meses queda `msAlto` → recibe AL FINAL (`cmpReparto`,
    después de la ficha y deportes) con su curva NORMAL: el ratio solo ordena **— pero dentro de su grupo: los outlets van SIEMPRE después de todas las de línea, aunque la de línea tenga 6+ meses** (23/09/2026, reparto de Nike: Gonnet y Calle 55 quedaban antes que City Bell y Calle 47; campo `outlet` del candidato, no aplica a la marca con «Outlets como local de línea») (Juli lo confirmó el mismo día; se probó un
    escalón menos de profundidad y se sacó). **Ecommerce ya no está exenta del tope (23/09/2026)**: la excepción «su ratio es el de toda la
    web» la dejaba siempre primera (Nike indumentaria hombre: 216 meses y «1 de 10»); ahora entra como cualquier Cat 1 con su ratio por subrubro. **Y el criterio «profundidad» sube un escalón a TODOS los perfiles** (`perfilDe`):
    antes solo cambiaba a las «honda», así que en locales de curva base (Cat 2, Aurelius) elegirlo a mano no cambiaba nada. **(5) Fechas comerciales** (`repPico`, `REP_PICO_DIAS` = 28 días antes;
    fechas por regla con `tercerDomingo`): Día del Niño (3.er domingo de agosto → niño), Día de la Madre (3.er domingo de
    octubre → dama), Día del Padre (3.er domingo de junio → hombre), Navidad (25/12 → TODO) y Vuelta al cole (15/01–10/03 →
    mochilas y calzado niño): el artículo corre con `criterio:'profundidad'`, `reserva:0` y `pico:true` (todos los perfiles
    suben un escalón, `PERFIL_SUBE`); si está fuera de temporada (curva tranquila) manda la temporada. **(6) Rotación del
    reingreso** (`repCargarEnvios` baja una vez por sesión los envíos de los últimos `REP_ROT_MESES` = 4 meses de
    `logistica/meses/<ym>/envios`, solo si hay stock por sucursal; `repRotacion` = 1 − stock ÷ recibido por artículo ×
    sucursal, cruce por código): ≥ 60 % → curva entera y perfil honda; < 50 % → solo completa talles aunque lo venda; en
    el medio o sin datos → la regla anterior (`vendeArt`). El tooltip de prioridad muestra perfil y rotación. Probado en
    node con casos sintéticos; **falta validarlo contra un reparto manual real** (el próximo informe automático vs. manual). **Descartado por Juli (20/09/2026): el 2 (prioridad y profundidad propias de Ecommerce: sigue como un Cat 1 más). No volver a proponerlo.**
    **El 4 quedó como PROPUESTA corregible, no como automatismo ciego (Juli, mismo día: «me da miedo que si lo automatizamos sin opción a mano haya errores»)**: el criterio «abrir a más locales» / «mayor profundidad» se resuelve **por artículo** (`repCriterioDe`): manda lo elegido a mano en el ARTÍCULO (`state.rep.criArt[idItem]`), si no lo del REMITO (`state.rep.criRem[nro]`; un artículo en varios remitos toma el del que más trae), si no el select general «Criterio» y, si ese está en **«automático» (nuevo default, prefs `v:3`)**, la propuesta del portal: unidades que entraron ÷ curva base = para cuántas sucursales alcanza; menos de la mitad de las candidatas → profundidad, si no → abrir. En la vista «Por remito»: select «Criterio del remito» en la cabecera de cada tarjeta y, por artículo, un chip (⇔ abrir / ▼ profundidad · auto / a mano, con el porqué en el tooltip) + su select. Lo elegido a mano le gana a la fecha comercial; fuera de temporada no se elige (curva tranquila). `criRem`/`criArt` se limpian al cargar otra estadística y al guardar, como `manual`; no se guardan en el reparto.
  - **Criterio «abrir a más locales» / «mayor profundidad» (17/09/2026, Juli: no siempre se usa el mismo)**:
    select «Criterio» (`param.criterio`, default `abrir` = lo de siempre: curva base a todas, después la reserva y
    la 3.ª unidad). `profundidad`: se aparta primero la reserva y cada sucursal, en orden de prioridad, recibe la
    curva profunda (cada talle +1 sobre la base; centrales hasta `maxCentral` si es mayor; niño progresivo x2/x3)
    antes de pasar a la siguiente (`darCurva` en `repRepartirArt`). «Abrir a más sucursales» de la Barrida no cambia.
  - **Reingreso que se vende (17/09/2026)**: tilde «A la que ya lo tiene y lo vende, la curva entera»
    (`param.reingresoProf`, default sí): el stock por sucursal no le achica la curva a la sucursal que vende el
    artículo (`vendeArt`: con el archivo de ventas de la Barrida cargado, que lo haya vendido — `repVentaArt`;
    sin él, que venda la marca en el rubro). Lo repartido hace poco (memoria) sí cuenta siempre.
  - **Niño y fútbol se reparten enteros (17/09/2026)**: tilde «Niño y fútbol: repartir todo»
    (`param.todoNinoFutbol`, default sí): en esos artículos (`repTodoAlSalon`: género niño/infante o
    disciplina fútbol/futsal) el reparto corre con `reserva:0` y `excedente:true`, así no queda curva en
    el depósito, como lo hace el depósito a mano. Destildado, valen las reglas generales.
  - **«Si ingresa nuevo, se reparte» (Juli 21/09/2026, Montagne: quedaban 64 de 80 pares en el depósito)**: «Repartir el
    excedente» vuelve a venir **tildado** (prefs `v:4`; pisa lo del 14/09 que sigue abajo): después de las curvas, lo que sobra
    se reparte de a una por talle en orden de prioridad y en el depósito queda solo la curva de reserva (1 por talle). Del
    excedente participan todas las que recibieron curva, también las que bajaron a x1 por ratio alto; quedan afuera la
    «curva x1» de la ficha y los outlets (`sinExc` en `repRepartirArt`).
  - **Reingreso que todas ya tienen (21/09/2026, Montagne ZEEPRO NARANJA: 10 pares y 0 sucursales)**: las 5 candidatas ya tenían
    la curva completa en el stock por sucursal y poca rotación → «solo completa talles» no daba nada y quedaba todo en el
    depósito. Ahora, si por el stock de las sucursales no sale NADA, `repCalcular` hace una segunda pasada de `repRepartirArt`
    con `sinStock:true` (no mira el stock; la memoria de lo enviado hace poco sí) y reparte por prioridad; `a.stockIgnorado` lo
    aclara en la regla del artículo.
  - **Medias Mateu Sports con piso por talle (22/09/2026, reporte de Nehuen)**: el Reparto inicial aplica la misma regla
    que la Barrida (`esMediaMateu`, `MEDIAS_MIN` S:12 · M:24 · L:36 · XL:12). `repCentrales` devuelve `medias:true` con
    `per` = el piso; `repAsig` las deja pasar a todas las sucursales destino **menos los Aurelius** (no trabajan medias Mateu; la marca propia no está en la Asignación de
    Marcas y antes quedaban «sin sucursal»); corren con `pisoFijo` (sin profundidad, fecha comercial, excedente ni curva de
    reserva; perfil base también en outlets; mínimo 1 talle) y el piso es stock objetivo: siempre se descuenta lo que la
    sucursal ya tiene. Lo que no alcanza el piso de nadie queda en el depósito para la Barrida.
  - **Marca propia por tipo de local (22/09/2026, Juli)**: en indumentaria y accesorios la marca **Mateu** es solo para los
    locales Mateu Sports (`esMarcaMateu` / `esLocalMateu`: ni Aurelius ni tiendas Adidas; Ecommerce, Kids y outlets Mateu sí) y
    la marca **Aurelius** solo para los Aurelius (`esMarcaAurelius`). Va en `reglaSucursal`, así rige en Reparto inicial,
    «Abrir» y la Barrida; ninguna de las dos está en la Asignación de Marcas, así que `repAsig` las deja pasar a esos locales.
    **Piso de las medias Mateu por tipo de local (23/09/2026, Juli)**: Cat 1 (y Ecommerce, que va como Cat 1) + Outlet
    Gonnet = **S:60 M:96 L:180 XL:60**; Cat 2 + Outlet Calle 55 y Av. 44 = **S:36 M:72 L:120 XL:36**; Mateu Kids sigue con
    `MEDIAS_MIN` (12/24/36/12). `mediasTablaSuc(slug)` + `mediasMin(talle, marca, slug)`; en el Reparto inicial cada candidato
    lleva su curva (`c.per`, que `repRepartirArt` usa en `baseS`) y en la Barrida el piso sale de la sucursal de la fila.
    Las **medias Aurelius** también llevan piso (`esMediaMateu` acepta las dos marcas), con su curva: **S (chico) 24 · M (grande) 24** (`MEDIAS_MIN_AUR`; `mediasMin(talle, marca)`).
  - **Accesorios por tipo de producto (Grupo 1) (22/09/2026, Juli: «trabajar por docena o media docena por talle
    para que el producto no se pierda en el depósito de la sucursal ni quede sin exhibir»)**: tabla `ACC_TIPOS_DEF`
    (tipo normalizado con `accTipoKey` → unidades por talle = stock objetivo de la sucursal) editable en el Reparto
    inicial, desplegable «Accesorios por tipo de producto (Grupo 1)» (`repAccHtml`; lista los de fábrica + los tipos de
    accesorios que traen los remitos cargados), compartida en `barrida/repartoConfig/accTipos`. Valores de arranque
    (cruzados con los envíos a mano de mar–ago 2026): 6 = medias de otras marcas, ropa interior, protectores bucales,
    vendas, grip, antivibradores, tapones, muñequeras, vinchas; 12 = llaveros y antiparras (23/09/2026, Juli: eran 6); 3 = gorros, guantes,
    canilleras, rodilleras, protecciones, cuellos, botellas, pelotas, infladores; 2 = mochilas, bolsos, riñoneras,
    botineros, billeteras, cartucheras, lunchera; 1 = paletas, raquetas, palos de hockey. **Tipos que faltaban (23/09/2026,
    Juli)**: 6 = bandas, sogas, cordones, silbatos, brazaletes, tobilleras, fajas, pantorrilleras; 3 = termos, vasos, mates,
    toallas, fundas, conos, pesas; 2 = carteras, colchonetas, redes, tableros y aros, set, pins; 1 = skates, patines, ruedas,
    cabezales y máscaras, bolsas y peras. El tipo genérico «ACCESORIOS» (126 artículos, mezcla) queda sin fila a propósito.
    Sin fila = como antes (1 por talle). `accPiso(meta)` (0 para las medias de marca propia, que siguen con su curva). **Reparto inicial**:
    `repCentrales` devuelve `per` = piso y `medias:true`, así corre igual que las medias (`pisoFijo`: descuenta lo que
    la sucursal tiene, sin excedente ni curva de reserva, perfil base). **Barrida**: para el talle vendido el objetivo
    es el piso (igual que las medias) y, con el stock por sucursal cargado, **se descuenta lo que la sucursal ya tiene**
    (también en las medias de marca propia; antes el piso se mandaba entero cada semana). Pill «piso por talle».
  - **Accesorios: la marca alcanza, y Aurelius solo moda (23/09/2026, reparto de antiparras Nike)**: para un accesorio
    no hay ficha, así que en `repAsig` mandaba el texto libre de la asignación de **calzado** («running, casual, futbol»
    de Nike en Calle 12, City Bell, D80, Plaza y Calle 49): una antiparra (NATACIÓN) no entraba y las Cat 1 quedaban
    afuera mientras los outlets sí recibían. Ahora el filtro de disciplinas del texto viejo **solo aplica en calzado e
    indumentaria** (`G.fam`): para un accesorio basta con que la marca esté asignada en cualquiera de los dos rubros.
    Y **Aurelius —línea y Calle 10, aunque se trabaje como outlet— no recibe accesorio deportivo** (`esAccDeportivo` en
    `reglaSucursal`, así rige en Reparto inicial, «Abrir» y Barrida): pasa solo lo de disciplina casual / Originals /
    Jordan / escolar / skate (`RX_ACC_MODA`: mochilas, medias, gorros, bolsos, riñoneras, billeteras…) y nunca un tipo
    de equipamiento (`RX_ACC_DEPORTE_TIPO`: pelotas, antiparras, canilleras, paletas, vendas, protecciones…). Contra el
    maestro del 23/09: 672 accesorios pasan, 2.785 quedan afuera de Aurelius.
  - **Excedente del Reparto inicial**: «Repartir el excedente» viene **destildado** (prefs `v:2`): lo que sobra
    después de las curvas queda de reserva (si queda menos de `reservaMin`, se reparte igual). New Balance
    exclusivos de Aurelius: Aurelius de línea y Ecommerce prioridad 1, Aurelius 10 (columna outlet, «como local
    de línea») prioridad 2.

## Picking del depósito — tarea por remito / por marca·rubro (`picking/` + kiosco, 20/09/2026)

Modelo de trabajo que definió Juli: Nehuen y Hernán arman el Reparto inicial / la Barrida en `barrida/`
→ **tarea asignada a un operario** en la tablet (kiosco `recepciones/control/`, rol `deposito-tablet`)
→ el operario confirma, corre el tiempo y prepara artículo×talle **escaneando** → finaliza → control
final → estadísticas por operario en el Panel de `picking/` (lo ven `logistica@` = Hernán y Marcelo,
y `deposito@` = Ariel, Luis y Nehuen; las dos cuentas tienen el tile). ⚠ **El depósito NO pica por
sucursal**: un remito trae artículos que van a una u otra sucursal.

- **Etapa 1 (HECHA 20/09/2026)**: `abrirNuevaTarea` reemplaza al «Crear picking» por sucursal (que
  queda como link «modo anterior», `abrirNuevoPicking`). Dos tipos: **`reparto`** = una tarea por
  REMITO de un reparto guardado (`barrida/repartos/<key>/remitos`), **`barrida`** = una tarea por
  MARCA·RUBRO de la última barrida guardada (reposición + curva de todas las sucursales,
  `barridaSegmentos`; vienen sin marcar). Pick nuevo: `tipo`, `titulo`, `nDest`,
  `operario_asignado` (+ `asignado_en/por`), `origen` = `{reparto, remito, marca, rubro}` o
  `{tipoBarrida:true, barrida:<lunes>, marca, rubro}` y cada talle lleva **`dest:[{s:slug,u}]`**. Un
  origen que ya tiene tarea se avisa y viene destildado (`tareaDe`). En la tarjeta se reasigna el
  operario mientras está PENDIENTE. Desde Barrida: botón **«📲 Mandar a la tablet»** (semana guardada →
  `../picking/?nuevo=barrida`; reparto guardado → `?nuevo=reparto&key=<key>`).
  Kiosco: «¿Quién sos?» → Mis tareas / Sin asignar / De otros; «✓ Confirmar e iniciar» (tomar la de
  otro pide confirmación y deja `picking_reassigned`); **reloj visible** (`pkReloj`) y bloque **«Va a»**
  (`pkDestHtml`/`pkDestActual`: resalta la sucursal de la unidad que se está por preparar, los destinos
  se llenan en orden). Los picks viejos con `destino` siguen andando (`tituloPick` / `pkTitulo`).
- **Operarios = padrón de RRHH (20/09/2026)**: `sincronizarOperarios()` corre al abrir `picking/` y
  arma la lista desde `rrhh/equipo/deposito` (id `leg-<legajoId>`): suma los activos, actualiza
  nombre/puesto, desactiva al que salió del depósito (`bajaPadron`) y a los «(demo)»; no reactiva al
  que se desactivó a mano. El botón «Traer dotación» queda de respaldo.
- **Etapa 2 (HECHA 20/09/2026) — escaneo forzado**, bloque «ESCANEO FORZADO» del kiosco: se sacó el
  «+1 manual» del picking y del control final. `pkValidar(raw, line, P)` acepta una lectura si es, en
  este orden: la **etiqueta del proveedor** (código con o sin las 3 letras de marca + talle pegado,
  `etiquetaTexto`; va primero porque hay códigos todos numéricos, p.ej. Atomik, que parecerían un EAN),
  el **EAN horneado** (maestro Adidas), un **EAN aprendido** (`picking/eanVar/<cod>/<talle>/<gtin13>` =
  `{por, ts, pick}`) o un EAN del **mapa del Buscador** (`ubicaciones-mateu/ean/<gtin13>`, con el índice
  `suf/`; consulta puntual con tope de 7 s). Si el mapa trae el artículo sin talle (al 20/09 solo 521 de
  13.103 EAN tienen talle) o la etiqueta no está en ningún lado, `pkPreguntar` muestra UNA vez «¿es este
  artículo y talle?» y la aprende (evento `ean_linked`); esa misma etiqueta en otro talle después da
  error. ⚠ Lo aprendido NO se publica al mapa compartido del Buscador (un vínculo mal hecho ensuciaría
  todas las sucursales): pendiente publicarlo cuando el control final lo confirme. Mensajes de error
  dicen qué se leyó («es talle 37», «es otro artículo: …»). Sin conexión no valida (no cuenta).
  **Cámara** (`pkCamToggle`, ZXing): vista flotante que sobrevive a los repintados, ignora el mismo
  código por 1,6 s y se apaga al salir de la pantalla de escaneo; sin probar todavía en la tablet real.
  **Excepción** (`pkExcepcion`, botón «No puedo escanearla»): una unidad por vez con motivo
  (`EXC_MOTIVOS`), suma `talles[].exc`, evento `scan_exception`, `excepciones` en el pick al cerrar y
  columna **«Sin escanear»** por operario en el Panel.
- **Etapa 3 (HECHA 20/09/2026) — dashboard**, Panel de `picking/`: filtro por **tipo de tarea**
  (`state.panelTipo`, afecta producción, operarios y excepciones), tabla por operario con **Errores
  scan · Sin escanear · Etiq. nuevas** (eventos `sku_error`/`control_error`, `scan_exception`,
  `ean_linked` por `operator_id`), tabla **«Unidades sin escanear»** (las 40 más recientes: cuándo,
  operario, tarea, artículo, talle, motivo + totales por motivo) y **«Control de ingreso por operario»**
  (desde `ingreso/control`: remitos, unidades, fuera de remito, tiempo, unid./hora).
- **Etapa 4 (HECHA 20/09/2026) — Ingreso de Mercadería**: (a) **packing list digital** en «+ Nuevo
  remito» (`ingPackingDigital`/`ingLeerPacking`, Excel o CSV): cada fila se lee por CONTENIDO contra el
  maestro — celda SKU, EAN, o artículo + talle en columnas separadas (la columna de talle se elige por
  columna, no fila por fila: un nro. de caja «7» se leía como talle) —; cantidad = encabezado
  Cantidad/Qty/Unidades/Pares o, sin encabezado, la columna de enteros chicos más llena (a igualdad la
  de más a la derecha); suma repetidos, toma el nro. de remito si está a la vista y dispara «Resolver
  detalle». ⚠ Sin validar con un packing real de la marca. (b) **Kiosco**: el operario del control
  ciego es un select del padrón (`picking/operarios`) **obligatorio**; se guardan `iniciado_ms/en`
  (primera unidad) y `terminado_ms`, reloj visible, y al terminar sale el **aviso** a la campana
  (`postAviso`). (c) **Enganche con el Reparto inicial**: en la conciliación se carga el **Nº de remito
  del sistema** (`remito_sistema`) al «Ingresar a stock» → índice liviano
  `ingreso/ingresados/<nro corto>` = `{remito, remito_sistema, fecha, u, faltan, sobran, por}`; la lista
  de remitos del Reparto inicial marca **«✓ controlado»** / «⚠ controlado con diferencias»
  (`S.ingresados`, cruce por `repNroCorto`) y la conciliación linkea a Reparto de Mercadería.
- **La barrida se reparte entre varios operarios POR ZONA del depósito (20/09/2026, decisión de Juli)**:
  la asignación de zonas (pestaña Zonas) admite dos niveles, `asignZona/<marca>__<rubro>` y el más fino
  `<marca>__<rubro>__<SUBRUBRO>` (HOMBRE / DAMA / NIÑO…, `generoNorm` le saca el «NN-»); **gana el más
  específico** (`zonaDe(marca, rubro, genero)`). La fila «todos» vale para toda la marca·rubro y las de
  subrubro aparecen al filtrar por marca o buscar. Al crear la tarea de barrida, `gruposPorZona(sg)`
  parte la marca·rubro en **una tarea por zona** (título «Adidas · CALZADO — Góndola 7», `origen.zona`
  / `zonaNombre`) y el modal deja elegir **un operario por zona** (`.ntOpZ`; vacío = el operario
  general). El subrubro viaja en cada artículo (`genero`; lo guardan las barridas desde septiembre, la
  del 03/08 no lo trae). ⚠ Al 20/09 en producción solo hay 3 zonas de demo: hay que tocar «🗺 Cargar
  zonas del plano» y asignar las marcas. Si el depósito se divide por otra cosa que no sea el subrubro
  (p.ej. tipo de prenda), sumar ese nivel a `comboKey`/`zonaDe`.
- **Plano del depósito con la estética de los planos de sucursal (20/09/2026, pedido de Juli)**:
  `picking/plano-mapa.js` dibuja como `shared/plano-suc.js` (Ensenada): marco claro, góndolas celestes
  `#cfe2f3`, servicios grises, recepción/boxes ámbar suave, rojo de la marca con destello para «acá
  está», verde para lo asignado, rótulo girado solo en muebles más altos que anchos, marco ajustado a lo
  dibujado y `aspecto` opcional. API y clases (`mp-*`, `data-zl`) sin cambios. Las 53 zonas del plano se
  cargaron en producción ese día y se borraron las 3 de demo (respaldo en
  `Descargas/respaldo-picking-zonas-2026-09-20.json`); **la asignación marca·rubro(·subrubro) → zona la
  hace el depósito a mano** en la pestaña Zonas.
- **Zona de trabajo antes de escanear (20/09/2026, pedido de Juli)**: en la tablet, `renderPickZona`
  muestra primero la zona en grande con el plano resaltado y cuántos artículos/unidades hay para preparar
  ahí; recién con «✓ Estoy en la zona — empezar a escanear» (`state.pkZonaOk = nro|zona`, evento
  `zone_entered`) arranca el escaneo artículo por artículo. Vuelve a salir cada vez que la tarea pasa a
  otra zona. En el escaneo el mini-mapa queda plegado (`pkMapaOpen=false`).
- **Alta de remitos en el Reparto inicial sin la estadística del sistema (20/09/2026, pedido de Juli)**: un
  remito entra por tres caminos. (1) El archivo, como siempre (`S.dataFile`). (2) **Automático**: al
  «Ingresar a stock» en Ingreso de Mercadería se escribe `ingreso/paraReparto/<remito>` = `{remito,
  remito_sistema, marca, fecha, por, u, contado, arts:[{cod:'ADI'+material, desc, t:[[talle,u]]}]}` con lo
  que se CONTÓ en el control ciego (si no hubo control, lo declarado; «5-» de la grilla Adidas → 5.5; suma
  los sobrantes que son del catálogo). (3) **A mano**: desplegable «+ Dar de alta un remito a mano» (líneas
  `código talle cantidad`, o `código cantidad` y se abre con la curva de la reserva) →
  `barrida/remitosManual/<remito>` (✕ en la lista lo quita). `repCargarAltas` los baja con la memoria,
  completa marca/rubro/subrubro/disciplina/tipo/ID ITEM con una consulta puntual a `logistica/arts/<código>`
  (`REP_ARTS`; el que no está en el maestro entra con su código y el aviso «N art. nuevos») y
  `repFusionarData` arma `S.data` = archivo + altas (si el archivo trae el mismo remito, manda el alta, que
  tiene los talles reales). Sin archivo la lista se arma igual (`soloAltas`). Pills «📦 del Ingreso» /
  «✍ a mano». El Nº de remito del sistema pasó a ser opcional en la conciliación. Probado 20/09 con un
  alta simulada (ADIJC5724 → ID 230107, dama, remeras): 38 u. repartidas a 4 sucursales sin subir archivo.
- **Planilla de transferencias (20/09/2026)**: el portal NO mueve el stock del sistema. Proceso real del
  depósito (Juli): Nehuen/Marcelo/Hernán le dan al operario un papel tipo F8 armado a mano mirando el
  sistema; el operario junta y deja cada artículo en la góndola de SU sucursal en planta baja; ahí otro
  operario tipea uno por uno en el sistema y lo deja para la camioneta. El botón **«🚚 Transferencias»**
  de la tarjeta de la tarea (`planillaTransferencias`/`transferenciasDe`) arma lo que REALMENTE se preparó
  (lo controlado si ya pasó el control final), una hoja por sucursal + CSV `sucursal;código;id item;
  descripción;talle;cantidad`, para tipear de corrido o importar si el sistema lo permite.
- **Artículo nuevo que no está en el maestro (20/09/2026)**: `logistica/arts` se actualiza con la carga mensual,
  así que un artículo que entra por primera vez no figura y llegaría sin rubro ni subrubro (sin eso no hay talles
  centrales, ni asignación de marcas por rubro, ni ficha). Respaldos en `barrida/`: el **rubro se deduce de los
  talles** (`repRubroPorTalles`: números de calzado / XS-S-M-L) y el panel **«⚡ Artículos nuevos»** (debajo del alta a
  mano, se abre solo si falta algo) deja completar marca, rubro, subrubro y disciplina; se guarda en
  `barrida/artsNuevos/<código>` con la forma del maestro (`REP_EXTRA`) y vale hasta que la carga de logística lo traiga.
- **Góndolas de envío → sucursal (20/09/2026, a mano)**: Picking → Zonas, sección «Góndolas de envío → Sucursal»: por
  sucursal se elige la góndola de planta baja de **calzado** y la de **indumentaria y accesorios** (las 13 del plano,
  numeradas de arriba hacia abajo: `gondolasEnvio` → «Envío ind. 1–3», «Envío calzado 1–10») + módulo en texto libre →
  `picking/envio/<slug>/<calz|ind>` = `{gid, nombre, modulo}`. La tablet lo muestra debajo de cada sucursal en «Va a»
  (`pkEnvio`) y la planilla de transferencias en el título de cada sucursal (`envioDe`).
- **Ajustes tras la primera prueba real (21/09/2026)**, todo en el kiosco `recepciones/control/`: (1) **«Separá por
  sucursal»** (`renderPickSeparar`, `pkSepPend`): el operario junta el total del artículo y antes la tablet no le volvía
  a mostrar los destinos; ahora, al terminar cada ARTÍCULO (todos sus talles juntados o con faltante), sale la grilla
  sucursal × talle con lo realmente preparado (`pkRepartoItem`: los destinos se llenan en orden, el faltante le pega al
  último) + la góndola de envío, y no sigue hasta tildar cada sucursal (`items/<iid>/sep` y `sep_ok`, evento
  `article_sorted`). Al finalizar, **«Repaso por sucursal»** (`pkRepasoHtml`): por sucursal, cada artículo con su curva
  («8.5×3 · 9×2»). (2) **El control final ya no re-escanea** (era tiempo perdido: el que despacha ya revisa): en tareas
  con destinos es un repaso POR SUCURSAL (`renderCfSucursales`): ✓ Coincide / ✗ Hay diferencia + motivo →
  `control_suc/<slug>` = `{ok, motivo, por, ts}`, `control_modo:'sucursal'`, y al cerrar `controlled = picked`; el
  re-escaneo queda como link «Prefiero controlar escaneando» (`state.cfModo='scan'`) y para los picks viejos sin `dest`.
  (3) El cartel «Etiqueta nueva» muestra el código como está impreso: un UPC de 12 dígitos se GUARDA como EAN-13 con un 0
  adelante (`gtin13`, igual que el Buscador), pero ya no se muestra con ese 0.
- **Cargas por sucursal → remito interno → despacho (23/09/2026, prueba de Juli con Marce: «el segundo control no
  aporta si termina ahí»)** — lógica e impresiones en **`picking/despacho.js`** (`window.Despacho`, lo cargan la tablet y
  `picking/`). Al cerrar el control de una tarea (`cfCerrar`, los dos modos), lo de cada sucursal se suma a su **carga
  abierta separada por rubro** (`famDe`: calz · ind · acc) en `picking/cargas/<slug>/<fam>/lineas/<pick>_<iid>_<talle>`
  (idempotente). Así se juntan remitos del Reparto y barridas mezclados. **«✗ Hay diferencia» del control por sucursal
  ahora corrige la CANTIDAD** por artículo×talle (`cfDifEditor` → `control_suc[s].aj=[{i,t,b,u}]` + motivo) y eso es lo
  que entra a la carga (`repartoDePick`). **El remito se genera SIEMPRE a mano** (Juli; lo puede generar cualquiera,
  desde la tablet o desde Picking → Despacho): número interno correlativo `R-00001` (`picking/remitoSeq` con
  `{".sv":{"increment":1}}`, atómico) → `picking/remitos/<nro>`; la carga se vacía solo de lo que entró. **Alertas, no
  cierre**: al llegar a `TOPE` (300 u.) o con unidades de más de `HS` (48 h) en la carga, aviso a la campana UNA vez
  (`aviso300`/`aviso48` en la carga, se borran al generar el remito) + resaltado en las dos pantallas. **Despacho** (tablet
  → tarjeta «🚚 Despacho»): quien pasa mercadería abre el remito, marca cada artículo ✓ Está / ✗ Falta-sobra con la
  cantidad real (`marcas/<cod>`), carga cajas y ensunchados (`bultos`), imprime etiquetas de bulto («Bulto 1/3») y
  «Despachado» (`despacho={por,ms,cajas,sunchos,arts,dif}`; con diferencias avisa a la campana). En **Picking → Despacho**
  (badge con alertas y pendientes): cargas abiertas (Ver / Generar remito), remitos para despachar / despachados, **Nº de
  transferencia del sistema** anotado aparte (`nro_sistema`; cómo integrarlo al sistema sin afectar otros movimientos
  quedó sin definir), 🖨 remito + CSV para el sistema (con las cantidades que realmente salieron) y ↩ Anular (solo sin
  despachar: las líneas vuelven a la carga). Probado 23/09 con una base simulada en el navegador, sin la tablet real.
- **Pendiente**: probar cámara y lector en la tablet real; validar el packing digital con un archivo de
  la marca; publicar al mapa del Buscador las etiquetas aprendidas que confirme el control final; hoja
  de apertura de cajas; otras marcas en el Ingreso (hoy solo Adidas).

## Panel General de Logística (`logistica/`, 08/09/2026)

Dashboard de logística (envíos e ingresos), **pantalla inicial de `logistica@` y `deposito@`**.
Desde el 08/09/2026 (tarde) las dos cuentas están en **`PERFILES_FIJOS`** del Portal (sus
herramientas, `inicio:'logistica'`, `soloHerramientas:true`), como producto@/rrhh@, así la
pantalla inicial no depende del ⚙ ni de la sesión que tengan abierta; sus registros en
`usuarios/` llevan lo mismo. Son admin (lo exigen sus módulos) pero ven SOLO esas herramientas.
Ojo: un admin **sin** `soloHerramientas` ve todos los tiles aunque se le marquen algunos — por
eso el ⚙ avisa en cada fila «⚠ Hoy ve TODAS las herramientas». Las sesiones ya abiertas toman
los cambios del ⚙ al pasar por el Portal (`refrescarSesion` en `init()`).
**Nombre visible (pedido de Juli 08/09/2026): «Panel General»** para quien lo tiene de pantalla
inicial (`session.inicio==='logistica'`: tiles del Portal `nombreTool`, drawer de `header.js`,
título/hero del módulo `NOMBRE_MODULO`) y **«Panel General · Logística»** para gerencia, que ya
tiene el Panel General de Indicadores (así no hay dos tiles iguales en la grilla de Juli). En
el código y en este archivo se sigue hablando de «logística» / envíos e ingresos. Replica
el informe HTML «Dashboard Gerencial — Envíos e Ingresos» (jun–ago 2026, generado fuera del
portal) con datos vivos: `index.html` self-contained (header unificado, Chart.js 4 + SheetJS
por jsdelivr; ⚠ en cdnjs la ruta de Chart.js da 404).

- **Fuente = los dos exports pivot del sistema** (CSV `;` latin1, una columna por mes 1..12,
  el año va en el nombre del archivo): **«Estad transferencias <año>.csv»** = envíos del
  depósito a cada sucursal (origen · rubro · subrubro · marca · proveedor · disciplina · tipo
  de artículo · campaña · línea · código · artículo · ID ITEM · destino · meses; una fila
  «Total» por artículo que se descarta) y **«Estad remitos <año>.csv»** = ingresos al depósito
  (marca · rubro · subrubro · disciplina · remito · tipo · campaña · línea · artículo · código
  · ID ITEM · pares Cant.recibido/Costo por mes + Total; segunda fila de encabezado). El
  informe HTML original era un **recorte** de estos archivos (Adidas/Nike/Puma y 4
  disciplinas, jun–ago): 9.226 de sus 9.228 filas coinciden con el CSV.
- **Modelo Firebase** (`recepciones-mateu/logistica/`): `arts/<clave>` = maestro compartido
  `[rubro, sub, disc, marca, idItem, artículo, tipo, código]` (clave = código con `. # $ [ ] /`
  → `_`; el rubro va sin el prefijo «NN-»: `CALZADO`), `meses/<YYYY-MM>` =
  `{meta:{envios:{archivo,hoja,subido,por,filas,unidades}, ingresos:{…}},
  envios:[[clave, sucursal, unidades],…], ingresos:[[clave, unidades, costo],…]}` (sumados
  por artículo × sucursal × mes), **`porSuc/<slug>/<YYYY-MM>`** = `{u, rubros:{}, marcas:{},
  top:[[art, marca, u, cod]…]}` (resumen por sucursal, seguridad blanda: Mi Sucursal baja solo
  el suyo; `PREFIJO_SLUG` NN→slug como en objetivos/), `avisos/<YYYY-MM>` (recordatorio ya
  mandado) y `ultimo`. **Carga perezosa (08/09/2026 tarde)**: al abrir baja `arts` + los
  últimos `MESES_INICIALES` (3) meses; el filtro «Mes» lista todos los del año (los no
  cargados con «·») y `refresh()` baja a demanda los que se elijan más el período anterior y
  el mismo del año anterior (para las variaciones); «Limpiar filtros» = todo el año.
  Sembrado el 08/09/2026 ene–sep 2026 con `node scripts/importar-logistica-csv.js 2026
  "<transferencias.csv>" "<remitos.csv>" [--dry]`. Totales: 643.710 enviadas · 787.804
  ingresadas · 151 marcas.
- **Parser en `lib/logistica-parse.js`** (UMD, `window.LogisticaParse` / `require`): única
  fuente de verdad de la lectura de los exports (`detectarPivot`, `conocidosDesde`,
  `inferirColumnas`, `parsearPivot`, `detectarPorNombre`, `parsearPorNombre`, `csvAMatriz`,
  `filasMes`, `unidadesDe`, `resumenPorSucursal`, `ymDeCelda`…). Lo usan el módulo, el
  script de siembra y los tests: **`node --test lib/logistica-parse.test.js`** (fixtures con
  el formato real, columnas desordenadas, remitos con costo, formato por nombre).
- **Pantalla**: 7 filtros multi-select propios (`multiSel`, chips con buscador; **encadenados**:
  cada uno ofrece solo los valores que quedan con los demás; el de Sucursal aplica solo a
  envíos porque los ingresos son del depósito; el 7.º es Tipo de artículo) → 5 KPIs
  (enviadas, ingresadas con **costo** en millones, **sin distribuir**, sucursales, artículos ·
  marcas) con **chips de variación** `varChip` vs. el período anterior de la misma cantidad
  de meses y vs. los mismos meses del año anterior (solo si están todos cargados) → Envíos
  (unidades por sucursal con selector «ver solo estas», anillo por rubro, **línea por mes con
  el año anterior punteado** y el **ritmo del mes en curso** `ritmoHtml`: unidades por día
  hábil lun–sáb sin feriados del calendario del shell `shared/data/calendario-<año>.json`,
  proyección y % del ritmo del mes pasado; top marcas, disciplinas, subrubros) →
  **«Abastecimiento vs. venta»** `ventaVsEnvios` (unidades enviadas por cada 100 vendidas por
  sucursal; la venta neta sale de `data/indicadores/<ym>/cadena.json` — períodos RETAIL, sin
  apertura por rubro — solo para los meses que tienen período) → Ingresos con **switch
  «Unidades / $ al costo»** (`MODO_ING`, `valIng`) para rubro/subrubro/mes → **«Ingresó y no
  salió»** `noSalio` (por artículo: ingresó − salió a cualquier sucursal en los mismos meses,
  % distribuido con barra, top 30; alimenta el KPI «Sin distribuir») → detalle **ordenable por
  columna** (`TB.sort`), **«Agrupar por artículo»** (suma sucursales) y **«⧉ Copiar»** (TSV al
  portapapeles), con «Ingresó al depósito» del mismo artículo+mes. «⇩ Excel» = Envíos,
  Resumen, Ingresos (con costo), Sin distribuir y Vs. venta. Plugin `valueLabels` dibuja
  valor · % en barras/anillo/puntos (texto plano, sin contorno; sin % con un solo valor).
- **Recordatorio de carga** (`recordatorioCarga`): si falta el mes anterior (desde el día 5)
  sale un banner ámbar con «⇧ Cargar ahora» y se manda **una vez por mes** un directo por la
  Bandeja a `AVISO_MAILS` (logistica@, deposito@; flag `logistica/avisos/<ym>`).
- **Mi Sucursal**: sección **«Qué te mandó el depósito»** (`secDeposito`,
  `renderDeposito`/`paintDeposito` en `indicadores/`, zona viva, después de la Reposición):
  lee `logistica/porSuc/<slug>` y muestra por mes (selector) unidades recibidas con variación
  vs. el mes anterior (el mes en curso se marca «parcial»), chips por rubro, barras por marca
  y los 10 artículos que más llegaron. Sin resumen → la sección no aparece.
- **Carga mensual** («⇧ Cargar export», modal con dos recuadros envíos / ingresos, CSV o
  Excel, drag & drop; el CSV se lee como windows-1252): `detectarPivot` reconoce el pivot del
  sistema por la fila de meses (y «Cant.recibido» en la segunda fila para remitos). **El orden
  de las columnas de texto NO importa (pedido de Juli 08/09/2026)**: `inferirColumnas` asigna
  cada columna por su CONTENIDO (valores conocidos del maestro `ARTS` para rubro/subrubro/
  disciplina/tipo/marca; patrones para ID ITEM, código, sucursal «NN-…», artículo; proveedor,
  campaña y nro. de remito se ignoran solos) y la previsualización muestra el panel «Cómo leí
  las columnas» (ejemplos + selector por columna, `CAMPOS`): cambiar un selector re-lee el
  archivo (`reprocesar`), marca «corregida», bloquea Guardar si falta Código/ID, Artículo o
  Sucursal destino, y recuerda la corrección por tipo y cantidad de columnas (localStorage
  `logi_colmap_<tipo>_<n>`). Respaldo `detectarPorNombre`/`parsearPorNombre` para una tabla
  plana con encabezados por alias (`ALIAS`: mes desde Fecha o Mes), con el mismo panel. El año
  sale del nombre del archivo o del campo «Año». Avisa si el archivo parece del otro recuadro.
  Cada mes del archivo **reemplaza** ese mes y tipo y actualiza el maestro (PATCH multi-path);
  los demás meses quedan. Validado con los dos CSV reales y con una copia con las columnas
  desordenadas: mismos totales que el script. Etiquetas de los gráficos (`valueLabels`): texto
  plano sin contorno, blanco adentro / navy afuera, sin % cuando hay un solo valor.

## Objetivos de Venta Semanal (y Mensual)

`objetivos/` es un `index.html` self-contained (lee la sesión del Portal, sin login
propio). Lo carga **gerencia**: el objetivo de venta por sucursal, semanal y mensual.
La ve el rol `admin` o quien tenga la herramienta `objetivos`. Las sucursales NO
entran acá: ven su objetivo en Indicadores.

- **Objetivo MENSUAL (18/08/2026)**: pestañas «Mensual · cargar» y «Mensual ·
  dashboard». Se sube el Excel **"Objetivos Ventas Mensual - Al MM-YYYY.xlsx"**
  (`Desktop/PMS/MENSUAL/`): libro ACUMULATIVO, una hoja por mes ("AGO26") y cada
  hoja trae todos los meses en bloques de 4 columnas (OBJETIVO · ALCANZADO ·
  %REAL · %ESTIMADO) desde ago-2021 — el año de cada bloque se deduce contando
  hacia atrás desde el mes de la hoja. La META publicada sale de la **tabla
  lateral** del mes (objetivo REDONDEADO, el que se comunica, con su división
  **Semanal**); fallback al bloque sin redondear. El mes en curso viene sin
  ALCANZADO: el real llega con el Excel del mes siguiente. Checkbox «Publicar
  también el histórico» → PATCH con todos los meses (habilita el **vs. mismo mes
  del año anterior** del dashboard; `·m` = compara la meta porque el mes está
  abierto). Avance del mes abierto = suma de las semanas del mes: real oficial donde está y, si no, la venta provisoria cargada (ventaEquipo) — «x sem».
  Firebase: `objetivos/meses/<YYYY-MM>` (mismo formato porSlug que las semanas,
  + campo `semanal`) y `objetivos/ultimoMes`. En **Indicadores**, bloque
  «Objetivo del mes» dentro de la sección Objetivo (cada sucursal baja solo su
  slug; suma semanas publicadas + lo provisorio del encargado).

- **Valores por sucursal/semana**: **META** (el objetivo, el único que se carga),
  **MÍNIMO** (= Meta ÷ 1,2), **120** (= Meta × 1,2, el gran objetivo; en pantalla se llama solo «120», destacado) y **REAL** (venta de
  la semana). Banda geométrica de razón 1,2 alrededor de la Meta (validado con el
  Excel real de Juli: p.ej. Meta 108M → Mín 90M → 120 129,6M). Mínimo/120 se derivan
  solos y se guardan horneados. Los factores están en `F_MIN`/`F_120` del módulo.
  ⚠️ Los objetivos son montos grandes (decenas/cientos de millones de pesos): la venta
  semanal de una sucursal grande ronda los 100M. Cuidado con hojas viejas del Excel que
  vienen en otra escala (×40 menos).
- **Carga (Etapa 1, dos caminos)**: (a) subir el Excel **"PMS Objetivos Semanal
  Locales"** (SheetJS por CDN, client-side, no se sube nada) → se elige la hoja de la
  semana ("SEMANA 3 AGO"…) y se parsea la grilla; o (b) cargar los montos a mano. Todo
  editable antes de guardar. El parseo detecta la sucursal por su **código NN** (01,
  02, … → slug del Portal vía `PREFIJO_SLUG`), toma el objetivo y la venta real de la
  fila, y las filas "FINAL AJUSTADO" (más abajo en la hoja) **pisan** a las de "FINAL".
  El lunes de la semana se deduce del nombre de la hoja.
- **Real de las semanas cerradas (21/09/2026)**: al guardar, `backfillRealPublicadas` completa el
  `real` de las semanas ya publicadas desde la hoja **HISTÓRICO** del Excel. Esa hoja puede quedar
  atrasada (el 21/09 terminaba en «31 AGO» y la semana del 14/09 quedó sin real, solo con el «prov»):
  respaldo `completarHistDesdeHojas` = la columna REAL de la hoja de cada semana (últimas 12 hojas con
  layout de objetivo, semanas cerradas de los últimos 70 días; HISTÓRICO manda; el backfill exige que
  la mayoría de las metas de la hoja coincida con las publicadas, `state.histHoja`). Las hojas ahora
  se llaman por número de semana («SEM38»): `lunesDesdeSemana` = lunes de esa semana ISO del año en
  curso (`lunesDeHoja` prueba primero día+mes).
- **Dashboard (gerencia)**: por semana, tabla con Meta/Mínimo/120/Real, % de
  cumplimiento con color (verde ≥meta, ámbar ≥mínimo, rojo <mínimo), total cadena,
  ranking ordenable y barra de avance. Selector de semana + histórico.
- **Firebase**: **reusa `recepciones-mateu`** (nodo `objetivos/…`, sin tocar
  `recepciones/…` ni `barrida/…`; no hace falta crear base). Árbol:
  `objetivos/semanas/<lunesISO>` con `{meta:{…}, porSlug:{<slug>:{meta,minimo,s120,real,nota}}}`
  y `objetivos/ultima` (puntero al último lunes). Se guarda **agrupado por slug** para
  que cada sucursal baje solo lo suyo (seguridad blanda, como Indicadores/Barrida).
  Constante `FIREBASE_DB_URL` en `objetivos/`, `OBJETIVOS_URL` en `indicadores/`.
- **Aviso a la sucursal**: vive en **`indicadores/`**, **arriba de todo** (encima de
  los KPIs — es lo primero que ve el encargado). La sección `secObjetivo` lista las
  semanas publicadas (`objetivos/semanas.json?shallow=true` → solo las claves, sin bajar
  datos de otras sucursales) en un **selector para ver semanas anteriores**, y por la
  elegida lee `.../porSlug/<slug>` (Meta destacada, Mínimo/120 y barra de avance vs.
  Real). Sin dato para esa semana → nota "aún sin cargar"; sin ninguna semana → la
  sección no aparece. Usa `SUC2SLUG`.
- **Venta por vendedor que carga el encargado** (en `indicadores/`, dentro de la
  sección Objetivo): panel desplegable "Cómo viene el equipo". El encargado sube el
  Excel de venta **abierta por vendedor** (SheetJS lazy), **previsualiza** y guarda.
  Tres formatos autodetectados en orden: (1) template PMS semanal (hoja PMS(H) +
  día a día de la hoja REAL — `vePegarDias` cruza los nombres de las dos hojas: idéntico →
  sin lo que va entre paréntesis → parecido único → mismo total de venta, y la vista previa
  avisa quién quedó sin días; hasta el 10/09/2026 exigía el nombre idéntico y en Aurelius 12
  «NICORA EZEQUIEL (VENDEDOR FULL)» vs. «NICORA EZEQUIEL» dejó al vendedor sin día a día); (2) **la estadística detallada por línea** (26/08/2026,
  la misma que sube gerencia en la vista Cadena — puede venir SIN columna Sucursal
  y hasta SIN encabezados: `veParseDetallado(m, sucFija)` + `veDetectarColumnas(m,
  sinSuc)` asumen la sucursal de la sesión, se quedan solo con los días de la semana
  elegida y traen el día a día por vendedor; va ANTES del genérico porque el genérico
  la leería mal); (3) **planilla por día** (27/08/2026, la que arma el encargado a
  mano: días en COLUMNAS — fila de «lunes/martes/…» en celdas combinadas arriba y
  sub-encabezados unidades·ticket·Importe por bloque, una fila por vendedor —
  `veParseMatrizDias`; suma los bloques y arma `dias`; va antes del genérico, que
  tomaría solo el primer día); (4) genérico (columnas vendedor/venta y, si vienen,
  tickets/unidades — sin días). Muestra
  ranking por venta con barra de participación, avance del equipo **vs. la Meta de la
  semana**, y UPT/ticket promedio por vendedor cuando el Excel trae tickets/unidades.
  Firebase: reusa `recepciones-mateu`, nodo `ventaEquipo/<slug>/<semanaISO>` (agrupado
  por slug → cada sucursal baja solo lo suyo, como Objetivos/Barrida).
- **Objetivos por equipo SIN Excel (reemplaza el circuito PMS)** — el recorrido:
  gerencia publica el objetivo semanal → el encargado **arma su equipo y asigna horas
  de venta por turno×día** (editor en el panel "Cómo viene el equipo" de Indicadores:
  agregar/quitar gente, importar de Plantilla, grilla 3 turnos × 7 días por persona,
  cap 4/3/4 h; semana nueva copia la anterior) → el portal **reparte la Meta** entre
  las personas. Turnos: T1 9-13 · T2 13-16 · T3 16-20. Fórmula (validada contra el
  PMS real de Aurelius CB): el peso de un turno-día se divide entre las horas del
  equipo en ese turno-día; `share persona = Σ horas×peso/horasEquipo`; su meta/mínimo
  = share × Meta/Mínimo. **Matriz de pesos**: pestaña **"Pesos por turno"** de
  `objetivos/` — Juli sube mensualmente la estadística de venta por sucursal×hora×día
  (hoja tipo "Datos actualizados"; T1=filas 9-12, T2=13-16, T3=17-20) y se publica en
  `objetivos/pesosTurnos` (porSlug); fallback horneado `indicadores/pesos-turnos.js`
  (regenerable con `node scripts/gen-pesos-turnos.js "PESOS TURNOS….xlsx"`). Equipo en
  `objetivos/equipos/<slug>/<lunesISO>` (equipo + real manual). La venta real
  individual sale del Excel PMS subido (match por nombre) o de carga manual (pisa al
  Excel). ⚠️ `num()` de objetivos come el punto decimal si hay exactamente 3
  decimales: para celdas numéricas usar el valor directo (ver `numCell`).
  Diagonal 80 tiene objetivo pero no datos de Indicadores: desde el 21/08/2026 la
  sección Objetivo (mes + semana + equipo) y la Reposición se muestran igual, porque
  resuelven el slug con `slugActual()` (sesión) y no con `SUC2SLUG[sucName]`; solo
  los KPIs quedan en empty state hasta que Diagonal tenga datos de venta.
- **Venta de la semana en curso (real provisorio)**: Juli baja del sistema la
  estadística detallada por línea de la semana ("Semana DD-MM-AA.xls") y corre
  `python scripts/cargar-venta-semana.py "<xls>" <lunesISO> --publicar` → escribe
  `ventaEquipo/<slug>/<lunesISO>` (venta · tickets · unidades · día a día por vendedor)
  para las 21 sucursales con los criterios por línea del ETL. Sin `--publicar` solo
  muestra el resumen vs. meta. Se puede re-correr con el archivo actualizado (pisa).
  NO escribe el `real` de `objetivos/semanas` (ese es el oficial del HISTÓRICO).
  **Desde el portal (22/08/2026, el camino habitual):** en Indicadores (Panel General),
  vista **Cadena**, sección «Objetivo de la semana», botón **«⇧ Cargar venta de la
  semana»** (solo gerencia): sube el export detallado con TODAS las sucursales — sirve
  tanto el semanal ("Semana DD-MM-AA.xls") como el **del mes entero** ("Venta Agosto
  Portal.xlsx", encabezados «Numero de comprobante»/«Descripcion» también válidos) como
  la vista **"Venta semanal portal"** del sistema ("ventas semana DD-MM.xlsx": **sin fila
  de encabezado**, sin año/mes, rubro sin prefijo «CALZADO»; `veDetectarColumnas`
  reconoce cada columna por su contenido — código «NN-» de sucursal, Lu/Ma/…, nro de
  comprobante «FcC.0057-…», rubros conocidos, enteros día/hora, los dos numéricos
  finales = cantidad/importe, texto antes del nro = vendedor y después = artículo).
  Con año y mes (filas 0-1) arma la fecha completa de cada comprobante; sin ellos
  compara los pares (día de semana, día del mes) con el calendario de la semana. El
  portal se queda **solo con los días de la semana elegida** en el selector
  (auto-selecciona la última publicada que el archivo cubre; si ninguna venta cae en
  la semana, bloquea Publicar). `veCriterioLinea` normaliza el rubro sin el «NN-». `veParseDetallado` (comprobantes) + `veAgregarSemana` (filtro + payloads)
  = port de `cargar-venta-semana.py`; mantener los criterios en sintonía.
- **La venta cargada da EXACTO lo que dice el sistema (17/09/2026, pedido de Juli)** —
  `VE_EXACTO` en `indicadores/index.html` (y `EXACTO` en `cargar-venta-semana.py`). Antes el
  portal aplicaba dos reglas propias sobre el export y el número no cerraba con el TS: el
  encargado veía «llegó a la meta» y el sistema le decía otra cosa, así que el módulo perdía
  veracidad. Las dos reglas se dieron de baja **solo en la carga semanal**:
  (1) **criterios de línea** — `veCriterioLinea` devuelve `[true,true]` siempre: suman todas
  las líneas del export (rubro Otros, REDONDEO, INGRESO CUPON, LLAVERO COMPRA GRANDE,
  CONCEPTOS VARIOS, envíos, promos, notas de crédito), tal cual las lista el sistema;
  (2) **atribución por comprobante** — cada **línea** va al vendedor que la hizo, no al de la
  línea de mayor importe del ticket: `veParseDetallado` guarda `comp.vends[<vendedor>] =
  {cant, imp, rub}` y `veAgregarSemana` recorre eso (la metadata del comprobante — día,
  fecha — sigue saliendo de la línea más grande). Caso que lo disparó: Diagonal 80, semana
  37, Camila Cavalier — sistema 9.395.649 / 129 u. vs. portal 9.755.637 / 157 u.
  ⚠️ **Los tickets del local ya no son la suma de los vendedores**: un ticket con líneas de
  dos personas le cuenta 1 a cada una, pero para el local es **uno solo** (`sucTk`, un Set
  de comprobantes por sucursal); venta y unidades sí son aditivas. Tests:
  `node --test lib/venta-exacta.test.js` (extraen las funciones del propio index.html).
  **El ETL mensual se alineó el mismo día** (Juli: «alinear»): misma constante `EXACTO` en
  `scripts/etl_indicadores.py` y los cuatro cambios están en «Cómo regenerar los datos»,
  arriba. Los cuatro períodos (2026-05 … 2026-08) se regeneraron con el criterio nuevo.
  ⚠️ **Las semanas ya guardadas conservan el criterio viejo**: para corregirlas hay que
  volver a subir el export de esa semana (o el del mes con «⇧ Cargar venta del mes», que
  republica todas las semanas que cubre).
  **Omnicanalidad (29/08/2026)**: los vendedores **WEB MATEU / WEB AURELIUS** en una
  sucursal física (Calle 12, Aurelius Calle 12, …) son venta de ecom facturada ahí:
  `veAgregarSemana` los **REASIGNA a Ecommerce** (la física queda igual que el
  sistema y la venta no se pierde; la previsualización avisa cuánto movió). En
  Ecommerce (99) son sus vendedores reales y quedan. Ojo: el ETL mensual y el
  script Python todavía no aplican esta regla. Previsualiza
  por sucursal vs. meta (avisa cuántos comprobantes descarta de otros días, sucursales
  sin slug —05-Depósito— y metas sin venta) y
  **publica en un solo PATCH multi-path** a `ventaEquipo/<slug>/<lunesISO>` (mismo
  payload que el script). **Dos botones, un mismo input** (`veCadElegir`, 29/08/2026):
  «⇧ Cargar venta de la semana» (sección Objetivo de la semana) toma **SOLO la semana
  elegida** en el selector aunque el archivo traiga el mes entero; «⇧ **Cargar venta del
  mes**» (bloque Objetivo del mes de la vista Cadena) sube el export del arranque del mes
  a hoy y publica **todas las semanas publicadas que cubre, juntas** en el mismo PATCH.
  En el modo mes, una semana **no vigente cubierta a medias** (días de la semana fuera del
  rango del archivo — típico de un export por mes calendario que corta las semanas retail
  de los bordes) se alerta y se **excluye** de la publicación, para no pisar una semana ya
  cargada completa (`veSemanasCobertura`); un día sin venta DENTRO del rango
  (feriado/domingo) no cuenta como faltante; la vigente publica con los días que tenga.
  Un `.xls` que llega al tope de 65.536 filas se detecta como truncado: alerta 🛑 y
  Publicar bloqueado (pedir `.xlsx`/CSV).
  ⚠️ Criterios de calendario: hasta agosto 2026 el objetivo MENSUAL se armó por **mes
  calendario** y el semanal por **semanas retail** (no cierran entre sí); desde septiembre
  2026 se unifica todo en calendario retail: **una semana pertenece al mes de su DOMINGO**
  (igual que `mesRetailDe` del calendario del shell), así que la **Semana 36 (31/08–06/09)
  es de septiembre**. El helper es `objMesDeSemana()` en `indicadores/` y `mesDeSemana()`
  en `objetivos/` (desde `2026-09` manda el domingo; antes, el mes calendario del lunes).
  Nunca derivar el mes con `sem.slice(0,7)`. La banda «En curso» y el acumulado del mes
  van por el mes retail de la semana elegida aunque la tarjeta del objetivo mensual caiga
  al último mes publicado (lo aclara en su título). La tabla de la cadena muestra esa venta como **«prov»**
  mientras no esté el real oficial (gerencia baja `ventaEquipo/<slug>/<sem>/total`
  de cada sucursal). El script Python queda como plan B.
- **Base «Horas asignadas» + justificaciones (03/08/2026)**: el toggle de KPIs de
  Indicadores pasó de "Horas con venta" a **"Horas asignadas"**: usa las horas que el
  encargado asignó a la venta en la grilla del equipo (de las contratadas, solo las de
  venta — un full suele tener 7 de 9 hs; el resto es limpieza/armados). Por semana del
  período: horas del equipo guardado, fallback al `h_act` del sistema; la nota al pie
  dice cuántas semanas cubre. En vista cadena solo gerencia baja los equipos de todas
  (seguridad blanda). Y dos alertas con modal de justificación: (1) al **guardar el
  equipo**, personas con días sin horas o de la dotación fuera del equipo → motivo
  obligatorio; (2) con venta cargada, personas con **horas asignadas y cero venta** →
  popup automático al encargado. Ambas se guardan en el payload del equipo
  (`justif.sinHoras` / `justif.sinVenta`) y el resumen les llega por **directo de la
  Bandeja** a `ALERTA_ADMINS` (capacitaciones@ —Iván, cubre RRHH, confirmado por Juli— /
  cristian.campion@, constante en `indicadores/`).
- **Etapa 2 (26/08/2026, HECHA la parte de aviso)**: al publicar la semana en
  `objetivos/` (`guardar()`), con confirmación se manda un **directo por la Bandeja**
  (`mensajes-mateu`) a cada cuenta de sucursal/outlet con su meta (`notificarSucursales`;
  mails resueltos contra `discontinuos-mateu/usuarios`). Queda pendiente solo la parte
  de armar objetivos sin Excel (ya se pueden cargar a mano).
- **Circuito operativo en Indicadores (26/08/2026)**: chip **«Hoy»** en la tira viva
  (objetivo del día de HOY con la curva, real y % si hay venta — solo en la semana en
  curso); **semáforo «Datos de la semana»** en el Panel General (venta cargada X/N y
  equipo armado X/N, botón «📣 Recordar a las que faltan» → directos por la Bandeja);
  **alerta de ritmo automática** (`alertasRitmo`): de jueves a domingo, al abrir el
  Panel General, directo a la sucursal + supervisor si va <90% del ritmo (una vez por
  semana/sucursal, flag `objetivos/alertasRitmo/<sem>/<slug>` en recepciones-mateu).
  El payload de `ventaEquipo` ahora guarda **`rubros`** por vendedor (importe por
  CALZADO/INDUMENTARIA/… de la estadística detallada) → «Mix de la semana» en el
  desplegable de cada vendedor. La matemática del reparto tiene **tests**:
  `node --test lib/reparto.test.js` (extraen las funciones del propio index.html).
- **Ritmo por vendedor (11/09/2026, pedido de Juli: «que el número quede ahí» y el encargado
  se lo pase al vendedor con seguridad, sin sacar la cuenta a ojo)**: en «Cómo viene el
  equipo» de Mi Sucursal, cada tarjeta muestra bajo el nombre **«⏱ N% del ritmo · para el
  ★ 120%: $X por día · meta: $Y por día (Ju·Vi·Sá)»** y el desplegable abre el bloque
  (`eqRitmoBloque`): debería llevar / lleva / ritmo, a cuánto cierra si sigue así, y dos
  recuadros (su meta y ★ 120%) con lo que falta, el promedio por día y el mismo monto abierto
  según la curva de cada día. Cálculo en `eqRitmoPersona(venta, objDias, diasSet, sem, hoy)`
  sobre su objetivo por día (`eqSharesDia` × meta): esperado = objetivo de los días ya cargados
  (un día transcurrido sin venta en el local sale, como en `ritmoEsperado`); «por día» = lo que
  falta ÷ los días que le quedan **con horas** después del último día cargado; semana terminada
  → no se pide nada; si la venta cargada quedó atrás de hoy lo avisa. Botón **«⧉ Copiar ritmo
  del equipo»** (texto para WhatsApp, `eqRitmoLinea`). Tests en `lib/reparto.test.js`.
  **Diferencia meta vs. venta (20/09/2026, pedido de Juli: «no sacar cuentas con la calculadora»)**:
  columna entre Venta y «% de su meta» en cada tarjeta y en «Total equipo» (`eqDifStat`): «Sobre la
  meta +$X» en verde o «Falta −$X» en rojo; sin meta o sin venta, «—». En las dos vistas del equipo. También en el
  Panel General: columna ordenable «Diferencia» (`difTd`) en el «Detalle por sucursal» del objetivo de la
  semana y del mes, y «· Falta / Sobre la meta» (`difTxt`) al lado de la meta del total.
  ⚠ Mismo día: `eqDiasSet` ahora cuenta un día como cargado **solo si el local vendió algo**
  (`veVentaDia` > 0). La plantilla PMS trae los días que no pasaron con venta 0 (Vie/Sáb en 0
  un jueves) y contarlos daba la semana por completa: el ritmo del local no salía y tickets/hora
  sumaba horas de días sin venta.

**Puesta en marcha: ya funciona (usa `recepciones-mateu`, en vivo). No hace falta
crear ninguna base.**

## Academia de Ventas (`capacitaciones/`)

`capacitaciones/index.html` es la versión FUNCIONAL, self-contained como el resto
(lee la sesión del Portal, sin login propio). Roles: **staff** = `admin` /
`capacitador` (Iván Nicoloff, `capacitaciones@mateu.com.ar`) / `supervisor`
(Cristian Campion) con acceso total; **alumno** = cuentas `sucursal`/`outlet` con la
herramienta `capacitaciones`.

**La app ES el prototipo de Design hecho funcional** (decisión de Juli 03/08/2026):
mismas pantallas y estética, con datos reales.

- **Pestañas** (SPA, sin recargar): alumno = Inicio (progreso, competencias, badges,
  carrusel "Continuá tu programa") · Catálogo (tabs de programas por nivel + carrusel
  de tarjetas con portada) · Novedades (feed) · Historial (certificado por programa
  completo o candado con progreso) · Ranking (podio por persona). Staff (admin /
  capacitador Iván / supervisor Cristian) = Catálogo (+ ✏ en cada tarjeta) · Novedades
  (+ publicar) · Mi equipo (dotación real de TODAS las sucursales con niveles y
  progreso por persona) · Ranking (toggle empresa/sucursal) · Gestión (CRUD de cursos
  y programas + encuestas).
- **Player de curso**: hero oscuro con barra de progreso, índice lateral (lecciones +
  quiz final), contenido en tarjetas; en módulos de texto, un bloque que arranca con
  `[[dato]]`/`[[tip]]`/`[[evitar]]`/`[[ejemplo]] Título` se destaca con color, y
  `Título:` al inicio de bloque hace tarjeta con título. Módulos tipo texto / video
  YouTube / **archivo PDF-PPT subido desde la PC** (Firebase en partes base64, nodo
  `archivos/<fid>`, tope 20 MB) / link. Quiz con opciones botón y banner de resultado
  (staff ve la correcta marcada). Al aprobar: badge + certificado imprimible (firmas
  Iván/Cristian) + encuesta + novedad automática en el feed.
- **Alumno**: la cuenta de sucursal elige QUIÉN es (picker con la dotación de
  Indicadores, mapa `SLUG_SUC_IND`; se recuerda en `cap_yo_<slug>`; "Cambiar persona"
  en el header). Programas filtran por puesto (encargado/vendedor/cajera/depósito)
  y/o sucursal, con fecha límite.
- **Firebase**: reusa **`recepciones-mateu`**, nodo aparte `capacitaciones/`:
  `cursos/`, `programas/`, `avances/<slug>/<personaId>/<cursoId>` (agrupado por slug,
  seguridad blanda), `novedades/` (feed; no-leídas por localStorage),
  `encuestas/<cursoId>/` y `archivos/<fid>`. «📣 Avisar» de un programa publica en la
  Bandeja del Portal (`mensajes-mateu/avisos`) y en Novedades.
- **Portada del curso** antes del player (datos, frase gancho, "Qué vas a aprender",
  Evaluación) y **certificado** con el diseño exacto del prototipo. **Encuesta previa
  al programa** (opción del programa: intro + preguntas abiertas de Iván; respuestas en
  `encuestasPrevias/<prog>/<slug>/<persona>`, visibles en Gestión → Encuestas). Programas
  con ícono (`icono`) y chips de filtro por competencia en el Catálogo. Cursos en
  **borrador** (`activo:false`): el equipo no los ve; un programa sin contenido visible
  no aparece al alumno.
- **Mejoras 03/08/2026 (todas en `capacitaciones/index.html` salvo aviso)**: PIN personal de 4
  dígitos por persona (`pins/<slug>/<persona>`; lo crea cada uno, staff/encargado lo resetea desde la
  ficha); tiempo de lectura por módulo (`avance.tiempo`) + alerta «muy rápido» (<20 s/módulo);
  Mi equipo → ficha de persona (pendientes, minutos, directo a la cuenta de la sucursal vía
  `mensajes-mateu/directos`, reset PIN), «Recordar a los que no empezaron» y export Excel;
  recordatorios automáticos de vencimiento (7 días antes y el día anterior, flag
  `programas/<id>/recordatorios`) a Bandeja + Novedades; PDF embebido en el curso; badges
  dorados por competencia completa; duplicar curso; encuesta post-programa
  (`encuestasPost/`); certificado «Compartir» (html2canvas + Web Share); celular (índice
  horizontal, tablas con scroll). **Resumen para otros módulos**: el staff publica
  `capacitaciones/resumen` (por sucursal y por persona) al entrar; `capacitaciones/resumen-widget.js`
  lo inyecta en Indicadores (sección «Academia de Ventas»), Evaluaciones (tarjeta bajo el
  formulario) y RRHH (chip por legajo) — cada uno lo incluye con una línea en el `<head>`.
- **Ayudante con IA**: `functions/api/academia-ia.js` (Pages Function; HTTP directo a
  `/v1/messages`, `claude-opus-5`, salida JSON Schema, fallback server-side). Necesita
  `ANTHROPIC_API_KEY` en Cloudflare Pages → Settings → Environment variables; sin la clave el
  GET responde `disponible:false` y la Academia no muestra los botones ✨ («Mejorar con IA» en
  el asistente, «Proponer preguntas con IA» en asistente y editor). Pendiente técnico: los
  archivos subidos van en base64 en RTDB (tope 20 MB); si crecen, migrar a Firebase Storage.
- **Tanda de adopción (07/09/2026, «aplicar todo» de Juli)** — al 07/09 había 3 cursos activos, 39 en
  borrador y CERO avances, así que estas mejoras apuntan a que se use:
  (1) **Panel del encargado en Mi Sucursal**: `resumen-widget.js` ya no depende del resumen del staff
  para la sucursal: calcula EN VIVO (cursos + programas + `avances/<slug>` + `asignaciones/<slug>` sobre
  el padrón de `shared/equipo.js`) el estado por persona (al día / en curso / sin empezar, qué le falta)
  y tiene **«⧉ Copiar recordatorio para WhatsApp»** (texto listo con nombres, pendientes y link). Copia
  mínima de `programasDe`/`cursosDe`/`estadoCurso`: mantener en sintonía. El Panel General sigue leyendo
  `capacitaciones/resumen`.
  (2) **Link directo**: `capacitaciones/?curso=<id>` abre la portada del curso (tras «¿Quién sos?»);
  `?programa=<id>` el catálogo en ese programa (`urlAcademia()`). Botones 🔗 en Gestión (cursos y
  programas) y «🔗 Copiar link» en la portada (staff); «📣 Avisar», los recordatorios de vencimiento y
  los avisos automáticos llevan el link.
  (3) **Resultados en la venta**: `resultadosPersona` cruza cada curso aprobado (`fin`) con la venta
  semanal por vendedor de `ventaEquipo/<slug>` (match por nombre/alias del padrón, `Equipo.norm`):
  UPT y ticket promedio hasta 4 semanas antes vs. hasta 4 después, con chip de variación. Se ve en la
  ficha de la persona (Mi equipo) y en el Inicio del alumno («Mis resultados»).
  (4) **Cruce con Evaluaciones**: en el formulario del supervisor, un ítem en Regular/Mal muestra
  «🎓 Curso de la Academia para este punto» (`ACAD_MAPA` ítem → competencia + palabras clave contra los
  cursos publicados) y **«Asignar a la sucursal»** escribe `capacitaciones/asignaciones/<slug>/<cursoId>`
  = `{curso, titulo, motivo, item, semana, por, ts}` + directo a la sucursal. En la Academia esos cursos
  entran a `cursosDe` como el programa virtual `PROG_SUP` («Recomendado por el supervisor», id `_sup`,
  todos los puestos): bloque propio en Inicio, pestaña en el Catálogo, cuentan en el avance y el resumen.
  Gestión → Programas los lista con ✕ para quitarlos.
  (5) **Píldoras**: `formato:'micro'` (check «⚡ Píldora» del editor; avisa si pasa de 3 módulos o 3
  preguntas): chip en tarjetas y portada, carrusel «⚡ Píldoras de 5 minutos» en Inicio y filtro en el
  Catálogo.
  (6) **Quiz**: `quiz.mezclar` (default sí) baraja preguntas y opciones en cada intento (`ordenQuiz`;
  `PLAYER.resp` sigue con índices originales; el staff lo ve en orden); `quiz.intentos` (0 = sin límite;
  el editor propone 3) bloquea al agotarse y el encargado/staff **habilita otro** desde la ficha
  («🔁 Habilitar otro intento», deja `int = intentos−1`). Cada envío suma contadores del servidor
  (`{'.sv':{increment:1}}`) en `quizStats/<curso>/<preguntaId>` = `{n, mal, op:{<opción>:n}}`; las
  preguntas reciben `id` estable al guardar; el editor muestra «Cómo responde el equipo» (% de falla y la
  equivocada más elegida).
  (7) **Firebase Storage opcional** (`STORAGE_BUCKET`, vacío hoy, mismo patrón que Tareas): con bucket,
  `subirArchivo` sube por REST y guarda la URL como `contenido` (`bajarArchivo` entiende URL y partes
  base64), tope 200 MB. **Videos subidos** (mp4/webm/mov) se reproducen en el player (`<video>`; en base64
  se bajan al tocar ▶).
  (8) **Certificación**: al completar un PROGRAMA entero, `avisarCertificacion` manda un directo a las
  cuentas de la sucursal **de parte de capacitaciones@** (`enviarDirectoDe`) y otro al capacitador; flag
  `certAvisos/<slug>/<persona>/<programa>`.
  Pendientes de Juli: `ANTHROPIC_API_KEY` en Cloudflare (botones ✨) y el bucket de Storage.
- **Quiz «como vendedor» + perfil deportivo (07/09/2026 tarde)**: el staff ve la correcta en verde y un
  banner lo aclara; «👁 Ver como vendedor» (`PLAYER.comoAlumno`) muestra el quiz sin marcas y mezclado.
  **Perfil deportivo** (pedido de Juli: qué disciplinas practica/conoce cada vendedor o cajera y de qué
  cuadro es hincha): tarjeta «Mi perfil deportivo» en el Inicio del alumno (chips `DISCIPLINAS`, «otra»,
  select `CLUBES` con «Otro»), guardado en `perfiles/<slug>/<personaId>` = `{disc[], otra, club, nombre,
  rol, ts}`. Se ve en la ficha, debajo del nombre en Mi equipo, como filtro por disciplina con conteos
  (para planificar cursos de producto) y en el Excel.
- **Bloques visuales en los módulos de texto (07/09/2026, pedido de Juli por el curso de HEAD)**:
  además de `[[dato]]/[[tip]]/[[evitar]]/[[ejemplo]]` y `Título:`, `seccionesDeTexto` entiende
  `## Subtítulo` (`.lec-h2`, grande con barra roja), `[[img]] ruta-o-URL | leyenda` (figura), `[[lista]]
  Título` + líneas `Término: explicación` (ficha a dos columnas) y `[[vs]] Evitar | Decir mejor` + líneas
  `malo | bueno` (comparación roja/verde). Render compartido en `seccionHtml` (player y vista previa).
  Las fotos de un curso van como archivos estáticos en `capacitaciones/assets/cursos/<curso>/` (JPEG
  ≤1400 px), NO en Firebase. **Curso «Head 2026: Raquetas y Paletas»** (`c-mtrji4n9mkv8`): rearmado
  con las 8 imágenes del PPTX de Iván (extraídas de `archivos/<fid>` con zipfile + PIL), títulos por
  módulo, fichas, comparación y quiz de 9 preguntas (3 intentos, mezclado); portada = foto de raquetas.
  La fuente está en `capacitaciones/assets/cursos/head-2026/curso.json` (semilla; se publica con
  `PUT cursos/<id>`), generada por el script de la sesión del 07/09.
  ⚠ Bug arreglado en la misma tanda: `sucsAcademia()` se llamaba a sí misma desde el commit del padrón
  (04/09) y Mi equipo / Ranking / `publicarResumen` reventaban para el staff.
- **Asistente «Crear curso desde un PDF o PowerPoint»** (Gestión): lee el texto en el
  navegador (pdf.js / JSZip por CDN), propone un módulo por página/diapositiva, Iván
  revisa (reordena, une, quita, agrega, vista previa), quiz opcional, programa y aviso.
- **Contenido cargado**: «Atención al Cliente» (programa «Introducción», toda la cadena),
  «Wilson: Tennis & Padel 2026» y «Hockey: palos adidas y Malik FW26» (programa
  «Producto de marca», vendedores+encargados), y los 4 programas del prototipo
  (Onboarding, Vendedores, Vendedores Intermedio, Encargados) con 39 cursos en borrador
  como hoja de ruta.
- Las pantallas `.dc.html` + `support.js` + `sesion.js` son el **prototipo de Design**
  que originó el módulo; quedan como referencia visual (siguen gateadas).

## Managment (`managment/`) — Desarrollo → OC → Ingresos (24/09/2026)

Pedidos de Juli aplicados ese día, todos en `managment/index.html`:
- **Filtros del Desarrollo**: barra `.dev-filtros` con **Fábrica / taller** y **Línea** (`devFiltro`,
  `prendaPasaFiltro` = único filtro de prendas junto con la marca del encabezado; vale para el listado y
  para la colección abierta). Las opciones salen de las prendas cargadas.
- **Celdas de estado con color** (`td.celda-falta` ámbar · `td.celda-ok` verde · `td.celda-bad` rojo):
  en el listado, la celda Status por línea cuenta «Falta aprobar N · Aprobado sin OC N · Aprobado · OC N»
  (`estadoCelda`); en cada prenda, la celda del paso y la columna OC (`celdaOCPrenda`: «Aprobado · OC» con el
  código y «Ver OC» cuando ya se convirtió en orden de compra; «Crear OC» si está aprobada; «Falta aprobar»).
- **Sin códigos automáticos**: el código es el que asigna el depósito en el sistema. Se carga en la prenda
  (`codigoManual`) o en la fila de la OC (input en el Paso 2, `setOCCodigo`, que lo copia a la prenda). Un
  código repetido **no frena** la OC (recompra del mismo artículo + color): solo avisa. Confirmar una OC exige
  que todas las líneas tengan código. Se borraron `nextCodigo` / `reservarCodigos` / contadores del ⚙;
  `state.contadores` y el nodo `contadoresCodigos` quedan por compatibilidad. El import de OC deja vacío
  lo que la planilla no trae.
- **Cantidades editables en Desarrollo** (mismo día): en la fila de cada prenda (color) hay una grilla
  de talles S…ÚN (`tallesEditHtml` / `setTallePrenda`) que escribe `p.talles` y marca `tallesEditado`
  (así una curva dejada en cero no vuelve a la nota vieja del import). Al tipear no se re-renderiza: se
  actualizan por DOM el total de la fila (`data-ptot`), el chip del color en la fila del artículo
  (`data-pchip`) y el total del artículo (`data-gtot`). Esas unidades pasan solas a la OC al aprobar; si
  la prenda ya es OC, la curva de la orden se corrige en el Paso 2. **Copiar la curva de un artículo a
  otro** (mismo día): handle «⠿» arrastrable de una grilla a la otra (`curvaDragStart` / `curvaDragOver` /
  `curvaDrop`, la grilla destino se marca con borde rojo punteado), botones «⧉ Copiar» / «⤓ Pegar» y
  Ctrl+C / Ctrl+V parado en un talle (`copiarCurvaPrenda` / `pegarCurvaPrenda` / `aplicarCurvaPrenda`).
  Comparte el portapapeles interno `copiedCurve` con el Paso 2, así una curva copiada en Desarrollo se
  pega en una fila de OC y al revés.
- **Nombre y color editables** (mismo día): en la fila de cada prenda, nombre y color son inputs
  (`setDescPrenda`; cambiar el nombre de un color lo mueve al artículo que se llame así). En la fila del
  artículo con varios colores, «✎» (`renombrarGrupo`) renombra todos los colores juntos. Los cambios se
  copian al artículo/color de la OC de esa prenda solo si está en Borrador; una OC enviada no se toca.
- **Logo en el Excel y el PDF** (mismo día, pedido de Juli): los exports de OC, la planilla modelo y el
  Excel para proveedor llevan el logo de Mateu (`LOGO_PNG`, convertido por canvas desde el `LOGO_MATEU`
  embebido; los exports hacen `await logoListo()` antes de armarse). Hasta ese día el PNG se buscaba en el
  header propio del módulo (`.header-logo img`), que no existe desde el header unificado, y salía el
  texto «MATEU SPORTS» en su lugar. En la lista de OC la lupa pasó a ser el botón verde «Abrir».
- **Filtros del Paso 2** (mismo día): barra `.dev-filtros` con **Proveedor** y **Línea** arriba de la lista
  de OC (`ocFiltro`, `ordenPasaFiltro`, `ocFiltrosHtml`; estado aparte del de Desarrollo). Solo acotan lo
  que se lista: con la línea filtrada, la cabecera del proveedor avisa que Confirmar / Excel / PDF / mail
  abarcan la OC completa del proveedor (esas acciones buscan el grupo en `state.ordenes`, no en lo filtrado).
- **Detalle de la OC a pantalla completa** (mismo día, Juli: «muy compactado, incómodo a la vista, no quiero
  barra para deslizar»): «Abrir» ya no abre un modal sino la vista `ocdet` (`openOCDetalle` → `renderOCDetallePage`,
  cuelga de la pestaña Paso 2; «← Volver» = `closeOCDetalle`). `curvaPanel` dejó de ser una tabla de 17 columnas:
  una **tarjeta por artículo** (`.oc-artgrp`, color por hash del nombre con `colorBloque`, cabecera con colores ·
  unidades · valorizado) y adentro **una línea por color** (`.oc-line`, pill del color con el mismo acento). Fila 1:
  código · color · género, los **7 talles en una sola fila** (`.oc-sizes`), unidades grandes y costo/valorizado; fila
  2: entrega · seguimiento · ficha · notas · estado · acciones (+ línea/colección/proveedor en modo edición). Los
  bloques envuelven (`flex-wrap`): nunca hay scroll horizontal. Conserva `data-total-id` / `data-val-id` /
  `.size-copy` (Ctrl+C/V y `updateLineTotals` siguen igual). El modal `#ocDetalleModal` se eliminó.
  `providerOptions` compara por `providerKey` (el select mostraba «Seleccionar proveedor» con «RA INT» vs «RA Int»).
- **Detalle de la colección a pantalla completa** (mismo día, «aplicar la misma vista para los desarrollos»):
  «Abrir colección» / «Abrir línea» / `?col=` abren la vista `coldet` (`openItemsModal` → `renderItemsModal`, que
  ahora pinta en `#view`; cuelga de la pestaña Paso 1; «← Volver a los desarrollos» = `closeItemsModal`). Cabecera
  con nombre, tipo, WhatsApp / link / «Procesar aprobados», seis números resumen y las pestañas «+ Nuevo artículo» /
  «Activos». Las prendas van como en la OC: por línea, **una tarjeta por artículo** (`articuloCard`: color por hash
  del nombre, ✎ renombrar, marca, colores · unidades · proveedor, pills de estado `estadoPillsPrendas`) con **una
  línea por color** (`prendaLinea`: pill del color, color/nombre/código editables, talles en una fila con ⠿ y
  Copiar/Pegar, paso actual con fondo ámbar/verde/rojo, caja OC `ocPrendaBox`; segunda fila con proveedor, PVP y
  costo, margen, referencia, versión e historial, fotos y Borrar). Sin scroll horizontal. Se eliminaron el modal
  `#itemsModal`, `grupoRow` (colores plegados) y `prendaRow`.
- **Gestión de avíos por código + tres costos + fecha de creación** (mismo día, pedido de Juli): en la
  pestaña «Gestion de Avios» del Paso 2 cada fila de OC (código = artículo + color) tiene su **lista de
  avíos** (`o.avios = [{id, nombre, costo, resp, nota}]`; `aviosDe` tolera el mapa de Firebase): nombre con
  sugerencias (`AVIOS_TIPICOS`), **costo unitario por prenda**, quién lo provee (`AVIOS_RESP`, por defecto el
  de la OC) y detalle; «+ Agregar avio», ✕, **«⧉ Copiar a los demas colores»** / «a toda la OC» (reemplaza
  con confirmación) y el texto libre viejo queda como «Notas de avios» (`aviosNotas`). Al tipear el costo no
  se redibuja (`refrescarTotalesAvios` actualiza por DOM). **Tres costos por línea**: producción
  (`o.costo`), avíos (`costoAvios`, suma por prenda) y final (`costoFinal` = ambos; `valorizadoFinal`).
  Se ven en el detalle de la OC (bloque `.oc-costos`, botón «N avios / + Avios» → `irAvios` vuelve a la
  lista con la pestaña abierta), en los KPIs del detalle (Valorizado producción · Avíos · Valorizado
  final), en la lista de OC (columna «Avios» y «· Avios $» en el encabezado del proveedor). ⚠ **La OC que
  se envía al proveedor (Excel / PDF / mail) lleva SOLO el costo de producción**: `valorizadoLinea` y los
  exports no cambiaron. **Fecha de creación**: columna «Creada» en la lista de OC y «Creada el …» (+
  «Enviada el …» si hay `fechaEnvio`) en el subtítulo del detalle (`fechaCreacionOC` = la `fecha` más
  vieja de las filas de esa OC; las filas siempre la tuvieron, solo no se mostraba).
- **El pill del color se pinta del color real (mismo día)**: la barra lateral y la cabecera del artículo siguen
  con `colorBloque` (hash del nombre), pero el botón que encapsula el color de cada variante usa `colorDeNombre` /
  `pillColorStyle` (mapa `COLORES_PRENDA`: «Chocolate» marrón, «Negro» negro, «Gris Chevy» gris; los compuestos como
  «azul marino» van antes que «azul»; claros con texto oscuro y borde; nombre desconocido cae al color del bloque).
  Vale en el Desarrollo, el detalle de la OC y las tarjetas de avíos. Color nuevo = una entrada más en el mapa.
- **Compartir el desarrollo**: botones «📲 WhatsApp» (abre `wa.me` con el mensaje armado, sin número) y
  «🔗 Link» en cada colección y dentro de la colección abierta. El link es `managment/?col=<id>`:
  `abrirDesarrolloDesdeUrl` abre esa colección al entrar (se reintenta cuando llega Firebase). Si el que
  abre el link no tiene sesión, el Portal lo manda al login y tiene que volver a tocar el link.

## Conversor de OC de marca (pestaña "Pedidos de compra" de `recepciones/`)

Botón **⇆ Convertir OC de marca**: Juli sube la planilla que manda **cualquier**
marca y sale la **OC unificada Mateu Sports** (detalle por artículo con curva de
talles) → Excel/PDF o "Guardar al sistema" (queda como pedido y alimenta el
control de ingresos vs pedido).

- **Motor genérico** (no hay un parser por marca): elige la hoja, encuentra la
  fila de encabezados y mapea las columnas por nombre (alias + pistas por marca).
  Entre varias combinaciones gana la que mapea más campos; que produzca artículos
  con unidades es el desempate (así descarta hojas de lista de precios). Nike
  conserva su lector propio ("Resumen Pedido") como atajo, con caída al genérico.
- **Unidades = la columna de confirmado**. En adidas es literalmente `Confirmado`
  (ojo: el export trae **dos** columnas con ese nombre, una numérica y otra de
  texto tipo "0-STOCK" → se elige por perfil numérico). Las filas con 0 quedan
  afuera. Los importes no se confunden con unidades porque se exige que la
  columna sea mayormente entera.
- **Empresa / banner**: si la planilla mezcla empresas (el multimarcas de adidas
  trae **MATEU SPORTS y AURELIUS**; los exclusivos de franquicias vienen en otro
  archivo), aparece un selector para convertir una OC por cada una.
- **Si la detección falla**: "⚙ Cambiar columnas" reasigna a mano cada campo (+
  rubro por defecto cuando la planilla no lo trae) y **★ Guardar como modelo de
  la marca** deja ese mapeo para la próxima vez (Firebase `recepciones/ocModelos/`).
- **Modelos por marca** (`recepciones/modelos-oc.js` → `window.OC_MODELOS_SEED`):
  semilla con el mapeo aprendido del **último pedido guardado de cada marca** en
  `G:\Soporte\Julian Mateu\Mateu sports\Pedidos de compras\<Marca>\…`. Regenerar con:
  `node scripts/gen-modelos-oc.js "G:/…/Pedidos de compras"` (self-contained, lee
  el motor del propio `recepciones/index.html` para no desincronizarse). Hoy 49 de
  80 marcas tienen modelo; el resto entra por detección + mapeo a mano. Los `.xls`
  viejos (BIFF) los lee el navegador con SheetJS pero no el generador.

## Ingreso de Mercadería (pestaña en `recepciones/`)

Circuito **físico** de recepción del depósito central, distinto de "Control de
Recepciones" (mirada de Compras: ingresos vs pedido en $). Es una **pestaña dentro
de `recepciones/`** (rol `admin` o depósito). MVP: **Adidas**.

Flujo: **pre-ingreso** (Ariel/Luis cargan el remito → declarado por SKU) → **control
ciego** (el operario escanea el EAN de cada unidad; NO ve las cantidades esperadas,
para que no redondee) → **conciliación** (declarado vs controlado → faltantes/sobrantes
por talle; "Ingresar a stock" cuando está ok) → reparto.

- **Cruce por EAN:** ni el remito ni el packing list traen EAN; el operario escanea el
  EAN de la caja. El puente es el **maestro de Adidas** (`recepciones/maestro-adidas.json`):
  `scan EAN → SKU (material+talle) → cruce vs. declarado`. Se cumple exacto que el SKU
  del packing list = `Material+Size` del maestro (validado). Se genera con:
  `node scripts/gen-maestro-adidas.js "Lista Codigos EanNNN.XLSX"` (self-contained
  fs+zlib, reusa el lector XLSX del generador de Meses de Stock; ~237k EANs, 7,4 MB /
  1,5 MB gzip). Regenerar cuando Adidas mande catálogo nuevo.
- **Arquitectura liviana (como Indicadores):** el maestro pesado se usa SOLO del lado
  escritorio (Ariel/Luis). En pre-ingreso se hornea un **mini-mapa por remito** (EAN→SKU
  de los SKU de ese remito) y el celular del operario baja solo eso.
- **Escáner (ambos):** lector de mano (input siempre enfocado, EAN+Enter) + cámara
  (ZXing por CDN, carga lazy).
- **Firebase:** reusa `recepciones-mateu`, nodo aparte `ingreso/` (no toca
  `recepciones/…`): `ingreso/remitos/<nro>` = {cabecera, `declarado{SKU:{talle,ean,desc,cant}}`,
  `minimap{ean:SKU}`}, `ingreso/control/<nro>` = {`scans{SKU:cant}`, `unknown{ean:cant}`,
  terminado}, `ingreso/ultima`.
- **PENDIENTE:** import automático del packing list (Excel/CSV del bizlogit, para no
  cargar el declarado a mano); la **hoja de apertura de cajas** (orden eficiente de
  apertura con switch de criterio — ver algoritmo probado en el chat); aviso a Ariel/Luis
  por `mensajes-mateu` al terminar el control; otras marcas.

## Equipo de la sucursal — padrón único (`shared/equipo.js`, 04/09/2026)

**Una sola lista de personas por sucursal para todos los módulos.** Fuente de verdad:
`rrhh/legajos/<legajoId>` (discontinuos-mateu). Índice por sucursal para que cada local baje
solo lo suyo: `rrhh/equipo/<slug>/<legajoId>` = resumen `{nombre, puesto, regimen, estado,
alias[], pendiente, ingreso, legajo_nro}`. RRHH lo regenera entero tras cada escritura a
legajos (`sincronizarEquipo()` → `Equipo.reconstruir`); las altas/bajas/alias hechas desde
Mi Sucursal escriben legajo + índice en un PATCH multi-path.

- **Identidad = `legajoId`, nunca el nombre.** El nombre con que aparece la persona en el
  sistema de ventas («CASAO KEVIN ARMANDO M.») se guarda como **alias** del legajo, una vez,
  con confirmación humana; desde ahí el cruce es exacto (`Equipo.resolver`: exacto por
  nombre/alias normalizado → `{persona, exacto:true}`; si no, la mejor **sugerencia** difusa
  — el algoritmo por tokens que antes usaba Indicadores en silencio — que hay que confirmar).
  Nada se vincula solo.
- **Helper** `shared/equipo.js` (`window.Equipo`, se incluye SIN `defer` antes de `iconos.js`):
  `cargar(slug)` / `cargarTodas()` / `activos()`, `resolver` / `resolverTodos` / `clavesDe`,
  `vincular(slug,id,nombreVentas)`, `alta(slug,{nombre,puesto,regimen,ingreso},por)` (entra
  al padrón YA con `pendiente:true`, `origen:'sucursal'`), `editar`, `baja`, `reconstruir`,
  `rolDe(puesto)` (encargado/vendedor/cajera/deposito/otro), `grupoDe`, `sectorDe`, `norm`.
- **RRHH**: campo «Nombres en el sistema de ventas (alias)» en el legajo, tag «Por validar»
  + ✓ para las altas de sucursal (guardar el form también valida), y **«⇄ Conciliar con
  ventas»** (`abrirConciliar`): junta los nombres del ETL del último período + últimas 4
  semanas de `ventaEquipo`, y por cada nombre que ningún legajo reconoce ofrece Vincular
  (alias) / Crear legajo / Ignorar (`rrhh/aliasIgnorados/<norm_con_guiones>`); lote «Aplicar
  las marcadas» para las sugerencias fuertes (score ≥3 en la misma sucursal). Aparte lista
  **«Venden en otra sucursal que la de su legajo»** (identidad resuelta: cobertura → nada;
  traslado → «Mover a X») y **legajos duplicados** (Unificar si el segundo no tiene
  movimientos). El form ahora conserva `legajo_nro`/`origen`/`creado` (antes se perdían
  al editar).
- **Indicadores (Mi Sucursal)**: sección **«Mi equipo»** (`secEquipo`, zona viva, antes de
  Novedades; `renderEquipoSuc`/`paintEquipoSuc`): padrón con puesto/régimen/estado de
  vínculo, **+ Agregar persona** (alta → aviso a `RRHH_MAILS` por la Bandeja), ✎ (nombre,
  puesto, régimen, ingreso) y ⏻ baja (aviso a RRHH); bloque **«Nombres de ventas sin
  vincular»** (de la venta de la semana activa `_ultimoVe` + `DET.vendedores`) con
  Vincular / Es nuevo / Ignorar. El **equipo semanal** guarda `{id, nombre, h}`: se arma
  desde el padrón (`padronVenta()` = activos encargado/vendedor/cajera; fallback ETL), «+
  Agregar persona…» es un select del padrón (+ «alguien nuevo» → alta), «⇩ Traer del
  padrón» reemplaza a «Importar de Plantilla», las filas viejas sin id muestran el select
  «¿Quién es?» con la sugerencia preseleccionada (se toma al Guardar). `real` y
  `justif` se indexan por `eqKey(p)` = id (o la clave por nombre para lo viejo). La venta
  se pega **exacto por alias** (`eqIdxExacto`); el difuso queda solo como «vínculo a
  confirmar ✓» (botón que llama a `Equipo.vincular`). `eqCasosSinHoras` toma la dotación
  del padrón. La **Plantilla** (`renderPlantillaPadron`) sale del padrón cruzado con el
  ETL por alias.
- **Buscador de Artículos**: `sincronizarPerfilesPadron()` en cada `cargarPerfiles`: los
  perfiles pasan a ser los activos con rol operativo, `id = legajoId`, avatar conservado
  (por id o por nombre); perfiles creados a mano llevan `manual:true` y se respetan; los
  del padrón (`legajo:true`) solo editan avatar y no se borran acá. Sin padrón, no toca nada.
- **Academia**: `dotacion(slug)` lee el padrón primero (ETL de respaldo); `personaId` =
  legajoId; `migrarIdsAcademia` mueve avances y PINs viejos (id por nombre) al legajoId
  cuando el nombre coincide exacto; el picker «¿Quién sos?» ya no acepta nombre libre si hay
  padrón; el staff ve también las sucursales con padrón (`sucsAcademia()`, Diagonal 80).
  `resumen-widget.js` busca en RRHH por legajoId (fallback por nombre).
- **Tareas**: «Yo soy» es un select del padrón (texto libre solo sin padrón).
- **ETL** `scripts/etl_indicadores.py --maestro`: el staff sale de `rrhh/equipo` (una fila
  por nombre+alias, `sector` en el vocabulario del Excel), los vendedores se normalizan como
  `Equipo.norm` (mayúsculas, sin acentos ni puntuación) y cada `vendedor` sale con `legajo`.
  Sin la opción sigue usando `Sucursales staff.xlsx`.
- **Tarea pendiente para RRHH (07/09/2026, pedido de Juli)**: al entrar a `rrhh/`,
  `conciliarPendientes()` corre de fondo el mismo cruce de «⇄ Conciliar con ventas» (último
  período del ETL + últimas 4 semanas de `ventaEquipo`) y, si hay nombres sin legajo, muestra
  un **banner ámbar en Legajos** con la lista por sucursal + contador en el botón (`CONC_PEND`,
  se actualiza a medida que se resuelven en el modal). La **primera vez** que aparece un período
  nuevo del ETL con pendientes, manda un **directo por la Bandeja a `CONC_AVISADOS`** (rrhh@) con
  la lista y graba `rrhh/aliasAviso/<periodo>` (solo con alcance completo, no supervisores). Así
  cada carga mensual de Indicadores deja la conciliación como tarea visible, sin depender de
  que alguien abra el modal.
- **Estado 04/09/2026**: índice sembrado desde los 237 legajos con sucursal (20 del Registro
  Único quedaron sin sucursal y no entran). Conciliación **pendiente de Juli** (RRHH → ⇄):
  para Diagonal 80 propone Polari/Casao/Maldonado (vincular), 5 personas nuevas
  (Calvimonte, Castro, Cavalier, Hernandez, y las que solo cubren) y traslados a confirmar
  (Arguello desde Adidas, Del Valle desde Kids…). Pendiente: unificar los ~20 mapas
  slug↔sucursal duplicados en `shared/` (hoy cada módulo tiene el suyo; el ETL suma `SLUG_DATA`).

## Compensatorios y horas (RRHH + Mi Sucursal)

Circuito de lo que la empresa le debe a cada persona por haber trabajado de más.
Son **dos conceptos separados** (pedido de Juli 01/09/2026), en la misma ficha:
**compensatorios en días** (feriado, domingo, inventario) y **horas extra en horas**.
Cada movimiento lleva `k` (`comp` | `hs`; sin `k` = compensatorio, los viejos) y `t`
(`alta` | `uso` | `pago` | `ajuste`). Cualquiera de los dos se puede **compensar con
tiempo** (`uso`) o **cobrar en plata** (`pago`). Vive en dos lugares y comparte el
nodo `rrhh/` de **discontinuos-mateu**:

- **`rrhh/` — pestaña «Compensatorios»** (gerencia / RRHH / supervisor): carga los
  días a favor, ve el saldo por persona y **responde las solicitudes**. Aprobar
  escribe un movimiento negativo (descuenta solo del saldo); rechazar pide el
  motivo y permite **sugerir otro día** para compensar. El botón ↩ vuelve la
  solicitud a pendiente (y devuelve el día si estaba aprobada). La columna
  **«Comp.»** de la nómina (pestaña Legajos) muestra el saldo y lo que está en
  trámite de cada persona, y el detalle del legajo suma la caja «Compensatorios».
  El modal **«+ Cargar compensatorio»** tiene el selector *Movimiento*: `➕ Días a
  favor` (fecha en que se generó) o `➖ Día tomado` (**fecha en que se usó**, con
  desde/hasta, días autocalculados y el saldo proyectado) — así RRHH registra un
  compensatorio que se tomó fuera del circuito de solicitudes. Atajo: el botón
  «🕘 Registrar día tomado».
- **Historial de uso**: cada movimiento guarda `t` (`alta`/`uso`/`ajuste`) y, en los
  usos, `desde`/`hasta`. La pestaña cierra con **«Historial de compensatorios
  tomados»** (`usosLista`/`histUsoHtml`, respeta el filtro por sucursal) y el 🕘 de
  cada persona abre su ficha con la columna Tipo y el día tomado. **No se pierde
  aunque se borre la solicitud**: el dato vive en el movimiento, no en la solicitud.
- **`indicadores/` — sección «Compensatorios del equipo»** (`secComp`,
  `renderComp`/`paintComp`, en la banda «En curso», junto a F8 y Reposición): el
  encargado ve el saldo de su gente y **solicita el día**. Gerencia lo ve de solo
  lectura. Una solicitud rechazada con día sugerido trae el botón «Pedir el día
  sugerido», que reabre el formulario con esa fecha precargada. Las pendientes se
  pueden cancelar. El desplegable **«Historial»** (`compHistorial`) lista todos los
  movimientos del equipo con su chip GANADO / TOMADO / AJUSTE y **el día en que se
  tomó cada compensatorio**.
- **Horas extra cargadas por la sucursal, validadas por RRHH (08/09/2026, pedido de
  Juli)**: el encargado carga las horas extra de su gente desde la misma sección de
  Mi Sucursal («+ Cargar horas extra» → persona del padrón, día, horas, motivo de
  `HS_MOTIVOS` y detalle). **No suman al saldo**: quedan en
  `rrhh/horas_pend/<slug>/<id>` con `estado:'pendiente'` (`hsEnviar`; el desplegable
  «Horas extra cargadas por la sucursal» las muestra con su estado y las pendientes
  se pueden cancelar). El aviso le llega a `COMP_APROBADORES` (rrhh@ y el
  supervisor) por la Bandeja. En **RRHH → Compensatorios y horas** aparecen arriba
  de las solicitudes, en «Horas extra cargadas por las sucursales» (`hpHtml`;
  pendientes + resueltas de los últimos 30 días, filtradas por el selector de
  sucursal y contadas en el badge de la pestaña): **✓ validar**
  (`formValidarHoras`: se puede ajustar la cantidad y el día, muestra el saldo
  proyectado y recién ahí escribe el movimiento `{d, k:'hs', t:'alta', hp:<id>}` en
  la ficha) o **✕ rechazar** con motivo (`formRechazarHoras`); las dos le avisan a
  la sucursal por la Bandeja. El 🗑 borra el registro ya resuelto (no toca el
  movimiento). Los **compensatorios en días los sigue cargando solo RRHH**.

**Carga masiva — «⇧ Importar Excel»** (pestaña Compensatorios): sube el Excel de
Juli (`Compensatorios.xlsx`: una hoja con bloques por sucursal — encabezado
`Legajo | <Sucursal> | Total`, una fila por persona con nro de legajo · nombre ·
días pendientes, y una fila de subtotal; la sucursal siguiente viene en la columna
del nombre con el legajo vacío). El cruce es por **`legajo_nro`**, no por nombre
(el Excel los trae recortados: «Casao Kevin» vs «Casao Kevin Armando»). El Excel
trae el **saldo**, no los movimientos: se publica un movimiento de **ajuste** por
la diferencia contra el saldo actual, en un solo **PATCH multi-path** a
`rrhh/compensatorios`. Previsualiza personas, saldos a actualizar, los que ya
estaban igual y los que **no tienen legajo** en el portal. Si el Excel ubica a
alguien en otra sucursal, le **mueve la ficha entera** (con su historial) y ofrece
el check **«Corregir también la sucursal del legajo»** (PATCH multi-path a
`rrhh/legajos`), que es lo que mantiene la dotación al día.
Alias de sucursal propios del Excel en `COMP_ALIAS_SUC` (`Diag 80`→diagonal,
`ADIDAS`→adidas, `Aurelius`→aurelius-10); el resto sale de `RU_DIVISOR`.

⚠️ La `sucursal` del legajo puede estar vieja (los legajos vienen del Registro
Único de julio y hubo movimientos, sobre todo a Diagonal 80). Por eso **manda el
slug donde vive la ficha de compensatorios**, no el del legajo: `compSlugDe()`.
La tabla de saldos avisa «legajo: <otra sucursal>» cuando difieren.

**Valorizado — el valor de la hora lo carga RRHH** (botón «💲 Valor de la hora»):
`rrhh/config/valorHora` = `{general, horasDia (default 8), porLegajo:{<legajoId>:valor}}`.
Un día de compensatorio se paga como `horasDia × valor`. El importe de un pago se
**hornea en el movimiento** (`vh` e `imp`), así el histórico no cambia cuando después
se actualiza el valor. Al registrar un pago (a mano o al aprobar una solicitud de
cobro) se puede **pasar a Novedades de nómina** del período con el concepto
`comp_pago` (`novedadDePago`), que es lo que va al estudio contable. El encargado
**no ve importes**: pide el cobro y RRHH lo valoriza.

**Firebase** (nodo `rrhh/`, agrupado por slug para que cada sucursal baje solo lo
suyo, misma seguridad blanda que Objetivos / Barrida):
`rrhh/compensatorios/<slug>/<legajoId>` = `{nombre, puesto, movs:{<id>:{d,f,m,por,en,sol}}}`
— el **saldo es la suma de `d`** (+ ganados, − tomados; no hay campo `saldo`) —
y `rrhh/solicitudes_comp/<slug>/<id>` = `{legajoId, nombre, k, modo:'tomar'|'cobrar',
cant (y `dias` por compatibilidad), desde, hasta, motivo, estado, por, en,
resp:{por,en,nota,imp,vh,sug:{desde,hasta,nota}}}`, y
`rrhh/horas_pend/<slug>/<id>` = `{legajoId, nombre, puesto, fecha, horas, motivo,
detalle, estado:'pendiente'|'aprobada'|'rechazada', por, en,
resp:{por,en,nota,horas,fecha}}` (las horas que carga la sucursal, hasta que RRHH
las valida).

**Avisos por la Bandeja** (`mensajes-mateu/directos`, best-effort): al solicitar le
llega a `COMP_APROBADORES` (rrhh@ = RRHH y cristian.campion@ = supervisor,
constante en `indicadores/`); al responder, RRHH le avisa a las cuentas de la
sucursal (resueltas contra `discontinuos-mateu/usuarios`) y a quien pidió.

## Mapa de sucursales y movimientos de personal (`rrhh/`, 08/09/2026)

Segunda pestaña de RRHH: **la dotación de cada local en una sola pantalla**, y el circuito
para mover gente entre sucursales. La ve gerencia, RRHH y el supervisor (este último de solo
lectura: `puedeMover = esAdmin || tieneTool`).

- **Pantalla**: KPIs (dotación activa · movimientos de los últimos 30 días · coberturas
  abiertas y cuántas con la vuelta vencida · sucursales sin encargado) + buscador de persona
  y filtro por puesto + dos vistas (**Tarjetas** / **Comparar**) + ⇩ Excel. Cada tarjeta es
  una sucursal: total, FT/PT, barra de composición por rol (`Equipo.rolDe`), chips de alerta
  (sin encargado, altas por validar, «N cubriendo acá», «N cubriendo afuera», vueltas
  vencidas), la lista de personas y **+ Persona** (alta con la sucursal precargada). Los
  legajos sin sucursal caen en la tarjeta «Sin sucursal asignada», primera de todas.
  «Comparar» es la misma foto como tabla (total · FT · PT · Jefatura · Ventas · Caja ·
  Depósito · Otros · Cubren) para ver desbalances.
- **Mover a alguien**: se **arrastra** la persona a otra tarjeta (en celular, el botón ⇄ de
  su fila; también hay «⇄ Registrar movimiento» en la barra y «⇄ Mover de sucursal» en el
  detalle del legajo). El modal pide destino, **tipo** (Traslado / Cobertura temporal con
  fecha de vuelta), fecha, motivo (`MOTIVOS_MOV`), puesto en el destino y observaciones.
- **Qué hace un movimiento** (`guardarMovimiento`), en este orden: (1) PATCH a
  `rrhh/legajos/<id>` con la sucursal nueva, el puesto y el campo `cobertura`
  (`{origen, retorno, mov, desde}`, o `null` si es traslado); (2) `sincronizarEquipo()` →
  `Equipo.reconstruir` regenera `rrhh/equipo/<slug>` — **por eso el cambio impacta solo en
  Mi Sucursal, el Buscador de Artículos, la Academia, Tareas y el ETL**, que leen ese índice;
  (3) **muda la ficha de compensatorios** `rrhh/compensatorios/<origen>/<id>` → `<destino>`
  con todos sus `movs` (mismo criterio que el import del Excel) y las solicitudes que siguen
  pendientes; (4) **avisa por la Bandeja** (`mensajes-mateu/directos`) a las cuentas de las
  DOS sucursales + `MOV_AVISADOS` (rrhh@ y cristian.campion@), con checkbox para no mandarlo.
- **Cobertura temporal**: la persona igual se muda (trabaja allá, así que todos los módulos
  tienen que verla allá) pero queda marcada; la tarjeta muestra el chip «Cubre», el botón ↩
  la devuelve a su sucursal (movimiento de tipo `retorno`, que cierra el original) y pasada
  la fecha de vuelta el chip se pone rojo y suma al KPI de vencidas.
- **Historial**: tabla «Movimientos de personal» al pie (últimos 40) con fecha, persona,
  desde → hasta, tipo, motivo y quién lo registró. El ↩ de una fila **deshace** un movimiento
  mal cargado (solo si la persona sigue donde ese movimiento la dejó): la devuelve, mueve la
  ficha de vuelta y lo tacha en el historial (`deshecho`), sin borrarlo.
- **Firebase**: nodo nuevo `rrhh/movimientos/<id>` en discontinuos-mateu =
  `{legajoId, nombre, puesto, desde, hasta, tipo:'traslado'|'cobertura'|'retorno', fecha,
  retorno, motivo, obs, por, en, cerrado?, deshecho?}`. Nada más cambia de esquema: la
  sucursal sigue viviendo en el legajo, que es la única fuente de verdad
  (ver «Equipo de la sucursal — padrón único»).
- **⇩ Excel** (ExcelJS, estilo del resto de RRHH): hojas «Dotación» (una fila por sucursal),
  «Personas» (una por persona, con la situación: estable / cubre / alta por validar) y
  «Movimientos», las tres con autofiltro.

## Empleado del mes (`rrhh/` + Mi Sucursal, 14/09/2026)

Uno por sucursal y por mes. **Lo asignan RRHH y Cristian (supervisor)** — y gerencia — desde
**RRHH → pestaña «🏆 Empleado del mes»** (`viewEmpleadoMes` / `formEmpleadoMes`; link directo
`rrhh/?tab=edm`): grilla de sucursales del mes elegido (‹ ›), persona del padrón activo de esa
sucursal (legajos), motivo obligatorio, aviso si ya fue elegida otro mes. Al guardar se **publica
en el Tablero de la Bandeja** (`para:'todos'`, solo si quien asigna está en `EDM_TABLERO` = los
mismos de `PUBLICAN_TABLERO`) y se le avisa a la sucursal por directo. «Quitar» no borra el post.
Se ve en **Mi Sucursal** (`secEmpMes`/`renderEmpMes`, arriba de todo en «En curso»: el último mes
asignado + los 3 anteriores; gerencia ve el link para cambiarlo) y en el **Panel General**
(`secEmpMesCad`/`pintarEmpMesCad`, zona En curso de todas las sucursales, el mes más nuevo con
asignaciones, respeta el filtro por línea). Quedan afuera depósito, administración y externos.
**Firebase** (discontinuos-mateu): `rrhh/empleadoMes/<slug>/<YYYY-MM>` = `{legajoId, nombre,
puesto, motivo, por, en}` — agrupado por slug, cada sucursal baja solo lo suyo.

## Calendario de novedades del mes

Reemplaza el Excel que los encargados mandaban mes a mes (`Calendario 08-2026.xls`:
grilla LUNES→DOMINGO, un par de columnas por día — número + texto libre — y el pie
con la sucursal y el mes). Mismo formato, en grande y en el portal:

- **`indicadores/` → «Novedades del mes»** (`secNov`, `renderNov`/`paintNov`, en la
  banda «En curso»): **solo la SEMANA EN CURSO es editable** (pedido de Juli 01/09/2026:
  si pueden cargar el mes entero, esperan a fin de mes y anotan cosas en días que no
  van). Los 7 casilleros lunes→domingo se guardan al salir del campo (`onchange`, no
  re-renderiza para no perder el foco) y la semana puede cruzar dos meses (cada día se
  escribe en el nodo de SU mes). Las semanas anteriores y el mes completo quedan de
  solo lectura. Al terminar, el encargado **confirma la semana** — y si no hubo nada,
  tiene que confirmarlo igual con **«Sin novedades»** (`rrhh/calSemanas/<slug>/<lunesISO>`
  = `{estado:'cargada'|'sin', dias, por, en}`). Desde el **jueves** el aviso se pone rojo
  y sale un recordatorio por la Bandeja (una vez por semana, flag en
  `rrhh/calAlertas/<lunesISO>/<slug>`). Gerencia lo ve de solo lectura.
- **`rrhh/` → pestaña «Calendario»**: la misma grilla por sucursal y **mes completo**,
  editable (RRHH corrige cualquier día), con el semáforo **de la semana en curso**
  («N de M sucursales ya la confirmaron», marcando las que no cargaron nada) + botón
  «📣 Recordar a las que faltan», la tabla **«Cierre semanal»** de las últimas 6 semanas
  de esa sucursal, **🖨 Imprimir** (`@media print`, A4 apaisado) y **⇩ Excel**.
- **El Excel** (ExcelJS, menú con «solo esta sucursal» / «todas»): un libro con
  **una hoja por sucursal** — calendario real de 7 columnas donde cada semana ocupa
  dos filas (el número del día arriba, la novedad abajo, con wrap), membrete, feriados
  en ámbar, fines de semana grisados, días fuera del mes apagados, apaisado y ajustado
  a una página —, la hoja **«Detalle»** (Sucursal · Fecha real · Día · Semana · Feriado
  · Novedad) **con autofiltro**, que es con lo que RRHH realmente trabaja, y — al
  exportar todas — la hoja **«Resumen»** con el cierre semanal de cada sucursal
  (confirmada / sin novedades / SIN CONFIRMAR, en verde y rojo). Helpers: `calHojaMes`,
  `calHojaDetalle`, `calHojaResumen`, paleta en `XC`. Exportar las 21 sucursales tarda
  ~5 s (hay un toast «Generando el Excel…»).
- **Aviso automático de los viernes** (`calAvisoViernes`, se dispara al abrir la pestaña
  — no hay backend con cron, mismo patrón que `alertasRitmo` de Indicadores): manda por
  la Bandeja el resumen de las sucursales que no confirmaron la semana a **RRHH y al
  supervisor** (`CAL_AVISADOS`) y un recordatorio a cada sucursal que falta. Flag
  `rrhh/calAlertas/<lunesISO>/__resumen` para no repetirlo.

Los **feriados** salen del calendario retail del shell (`shared/data/calendario-<año>.json`,
eventos con `tipo:'feriado'`; se resuelven fecha fija, rango y regla móvil) y se marcan
solos en la celda — el 17/08/2026 aparece como «Paso a la Inmortalidad de San Martín».

**Firebase**: `rrhh/calendario/<slug>/<YYYY-MM>` = `{dias:{'1':'texto',…}, actualizado, por}`
en discontinuos-mateu, agrupado por slug para que cada sucursal baje solo lo suyo.

## Tareas de la Sucursal (`tareas/`)

`tareas/index.html` self-contained (lee la sesión del Portal, sin login propio). Es de
**todas las cuentas de sucursal/outlet** (se les agrega sola en `herramientasEfectivas`,
como Marcas; también al supervisor) y gerencia la usa como control. `deposito`/`puesto`
no entran. Cuatro pestañas:

- **Cambio de precios** y **Sectores de marcas**: tareas con título, marca, fecha
  (vigencia / límite), detalle, estado pendiente/hecha, **foto ANTES y DESPUÉS** y quién
  la hizo. Las publica **gerencia a una o varias sucursales** (chips de sucursales en el
  formulario, un PATCH multi-path; aviso por directo de la Bandeja a cada cuenta) o la
  propia sucursal se las anota. Vencida = fecha pasada sin marcar (rojo). Al marcar hecha
  una tarea de gerencia, le llega un directo a quien la publicó (`creado.mail`).
- **Limpieza**: checklist con frecuencia `diaria` / `semanal` / `mensual`; cada ítem
  guarda `hechos/<período>` (`YYYY-MM-DD`, lunes ISO o `YYYY-MM`) con `{por,ts,antes,
  despues}`. Puntitos de cumplimiento de los últimos períodos (neutros antes del alta).
  Botón «Cargar checklist sugerido» (`LIMPIEZA_SUGERIDA`) cuando no hay nada. 📷 = foto
  de antes (deja la entrada `pendiente:true`), ✨ = foto de después (marca hecho).
- **Vidrieras**: una tarjeta por vidriera con el último cambio y los **días sin cambios**;
  alerta (rojo + badge rojo en la pestaña + banner) al superar `config/global.diasVidriera`
  (default `DIAS_VIDRIERA_DEF` = 15; gerencia lo ajusta con «ajustar» y puede darle un tope
  propio a una vidriera en su edición), ámbar cuando está por vencer. «🔄 Registrar cambio»
  pide la foto de después (la de antes se hereda del cambio anterior, se puede reemplazar)
  + nota; historial de cambios con comparativa. **Aviso por la Bandeja** una vez cada 7
  días por vidriera en alerta (flag `alertasVidriera/<slug>/<vid>`, se borra al registrar
  el cambio) a las cuentas de la sucursal + `ALERTA_AVISADOS` (Cristian); se dispara al
  abrir el módulo, como `alertasRitmo`.
- **Comparativa antes/después** (`abrirCmp`): modal con modo **Deslizar** (slider con
  `clip-path`) y **Lado a lado**; baja las fotos grandes recién ahí.
- **Fotos**: se comprimen en el navegador (`comprimirFoto`: JPEG ≤1280px + miniatura
  ≤360px) y el input lleva `capture="environment"` (celular → cámara). La grande va a
  `tareas/fotos/<slug>/<id>` = `{data,ts,por}`; en el ítem solo viaja `{id,thumb,ts,por}`
  → el listado es liviano. Al borrar tarea/vidriera se borran sus fotos.
- **«Yo soy»** (cuenta de sucursal): nombre de quien opera, en localStorage
  `tareas_yo_<slug>`; `firma()` = «Nombre (Usuario)». Gerencia firma con el usuario.
- **Todas las sucursales** (gerencia, selector vacío): tabla sucursal × (precios y
  sectores pendientes con ⚠ vencidas, limpieza hoy y semana x/y, vidrieras en alerta, máx.
  días sin cambio) + KPIs, «+ Publicar tarea» a varias sucursales. El supervisor ve solo
  su alcance (`session.sucursales`) si lo tiene cargado.
- **Firebase**: `recepciones-mateu`, nodo `tareas/` (agrupado por slug, seguridad blanda):
  `precios/<slug>/<id>`, `sectores/<slug>/<id>`, `limpieza/<slug>/<id>`,
  `vidrieras/<slug>/<id>` (`cambios/<cid>`), `fotos/<slug>/<fid>`, `config/global`,
  `alertasVidriera/<slug>/<vid>`, `alertasVenc/<slug>/<id>`, `recurrentes/<id>`.
  Íconos nuevos en `shared/iconos.js`: ⇄ ✨ 🪟.

**Segunda tanda (04/09/2026 tarde, las diez mejoras que pidió Juli):**
- **Foto obligatoria** (`exigeFoto`, check en el formulario; gerencia lo deja marcado por
  defecto): sin foto de después no se puede confirmar «Hecha» (chip «📷 exige foto»).
- **Vencidas por la Bandeja** (`avisarVencidas`): tarea con fecha pasada sin marcar →
  directo a la sucursal + `ALERTA_AVISADOS`, una sola vez por tarea (flag `alertasVenc`).
  Se dispara al abrir el módulo (la sucursal para sí; gerencia para todas).
- **Resumen de gerencia con 4 solapas** (`state.resVista`): **Hoy** (tabla + semáforo de
  limpieza con «📣 Recordar a las que faltan», `recordarLimpieza`), **Cumplimiento**
  (`cumplSucursal`: por mes, tareas hechas/total, % a tiempo, días promedio para cerrar,
  % de limpieza sobre los períodos que correspondían desde el alta de cada ítem, cambios
  de vidriera, vidrieras en alerta e **índice** = promedio de los tres %; ranking),
  **Vidrieras** (`renderGaleria`: última foto de cada vidriera de todos los locales) y
  **Recurrentes**.
- **Recurrentes** (`tareas/recurrentes/<id>` = tipo, título, marca, detalle, `cadaDias`,
  `plazoDias`, `proximo`, `sucursales` (vacío = todas), `exigeFoto`, `activo`):
  `generarRecurrentes()` corre cuando gerencia abre el resumen; por cada plantilla con
  `proximo <= hoy` crea la tarea en sus sucursales (fecha = último vencimiento + plazo,
  `recurrente:<id>`, origen gerencia) en un PATCH multi-path, adelanta `proximo` y avisa
  por la Bandeja. Pausar / reanudar / borrar desde la solapa.
- **⇩ Excel** (`exportarExcel`, ExcelJS por CDN, estilo RRHH): hojas Hoy · Cumplimiento
  (mes elegido) · Tareas (detalle del mes) · Limpieza (marcas del mes) · Vidrieras.
- **Cola offline** (`fbWrite`): toda escritura que falla por red queda en localStorage
  `tareas_cola` (tope ~4 MB, fotos incluidas) y se reintenta al volver `online`, al abrir el
  módulo y cada 30 s; la pantalla se actualiza igual y arriba sale «N cambios esperando
  conexión». Errores HTTP (no de red) siguen fallando normal.
- **Firebase Storage opcional** (`STORAGE_BUCKET`, vacío hoy): cuando Juli cree el bucket
  y pegue su nombre, las fotos grandes suben por REST a `tareas/<slug>/<id>.jpg` y el ítem
  guarda `url` en vez de `id`; `bajarFoto`/`borrarFoto` entienden las dos formas. Mientras
  tanto, **poda** (`podarFotos`, gerencia, una vez por día por dispositivo): tareas hechas y
  limpiezas de más de `PODA_DIAS` (90) pierden la foto grande (queda la miniatura, marcadas
  `podada:true`). Las vidrieras no se podan.
- **En Indicadores**: sección **«Tareas de hoy»** (`secTareas`, `renderTareasSuc`) en la
  banda «En curso» de Mi Sucursal (chips precios/sectores/limpieza/vidrieras + lista de
  vencidas, para hoy, limpieza sin marcar y vidrieras en alerta + link al módulo; oculta si
  la sucursal no usa el módulo) y **«Tareas de la Sucursal · control»** (`secTareasCad`,
  `renderTareasCad`/`pintarTareasCad`, solo gerencia, respeta el filtro por línea) en la
  vista de todas las sucursales, con «📣 Recordar limpieza a las que faltan». Los helpers
  `t*` de Indicadores son una copia mínima de la lógica del módulo: mantener en sintonía.

## Celular (03/09/2026)

Juli usa el portal como app instalada en el iPhone (PWA, `manifest.json` con
`display:standalone` + barra de estado `black-translucent`). Convenciones:

- **Safe-area del header**: la regla va SIN `@media(display-mode:standalone)` y con
  `html` delante (`html .top{padding-top:calc(12px + env(safe-area-inset-top,0px))}`).
  Motivo: las media queries móviles de cada módulo (`.top{padding:10px 14px}`) venían
  después y pisaban el padding-top → el botón Menú quedaba debajo de la hora del
  teléfono. Con la especificidad extra gana siempre; en el navegador el inset es 0.
  Todo módulo con header propio la lleva; `header.js` la trae para el resto. El
  `<meta viewport>` lleva `viewport-fit=cover` en todos los módulos.
- **Indicadores ≤640px** (bloque `/* CELULAR */` al final del CSS): la barra de la vista
  «Todas las sucursales» (`.rk-bar`) se apila (pestañas / Línea / KPI) con los chips
  deslizables de costado y deja de ser sticky; toolbar con selector y segmented a todo
  el ancho; menos padding en tarjetas; la semana editable de «Novedades del mes» se
  apila un día por fila (`data-dow` en cada `.cald`). Los widgets flotantes suman
  `env(safe-area-inset-bottom)`.
- **Portal ≤560px**: los tiles pasan a lista compacta (ícono a la izquierda, nombre +
  descripción); ≤480px se oculta el rol del header (el saludo ya lo dice).
- Para probar sin teléfono: Playwright con Chromium (`/opt/pw-browsers/chromium`),
  viewport 390×844 e `isMobile:true`, sesión inyectada en `localStorage`.

## Estética por marca — sucursales Aurelius (`shared/marca.js`, 06/09/2026)

Las cuentas de las sucursales **Aurelius** (Aurelius 12, Aurelius 5, Aurelius CB y el outlet
Aurelius 10 — incluidas sus cuentas de depósito y puesto) ven todo el portal con la estética de
Aurelius: **negro `#0b0b0d` + rojo `#C2201F` + blanco**, logo de Aurelius (escudo + corona +
palabra) en vez del de Mateu, título «… — Aurelius» y app instalable propia. El resto no cambia.

- **Un solo archivo**, `shared/marca.js`, incluido **SIN `defer` antes de `iconos.js`** en el
  `<head>` de todos los módulos y del Portal (`<script src="../shared/marca.js"></script>`).
  Módulo nuevo → sumar esa línea. Decide la marca en este orden: (1) **gerencia mirando una
  sucursal** — el módulo avisa con `Marca.vista(slug)` (hoy Indicadores en `render()`,
  Buscador al elegir sucursal y Tareas); vale solo para esa página (sessionStorage
  `mateu_marca_vista`); (2) la **sesión** del Portal (`sucursal`/`outlet_id` que empieza con
  `aurelius`); (3) sin sesión, `?marca=aurelius` en la URL o la última marca que entró en ese
  dispositivo (localStorage `mateu_marca_login`, lo guarda el Portal en `login()` vía
  `Marca.alIniciarSesion`; `?marca=mateu` lo borra).
- **Cómo pinta**: pone `data-marca="aurelius"` en `<html>` y pisa las variables del módulo
  (`--navy`, `--red`, `--off`, `--muted`, `--border`, sombras…). Los scripts del shell
  (`header.js`, `bloqueo.js`, `tutorial.js`, `notificaciones.js`) ya no llevan colores
  horneados: usan `var(--marca-navy,#0B1527)`, `var(--marca-red,#CC0000)`,
  `var(--marca-off,#f5f7fc)` y `var(--marca-mid,#1a2f55)`, que `marca.js` publica en `:root`
  con los valores Mateu por defecto. Colores escritos a mano dentro de un módulo NO cambian
  (son acentos menores); si molesta alguno, pasarlo a variable.
- **Logo (07/09/2026, isotipo OFICIAL)**: reemplaza todo `<img alt="Mateu Sports">` (header propio,
  `header.js`, login) por el isotipo oficial de Aurelius (escudo + corona, PNG del identificador que
  pasó Juli, embebido en `marca.js` como data URI a 200 px) y lo envuelve en un lockup
  `.marca-lockup` = isotipo + la **palabra AURELIUS oficial** (`img.marca-word`, PNG blanco del
  identificador, 110 px de alto, también embebido). Le saca el filtro `brightness(0) invert(1)`.
  **Headers y pantallas de ingreso (11/09/2026, pedido de Juli): el logo completo APILADO oficial**
  (variante 1-08 del identificador: escudo a color arriba, palabra blanca abajo; UNA sola imagen
  `APILADO_AU`, 240 px de alto embebida, clase `img.marca-apilado`). **El escudo va al 80 % del
  original** (pedido de Juli el mismo día: «achicar un poco la corona que quede proporcional»; se
  recompuso con PIL escudo + separación escalados y la palabra al 100 %). Va donde el logo cuelga de
  `SEL_APILADO` (`.msh-logo`, `.top`, `.logo` de Indicadores, `.login-head`, `.login-logo` del
  Turnero, `.pss-logo` del puesto y el modal «Acceso Aurelius»): 43 px en headers (37 en celular),
  80 px en el login del Portal, 66 en los otros ingresos (la palabra queda del mismo tamaño que con el
  escudo entero). En el resto (decks, impresiones, etiquetas
  chicas) sigue el lockup horizontal isotipo + palabra. Un MutationObserver cubre lo que se inyecta después.
  ⚠ No volver a dibujar el escudo ni las letras a mano: la primera versión (SVG propio) quedó mal y
  Juli pidió el original. Los 14 PNG del identificador (isotipo, logo apilado y palabra, a color y en
  rojo/negro/blanco) están en su carpeta de Drive «id aurelius…».
  Textos: «Mateu Sports» del login y «MATEU SPORTS» de la cortina de bloqueo → «Aurelius».
- **App instalable**: `manifest-aurelius.json` (id `./aurelius`, así convive con la app Mateu)
  + `icons/aurelius-{192,512,maskable,180}.png` (solo el escudo con la corona sobre negro, pedido de
  Juli; generados con PIL desde el PNG oficial, maskable con más margen); `marca.js` cambia el
  `<link rel=manifest>`, `theme-color`, `apple-touch-icon` y el favicon cuando la marca está activa.
- **Explicación para los usuarios**: ítem **«Acceso Aurelius»** en el drawer (`header.js` e
  Indicadores; lo inyecta `marca.js`) → modal con el link `…/?marca=aurelius`, botón Copiar y los
  pasos para agregarlo a la pantalla de inicio (iPhone/Android). En el login con la marca activa
  hay una nota con el mismo link; y la primera vez que una cuenta Aurelius entra en un
  dispositivo sale un aviso (flag `mateu_marca_aviso_v1`). API: `Marca.abrirAcceso()`,
  `Marca.urlAcceso()`, `Marca.activa()`, `Marca.refrescar()`.
- Para sumar otra marca: una entrada más en el mapa `MARCAS` de `marca.js` (`esSlug`, paleta,
  logo, manifest e íconos).

## Reseñas de Google (`reviews/`, 08/09/2026)

`reviews/index.html` self-contained (lee la sesión del Portal, sin login propio). Muestra las
**reseñas de Google de cada sucursal** — buenas y malas, captación sobre tickets y evolución
mes a mes — con la estética de una ficha de Google (avatar, estrellas, barras). Es de solo
lectura: NO escribe a Firebase. Lo mira gerencia; la fuente la mantiene **Iván**.

**Dos métricas distintas, no confundirlas:**
- **Captación** = `buenas ÷ tickets`. Es la columna «%» del Excel de Iván: cuántos de los que
  compran dejan una reseña. Es el KPI del módulo (semáforo del chip: ≥10 % verde, ≥5 % ámbar,
  menos rojo) y la línea del gráfico.
- **% positivas** = `buenas ÷ (buenas + malas)`. La calidad de lo que se recibió. Da ~99–100 %
  en casi todas, así que sirve de control, no de ranking. Es el número grande + las estrellas.

**Pantalla:** barra con selector de mes y buscador · 4 KPIs del mes (reseñas, captación con
delta en puntos vs. el mes anterior, % positivas, acumulado en Google) · grilla de fichas por
sucursal ordenada por captación (avatar con iniciales, estrellas rellenas al % positivas,
barras positivas/negativas, captación con delta, acumulado en Google con las nuevas del mes,
sparkline de 12 meses y quién dejó la última opinión) · ranking ordenable por cualquier
columna · detalle al tocar una ficha (barras apiladas buenas/malas + línea de captación de
toda la serie, y tabla mes a mes). La ficha de la sucursal del usuario va con borde rojo.

**Todo el dibujo es SVG inline** (estrellas, sparkline y gráfico del detalle), como Meses de
Stock: sin Chart.js ni ninguna librería de gráficos.

**Datos — `reviews/reviews-data.js`**, que genera `scripts/gen-reviews.py` desde el Excel de
Iván «Porcentaje de buenas y malas criticas.xlsx». **No editar a mano.** Para actualizar:

```
python scripts/gen-reviews.py "C:/ruta/Porcentaje de buenas y malas criticas.xlsx"
```

Hoy: **20 sucursales, 26 meses (jul-2024 → ago-2026)**. Forma:
`{fuente, generado, periodos:[...], sucursales:{<slug>:{nombre, serie:{"2026-07":{b,m,t,total,nuevas,autor}}}}}`
— `b` buenas, `m` malas, `t` tickets, `total` reseñas acumuladas del local en Google,
`nuevas` las del mes, `autor` el nombre de la última opinión leída.

**Trampas del Excel** (están resueltas en el generador, no volver a pisarlas):
- Los bloques mensuales **no tienen ancho fijo**: arrancan en 3 columnas y crecen hasta 8. Hay
  que detectarlos buscando `Sucursal` en la fila 2 y leer los encabezados contiguos, nunca
  saltando de a N columnas.
- **Cada bloque ordena las sucursales distinto** (los últimos van por captación), así que el
  nombre se lee fila por fila dentro del bloque.
- El mes que mide un bloque: manda la **etiqueta** de la fila 1 si está; si no, con dos fechas
  la primera es el 1.º del mes medido, y con una sola el dato se leyó a principios del mes
  siguiente (los datos de junio se tomaron el 04/07). El corte de año aparece en las dos hojas:
  se deduplica comparando el contenido **ordenado por sucursal** (si no, se corre todo un mes).
- La columna «%» no se copia: se recalcula.

**Informe mensual — `reviews/?pres=YYYY-MM`** (08/09/2026): deck que **Iván manda por mail la
primera semana de cada mes**. Es **público**, igual que el Reporte Mensual de stock — el
chequeo de `?pres=` va ANTES del gate de sesión, así lo abre cualquiera desde el mail. Solo
muestra agregados: no lista los nombres de quienes dejaron reseña (eso queda dentro del
módulo). Cinco secciones: los números del mes, ranking (paneles de las cinco primeras y
últimas + tabla), qué subió y qué bajó contra el mes anterior, reseñas negativas y la
captación de los últimos 12 meses. Tres acciones (no se imprimen): **🖨 Imprimir** (A4,
`@media print`), **🔗 Copiar link** y **⧉ Resumen para el mail** (`presTexto`, texto plano
listo para pegar). En el módulo lo abre el botón «📄 Informe del mes», con el mes que se
esté mirando.

**Usa el mismo lenguaje visual que `gestion-stock/?pres=`** (pedido de Juli 08/09/2026: los
dos informes se mandan por mail y tienen que verse de la misma familia): tapa a pantalla
completa con grilla y diagonales, nav fija con links y barra de progreso, secciones
numeradas con label rojo y logo tenue, números en **Saira itálica 800**, KPIs con conteo
animado y sparkline, paneles con barras, tablas con barra en la celda y leyenda de lectura,
reveal por IntersectionObserver y pie navy. Se escribe con **`document.write`** (documento
completo, como el de stock), así no hereda el CSS del módulo; el logo va embebido y todo el
dibujo es SVG, así que el HTML imprime suelto.

⚠️ Dos cosas que el patrón original deja expuestas y acá **no hay que volver a romper**,
porque esto se manda por mail y se abre en cualquier navegador: (1) el **valor final de cada
KPI va escrito en el HTML** y la animación solo lo recorre — si el span sale vacío y arranca
en cero, un navegador sin `requestAnimationFrame` (o una pestaña en segundo plano) muestra
«0 reseñas», que es un número falso; hay además un plazo de 1,8 s que lo escribe igual;
(2) un bloque **no puede quedar en `opacity:0`** si el IntersectionObserver no dispara: el
handler de scroll revela lo que ya está en pantalla (`red()`) y hay un chequeo a los 1,2 s.

⚠️ **El mes que se manda suele no tener tickets todavía** (la columna se carga después), y sin
tickets no hay captación. En ese caso el ranking ordena por **reseñas recibidas** y el informe
lo aclara; cuando Iván carga los tickets, el mismo link pasa solo a ordenar por captación.
La constante `MODO` (`'tasa'` | `'vol'`) es la que decide, en `presRender` y en `presTexto`.

**Quién lo ve** (08/09/2026): gerencia, el rol **supervisor** (Cristian — se suma en
`herramientasEfectivas` junto a evaluaciones/indicadores/capacitaciones/tareas) e **Iván**
(`capacitaciones@`, que tiene perfil fijo con `soloHerramientas`: su lista es
`['capacitaciones','reviews']` y el inicio sigue siendo la Academia).

**Lo que el Excel NO trae: el texto de las reseñas.** Solo el nombre de quien dejó la última
opinión leída. Para ver los comentarios hace falta conectar la **API de Google Business
Profile** (OAuth + el Place ID de cada sucursal), que queda pendiente. Tampoco hay mapa
geográfico: no están cargadas las direcciones de los locales.


## Matts — el asistente del portal (`shared/asistente.js` + `functions/api/asistente.js`, 20/09/2026)

Chat flotante **abajo a la izquierda** en todos los módulos (la campana y el «?» van a la derecha).
Personaje: **Matts**, un deportista profesional de todos los deportes. Hace dos cosas: **ayuda de
uso del portal** (sabe en qué módulo está el usuario y su rol) y **asesor deportivo** para el
mostrador. Pedido de Juli: modelo de bajo consumo → **Claude Haiku 4.5** (unos US$0,003–0,006 por
consulta). Etapa 1 = guía + catálogo; etapa 2 = stock desde el Buscador (hechas el 20/09); etapa 3 = 360 (ventas y stock del sistema) con la API MySQL, pendiente.

- **Widget** `shared/asistente.js` (ES5, XHR, prefijo `mat-`): `header.js` lo carga solo (como
  `bloqueo.js`); el Portal e Indicadores lo incluyen con una línea. No se monta sin sesión, en el rol
  `puesto` ni con `?pres=`. Al cargar hace `GET /api/asistente`: si `disponible:false` (falta la clave,
  o se abrió el HTML suelto) **el botón no aparece**. La charla vive en `sessionStorage` (`matts_chat`)
  y se mandan las últimas 12. Abierto sube a z-index 1290 (tapa «?» y campana; el tutorial sigue arriba).
  **Avatar animado** (`avatarSvg` + `animarAvatares`, 20/09/2026): **silueta atlética articulada** con
  estética de gráfica deportiva (blanca sobre navy, zapatillas y franja rojas, piso con filo rojo, líneas de
  velocidad, leve `skewX`). Tiene esqueleto real (torso, hombro+codo, cadera+rodilla; el lado de atrás va
  más apagado para dar profundidad) y un motor propio que interpola entre **poses clave** del mapa
  `DEPORTES` (running con ciclo de carrera, tenis, fútbol, básquet —pica, salta y emboca en un aro que aparece
  solo en ese deporte— y box; **hockey se sacó el 20/09: Juli lo leía como esquí**) con `setInterval` de 33 ms
  —no `requestAnimationFrame`: en vistas embebidas no dispara— y PASA de un deporte al otro transformando
  la pose. Raqueta, aro, guantes y pelota son `data-p` que se prenden por deporte. Sumar un deporte = una
  entrada en `DEPORTES` (ángulos en grados, positivo = adelante; ver el comentario de campos). Con «reducir
  movimiento» queda fija en la zancada. ⚠ Juli rechazó las dos versiones anteriores el mismo día: el
  pictograma de palitos («parece el colgado») y el muñeco cabezón con vincha («dibujito de bebé»). La vara
  es **pro, competitivo, elite deportiva, dinámico**: no volver a lo infantil.
  Sugerencias por módulo en `SUGERENCIAS`. El nombre es la constante `NOMBRE` (widget y Function).
- **Function** `functions/api/asistente.js`: usa la misma `ANTHROPIC_API_KEY` que `/api/academia-ia`.
  Opcionales `ASISTENTE_MODELO`, `ASISTENTE_TOPE` (60 consultas por cuenta y día) y
  `ASISTENTE_TOPE_TOTAL` (1500). El mail tiene que existir en `discontinuos-mateu/usuarios` (el rol y
  la sucursal salen de ahí, no del navegador; seguridad blanda, sin PIN). Prompt = personaje + índice
  de módulos (bloque estable) + usuario y guía del módulo actual filtrada por rol. Bucle de
  herramientas (máx. 5 vueltas): `guia_modulo` (guía de OTRO módulo), `consultar_stock`, `resumen_gestion` y `buscar_catalogo`
  (disciplina + rubro, marca y texto opcionales; 40 filas). La llamada al modelo está aislada en
  `llamarModelo`: cambiar de proveedor es tocar esa función.
- **Etapa 2 — stock (20/09/2026)**: herramienta `consultar_stock({codigos[1..4], talle?})` → lee el
  Buscador de Artículos (`ubicaciones-mateu/sucursales/<slug>/articulos`) con una consulta puntual por
  clave (`orderBy="$key"&equalTo`, clave = `fbKey` del Buscador) a cada sucursal que carga stock ahí; cuáles
  son se averigua una vez por hora con el `meta` de cada una (`sucursalesConStock`, en memoria del isolate).
  Devuelve por artículo `con_stock` (sucursal, unidades, **ubicación en el depósito** —estantería · módulo ·
  piso, con los nombres de `estanterias/<id>` y los pisos de `PISOS`, copia de `DEPOSITOS_SUC` del Buscador;
  pedido de Juli el mismo día: preguntó dónde estaba la camiseta de EDLP en Diagonal 80 y Matts lo mandó a
  Logística—, talles con stock si los abre, fecha de carga),
  `no_lo_tienen` (cargan stock y el artículo no figura), y las `sucursales_sin_dato`. Al 20/09 cargan stock 6 de 17 (Diagonal 80, Calle 49,
  Berisso, Ensenada, Aurelius 12, Aurelius 5) y **solo Calle 49 y Aurelius 12 abren por talle** — el techo de
  esta etapa es ese: más sucursales cargando su stock con talle en el Buscador = mejores respuestas, sin
  tocar código. Para llegar del nombre al código, `buscar_catalogo` acepta **solo marca + texto**
  (partición `catalogo/porMarca/<MARCA>`); el 90 % de los códigos del Buscador está en el catálogo. La ven
  todos los roles (el stock entre sucursales no es sensible); el `puesto` sigue sin Matts.
- **Vocabulario de la casa en el prompt**: «Diagonal 80 / la 80 / casa matriz» es una SUCURSAL (Matts la
  confundía con el módulo «Apertura Diagonal 80»); «EDLP / Estudiantes / Pincha» = marca Ruge, y la camiseta
  oficial es la que lleva el año («M/C EDLP HOME 26»), no las AMATEUR/JR. Sumar ahí la jerga que aparezca
  en `asistente/log`.
- **Reglas del prompt que no hay que aflojar**: de stock habla SOLO con lo que devuelve `consultar_stock`,
  siempre con la fecha de carga y aclarando que no es el sistema en vivo; «sin dato» ≠ «no tiene»; nunca
  precios; solo recomienda artículos que devuelve la herramienta; no
  inventa botones; nada de consejos médicos.
- **Guía de uso** = `shared/asistente-guia.json`, generada desde el mapa `TUT` de `shared/tutorial.js`:
  `node scripts/gen-asistente.js guia` **cada vez que se toque un tutorial** (módulo nuevo = su entrada
  en `TUT` y regenerar).
- **Catálogo** = `recepciones-mateu/asistente/catalogo` = `{generado, indice, partes:{<DISC>__<RUBRO>:
  [[código, artículo, marca, género, tipo]]}}`, el maestro `logistica/arts` partido para bajar solo el
  pedacito: `node scripts/gen-asistente.js catalogo --publicar` después de la carga mensual de
  logística (20/09: 71 particiones, 12.607 artículos).
- **Firebase** (`recepciones-mateu/asistente/`): `uso/<YYYY-MM-DD>/<mail>` y `_total` (contadores del
  tope) y `log/<YYYY-MM>/<id>` = `{ts, mail, rol, suc, modulo, q, r, tools, tin, tout, modelo}` — con
  eso se ve qué se pregunta y cuánto gasta antes de decidir cambios de modelo.
- **La clave** `portal-mateu` (consola de Anthropic, organización «Mateu Sports», cuenta julian@mateu.com.ar,
  crédito prepago sin recarga automática) **vence el 20/09/2027**: cuando caduque, Matts y los ✨ de la
  Academia dejan de responder → crear otra y reemplazar el Secret `ANTHROPIC_API_KEY` en el proyecto Pages
  + Retry deployment. Si Matts contesta «No pude contactar al modelo», mirar primero el saldo de créditos.
- **Puesto del salón (20/09/2026)**: el rol `puesto` tiene a Matts SOLO como asesor de producto + stock
  (`esPuesto` en la Function: sin índice de módulos ni `guia_modulo`, prompt que asume al cliente leyendo la
  pantalla, nada interno; tope diario doble). En el widget (`PUESTO`): sube a `bottom:86px` (arriba del pie
  del quiosco), saludo y sugerencias de producto, **la charla se borra y el chat se cierra a los 90 s sin
  uso** (pantalla compartida) y una pasada de la lectora con el chat enfocado (texto sin espacios que entró
  en un instante, `pareceEscaneo`) NO se manda como pregunta: se deriva a `procesarEscaneo` del Buscador.
- **Gestión del local (20/09/2026, «hacer todo» de Juli)**: herramienta `resumen_gestion({sucursal?, que?})` — sin
  esperar la API, lee lo que ya está en Firebase: objetivo de la semana y del mes (`objetivos/semanas|meses`)
  contra la venta provisoria (`ventaEquipo/<slug>/<lunes>`: % de la meta, falta para la meta y el ★ 120%, días
  cargados, UPT, ticket promedio), venta por vendedor, y los **pendientes**: F8 sin confirmar
  (`turnero-mateu/equipo/f8suc`), reposición disponible (`barrida/ultima`), mercadería que le baja
  (`barrida/repartoSuc`), tareas vencidas y vidrieras en alerta. **Los permisos se aplican en la Function, no
  en el prompt**: `sucursal`/`outlet` ven SOLO su slug (pedir otra devuelve error), `deposito` solo sus
  pendientes, `admin`/`supervisor` cualquier sucursal por nombre o «todas» (avance de cada una vs. su meta; el
  % total se calcula solo sobre las que cargaron venta); `puesto` y el resto no tienen la herramienta. ⚠ El
  **objetivo personal y el ritmo por vendedor NO se calculan acá** (dependen de pesos por turno, curva de venta
  y alias del padrón: darían un número distinto al de Mi Sucursal): Matts manda a «Cómo viene el equipo».
  El mes de una semana = el de su domingo (`mesDeSemana`, igual que `objMesDeSemana`).
- **«¿Te sirvió? Sí / No»** debajo de cada respuesta: la Function devuelve el `id` de la entrada del log
  (`<YYYY-MM>_<id>`, ahora se escribe con PUT) y `POST {accion:'voto', id, voto}` le anota `voto` / `votoPor`.
- **Panel de uso `asistente/index.html`** (solo `ADMINS` = julian@; link «🤖 Matts · qué preguntan y cuánto
  gasta» en el ⚙ del Portal): consultas, cuentas, % que sirvió, gasto estimado del mes (tarifa de Haiku sobre
  `tin`/`tout`; es un techo, no descuenta caché ni incluye los ✨ de la Academia), saldo estimado contra
  `asistente/config/credito` (lo que se cargó en la consola; editable ahí), consultas por día, quién / desde
  qué módulo / qué herramienta, y la lista de preguntas con filtros (no sirvió · gestión · stock · producto ·
  uso del portal), buscador y «⧉ Copiar las que no sirvieron». Es con lo que se decide qué mejorar.
- **Presentación**: paso «🤖 Conocé a Matts» en el tutorial del Portal y «Preguntale a Matts» en el de Mi
  Sucursal (de ahí también lo aprende el propio Matts, vía la guía). Ícono 🤖 sumado a `shared/iconos.js`.
- **Trato y confidencialidad (21/09/2026)**: un usuario le escribió «sos crack» y Matts contestó «¡Gracias, boludo!». El prompt ahora
  prohíbe insultos, malas palabras y apodos de confianza aunque el usuario hable así, y `sinGroserias` los borra de la respuesta por si
  el modelo se escapa (no incluye «gil» ni «forro»: rompían «ágil» y «forro polar»). Regla CONFIDENCIALIDAD: los números salen solo de
  `resumen_gestion`; nada de costos, márgenes, sueldos, datos del personal, accesos ni la venta de otra sucursal, aunque digan «soy de
  gerencia». Con el ingreso por servidor activo (`accesoDisponible`), `resumen_gestion` exige el token de sesión (`body.tok` = `session.tok`,
  `leerToken` exportada de la librería) del mismo mail; sin Secrets sigue la seguridad blanda.
- **Búsqueda y stock del local (21/09/2026, tras leer las 64 consultas de `asistente/log`)**: fallaba por búsqueda, no por redacción —
  recomendaba lo que el local no tenía (Ultraboost en Berisso), no entendía el Id.item que tipea el salón («233999»), no encontraba un
  modelo sin la marca o mal escrito («dropster control 4», «tokio») y preguntaba antes de buscar (36 de 64 respuestas sin herramientas).
  `gen-asistente.js catalogo --publicar` ahora publica además `catalogo/vocab` (palabra → cantidad), `palabras/<PALABRA>` (artículos; las de
  más de `PALABRA_COMUN` = 400 solo filtran), `porId/<Id.item>` y `porCod/<código entero o sin las 3 letras de marca>`. En la Function:
  `buscar_catalogo` acepta SOLO texto (`filasPorTexto`: `RELLENO`, `SINONIMOS`, `corregirPalabra` por comienzo o distancia de edición, hasta
  3 palabras de entrada, puntaje por rareza; avisa `palabras_corregidas` / `coincidencia_parcial`), filtro `genero`, y marca qué resultados
  figuran en el local del usuario (`en_el_local` + `siguiente_paso`); `consultar_stock` traduce Id.item y código corto (`resolverCodigo`,
  `pedido_como`); herramienta nueva **`stock_del_local`** = catálogo ∩ claves de la sucursal (`articulos.json?shallow=true`, ~40 KB, 10 min
  en memoria) y stock real de hasta `MAX_LOCAL` (24, alternando marcas; el resto va en `otros_en_el_local_sin_revisar`) con talles y
  ubicación; sin disciplina mira calzado de running + casual + training; un talle en otra escala (AR 37 vs. US) no vacía la lista. ⚠ Tope
  de 50 subrequests por pedido en el plan gratis de Cloudflare: no subir `MAX_LOCAL` sin mirar eso. Prompt: «PRIMERO LO QUE HAY EN EL LOCAL»,
  «BUSCÁ ANTES DE PREGUNTAR» y «LO QUE NO TENÉS» (más vendidos, stock de una marca, repartos → una línea y el módulo que lo tiene). Probado
  en vivo como el puesto de Berisso con las preguntas que habían fallado. Para volver a medir: `asistente/log/<YYYY-MM>` o el panel de uso.
- **Fichas técnicas por disciplina (21/09/2026)** — `lib/asistente-fichas.mjs` (`FICHAS` + `fichasPara`; tests `node --test
  lib/asistente-fichas.test.mjs`): el criterio de la casa para asesorar (pádel, tenis, running, fútbol, hockey, básquet, training, vóley,
  rugby, natación, box, adventure y talles), porque Haiku solo afirmaba cosas al revés (balance alto para un principiante de pádel). La
  Function detecta la disciplina por palabras clave en los últimos 3 mensajes del usuario e inyecta al prompt SOLO esa ficha (hasta 2;
  «talles» entra de segunda o sola; tenis de mesa no trae ninguna) con un «CÓMO USARLA»: la respuesta abre con el criterio que aplica y
  **no le atribuye características a un modelo puntual** (del stock solo conoce nombres): cierra con «confirmá en la etiqueta que sea …».
  El log guarda `fichas`. **Para corregir o sumar criterio se edita el `texto` de la ficha y se pushea**; conviene que las revise Iván o el
  referente de cada deporte (las escribió Claude, sin validar con la gente de la casa). Sin precios ni consejos médicos (hay un test).
- **Índice compacto de stock, pre-búsqueda y memoria (23/09/2026, tras 10 consultas reales del salón: 3 de 10 terminaban en
  repregunta —«CAMPUS» → «¿qué necesitás?»— y «de hombre» perdía el hilo)**. (1) **Índice**: el Buscador escribe en cada carga de
  stock `sucursales/<slug>/indice` = `{ts, n, a:{<clave>:[stock, "talle:cant,…", "ubicación en texto", idItem, descripción]}}`
  (`indiceMatts`/`indiceMattsEntrada` en `ubicaciones/index.html`; `indiceMattsPatch` retoca la entrada al asignar/quitar una
  ubicación; ~40–320 KB por sucursal, sembrado el 23/09 en las 8 que cargan stock con `sembrar_indice.mjs` de la sesión). La Function
  lo baja en UN pedido y lo cachea 10 min (`indiceSucursal`, `filaIndice`): `stock_del_local` mira TODO el local sin pedidos por
  artículo (ya no rige `MAX_LOCAL`; lista hasta 30 + `mas_con_stock_sin_listar`), `consultar_stock` resuelve en memoria las
  sucursales con índice y `buscar_catalogo` trae unidades/talles/ubicación del local en `en_el_local`. Sin índice, camino viejo.
  (2) **Pre-búsqueda** (`prebuscar`, antes de llamar al modelo): busca en el catálogo lo que escribió el usuario en modo ESTRICTO
  (`filasPorTexto(texto, true)`: exacto o prefijo, sin corrección por distancia —«correr» daba «correa»—; números y palabras de ≤2
  letras filtran pero no buscan y pesan 0,02 —«6 uk» hacía ganar a Reebok «UK»—; `RELLENO` sumó las palabras de pregunta/gestión) y,
  si hay 1–120 coincidencias, inyecta al prompt hasta 15 filas con el stock del local ya resuelto, las palabras que no existen en el
  catálogo («YONES» → «no se trabaja») y «USALO DIRECTO». El log guarda `pre:1`. (3) **Memoria**: la Function devuelve `ctx` (resumen
  compacto de lo que salió de la pre-búsqueda y las herramientas, `resumenParaMemoria`, ≤1.500 caracteres); el widget lo guarda en el
  mensaje y manda los de las últimas 2 respuestas como `contexto` → bloque «ARTÍCULOS QUE YA SE MOSTRARON EN ESTA CHARLA». Sugerencia
  «¿En qué sucursal hay stock de …»: un botón que termina en «…» deja la frase escrita en vez de mandarla. Probado en vivo como el
  puesto de Calle 49: «CAMPUS», «response 2 en 6 uk», «raquetas yones» y «de hombre, en 9.5» contestan directo.
- **Equivalencias de talles por marca (23/09/2026)** — `lib/asistente-talles.mjs` (`MARCAS`, `tablaDe`, `aLaMarca`, `bloqueTalle`,
  `talleEnTexto`; tests `node --test lib/asistente-talles.test.mjs`). Qué escala ROTULA cada marca se verificó contra los talles
  cargados en el Buscador de las 8 sucursales: Adidas, Nike, New Balance, Asics, ON, Salomon, Skechers, Under Armour, Vans, Converse y
  Crocs rotulan **US**; Puma **UK**; Head, Atomik, Fila, Le Coq, Montagne, Topper, Umbro, Timberland, 47 Street, Olympikus **número AR/EU**;
  Havaianas, Rider, Bagunza y Hang Loose **BR** (talle doble «37/38» ≈ 39/40 AR). Fila = `[rótulo, AR/EU, US, UK, cm]` por marca y género,
  alineada con la tabla de la casa (NB: dama US 7·7.5·8 = AR 37–38.5, hombre US 8.5·9·9.5 = AR 41–42; Puma UK 4.5–5.5 / 8–9). ⚠ Las
  escribió Claude desde las tablas oficiales, sin validar con la casa: corregir ahí. Cómo se usa: (1) `stock_del_local` y `consultar_stock`
  aceptan `escala` (AR/US/UK/CM) y llevan el talle pedido al rótulo de la marca de cada fila (`talleParaMarca`: «42 AR» = US 8.5 en Adidas,
  UK 8 en Puma, 42 en Head; campos `talle_pedido_en_esta_marca` / `talle_pedido_en_la_escala_de_la_marca`); (2) la pre-búsqueda, si la
  pregunta trae un talle (`talleEnTexto`: «6 uk», «talle 42», «calzo 9.5 us», un 33–47 suelto = AR, «en 9» = rótulo de la marca), marca
  por artículo «talle pedido 42 AR = US 8.5: LO TIENE / no lo tiene»; (3) bloque automático «EQUIVALENCIAS DE TALLE» con la fila de cada
  marca en juego (las de la pre-búsqueda o las nombradas; sin ninguna, Adidas/Nike/Puma/NB + número AR); (4) herramienta
  `equivalencia_talle` para «¿qué talle es 42 en Nike y en Puma?». El prompt manda pasar `escala` y no convertir de memoria. Probado en vivo:
  «response 2 en 6 uk», «qué talle es 42 en nike y en puma» (US 8.5 / UK 8), «duramo speed en 42» (US 8.5 ✓ con stock), «havaianas 39/40»
  (≈ 41/42 AR). Límite: Haiku a veces redondea una fila del bloque de otra manera (dijo «AR 38» donde la fila decía 39.3).
- Pendiente: la etapa 3, que Matts use los cursos de la Academia como fuente de producto, motivo de un toque en el voto «No» (solo 4 de 64
  consultas tenían voto) y atributos reales por artículo (forma, balance, drop…): hoy el catálogo solo trae el nombre.

## API de ventas (fase 1) — estado 24/09/2026

El dev entregó la API de ventas sobre el SQL Server del sistema (`https://66-97-37-173.sslip.io`, key Bearer que
**no va en el repo**: es público). Doc del dev en `docs/API-VENTAS-DOC-DEV-2026-09-23.md` (key tapada), spec en
`docs/API-VENTAS-FASE1.md` (§4 reescrito ese día con el criterio EXACTO), **informe de validación para el dev en
`docs/API-VENTAS-VALIDACION-2026-09-23.md`** y la respuesta de la tarde en `docs/API-VENTAS-RESPUESTA-PUNTO3-2026-09-23.md`.
Resultado: la API responde y respeta el shape de `ventaEquipo`, pero **todavía no se conecta**: (1) el importe por
línea venía bruto (a la tarde corrigieron `Imp_dto`, pero falta el descuento del comprobante que el reporte del
sistema prorratea por línea: 10/15/20 % en todas las líneas del ticket), (2) Nc con el signo al revés (corregido a
la tarde), (3) aplica el criterio viejo de agosto y el Portal es EXACTO desde el 17/09 — el dev lo cuestionó y pidió
evidencia: está en la respuesta, con casos de su propio /lineas y del export de agosto (§4 baja los tickets 11 % y
sube las unidades 5 %; WEB MATEU/AURELIUS es el campo Vendedor, no una sucursal); es decisión de Juli y no se reabre,
(4) sin `Access-Control-Allow-Origin` (corregido a la tarde) y (5) 500 intermitentes, que en realidad son un bloqueo
de ~20 s cada ~30 s en la base (1 de cada 3 llamadas tarda 20 s; su reintento lo esconde). Para volver a validar:
`VENTAS_API_KEY=<key> node scripts/validar-api-ventas.mjs semana|sucursal|lineas …` (cruza contra Firebase y contra
el export «Ventas agosto portal.csv» comprobante por comprobante; meta = diferencia 0 contra el export del sistema).
Plan de conexión (cuando los números den): Pages Function `/api/ventas/…` como proxy con la key en Secret (sin CORS,
key fuera del navegador, filtro de slug por rol con el token de `acceso.js`) e Indicadores leyendo la semana viva de
ahí con fallback a `ventaEquipo`; la carga manual queda como plan B.

**Conexión HECHA (24/09/2026 tarde)** — ver `docs/API-VENTAS-CONEXION.md`. El deploy del dev de ese día dejó el criterio EXACTO y la omnicanalidad bien (Kids 317 tickets, Diagonal 908/1.412, vendedores iguales al recálculo); quedan pendientes de ellos el descuento de cabecera del comprobante (Kids 24/08: +329.320 en 26 comprobantes) y el bloqueo de la base. Del lado del Portal: **`functions/api/ventas.js` → `lib/ventas-proxy.mjs`** (tests `node --test lib/ventas-proxy.test.mjs`): `GET /api/ventas` → `{disponible}`, `?semana=<lunes>` (totales por sucursal) y `?semana=&sucursal=<slug>` (detalle, shape `ventaEquipo` + `fuente:'api'`). La key vive en el Secret **`VENTAS_API_KEY`** de Cloudflare Pages (⚠ **pendiente de que Juli lo cargue** + Retry deployment; hasta entonces `disponible:false` y todo sigue por `ventaEquipo`). Identidad por headers `X-Mateu-Email` / `X-Mateu-Tok` contra `usuarios/`: admin/supervisor cualquier sucursal, sucursal/outlet solo la propia (totales filtrados). Cache en memoria + R2 (`LEGAJOS`, prefijo `_cache/ventas/`): fresco 5 min, viejo hasta 24 h servido al toque y refrescado con `waitUntil`, una consulta en vuelo por ruta, fallos recordados 60 s, timeout 40 s: el bloqueo de 20 s de la base lo paga a lo sumo la primera consulta. En `indicadores/` (bloque «API de ventas del sistema»: `ventasApiDisponible`, `vapiSemana`, `vapiSucursal`, `lunesHoyISO`, `vapiPrimero`): la **semana en curso** (lunes de hoy o posterior) sale primero del proxy y cae a `ventaEquipo`; las anteriores al revés (Firebase primero, API si no hay nada); el Excel recién subido por el encargado gana en esa visita (`_veManual`). Pills: «● en vivo · hasta DD/MM HH:MM» en «Cómo viene el equipo» y «vivo» (en vez de «prov») en la tabla del Panel General. Probado el 24/09 contra la API real con un servidor local que monta la librería (Panel General + Kids, semana del 21/09). Hallazgo al conectar: los **500 de 0,15 s** de la API aparecen justo después de un 500 de 16–20 s (repitiendo Kids 14/09 cada 4 s: 500 en 20,6 s y las dos llamadas siguientes 500 al instante): no es por sucursal ni por semana, es que durante la ventana de bloqueo, cuando una llamada agota los reintentos, las siguientes fallan sin intentar (pool de conexiones agotado) — pendiente del dev. **Segunda tanda (misma noche, «avanzá con todos»)**: (1) el proxy **espeja** cada detalle de sucursal que trae de la API en `ventaEquipo/<slug>/<lunes>` con `por:'api'` (solo si el nodo no existe o ya era del proxy; `VENTAS_ESPEJO=0` lo apaga), así Academia, Matts, RRHH, el objetivo mensual y la curva de Diagonal siguen leyendo Firebase sin que nadie suba el Excel; (2) **`shared/ventas-api.js`** (`window.VentasApi`: disponible · semana · sucursal · totalesMes · semanasDelMes) para los demás módulos; (3) **Objetivos**: pill «sistema» en el dashboard semanal y semanas en vivo en el mensual (sin escribir `real`); (4) **Reseñas**: tickets del sistema en los meses sin la columna (`ticketsDelSistema`, `tApi`); (5) **Logística**: «Abastecimiento vs. venta» del mes en curso desde la API (`VENTA_API`); (6) **`scripts/ventas-api-lineas.mjs`**: `csv` (el mismo CSV del export del sistema, para el ETL y «Cargar venta del mes») y `pesos YYYY-MM --publicar` (matriz de pesos por turno desde `hora`, reemplaza el Excel PESOS TURNOS). Pedido al dev para Reparto y Regalías: ID ITEM, talle, código de artículo y cliente en `/lineas`.

## Reglas

- Responder y comentar el código en **español**.
- **No usar la palabra «cadena» en textos visibles** (Juli, 23/08/2026): el agregado de todas
  las sucursales se llama **«Todas las sucursales»** (vista, títulos) o **«total sucursales»**
  (rótulos cortos: «Mínimo total sucursales»); en rankings cortos, «Todas 5/19» y «vs. todas».
  En el código los identificadores (`vistaCadena`, `cadena.json`, etc.) siguen igual.
- El objetivo de superación se muestra como **«★ 120%»** (nunca «Superación»).
- No agregar frameworks ni build steps. Mantener todo self-contained.
- No tocar la config de Firebase de los módulos (URLs de las bases) salvo pedido explícito.
- Antes de un cambio grande en una herramienta, confirmá el alcance con Juli.
- Juli itera con correcciones puntuales: hacé cambios acotados y dirigidos, no
  reescrituras completas salvo que lo pida.
