# SoyGerman

PWA para agendar mensajes de WhatsApp. Un worker con sesión persistente los envía.

## Piezas

- `apps/web`: Next.js 16.3.6, React 19, Tailwind 4, HeroUI 3.2.6, Supabase (`@supabase/ssr`), PWA con `@ducanh2912/next-pwa`. El manifiesto abre en `/`, trae iconos de 192 y 512, y en producción se registra `/sw.js`. En el iPhone hace falta la meta `apple-mobile-web-app-capable` para añadirlo a la pantalla de inicio.
- `apps/worker`: Express, Baileys 7.0.0-rc14, `node-cron`, cliente de Supabase con service role.
- `supabase/migrations/20260928120000_init.sql`: esquema aplicado en el proyecto remoto.

Workspaces npm en la raíz: `dev:web`, `dev:worker`, `build:web`, `start:worker`.

## Datos

Proyecto Supabase `nbwxmkcwzqqxvxxfqqpn`. URL `https://nbwxmkcwzqqxvxxfqqpn.supabase.co`.

Tablas:

- `profiles`: se crea con el trigger `handle_new_user` al insertar en `auth.users`.
- `whatsapp_sessions`: una por usuario. Estados `disconnected`, `connecting`, `qr_ready`, `authenticating`, `connected`, `interrupted`. Realtime con `REPLICA IDENTITY FULL`. El dashboard se entera del QR, del escaneo, de una caída y del resultado por ese canal.
- `whatsapp_auth_files`: copia de `creds.json` cuando ya hay `me.id` o `registered` es true. Solo el service role. No está en Realtime. Sirve para reabrir el socket sin QR.
- `chats`: UUID propio, `wa_id` único por usuario. Directos y grupos. No se guarda el historial. Sí la clave del último mensaje (`last_message_key`: id, fromMe, participant) para pedir contexto en el resumen, y el no leído: `unread_count`, `marked_unread`, `archived` (no entra en Sin leer), `unread_since` (el entrante sin leer más viejo que llegó en el sync reciente; un solo no leído usa la hora de ese mensaje; marcada a mano y ya leída no inventa fecha) y el último texto (`last_message_preview`, `last_message_at`, `last_message_from_me`). Esas columnas se escriben solo cuando el worker las conoce, para no borrarlas en un upsert de solo nombre. No se borran al sincronizar. `hidden` saca un chat de Chats, de Agendar y de Sin leer; el upsert no escribe esa columna, así que no reaparece. Al quitarlo, sus mensajes `pending` pasan a `cancelled`. Al pasar la sesión a `disconnected`, el worker los borra. Los mensajes ya cerrados quedan con `chat_id` nulo. Los `pending` y `processing` pasan a `failed`. El teléfono de un directo es la parte numérica de un `wa_id` `@s.whatsapp.net` o `@c.us`. Un `@lid` no es un teléfono. PostgREST devuelve como máximo 1000 filas por consulta. Chats y Agendar filtran en Postgres por nombre o por esos dígitos y piden una página corta; no cargan la lista entera en el navegador.
- `scheduled_messages`: `pending`, `processing`, `sent`, `cancelled`, `failed`.
- `daily_digests`: un resumen por usuario y fecha de Ciudad de México. Estados `running`, `ready`, `empty`, `failed`. Guarda el párrafo y las acciones (`chat_id`, `name`, `action`), no el hilo. La persona solo lee el suyo. Lo escribe el service role.

RLS: cada quien lee y escribe lo suyo. En mensajes agendados solo puede insertar `pending` y pasar de `pending` a `cancelled`. No puede falsificar `sent` o `failed`. El resumen diario solo se lee.

`claim_due_messages(batch_limit default 20)` la ejecuta solo `service_role`.

## Auth

Magic link con PKCE. El formulario llama `signInWithOtp` con `shouldCreateUser: false` y el redirect es `{origen}/auth/callback`. Esa ruta cambia el `code` por sesión. Un correo nuevo no crea cuenta: el alta es la invitación desde el panel de Supabase.

Rutas protegidas: `/dashboard`, `/chats`, `/schedule`, `/pending`, `/history`, `/settings`. Sin sesión vuelven a `/login`. Si no hay chats visibles ni mensajes, esas rutas muestran solo el cuadro para conectar WhatsApp. El menú de escritorio es Inicio, Chats, Agendar y Configuración, en una columna de `100vh`. En el teléfono el pie es Chats, Agendar y Configuración; el logo abre el inicio. Agendar, Pendientes e Historial comparten la vista de mensajes y cada una conserva su URL. Al abrir Agendar, la fecha queda en el día siguiente a la hora en que se abrió la vista. Configuración tiene la cuenta en solo lectura, el tema y la vinculación de WhatsApp. El inicio abre con Para hoy: el resumen de esa fecha, o el aviso de que sale a las 6:00 si aún no hay fila. Después lista las conversaciones sin leer y las marcadas como no leídas, con el último texto y un enlace a Agendar (`/schedule?chat=`). Abajo siguen los pendientes, los enviados de la semana (lunes a domingo, hora de Ciudad de México) y los fallidos acumulados.

## Worker

