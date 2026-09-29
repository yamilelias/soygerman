# SoyGerman

PWA para agendar mensajes de WhatsApp. Un worker con sesión persistente los envía.

## Piezas

- `apps/web`: Next.js 16.3.6, React 19, Tailwind 4, HeroUI 3.2.6, Supabase (`@supabase/ssr`), PWA con `@ducanh2912/next-pwa`.
- `apps/worker`: Express, `whatsapp-web.js`, Puppeteer, `node-cron`, cliente de Supabase con service role.
- `supabase/migrations/20260928120000_init.sql`: esquema aplicado en el proyecto remoto.

Workspaces npm en la raíz: `dev:web`, `dev:worker`, `build:web`, `start:worker`.

## Datos

Proyecto Supabase `nbwxmkcwzqqxvxxfqqpn`. URL `https://nbwxmkcwzqqxvxxfqqpn.supabase.co`.

Tablas:

- `profiles`: se crea con el trigger `handle_new_user` al insertar en `auth.users`.
- `whatsapp_sessions`: una por usuario. Estados `disconnected`, `connecting`, `qr_ready`, `authenticating`, `connected`. Realtime con `REPLICA IDENTITY FULL`. El dashboard se entera del QR, del escaneo y del resultado por ese canal.
- `chats`: UUID propio, `wa_id` único por usuario. Directos y grupos. No se guarda historial de mensajes. No se borran al sincronizar.
- `scheduled_messages`: `pending`, `processing`, `sent`, `cancelled`, `failed`.

RLS: cada quien lee y escribe lo suyo. En mensajes agendados solo puede insertar `pending` y pasar de `pending` a `cancelled`. No puede falsificar `sent` o `failed`.

`claim_due_messages(batch_limit default 20)` la ejecuta solo `service_role`.

## Auth

Magic link con PKCE. El formulario llama `signInWithOtp` y el redirect es `{origen}/auth/callback`. Esa ruta cambia el `code` por sesión.

Rutas protegidas: `/dashboard`, `/chats`, `/schedule`, `/pending`, `/history`, `/settings`. Sin sesión vuelven a `/login`. `/settings` redirige al dashboard.

## Worker

Un cliente de `whatsapp-web.js` por `user_id`, con `LocalAuth({ clientId: userId })`.

Endpoints, todos con `x-worker-secret` y el JWT del usuario, salvo la salud:

- `GET /health`
- `POST /sessions/connect`
- `POST /sessions/disconnect`
- `POST /sync-chats`

El sync guarda grupos `@g.us` y chats directos `@c.us`, `@s.whatsapp.net` y `@lid`. Ignora `@broadcast` y `@newsletter`. Upsert por `(user_id, wa_id)` en lotes de 200.

El cron es `* * * * *`. Si la sesión no está lista, el mensaje queda `failed` con «WhatsApp no está conectado para este usuario». Si sale, `sent`. Si `sendMessage` falla, `failed` y el error se corta a 500 caracteres. Un envío puede retrasarse hasta unos 60 segundos. Cada Chromium activo pide cerca de 1 GB de RAM.

## Dónde corre

- Web en Vercel, producción `https://soygerman-rose.vercel.app`. Directorio raíz `apps/web`. El build es `next build --webpack`.
- Worker en Render, workspace `tea-csp9avbgbbvc73ceiu30`, en línea desde el 2026-09-29. Dockerfile en `apps/worker`, disco en `/data`, `WWEBJS_DATA_PATH=/data/wwebjs`, Chromium en `/usr/bin/chromium`, health `GET /health`, escucha `PORT`. La URL pública falta en esta nota.
- Local: web `http://localhost:3000`, worker `http://localhost:3001`.

## Variables

Web: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `WORKER_API_SECRET`, `WORKER_URL`.

Worker: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_API_SECRET`, `WEB_ORIGIN`, `PORT`, `WWEBJS_DATA_PATH`, `PUPPETEER_EXECUTABLE_PATH`.

El mismo `WORKER_API_SECRET` en ambas. El service role solo en el worker.

## Correo

Remitente previsto: `no-reply@soygerman.com` vía Resend (`smtp.resend.com`, puerto 465, usuario `resend`). La contraseña SMTP es la API key y no está en el repositorio. El correo de acceso ya llega. La Site URL y las redirect URLs tienen que incluir `https://www.soygerman.com/**`; si no, el enlace no vuelve a `/auth/callback`.
