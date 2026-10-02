# Registro de decisiones

Solo para añadir al final. Cuando se tome una decisión importante, regístrala aquí.

Formato: [AAAA-MM-DD] DECISIÓN: ... | RAZONAMIENTO: ... | CONTEXTO: ...

---

[2026-09-28] DECISIÓN: Monorepo npm con `apps/web` y `apps/worker` en este repositorio. | RAZONAMIENTO: La PWA y el worker comparten el mismo esquema y el mismo secreto de comunicación. | CONTEXTO: El remoto ya existía vacío en GitHub.

[2026-09-28] DECISIÓN: `chats.id` es UUID y el JID de WhatsApp vive en `wa_id`, único por `(user_id, wa_id)`. | RAZONAMIENTO: Dos cuentas pueden compartir el mismo grupo. El worker envía con `wa_id`. | CONTEXTO: El esquema original usaba el JID como clave primaria.

[2026-09-28] DECISIÓN: El cron reclama mensajes con `claim_due_messages()` y el estado `processing`. | RAZONAMIENTO: Dos ciclos solapados no deben enviar el mismo texto. Un mensaje `cancelled` no entra en esa consulta. | CONTEXTO: `FOR UPDATE SKIP LOCKED`. La función solo la ejecuta `service_role`.

[2026-09-28] DECISIÓN: La puerta de auth de Next.js 16 es `apps/web/proxy.ts`, no `middleware.ts`. | RAZONAMIENTO: En esta versión el archivo de middleware quedó en desuso. La sesión sigue en `apps/web/utils/supabase/middleware.ts`. | CONTEXTO: Magic link con PKCE y callback en `/auth/callback`.

[2026-09-28] DECISIÓN: `WORKER_API_SECRET` solo vive en el servidor. | RAZONAMIENTO: El navegador no debe poder hablarle al worker. Las server actions reenvían el secreto y el JWT del usuario. | CONTEXTO: El service role de Supabase solo está en el worker.

[2026-09-28] DECISIÓN: HeroUI 3 usa la clase `dark` en `<html>`. No hay `HeroUIProvider`. | RAZONAMIENTO: La versión instalada es la 3.2.6, con componentes compuestos y Tailwind 4. | CONTEXTO: El tema claro se guarda en `localStorage`.

[2026-09-28] DECISIÓN: El build de producción es `next build --webpack`. En desarrollo la PWA está apagada y Turbopack sigue activo. | RAZONAMIENTO: `@ducanh2912/next-pwa` inyecta webpack. Next 16 usa Turbopack por defecto y falla si hay un plugin de webpack sin una clave `turbopack`. | CONTEXTO: `apps/web/next.config.ts` define `turbopack: {}`.

[2026-09-28] DECISIÓN: Vercel despliega solo `apps/web`, con instalación `npm install --workspace=web`. | RAZONAMIENTO: El worker trae Chromium y no debe entrar en ese build. | CONTEXTO: Proyecto `weprograpp/soygerman`, directorio raíz `apps/web`. Producción: `https://soygerman-rose.vercel.app`.

[2026-09-28] DECISIÓN: `lightningcss-linux-x64-gnu` y `@tailwindcss/oxide-linux-x64-gnu` son dependencias opcionales de `apps/web`. | RAZONAMIENTO: El lockfile generado en macOS no instalaba el binario de Linux y el build de Vercel no compilaba los estilos. | CONTEXTO: El primer despliegue falló con `Cannot find module '../lightningcss.linux-x64-gnu.node'`.

[2026-09-28] DECISIÓN: `handle_new_user()` no se puede ejecutar desde la API. | RAZONAMIENTO: Es `SECURITY DEFINER` y solo debe correr como trigger al crear un usuario. | CONTEXTO: El advisor de Supabase lo marcó. Sigue creando el perfil.

[2026-09-28] DECISIÓN: El correo de acceso sale por Resend, remitente `no-reply@soygerman.com`, SMTP `smtp.resend.com:465`, usuario `resend`. | RAZONAMIENTO: El correo integrado de Supabase solo escribe a miembros del equipo y con un límite bajo. | CONTEXTO: La API key no se guarda en el repositorio. Al cierre del 2026-09-28 el panel de Supabase no tenía sesión y la CLI local no administra este proyecto, así que el SMTP aún no quedó aplicado.

