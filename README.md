# Frío Austral — sitio web (v5 Patagonia nocturna)

Sitio estático (HTML/CSS/JS, sin build) + funciones serverless en `/api` (Vercel, Node 20+).
Base: demo del cliente `demo-cliente` del 5 de noviembre de 2026.

## Qué hace hoy

- **Todo se vende en Hotmart. El sitio no cobra nada** (no hay pasarela de pago ni cobros automáticos en el sitio).
- **Cursos**: cada curso tiene su `hotmartCheckoutUrl` en `assets/fa-config.js` → `COURSES`. El botón «Comprar en Hotmart» abre ese link en una pestaña nueva (`rel="noopener"`). El curso se ve en la plataforma de Hotmart (quien compra crea allí su usuario y contraseña): el sitio no da acceso a cursos ni pide cuenta para comprar. Si el link está vacío, el botón queda desactivado como «Próximamente».
- **Suscripciones** (Aprendiz, Técnico, Premium): cada plan tiene su `hotmartCheckoutUrl` en `PLANS`. Hotmart avisa del pago al webhook `/api/hotmart/webhook` y el plan se **activa solo** para el correo del comprador.
- **Mi cuenta** (`mi-cuenta.html`): crear cuenta / ingresar, ver el plan y su vigencia, chat con el equipo (con cupo según el plan), material de su plan y videollamadas (Premium).
- **Panel del equipo** (`equipo.html`): suscriptores, preguntas por responder, responder y solicitudes de videollamada (confirmar, proponer otra hora, cancelar o entrar en una pestaña nueva).
- **Academia desactivada** (código dormido; ya no se usa para vender ni dar acceso a cursos). Las páginas `academia`, `mi-academia`, `leccion`, `certificado` e `ingresar` redirigen a `cursos.html`.
- `admin.html` es la maqueta anterior (catálogo, video y links guardados solo en el navegador). Muestra un aviso que apunta al panel real.

## Planes (precio en un solo lugar)

`assets/fa-config.js` → `PLANS` (lo usan la web y el servidor):

| Plan | Etiqueta | Clave | Precio mensual | Incluye |
|---|---|---|---|---|
| Plan Aprendiz | Inicial | `basico` | $5.000 CLP | 3 preguntas mensuales |
| Plan Técnico | Intermedio | `pro` | $10.000 CLP | Preguntas ilimitadas |
| Plan Premium | Premium | `premium` | $20.000 CLP | Ilimitadas + videollamadas + preguntas de otros + ebooks y biblioteca (próximamente) |

- El cupo de preguntas se cuenta por período pagado (la vigencia del acceso; si falta, los últimos 30 días). Solo cuentan los mensajes del cliente.
- Cambiar un precio en `PLANS` solo cambia lo que se muestra en el sitio: el cobro real lo define el producto en Hotmart.

## Cómo se activa una suscripción (Hotmart)

1. En `planes.html` el cliente pulsa «Suscribirme para preguntar» y paga en el link de Hotmart de su plan.
2. Hotmart envía el aviso (webhook v2.0.0) a `POST /api/hotmart/webhook` con el header `X-HOTMART-HOTTOK`; si no coincide con `HOTMART_HOTTOK` se responde 401.
3. Con `PURCHASE_APPROVED` o `PURCHASE_COMPLETE` el plan queda **activo** para `buyer.email` en la tabla `plan_access` (por correo, tenga o no cuenta). Con `PURCHASE_CANCELED`, `PURCHASE_REFUNDED` o `PURCHASE_CHARGEBACK` se **desactiva**. `SUBSCRIPTION_CANCELLATION` lo deja activo solo hasta la fecha ya pagada (`date_next_charge`) o lo desactiva si ya pasó. Cada renovación mensual llega como un nuevo `PURCHASE_APPROVED` y extiende la vigencia.
4. Es **idempotente** (el mismo evento dos veces no cambia nada; un evento más antiguo que el último aplicado se ignora) y todo queda en la tabla `hotmart_events`.
5. La persona vuelve a **`https://frioaustralspa.cl/mi-cuenta.html?compra=ok`** (página de agradecimiento de cada producto en Hotmart): crea su cuenta con el **mismo correo con que pagó** (o ingresa). El plan se vincula a la cuenta al registrarse o iniciar sesión. Si todavía no llegó el aviso de Hotmart, ve «Tu pago está siendo verificado».
6. `contenido.html` → *Accesos por plan* muestra las suscripciones, su estado y los últimos avisos; dar acceso a mano queda solo como respaldo.

