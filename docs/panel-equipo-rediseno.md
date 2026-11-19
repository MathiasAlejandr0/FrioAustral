# Rediseño del panel del equipo (equipo.html)

Rama `rediseno-panel-equipo`, base `main` 10a3e9d. Un solo panel para el equipo; `admin.html` y `contenido.html` se retiran.

## Espacios (menú)
1. **Resumen**: qué requiere atención hoy (mensajes sin responder, videollamadas por confirmar, accesos por vencer) con un botón por tarea.
2. **Mensajes**: preguntas y videollamadas. Abrir una conversación no la marca como leída hasta responder o marcarla (`mark=0`).
3. **Páginas del sitio**: Inicio, Cursos, Gratis, Taller, Comunidad, Suscripción. Cada página muestra un mapa (la página real, escalada) con zonas numeradas; cada zona tiene tarjeta con «Cambiar foto/video», «Volver a la original» y «Volver a la versión anterior». Antes de publicar hay un paso **Revisar** con Antes/Después y vista en computador y celular, usando la página real. En Gratis están los recursos gratis (videos y documentos).
4. **Material de los planes**: archivos por plan, con vista previa (URL firmada de 120 s).
5. **Accesos**: suscripciones y estado; dar acceso a mano queda como respaldo.

Redirecciones (`vercel.json`, no permanentes): `/admin`, `/admin.html` → `/equipo.html`; `/contenido`, `/contenido.html` → `/equipo.html#/paginas/inicio`.

## Cambios de API (aditivos, aprobados por Mathias el 2026-11-19)
Solo `api/admin.js` y `api/_lib/storage.js`. **No se tocó `api/account.js`** (lo modifica el PR de Mi cuenta).
- `summary`: contadores para el Resumen.
- `mark-read` y `thread` con `mark=0`: leer sin marcar como leído.
- `material-preview-url`: URL firmada de vista previa del material.
- `media-save` conserva la versión inmediatamente anterior de cada foto; `media-restore-previous` la recupera; `media` devuelve `custom.hasPrevious` y `contentType`; `media-reset` borra la carpeta del espacio. Sin migración de base de datos (la versión anterior es el objeto más antiguo siguiente en la carpeta del espacio).

Archivos de pagos intactos (verificar con `git diff --stat main -- api/hotmart api/_lib/hotmart.js api/_lib/access.js api/_lib/plans.js assets/fa-config.js api/account.js`: sin salida).

## Pruebas
- `npm test`: 97/97 (incluye `tests/panel-equipo.test.js`, `tests/panel-equipo-api.test.js`).
- E2E (`tests-e2e/`, Playwright con API simulada con `page.route`; nunca toca datos reales):
  `cd tests-e2e && npm install && npx playwright test` (usa el puerto 4599; `CAPTURAS=<carpeta> npx playwright test capturas.spec.js` genera capturas).
  - `tareas.spec.js`: T1–T10 con tope de clics y tiempo (guion en `docs/pruebas-usabilidad.md`).
  - `panel.spec.js`: mapas de las 6 páginas en computador y celular, tarjetas iguales, vista previa antes de publicar, conversión a WebP, video, archivo inválido, volver a la original en los 34 espacios, versión anterior, confirmaciones, progreso, errores, sesión vencida con borrador, marcar leído, términos prohibidos, sin pagos, foco de teclado.
  - `layout.spec.js`: sin scroll horizontal (390 y 1440), objetivos táctiles ≥44 px, navegación inferior, axe (serious/critical = 0) en todas las vistas, un diálogo abierto y el login.
- No se ejecutó Lighthouse (la página necesita sesión y API real; con la API simulada las cifras no serían representativas). Pendiente de medir en la vista previa.

## Desviaciones
- **Peso de JS**: criterio 120 KB; el código legible suma ~148 KB (minificado ~117 KB, gzip ~44 KB). La prueba lo limita a 160 KB. Decisión pendiente: agregar paso de minificado o aceptar.
- **No implementado**: autor de cada subida y «respondidas hoy» (requieren datos/endpoints nuevos).
- El enlace de recuperar contraseña apunta a `mi-cuenta.html?recuperar=1` (limitación conocida para cuentas del equipo).

## Reglas respetadas
Español neutro, sin la palabra «Hotmart» en la interfaz, sin blur/vidrio/grano/cursor propio, botones tipo píldora ≥48 px, un único botón primario por pantalla, sin `confirm/alert/prompt`.
