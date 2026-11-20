# Rediseño del panel del equipo (equipo.html)

Rama `rediseno-panel-equipo`, base `main` 10a3e9d. Un solo panel para el equipo; `admin.html` y `contenido.html` se retiran.

## Espacios (menú)
1. **Resumen**: qué requiere atención hoy (mensajes sin responder, videollamadas por confirmar, accesos por vencer) con un botón por tarea.
2. **Mensajes**: preguntas y videollamadas. Abrir una conversación no la marca como leída hasta responder o marcarla (`mark=0`).
3. **Páginas del sitio**: Inicio, Cursos, Gratis, Taller, Comunidad, Suscripción y Tienda. Cada página muestra un mapa (la página real, escalada) con zonas numeradas. Cada foto o video tiene tarjeta con «Cambiar foto/video», «Volver a la original» y «Volver a la versión anterior». Cada texto visible tiene «Editar texto», con el mismo número en el mapa: cuadro con contador, negrita (`**así**`) y salto de línea, paso **Revisar** (antes/después y la página real en computador y celular), **Publicar**, «Volver al original» y «Volver al anterior». El HTML de la página es el texto por defecto: si no hay cambio publicado, o la carga falla, se ve el original. No se editan los enlaces de pago ni los precios y cupos que pinta `assets/fa-precios.js` desde `assets/fa-config.js`. En Gratis están además los recursos gratis (videos y documentos).
4. **Material de los planes**: archivos por plan, con vista previa (URL firmada de 120 s).
5. **Accesos**: suscripciones y estado; dar acceso a mano queda como respaldo.

Redirecciones (`vercel.json`, no permanentes): `/admin`, `/admin.html` → `/equipo.html`; `/contenido`, `/contenido.html` → `/equipo.html#/paginas/inicio`.

## Cambios de API (aditivos, aprobados por Mathias el 2026-11-19)
Solo `api/admin.js` y `api/_lib/storage.js`. **No se tocó `api/account.js`** (lo modifica el PR de Mi cuenta).
- `summary`: contadores para el Resumen.
- `mark-read` y `thread` con `mark=0`: leer sin marcar como leído.
- `material-preview-url`: URL firmada de vista previa del material.
- `media-save` conserva la versión inmediatamente anterior de cada foto; `media-restore-previous` la recupera; `media` devuelve `custom.hasPrevious` y `contentType`; `media-reset` borra la carpeta del espacio. Sin migración de base de datos (la versión anterior es el objeto más antiguo siguiente en la carpeta del espacio).

Los archivos de pago no se modifican (`api/hotmart`, `api/_lib/hotmart.js`, `api/_lib/access.js`, `api/_lib/plans.js`, `assets/fa-config.js`). `api/account.js` solo suma la lectura pública `site-texts`, del mismo modo que ya leía `site-media`.

## Textos del sitio
Tabla `site_texts` (migración `20261120120000_textos_del_sitio.sql`, **no aplicada**: la corre Mathias). Lectura pública solo de lo publicado. Escritura directa solo si `fa_is_admin()` (la tabla `admins`). El panel escribe por `/api/admin` después de la misma comprobación de admin que el resto del panel. El sitio pide `GET /api/account?action=site-texts` y aplica el cambio con `textContent` (`assets/fa-aplicar-textos.js`); nunca `innerHTML`. Listado de textos sin marca: `node tests/textos-sin-marca.js` (debe imprimir 0 en las siete páginas).

## Pruebas
- `npm test`: 135/135 (incluye `tests/textos.test.js`, `tests/panel-equipo.test.js`, `tests/panel-equipo-api.test.js`).
- E2E (`tests-e2e/`, Playwright con API simulada con `page.route`; nunca toca datos reales):
  `cd tests-e2e && npm install && npx playwright test` (usa el puerto 4599; `CAPTURAS=<carpeta> npx playwright test capturas.spec.js` genera capturas).
  - `tareas.spec.js`: T1–T10 con tope de clics y tiempo (guion en `docs/pruebas-usabilidad.md`).
  - `panel.spec.js`: mapas de las 7 páginas en computador y celular (fotos y textos), tarjetas iguales, vista previa antes de publicar, conversión a WebP, video, archivo inválido, volver a la original en los 34 espacios, versión anterior, confirmaciones, progreso, errores, sesión vencida con borrador, marcar leído, términos prohibidos, sin pagos, foco de teclado.
  - `textos.spec.js`: editar un texto en el panel, verlo en la página y volver al original; el editor en celular.
  - `layout.spec.js`: sin scroll horizontal (390 y 1440), objetivos táctiles ≥44 px, navegación inferior, axe (serious/critical = 0) en todas las vistas, un diálogo abierto y el login.
- No se ejecutó Lighthouse (la página necesita sesión y API real; con la API simulada las cifras no serían representativas). Pendiente de medir en la vista previa.

## Desviaciones
- **Peso de JS**: criterio inicial 120 KB. Con el editor de textos el código del panel (`fa-panel*.js`) pesa ~163 KB. La prueba lo limita a 220 KB. El catálogo `assets/fa-textos.js` no entra en esa cuenta (no lo descarga el sitio público).
- **No implementado**: autor de cada subida y «respondidas hoy» (requieren datos/endpoints nuevos).
- El enlace de recuperar contraseña apunta a `mi-cuenta.html?recuperar=1` (limitación conocida para cuentas del equipo).

## Reglas respetadas
Español neutro, sin la palabra «Hotmart» en la interfaz, sin blur/vidrio/grano/cursor propio, botones tipo píldora ≥48 px, un único botón primario por pantalla, sin `confirm/alert/prompt`.
