# Frío Austral — sitio web (v5)

Sitio estático con estilo *Patagonia nocturna*. Esta copia parte de la demo del cliente (`demo-cliente`, 5 de noviembre de 2026).

## Estado actual

- **La Academia está desactivada**, pero **todo su código se mantiene** (páginas, login, temario, lecciones, certificado, `assets/academia*.js`, panel admin).
- Cada botón **Comprar curso** abre el checkout de Hotmart en una pestaña nueva.
- La **suscripción para preguntar / hablar con el equipo** se paga con **Flow**. El cobro real queda pendiente hasta tener cuenta, precios confirmados y definir qué ocurre después del pago.

No hay un repositorio GitHub ni un proyecto de Vercel de Frío Austral todavía. Esta carpeta está lista para subirse a `MathiasAlejandr0` cuando Mathias lo autorice.

## Cómo reactivar la Academia

1. En `assets/fa-config.js`, cambia `ACADEMIA_ENABLED` a `true`.
2. Vuelve a publicar el sitio.
3. Con eso regresan el enlace Academia, Ingresar / crear cuenta, el campus y el pago de prueba interno. Los botones Comprar curso dejan de ir a Hotmart (vuelven al campus).
4. El pago de la suscripción **sigue siendo por Flow**, aunque la Academia esté encendida.

## Cómo probar en local

```bash
python servidor_demo.py
```

o el acceso directo `Abrir demo Frío Austral.bat`.

Los pagos de Flow no corren en el servidor estático de Python: hace falta un deploy con las funciones de `/api` (por ejemplo Vercel) y las variables de `.env.example`.

```bash
npm test
```

## Flow (suscripción)

Variables (ver `.env.example`):

- `FLOW_API_KEY`, `FLOW_SECRET_KEY`
- `FLOW_API_URL` (por defecto sandbox: `https://sandbox.flow.cl/api`)
- `SITE_URL` (URL pública, para el retorno y el webhook)
- `FLOW_PLAN_AMOUNTS` (obligatoria para cobrar; no se inventan precios)
- `FLOW_BILLING_TYPE` (`one_time` implementado; `subscription` recurrente queda como TODO)
- `FLOW_SUCCESS_WHATSAPP` (opcional, se muestra después de un pago exitoso)

Endpoints:

- `POST /api/flow/create` — crea el pago y devuelve la URL de Flow
- `GET|POST /api/flow/confirm` — webhook de Flow (`urlConfirmation`)
- `GET|POST /api/flow/return` — vuelta del pagador (`urlReturn`) → `pago-return.html`

Hasta que existan las claves y los montos, el botón de suscribirse muestra un aviso claro y **no simula** un pago exitoso.

Pendiente de confirmar: precio de cada plan, si el cobro es mensual recurrente o un pago, y qué recibe la persona después (WhatsApp, bandeja de consultas u otra cosa). El webhook aún no guarda la suscripción en una base de datos.

## Medios

Los videos `.mp4` / `.webm` no van a git (pesan más de ~5 MB). Quedan en la carpeta local para la previsualización. Las fotos derivadas (WebP/AVIF/JPG) sí se versionan.

## Origen

Trabajo hecho sobre una **copia nueva**. No se modificaron `D:\PROYECTOS\frio-austral\demo-cliente`, `05-premium` ni `05-premium-media-preview`.