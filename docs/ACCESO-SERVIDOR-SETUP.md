# Ingreso por servidor — puesta en marcha

Código: `lib/acceso-servidor.mjs` (lógica + tests), `functions/api/acceso.js` (la Function),
`shared/acceso.js` (navegador). Mientras no estén los Secrets, **todo sigue como hasta ahora**
(`GET /api/acceso` → `{"disponible":false}`).

**El orden importa.** Cerrar las reglas de Firebase antes de que el servidor ande deja a todos
afuera. Hacer los pasos de a uno y verificar cada uno.

## 1 · Clave de la cuenta de servicio de Firebase

Consola de Firebase → proyecto **discontinuos-mateu** → ⚙ Configuración del proyecto →
**Cuentas de servicio** → «Generar nueva clave privada». Baja un archivo `.json`.
No subirlo al repo ni mandarlo por mail/WhatsApp: después de cargarlo en Cloudflare, borrarlo.

## 2 · Dos Secrets en Cloudflare

Workers & Pages → proyecto **Pages** `mateu-sports-portal` (el de `…pages.dev`, no el Worker del
mismo nombre) → Settings → Variables and Secrets → Add, los dos como **Secret**:

| Nombre | Valor |
|---|---|
| `FIREBASE_SA` | el contenido COMPLETO del `.json` del paso 1 (abrirlo con el Bloc de notas, copiar todo) |
| `SESSION_SECRET` | un texto largo al azar (ver abajo) |

Para generar `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

⚠ `SESSION_SECRET` **no se cambia nunca más**: con él se firman los PIN. Si se cambia, todos los
PIN dejan de valer y hay que resetearlos uno por uno. Guardarlo en un lugar seguro.

Después: Deployments → ⋯ del último → **Retry deployment** (un Secret nuevo toma efecto recién
en el deploy siguiente).

## 3 · Verificar

Abrir `https://mateu-sports-portal.pages.dev/api/acceso` → tiene que decir `{"disponible":true}`.
Salir del portal y volver a entrar: si entra, el servidor ya está validando el PIN (y el PIN de
esa cuenta ya pasó solo al nodo privado). En ⚙ aparece un cartel ámbar con cuántos PIN siguen
en la base pública.

Si el ingreso da «No pude completar la operación (Google rechazó la cuenta de servicio…)»: el
`FIREBASE_SA` quedó mal pegado (tiene que ser el JSON entero, con las llaves). En ese caso no se
migró ningún PIN todavía, así que se puede volver atrás sin costo borrando `SESSION_SECRET` +
Retry deployment. (Una vez que una cuenta entró por el servidor, su PIN ya no está en la base
pública: volver atrás obligaría a resetearle el PIN.)

## 4 · Migrar los PIN

⚙ del Portal → botón **«Pasarlos al servidor»**. Mueve todos los PIN a `usuariosPriv/` y los borra
de `usuarios/`. Hacerlo fuera de hora pico: una pestaña que quedó abierta con el código viejo
puede pedir recargar la página para validar el PIN.

## 5 · Cerrar los dos nodos (recién ahora)

Consola de Firebase → discontinuos-mateu → Realtime Database → **Reglas** → reemplazar todo por:

```json
{
  "rules": {
    "usuariosPriv": { ".read": false, ".write": false },
    "accesos":      { ".read": false, ".write": false },
    "$otro":        { ".read": true,  ".write": true }
  }
}
```

(En Firebase una regla abierta en la raíz no se puede cerrar más abajo; por eso la raíz queda sin
regla y `$otro` abre todo lo demás, como estaba.) Publicar.

Verificar: `https://discontinuos-mateu-default-rtdb.firebaseio.com/usuariosPriv.json` y
`…/accesos.json` tienen que responder `Permission denied`; el portal tiene que seguir entrando y
el panel 🔒 Dispositivos tiene que seguir cargando.

## Si algo falla después

- Nadie puede entrar y `/api/acceso` da `disponible:false` → se perdió un Secret: volver a cargarlo + Retry deployment.
- Una cuenta quedó bloqueada por intentos: espera 15 min, o «Resetear PIN» desde el ⚙ (limpia el contador).
- Panel 🔒 o «Resetear PIN» dicen «Tu sesión es anterior a este control»: salir y volver a entrar (el token dura 30 días).