Un socket de Baileys por `user_id`. La credencial vive en `BAILEYS_DATA_PATH/session-<user_id>` (`useMultiFileAuthState`) y, en cuanto `creds.json` trae `me.id`, se copia en `whatsapp_auth_files`. Baileys 7 no pone `registered` al emparejar; el login mira `me.id`. Un corte 428 o 408 reabre ese archivo: no pide otro QR ni borra los chats. Un perfil con `me.id` no se borra al arrancar. El navegador no puede leer esa tabla. Los chats se borran solo si la persona desconecta o WhatsApp cierra la sesión (401). No abre Chromium. El historial completo no se pide (`syncType` FULL se rechaza; el bootstrap y lo reciente sí, para LID y grupos). El dispositivo se anuncia como SoyGerman. Cómo se leía un intento trabado con Puppeteer está en `memory/references/sops/whatsapp-linking.md`.

Endpoints, todos con `x-worker-secret` y el JWT del usuario, salvo la salud:

- `GET /health`
- `POST /sessions/connect`
- `POST /sessions/disconnect`
- `POST /sync-chats`. Al quedar la sesión lista, el worker lo llama solo, unos segundos después del último lote de chats. La pantalla también lo pide al pasar a conectado.
- `POST /digests/run`. Genera otra vez el resumen de hoy para quien llama. El cron de las 6:00 no lo regenera si ya quedó `ready` o `empty`.

El sync guarda grupos `@g.us` y chats directos `@c.us`, `@s.whatsapp.net` y `@lid`. Ignora `@broadcast` y `@newsletter`. Upsert por `(user_id, wa_id)` en lotes de 200. Junta lo que Baileys emite en chats, contactos y mensajes, más `groupFetchAllParticipating`. Se queda con el id, el nombre, si es grupo, el no leído y el último texto. Un mensaje nuevo con la sesión ya abierta se escribe unos segundos después, sin repetir toda la lista. Al abrir el inicio se vuelve a pedir el estado de leído (`regular_low`): un conteo 0 deja la conversación leída y uno negativo la deja marcada como no leída. Un mensaje propio que llega en vivo también la marca leída. El número visible sale del propio `wa_id` cuando el host es `@s.whatsapp.net` o `@c.us`.

Si la lista se corta en una letra, cuenta primero las filas de `chats`. El 2026-10-02 había 2618 guardados y la pantalla llegaba a la E: una sola consulta, ordenada por nombre, devuelve 1000 y cae a mitad de esa letra. No era un sync a medias. La búsqueda del número lleva un `%` antes del `@` (`%521%@s.whatsapp.net`). Sin ese `%` solo entran los que terminan en esos dígitos. Un `@lid` no se muestra ni se busca como teléfono.

El cron de envío es `* * * * *`. Si la sesión no está lista, el mensaje queda `failed` con «WhatsApp no está conectado para este usuario». Si sale, `sent`. Si `sendMessage` falla, `failed` y el error se corta a 500 caracteres. Un envío puede retrasarse hasta unos 60 segundos. Un `@c.us` guardado antes se manda como `@s.whatsapp.net`. Cada 8 s, mientras vincula, el worker anota la RAM del proceso.

Otro cron, `0 6 * * *` en `America/Mexico_City`, resume los chats sin leer y no archivados de cada sesión `connected`. El modelo es `gpt-6-luna` por LangChain (`apps/worker/llm.js`); `DIGEST_MODEL` lo cambia sin tocar el flujo. Lotes de 40, tope 200. Si el último texto no alcanza, pide 5 mensajes a WhatsApp y no los guarda. Sin chats sin leer queda `empty` y no llama al modelo.

## Dónde corre

- Web en Vercel, producción `https://www.soygerman.com` (el apex redirige ahí; `https://soygerman-rose.vercel.app` sigue activo). Directorio raíz `apps/web`. El build es `next build --webpack`.
- Worker en Render, workspace `tea-csp9avbgbbvc73ceiu30`, en línea desde el 2026-09-29. URL pública `https://webservice.soygerman.com`. Dockerfile en `apps/worker`, disco en `/data`, `BAILEYS_DATA_PATH=/data/baileys`, health `GET /health`, escucha `PORT`.
- Local: web `http://localhost:3000`, worker `http://localhost:3001`.

## Variables

Web: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `WORKER_API_SECRET`, `WORKER_URL`.

Worker: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_API_SECRET`, `WEB_ORIGIN`, `PORT`, `BAILEYS_DATA_PATH`, `OPENAI_API_KEY`. Opcional: `DIGEST_MODEL` (si falta, `gpt-6-luna`).

El mismo `WORKER_API_SECRET` en ambas. El service role solo en el worker.

`WORKER_URL` tiene que ser absoluta y con esquema (`https://webservice.soygerman.com`). La web no llama a Render desde el navegador: `apps/web/app/actions/worker.ts` hace el POST en la función de Vercel. «El worker no está configurado» es una variable ausente. «No se pudo contactar al worker» es un `fetch` que lanzó, sin respuesta HTTP. «Error del worker» es un estado distinto de 2xx. El detalle está en `memory/references/sops/vercel.md`.

## Correo

Remitente previsto: `no-reply@soygerman.com` vía Resend (`smtp.resend.com`, puerto 465, usuario `resend`). La contraseña SMTP es la API key y no está en el repositorio. El correo de acceso ya llega. La Site URL y las redirect URLs tienen que incluir `https://www.soygerman.com/**`; si no, el enlace no vuelve a `/auth/callback`.