**Mapeo producto → plan.** Se hace con `data.product.id` (el número que va dentro del código del link de pago: `D108538114T` → `108538114`), con `data.product.ucode` o con `data.purchase.offer.code`. Por defecto se derivan de los `hotmartCheckoutUrl` de los planes (Aprendiz `D108538114T`, Técnico `F108559411V`, Premium `W108559868U`). Si el primer aviso real llega como «Producto sin plan» en la pestaña de avisos, se corrige sin tocar código con la variable `HOTMART_PLAN_MAP` (JSON: `{"<id, ucode u offer.code>": "basico|pro|premium"}`).

### Conectar Hotmart
- Hotmart → *Herramientas → Webhook (Postback)* → URL `https://frioaustralspa.cl/api/hotmart/webhook`, versión **2.0.0**, eventos: Compra aprobada, Compra completa, Compra cancelada, Compra reembolsada, Chargeback y Cancelación de suscripción.
- Copiar el *hottok* a la variable `HOTMART_HOTTOK` en Vercel (Sensitive) y volver a publicar.
- En cada producto de suscripción: página de agradecimiento / redirección → `https://frioaustralspa.cl/mi-cuenta.html?compra=ok`.

## Datos (Supabase)

Proyecto dedicado **Frio Austral** (`kgxwjywupnnvceyziymj`, cuenta Supabase de Frío Austral). Migraciones aditivas: `20261112220000_suscripciones_mi_cuenta.sql`, `20261117130000_videollamadas.sql`, `20261119120000_material_planes_y_medios.sql`, `20261119121500_fa_has_plan_access_invoker.sql` y `20261119150000_hotmart_accesos.sql` (tablas `plan_access` y `hotmart_events`; **pendiente de aplicar** hasta tener el OK).

Tablas `subscribers`, `messages`, `admins`, `plan_access` y `hotmart_events`, todas con RLS: nadie escribe desde el navegador; las escrituras pasan por `/api` con la service role. La tabla `payments` (de cuando se cobraba con otra pasarela) sigue en la base pero ya no se usa.

## Variables de entorno

Ver `.env.example`. **Nunca** se suben claves a git.

| Variable | Dónde se obtiene | Secreta |
|---|---|---|
| `SUPABASE_URL` | `https://kgxwjywupnnvceyziymj.supabase.co` | No |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys (anon / publishable) | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys (service_role / secret) | **Sí** |
| `HOTMART_HOTTOK` | Hotmart → Herramientas → Webhook → token (hottok) | **Sí** |
| `HOTMART_PLAN_MAP` | Opcional. JSON que corrige el mapeo producto/oferta → plan | No |
| `ADMIN_EMAILS` | Correos del equipo (separados por coma) | No |
| `SITE_URL` | `https://frioaustralspa.cl` | No |

## Pasar a producción (checklist)

1. **Vercel**: proyecto `frioaustralweb` (framework *Other*, sin build ni output). Variables en *Production* y *Preview*: las de la tabla; `SUPABASE_SERVICE_ROLE_KEY` y `HOTMART_HOTTOK` como *Sensitive*.
2. **Supabase → Authentication → URL Configuration**: *Site URL* = `SITE_URL`; agrega `SITE_URL/mi-cuenta.html` en *Redirect URLs* (para recuperar contraseña).
3. **Migración** `20261119150000_hotmart_accesos.sql` (aditiva) aplicada en el proyecto de Supabase de Frío Austral.
4. **Cuenta del equipo**: Supabase → *Authentication → Users → Add user* (email + contraseña, *Auto confirm*) y su email en `ADMIN_EMAILS`.
5. **Hotmart**: webhook y páginas de agradecimiento (ver arriba). Pega los links de cada curso en `COURSES` (`hotmartCheckoutUrl`) cuando existan.
6. **Dominio**: agrégalo en Vercel y actualiza `SITE_URL` y la URL de Supabase Auth.

