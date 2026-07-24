# Pack de handoff para el dev de la API (con su propio Claude)

Esta carpeta es **autosuficiente**: contiene todo lo que necesitás para construir la
API sobre MySQL **sin acceso al repo del Portal** y sin datos sensibles. Copiala a tu
propio repo de la API y, si usás Claude Code, ponelo a leer esta carpeta — con esto
tiene el contexto completo del contrato.

## Qué tenés que construir

Una **API REST de solo-lectura** sobre el MySQL gestionado de Mateu Sports, que
alimenta módulos de un Portal (hoy hosteado en Cloudflare Pages) que antes leían
archivos exportados de Excel. El Portal **no cambia de hosting**: solo va a hacer
`fetch` a tus endpoints en vez de leer los archivos estáticos.

## Archivos

| Archivo | Endpoint que ejemplifica |
|---|---|
| `../API-CONTRATO-MYSQL.md` | **El contrato completo.** Leelo primero: convenciones, auth, CORS, y el shape de cada endpoint con notas. |
| `meses-stock.json` | `GET /v1/meses-stock` |
| `indicadores-periodos.json` | `GET /v1/indicadores/periodos` |
| `indicadores-objetivos.json` | `GET /v1/indicadores/objetivos` |
| `indicadores-cadena.json` | `GET /v1/indicadores/{periodo}/cadena` (SIN personas) |
| `indicadores-sucursal.json` | `GET /v1/indicadores/{periodo}/sucursal/{id}` (CON personas) |

## Cómo usar estos ejemplos

Son **datos de juguete** (nombres y números inventados). Tu objetivo: que tus
endpoints devuelvan **exactamente este shape** — mismos nombres de campo, mismo
anidamiento, mismos tipos. Si tu respuesta valida contra estos ejemplos, el Portal
la consume sin cambios de lógica.

Podés usarlos también como **fixtures de test**: mockeás el endpoint con el JSON de
juguete y verificás que tu serializador produce la misma estructura.

## Reglas que no se pueden romper (resumen — el detalle está en el contrato)

1. **HTTPS + CORS** al dominio del Portal. Manejar el preflight `OPTIONS`.
2. Rutas bajo **`/v1/`**.
3. **Meses de Stock**: no dividir las marcas por 2 (bug histórico). Cada nivel
   —rubro, marca, segmento— sale de su fila correspondiente del reporte RATIO tal
   cual. Ver §4 del contrato.
4. **Indicadores**: el endpoint `cadena` **nunca** incluye `vendedores` (personas);
   solo el endpoint de sucursal los trae. Es la regla de privacidad del módulo.
5. Sin dato para un período válido → **200 con estructura vacía**, no 404.
6. Las **claves de sucursal** deben ser el string `"NN-Nombre"` que ya usa el Portal
   (te lo pasa Juli; en los ejemplos van como `"01-Sucursal Demo A"`).

## Lo que necesitás definir con Juli

- La **URL base** de tu API (`API_BASE` en el Portal).
- El **esquema de auth** (§3 del contrato): API key fija, o filtrado por sucursal
  en el server (recomendado para Indicadores).
- Las **credenciales del MySQL** viven como secret en tu server, nunca en el Portal.

## Dudas sobre el contrato

Si algo del shape no cierra, anotá la pregunta concreta (qué campo, qué endpoint) y
pasásela a Juli; del lado del Portal se resuelve rápido. También podés preguntarle a
tu propio Claude Code apuntándolo a esta carpeta.
