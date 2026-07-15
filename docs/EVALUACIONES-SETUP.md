# Evaluaciones de Supervisor — puesta en marcha

Módulo `evaluaciones/`. Funciona **igual que el resto del portal**: es un
`index.html` self-contained que lee/escribe a **Firebase Realtime Database por
REST** (como marcas, turnero o mensajes). No hay build, no hay servidor, no hay D1.

Mientras no pegues la URL de la base, el módulo corre en **modo demo** con los
datos de prueba de `evaluaciones/mock-data.js` (no persiste, muestra un banner).

---

## Lo único que hay que hacer una vez (lo hace Juli)

1. **Crear la base** en Firebase: nueva Realtime Database, p.ej. `evaluaciones-mateu`
   (igual que hiciste con `mensajes-mateu`). Copiá su URL, algo tipo
   `https://evaluaciones-mateu-default-rtdb.firebaseio.com`.

2. **Pegar la URL en dos lugares** (constante `EVAL_DB_URL`, hoy vacía):
   - `evaluaciones/index.html` → el módulo (lectura/escritura).
   - `index.html` (Portal) → solo para el badge del tile (§6.6). Si no lo pegás
     acá, el módulo anda igual, solo no aparece el badge en el Portal.

   Con eso deja de estar en modo demo y guarda de verdad. `commit` + `push` y listo.

3. **Reglas de la base (Firebase → Realtime Database → Reglas).** La base se crea en
   "modo prueba", con reglas que **expiran** (`now < <timestamp>`); pasada esa fecha
   Firebase rechaza todo. Reemplazalas por estas permanentes y publicá:

   ```json
   {
     "rules": {
       "evaluaciones":  { ".read": true, ".write": true },
       "puntos_mejora": { ".read": true, ".write": true }
     }
   }
   ```

   Solo habilitan los dos nodos que usa el módulo (no la raíz), así nadie puede
   borrar la base entera de un saque ni escribir en rutas ajenas.

   > Nota de seguridad: igual que en todo el portal, esto es **blando** — la URL
   > está en el código de la página, así que técnicamente cualquier usuario logueado
   > podría leer/escribir esos nodos. El alcance por rol (que una sucursal solo vea la
   > suya) se aplica en el cliente, no es una barrera dura. Es la misma decisión que
   > el resto de los módulos.

---

## Supervisores

Hoy hay **un solo supervisor: `cristian.campion@mateu.com.ar`**, cubre todas las
sucursales. En el **⚙ del Portal** (solo Juli): creá/editá ese usuario con rol
`supervisor` y marcá **todas** las sucursales en el multiselect. Se guarda en
`usuarios/<mail>/sucursales` de la base de usuarios (`discontinuos-mateu`), que es
lo que el módulo lee para saber qué sucursales le tocan (`session.sucursales`).

Cuando sumes más supervisores, a cada uno le marcás su subconjunto.

---

## Cómo funcionan los roles

- **admin (gerencia):** ve/edita todo, ranking global, gráficos.
- **supervisor:** ve/edita solo sus sucursales; ranking y gráficos de las suyas.
- **sucursal / outlet (encargado):** solo su propia evaluación (nota, plan de
  acción, evolución), acuse de recibo y marcar puntos de mejora como resueltos.
  Aterriza en Indicadores; llega a "Mi evaluación" desde el menú de herramientas.

---

## Estructura de datos en Firebase

```
evaluaciones-mateu/
  evaluaciones/
    <sucursal>__<semana>/         # ej: calle-12__2026-W28  (único por sucursal/semana)
      sucursal, encargado, supervisor, semana,
      pts_operativa, pts_actitudinal, pts_total, nota,
      obs_operativa, obs_actitudinal, estado ('borrador'|'enviada'),
      visto_encargado, visto_en, visto_comentario, created_at, updated_at,
      items: { <item_key>: { categoria, valor, puntos, plan_accion } }
  puntos_mejora/
    <pushid>/                     # seguimiento entre semanas
      sucursal, item_key, semana_origen, texto,
      estado ('pendiente'|'resuelto'|'confirmado'),
      marcado_por, marcado_en, confirmado_por, confirmado_en
```

---

## Archivos

```
lib/evaluacion.js                 # cálculo puro (puntaje/nota) — única fuente de verdad (§3/§4)
lib/evaluacion.test.js            # tests: node --test lib/evaluacion.test.js
evaluaciones/index.html           # el módulo (UI + capa de datos Firebase, self-contained)
evaluaciones/mock-data.js         # datos de prueba del modo demo (generado)
scripts/gen-evaluaciones-mock.mjs # regenera mock-data.js
```

## Pendiente para v2 (fuera de alcance de v1)

- Foto por ítem como evidencia (necesita storage de imágenes).
- Calibración entre supervisores (nota promedio otorgada por cada uno).