[2026-09-28] DECISIÓN: La URL de producción para Auth es `https://www.soygerman.com`. | RAZONAMIENTO: Vercel redirige el apex `soygerman.com` a `www`. El magic link pide `{origen}/auth/callback`. Si esa URL no está permitida, Supabase manda el enlace a la Site URL y la sesión no se guarda. | CONTEXTO: El 28 de septiembre el enlace de `yamileliassoto@gmail.com` verificó en Auth y dejó `auth.sessions` vacía.

[2026-09-28] DECISIÓN: Cada actualización de la memoria se commitea sola, en el momento. | RAZONAMIENTO: Si queda sin commit, el siguiente cambio de código la arrastra. | CONTEXTO: Aplica a `AGENTS.md` y a `memory/`. `memory/local.md` no entra en git.

[2026-09-29] DECISIÓN: El worker de producción corre en Render, workspace `tea-csp9avbgbbvc73ceiu30`. | RAZONAMIENTO: Chromium y el disco de la sesión no caben en Vercel. | CONTEXTO: El servicio quedó en línea y las variables de Vercel y Render se actualizaron ese día. La URL pública no quedó escrita en la memoria.

[2026-09-29] DECISIÓN: La vinculación avisa al dashboard por Realtime de Supabase, con estados `connecting`, `qr_ready`, `authenticating` y `connected`. El QR se renueva solo (`qrMaxRetries: 0` en whatsapp-web.js 1.34.2). Un fallo duro reintenta el cliente hasta 3 veces. | RAZONAMIENTO: El navegador no debe abrir un socket al worker. El evento `authenticated` es el escaneo; `ready` es la sesión usable. La librería no rearma el cliente si el navegador se cae. | CONTEXTO: El clic en vincular no mostraba nada hasta que llegaba el QR.

[2026-09-29] DECISIÓN: Cada cambio terminado se commitea en el momento, en commits atómicos. El push sigue siendo un pedido aparte. | RAZONAMIENTO: El historial tiene que quedar aunque la tarea mezcle código y documentación. Un commit por tema evita arrastrar memoria con código o con cambios que ya estaban en el árbol. | CONTEXTO: `supabase/.temp/` no entra en git. Es caché local de la CLI.

[2026-09-29] DECISIÓN: `WORKER_URL` de producción es `https://webservice.soygerman.com`. | RAZONAMIENTO: Sin el esquema, `fetch` de la server action lanza «Failed to parse URL» y la UI dice «No se pudo contactar al worker». El host ya respondía `GET /health`. | CONTEXTO: El valor anterior era el host pelado. Render redirige el HTTP a HTTPS.

[2026-10-01] DECISIÓN: Al dejar la sesión en `disconnected`, el worker borra los chats de ese usuario. `scheduled_messages.chat_id` acepta nulo y, si el chat desaparece, queda en nulo. Pendientes y en proceso pasan a `failed` con «WhatsApp se desconectó». | RAZONAMIENTO: La lista de chats solo sirve mientras WhatsApp está vinculado. El historial ya dice «Chat eliminado» cuando no hay chat. | CONTEXTO: Tras desconectar, la sesión quedó `disconnected` y los chats siguieron en la tabla.

[2026-10-01] DECISIÓN: Antes de abrir Chromium se cierran procesos huérfanos de ese perfil y se quitan `SingletonLock`, `SingletonCookie` y `SingletonSocket`. Si el intento no llega a `ready`, se borra `session-<user_id>` y un cliente en `initializing` o `authenticating` deja de bloquear un clic nuevo a los 2 y 3 minutos. | RAZONAMIENTO: Un perfil a medio cerrar hace que `initialize` falle al instante y, tras 3 intentos, la pantalla diga que no se pudo vincular. | CONTEXTO: Los intentos del 2026-10-01 20:53 UTC escribieron la sesión cada ~3 s y terminaron en `disconnected` sin QR.

