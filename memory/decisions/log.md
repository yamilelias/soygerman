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