## Probar en local

```bash
npm test                   # pruebas (sin red: Supabase y Hotmart simulados)
python servidor_demo.py    # sitio estático (sin /api)
```

## Medios

Solo van a git imágenes optimizadas y videos de menos de ~5 MB (ver `.gitignore`). Quedan fuera los originales y `v1-hero-intro-1080.mp4` (5,3 MB) y `v2-curso-ac-1080.mp4` (7,7 MB); si se necesitan, se suben a un hosting externo y se apunta `window.FA_MEDIA_BASE`. El video del hero parte silenciado con el botón **Activar sonido**.

## Origen

No se modificaron `D:\PROYECTOS\frio-austral\demo-cliente`, `05-premium` ni `05-premium-media-preview`.

## Contenido del sitio (panel del equipo)

`contenido.html` (se entra con la misma cuenta del equipo que `equipo.html`; hay un botón en ese panel) tiene tres pestañas:

- **Material por plan**: se sube un archivo (PDF, EPUB, ZIP, Word, Excel, PowerPoint, texto, imagen o video, hasta 50 MB), se le pone título, categoría (Ebook, Biblioteca, Guía, Video, Recurso) y se elige a qué planes va (uno o varios). Los suscriptores lo ven en **Mi cuenta → Material** (y en Ebooks / Biblioteca del Plan Premium) y lo descargan con un enlace firmado de 2 minutos. Se puede ocultar, editar o eliminar.
- **Fotos y videos**: cada espacio del catálogo `assets/fa-slots.js` (portadas, secciones, galería del taller, reels, video de bienvenida y video del curso) se puede cambiar subiendo un archivo nuevo. «Volver al original» borra el archivo subido. Si no hay archivo nuevo o no carga, el sitio usa el archivo de siempre (`assets/fa-medios.js`).
- **Accesos por plan**: las suscripciones y su estado (activo, cancelado, vencido) que llegan solos desde el webhook de Hotmart, más los últimos avisos recibidos. Dar acceso a mano a un correo queda como respaldo.

### Cómo se controla el acceso

- Bucket **`plan-material` privado** (sin URL pública). El navegador nunca recibe la ruta del archivo: `/api/account?action=material-url` comprueba sesión, plan del material y suscripción vigente (estado activa, período no vencido) y recién ahí entrega una URL firmada de 120 segundos.
- RLS en `plan_materials` y en `storage.objects` (función `fa_has_plan_access`): aunque alguien use la API de Supabase directamente, solo ve lo asignado a su plan vigente. Escribir (subir, editar, borrar) solo lo hace `/api/admin` con la service role, y solo para cuentas del equipo.
- Bucket **`site-media` público** (son las mismas fotos que ve cualquier visitante); solo el equipo escribe.
- Subidas: el servidor entrega un token de subida de un solo uso para una ruta concreta; el archivo viaja directo del navegador a Storage (sin pasar por la función de Vercel, que tiene límite de 4,5 MB).

Migraciones (aditivas): `20261119120000_material_planes_y_medios.sql` y `20261119121500_fa_has_plan_access_invoker.sql`.

## Recursos gratis (gratis.html)
El equipo los administra en **contenido.html → Recursos gratis** (título, descripción, foto de referencia obligatoria y tipo):
- **Archivo** (PDF u otro documento) para descargar → sección «Documentos gratis».
- **Video con link** (YouTube u otro https; en YouTube la foto es opcional y se usa su miniatura) y **video corto subido** (mp4/webm, máx. 50 MB, el tope de Supabase Free) → sección «Videos gratis», junto a la tarjeta fija de YouTube.
- Una categoría sin recursos publicados no se muestra. Se puede publicar/ocultar, editar y eliminar (borra también los archivos del Storage).
- Datos: tabla `free_resources` y bucket público `free-resources` (migración aditiva `20261119190000_recursos_gratis.sql`; lectura pública solo de lo publicado, escritura solo por `/api/admin` con la service role). La lista pública sale de `GET /api/account?action=free-resources`.
- **La migración hay que aplicarla en Supabase antes de usar la pestaña** (hasta entonces la página solo muestra la tarjeta de YouTube).
