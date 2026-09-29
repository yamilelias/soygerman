# SoyGerman

Mensajes programados de WhatsApp: una PWA en Next.js y un worker con `whatsapp-web.js`.

## Estructura

- `apps/web` — interfaz (Next.js, HeroUI, Supabase, PWA)
- `apps/worker` — sesión de WhatsApp, sincronización de chats y cron de envío
- `supabase/migrations` — esquema para pegar en el SQL Editor

Next.js 16 protege las rutas en `apps/web/proxy.ts` (el reemplazo de `middleware.ts`). La lógica de sesión está en `apps/web/utils/supabase/middleware.ts`.

## Puesta en marcha

1. Crea un proyecto en Supabase y ejecuta `supabase/migrations/20260928120000_init.sql`.
2. En Authentication → URL Configuration, permite `http://localhost:3000/auth/callback` y la URL de producción.
3. Copia `apps/web/.env.example` a `apps/web/.env.local` y `apps/worker/.env.example` a `apps/worker/.env`.
4. Usa la misma `WORKER_API_SECRET` en ambas apps. El service role solo va en el worker.
5. Instala y arranca:

```bash
npm install
npm run dev:web
npm run dev:worker
```

La web queda en `http://localhost:3000` y el worker en el puerto `3001`.

`npm run build:web` usa Webpack (`next build --webpack`) porque el plugin PWA no corre con Turbopack. En desarrollo la PWA queda apagada.

## Web en Vercel

El proyecto es [weprograpp/soygerman](https://vercel.com/weprograpp/soygerman). El directorio raíz es `apps/web` y el build ejecuta `npm run build`. La instalación solo trae el workspace `web`, para no bajar Chromium del worker.

Variables en Production y Preview:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `WORKER_API_SECRET`
- `WORKER_URL`

Después del primer despliegue, agrega la URL de producción en Supabase → Authentication → URL Configuration, con el comodín `https://<tu-dominio>/**`.

## Correo con Resend

El magic link lo envía Supabase Auth. En [SMTP](https://supabase.com/dashboard/project/nbwxmkcwzqqxvxxfqqpn/auth/smtp) usa la cuenta de Resend:

- Host: `smtp.resend.com`
- Puerto: `465`
- Usuario: `resend`
- Contraseña: la API key de Resend
- Remitente: un correo de un dominio verificado en Resend, por ejemplo `SoyGerman <no-reply@tu-dominio>`

Sin ese SMTP, Supabase solo manda el enlace a los miembros del equipo y con un límite bajo.

## Worker en Render

- Web Service con Dockerfile `apps/worker/Dockerfile` y contexto `apps/worker`.
- Disco persistente montado en `/data`. `WWEBJS_DATA_PATH=/data/wwebjs`.
- Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_API_SECRET`, `WEB_ORIGIN`, `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`.
- Health check: `GET /health`.
- El proceso escucha `PORT`. Cada sesión activa abre un Chromium; calcula cerca de 1 GB de RAM por usuario conectado.

El cron corre cada minuto. Un mensaje sale en el minuto programado, con hasta ~60 segundos de retraso. `claim_due_messages()` evita un envío doble si el ciclo se solapa. Un mensaje `cancelled` no entra en esa consulta.