[2026-10-01] DECISIÓN: El worker registra cada 8 s el estado del socket de WhatsApp (`state`, `hasSynced` y un recorte de la pantalla) y, si el navegador ya está `CONNECTED` pero no llegó `authenticated`, llama a `onAppStateHasSyncedEvent`. El dispositivo vinculado se anuncia como SoyGerman. Un QR visible no se considera caducado hasta 5 minutos después del último código. | RAZONAMIENTO: whatsapp-web.js 1.34.7 solo emite `authenticated` y `ready` cuando `change:hasSynced` se dispara. Con el historial en pausa ese evento no llega, la fila se queda en `qr_ready` y Render no muestra nada más. | CONTEXTO: El 2026-10-01 22:07 UTC el teléfono ya listaba el Chrome y la base seguía en `qr_ready`.

[2026-10-02] DECISIÓN: El aviso de sincronización no se espera dentro de `page.evaluate`. Se dispara en el siguiente turno de la página, solo si el socket lleva dos lecturas en `CONNECTED` o `hasSynced`, y no si `WWebJS` ya existe. Si el navegador ya se cerró, el intento se rearma. | RAZONAMIENTO: `onAppStateHasSyncedEvent` es un binding de Puppeteer y, al ejecutarse, vuelve a llamar `page.evaluate` (`Runtime.addBinding`). Esperarlo desde otro `evaluate` cierra la página con «Target closed» en el momento del escaneo y el cliente sigue marcado en curso, así que un clic nuevo no abre otro QR. | CONTEXTO: El 2026-10-02 18:44 UTC el watch de `bbed4915-a816-4c74-ac2a-b7efa7e381b0` registró ese error al escanear.

[2026-10-02] DECISIÓN: Si el contenedor tiene menos de 900 MB, Chromium arranca en un solo proceso y con el heap de JS limitado. Cada 2 s se mide la RAM libre y, si queda por debajo de 72 MB o el uso pasa del 90 %, se cierra ese navegador sin reintentar. Al arrancar solo se restaura un perfil marcado listo; un perfil a medias se borra. | RAZONAMIENTO: WhatsApp Web sube de golpe al escanear el QR. En una instancia chica ese pico hace que Render mate el proceso y, al volver, el perfil a medias abre otro Chromium. | CONTEXTO: Un segundo intento de vincular reinició el servicio de Render el 2026-10-02.

[2026-10-02] DECISIÓN: Si el navegador deja de estar listo, la fila pasa a `interrupted` antes de esperar a que Chromium cierre. Al arrancar, una fila `connected` sin cliente también pasa a `interrupted`. Un `authenticated` posterior no baja una sesión que ya está `ready`. | RAZONAMIENTO: La interfaz solo lee la fila. Si el cierre se cuelga, el chip se queda en conectado y sincronizar responde que no hay sesión. | CONTEXTO: El 2026-10-02 19:12 UTC la cuenta `bbed4915-a816-4c74-ac2a-b7efa7e381b0` quedó `connected` con cero chats y el teléfono mostró el historial en pausa.

[2026-10-02] DECISIÓN: La sincronización no usa `Client#getChats`. Lee los modelos de `WAWebCollections.Chat` y guarda id, nombre y si es grupo, sin repetir `wa_id` en el mismo lote. | RAZONAMIENTO: `getChats` espera `groupMetadata.update` y el último mensaje de cada chat. Uno que falle rechaza todo el lote y el POST responde 500. | CONTEXTO: El 2026-09-29 la sesión estaba `connected`, `chats` seguía vacía y el worker del puerto 3001 aún ejecutaba el código anterior: `node --watch` no recargó mientras Chromium seguía abierto.

[2026-10-02] DECISIÓN: Agendar, Pendientes e Historial viven en una sola vista con tabs y conservan `/schedule`, `/pending` y `/history`. La vinculación, el tema y la cuenta quedan en `/settings`. El dashboard resume pendientes, enviados de lunes a domingo en `America/Mexico_City` y fallidos acumulados. | RAZONAMIENTO: Vincular es de una sola vez y el correo con el tema no hacen falta en cada pantalla. La semana se cuenta por la hora agendada porque no hay `sent_at`. | CONTEXTO: El menú de escritorio es Inicio, Chats, Agendar y Configuración. En el teléfono el pie omite Inicio; el logo abre el dashboard.
