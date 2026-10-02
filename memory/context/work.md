# SoyGerman

PWA para agendar mensajes de WhatsApp. Un worker con sesión persistente los envía.

## Piezas

- `apps/web`: Next.js 16.3.6, React 19, Tailwind 4, HeroUI 3.2.6, Supabase (`@supabase/ssr`), PWA con `@ducanh2912/next-pwa`.
- `apps/worker`: Express, Baileys 7.0.0-rc14, `node-cron`, cliente de Supabase con service role.
- `supabase/migrations/20260928120000_init.sql`: esquema aplicado en el proyecto remoto.

Workspaces npm en la raíz: `dev:web`, `dev:worker`, `build:web`, `start:worker`.

## Datos

Proyecto Supabase `nbwxmkcwzqqxvxxfqqpn`. URL `https://nbwxmkcwzqqxvxxfqqpn.supabase.co`.

Tablas:

- `profiles`: se crea con el trigger `handle_new_user` al insertar en `auth.users`.
- `whatsapp_sessions`: una por usuario. Estados `disconnected`, `connecting`, `qr_ready`, `authenticating`, `connected`, `interrupted`. Realtime con `REPLICA IDENTITY FULL`. El dashboard se entera del QR, del escaneo, de una caída y del resultado por ese canal.
- `chats`: UUID propio, `wa_id` único por usuario. Directos y grupos. No se guarda historial de mensajes. No se borran al sincronizar. Al pasar la sesión a `disconnected`, el worker los borra. Los mensajes ya cerrados quedan con `chat_id` nulo. Los `pending` y `processing` pasan a `failed`. El teléfono de un directo es la parte numérica de un `wa_id` `@s.whatsapp.net` o `@c.us`. Un `@lid` no es un teléfono. PostgREST devuelve como máximo 1000 filas por consulta. Chats y Agendar filtran en Postgres por nombre o por esos dígitos y piden una página corta; no cargan la lista entera en el navegador.
- `scheduled_messages`: `pending`, `processing`, `sent`, `cancelled`, `failed`.

RLS: cada quien lee y escribe lo suyo. En mensajes agendados solo puede insertar `pending` y pasar de `pending` a `cancelled`. No puede falsificar `sent` o `failed`.

`claim_due_messages(batch_limit default 20)` la ejecuta solo `service_role`.

## Auth

Magic link con PKCE. El formulario llama `signInWithOtp` y el redirect es `{origen}/auth/callback`. Esa ruta cambia el `code` por sesión.

Rutas protegidas: `/dashboard`, `/chats`, `/schedule`, `/pending`, `/history`, `/settings`. Sin sesión vuelven a `/login`. El menú de escritorio es Inicio, Chats, Agendar y Configuración. En el teléfono el pie es Chats, Agendar y Configuración; el logo abre el inicio. Agendar, Pendientes e Historial comparten la vista de mensajes y cada una conserva su URL. Configuración tiene la cuenta en solo lectura, el tema y la vinculación de WhatsApp. El inicio resume los pendientes, los enviados de la semana (lunes a domingo, hora de Ciudad de México) y los fallidos acumulados.

## Worker

Un socket de Baileys por `user_id`. Las credenciales viven en `BAILEYS_DATA_PATH/session-<user_id>` (`useMultiFileAuthState`). No abre Chromium. El historial completo no se pide (`syncType` FULL se rechaza; el bootstrap y lo reciente sí, para LID y grupos). El dispositivo se anuncia como SoyGerman. Cómo se leía un intento trabado con Puppeteer está en `memory/references/sops/whatsapp-linking.md`.

Endpoints, todos con `x-worker-secret` y el JWT del usuario, salvo la salud:

- `GET /health`
- `POST /sessions/connect`
- `POST /sessions/disconnect`
- `POST /sync-chats`

El sync guarda grupos `@g.us` y chats directos `@c.us`, `@s.whatsapp.net` y `@lid`. Ignora `@broadcast` y `@newsletter`. Upsert por `(user_id, wa_id)` en lotes de 200. Junta lo que Baileys emite en chats y contactos, más `groupFetchAllParticipating`, y se queda con el id, el nombre y si es grupo. El número visible sale del propio `wa_id` cuando el host es `@s.whatsapp.net` o `@c.us`.

El cron es `* * * * *`. Si la sesión no está lista, el mensaje queda `failed` con «WhatsApp no está conectado para este usuario». Si sale, `sent`. Si `sendMessage` falla, `failed` y el error se corta a 500 caracteres. Un envío puede retrasarse hasta unos 60 segundos. Un `@c.us` guardado antes se manda como `@s.whatsapp.net`. Cada 8 s, mientras vincula, el worker anota la RAM del proceso.

## Dónde corre

- Web en Vercel, producción `https://www.soygerman.com` (el apex redirige ahí; `https://soygerman-rose.vercel.app` sigue activo). Directorio raíz `apps/web`. El build es `next build --webpack`.
- Worker en Render, workspace `tea-csp9avbgbbvc73ceiu30`, en línea desde el 2026-09-29. URL pública `https://webservice.soygerman.com`. Dockerfile en `apps/worker`, disco en `/data`, `BAILEYS_DATA_PATH=/data/baileys`, health `GET /health`, escucha `PORT`.
- Local: web `http://localhost:3000`, worker `http://localhost:3001`.

## Variables

Web: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `WORKER_API_SECRET`, `WORKER_URL`.

Worker: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_API_SECRET`, `WEB_ORIGIN`, `PORT`, `BAILEYS_DATA_PATH`.

El mismo `WORKER_API_SECRET` en ambas. El service role solo en el worker.

`WORKER_URL` tiene que ser absoluta y con esquema (`https://webservice.soygerman.com`). La web no llama a Render desde el navegador: `apps/web/app/actions/worker.ts` hace el POST en la función de Vercel. «El worker no está configurado» es una variable ausente. «No se pudo contactar al worker» es un `fetch` que lanzó, sin respuesta HTTP. «Error del worker» es un estado distinto de 2xx. El detalle está en `memory/references/sops/vercel.md`.

## Correo

Remitente previsto: `no-reply@soygerman.com` vía Resend (`smtp.resend.com`, puerto 465, usuario `resend`). La contraseña SMTP es la API key y no está en el repositorio. El correo de acceso ya llega. La Site URL y las redirect URLs tienen que incluir `https://www.soygerman.com/**`; si no, el enlace no vuelve a `/auth/callback`.
