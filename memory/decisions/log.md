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

[2026-10-02] DECISIÓN: El worker deja Chromium y usa Baileys 7.0.0-rc14. La credencial va a `/data/baileys`. No se pide el historial completo. Un perfil de `whatsapp-web.js` no se migra. | RAZONAMIENTO: En el plan de 512 MB WhatsApp Web tumba el contenedor, y topar Puppeteer o enlazar el QR en una función de Vercel no quita el navegador del envío. Un socket cabe en la instancia que ya está. | CONTEXTO: Render mató el servicio con «Ran out of memory (used over 512MB)».

[2026-10-02] DECISIÓN: `chats.phone` guarda solo dígitos. Chats y Agendar buscan en Postgres por nombre o por ese número, en páginas cortas. | RAZONAMIENTO: Un `@lid` no es un teléfono, y meter miles de filas en el dropdown vuelve a topar el límite de 1000. | CONTEXTO: De 2618 chats, 1531 ya traían el número en el JID y 890 eran LID.

[2026-10-02] DECISIÓN: No hay columna `phone`. El número se lee del `wa_id` `@s.whatsapp.net` o `@c.us`, y la búsqueda filtra esa columna. | RAZONAMIENTO: Esos JID ya son el teléfono. Un `@lid` es otro identificador y mostrarlo como número confunde. | CONTEXTO: 1530 de 1531 `@s.whatsapp.net` son dígitos; 890 `@lid` no empiezan como un teléfono de México.

[2026-10-02] DECISIÓN: Un cierre 428 o 408 con credencial registrada reabre el socket. La credencial se copia en `whatsapp_auth_files` y los chats solo se borran al desconectar o con logout 401. | RAZONAMIENTO: Ese código es un corte del WebSocket, no un desvinculado. Tratarlo como vinculación nueva borraba `creds.json` y, al agotar 3 intentos, vaciaba `chats`. | CONTEXTO: El 2026-10-03 00:06 UTC la cuenta `bbed4915-a816-4c74-ac2a-b7efa7e381b0` recibió 428, pasó a QR y a las 00:11 quedó `disconnected` con los chats borrados. El teléfono seguía listando el dispositivo.

[2026-10-02] DECISIÓN: Chats y Agendar no leen `chats` en una sola consulta. El teléfono se busca con `wa_id ilike '%dígitos%@s.whatsapp.net'`. | RAZONAMIENTO: El tope de PostgREST es 1000. Ordenado por nombre, eso cae a mitad de la E y parece que el sync se detuvo. Un `%` pegado al `@` solo acierta números que terminan en esos dígitos. | CONTEXTO: Había 2618 chats guardados y la lista visible llegaba a la E. `521` con el patrón correcto devolvió 1344 `@s.whatsapp.net` y ningún `@lid`.

[2026-10-02] DECISIÓN: Agendar abre con el día siguiente, a la hora en que se abrió la vista. | RAZONAMIENTO: La fecha vacía obligaba a rellenar el campo más repetido. Mañana a esta hora es el valor que casi siempre se quiere. | CONTEXTO: El control sigue exigiendo una hora futura.

[2026-10-02] DECISIÓN: Quitar un chat pone `chats.hidden` y cancela sus pendientes. El sync no escribe `hidden`. | RAZONAMIENTO: Borrar la fila no sirve: el siguiente upsert la crea otra vez. La lista tiene que quedarse solo con los chats que la persona quiere para recordatorios. | CONTEXTO: Al desconectar, el worker sigue borrando todas las filas, ocultas incluidas.

[2026-10-02] DECISIÓN: El magic link no crea cuentas. El alta es una invitación desde Supabase. | RAZONAMIENTO: La página de login no debe registrar a quien llegue con un correo. Quien ya existe sigue pidiendo el enlace. | CONTEXTO: `shouldCreateUser: false`. El interruptor «Allow new users to sign up» del panel cierra el mismo hueco si alguien llama la API directo.

[2026-10-02] DECISIÓN: Al quedar WhatsApp listo, los chats se sincronizan solos. | RAZONAMIENTO: El botón era un paso de más justo después de escanear el QR. El worker espera a que llegue la lista; la pantalla también pide el sync al ver `connected`, por si el proceso de Render aún no trae este cambio. | CONTEXTO: `POST /sync-chats` sigue disponible para repetirlo.

[2026-10-02] DECISIÓN: Sin chats visibles ni mensajes, la app solo muestra el cuadro de WhatsApp. | RAZONAMIENTO: Una cuenta nueva no puede agendar ni revisar nada. El primer paso es vincular. | CONTEXTO: En cuanto el sync deja chats, vuelve el menú. Si ya hay historial de mensajes, el menú se queda aunque no haya chats.

[2026-10-02] DECISIÓN: La PWA abre en `/`, registra `/sw.js` en producción y declara `apple-mobile-web-app-capable`. | RAZONAMIENTO: Android pide manifiesto, iconos de 192 y 512 y un service worker con `fetch`. Safari sigue mirando la meta de Apple para instalar en la pantalla de inicio. `start_url` en `/dashboard` redirige si no hay sesión. | CONTEXTO: En desarrollo el plugin sigue apagado. El archivo `sw.js` lo genera el build.

[2026-10-02] DECISIÓN: El inicio muestra chats con `unread_count` > 0 o `marked_unread`, el último texto y desde cuándo. No se guarda el hilo. | RAZONAMIENTO: Con la sesión abierta se puede responder lo que sigue pendiente sin buscar el chat a mano. La fecha es el entrante sin leer más viejo que trajo el sync reciente; si solo está marcada, no hay una hora fiable. | CONTEXTO: El worker la escribe al sincronizar y, ya conectado, unos segundos después de cada cambio. Agendar abre `/schedule?chat=`.

[2026-10-03] DECISIÓN: Un chat con `archived` no entra en Sin leer. | RAZONAMIENTO: Archivarlo es sacarlo de lo pendiente. Sigue en la lista de chats. | CONTEXTO: Baileys manda `archived` en el chat. El inicio filtra `archived = false`.

[2026-10-04] DECISIÓN: Al abrir el inicio se relee el estado de leído en WhatsApp. | RAZONAMIENTO: Responder en el teléfono no llegaba al conteo guardado, y Sin leer seguía mostrando esas conversaciones. | CONTEXTO: `POST /refresh-unread` pide `regular_low` y guarda enseguida. Mientras tanto, el título dice Actualizando.

[2026-10-04] DECISIÓN: Esa relectura baja `regular_low` desde cero y aplica la marca de leído hasta el mensaje que cubre. | RAZONAMIENTO: La sincronización inicial ya había consumido esas marcas como “ya leído” y el inicio no las volvía a ver, así que la lista solo crecía. Un entrante posterior a la marca se conserva. | CONTEXTO: También se limpia si el último mensaje guardado es propio y el chat no está marcado a mano.

[2026-10-05] DECISIÓN: Un `unreadCount` null quita la marca de no leído. | RAZONAMIENTO: WhatsApp manda null cuando la conversación ya no está marcada, y el worker lo dejaba pasar, así que el conteo viejo seguía en Sin leer. Un entrante posterior a la marca no conserva ese número: queda en 1. | CONTEXTO: Al abrir el inicio se cargan los no leídos ya guardados para poder aplicar la marca.

[2026-10-06] DECISIÓN: El historial inicial y sincronizar chats no reescriben el no leído. | RAZONAMIENTO: En la cuenta antigua el conteo ya no coincidía con el teléfono, y sincronizar lo volvía a guardar. Un mensaje nuevo con la sesión abierta sigue marcando la conversación. | CONTEXTO: Se limpiaron a mano los no leídos visibles de `bbed4915-a816-4c74-ac2a-b7efa7e381b0`.

[2026-10-03] DECISIÓN: Una credencial se puede reabrir si `creds.json` trae `me.id` o `registered: true`. | RAZONAMIENTO: Baileys 7.0.0-rc14 entra con `creds.me` (`generateLoginNode`). `configureSuccessfulPairing` no escribe `registered`. Exigir solo esa bandera dejaba `whatsapp_auth_files` vacía y, al reemplazar el proceso, el arranque borraba el perfil como si fuera un QR a medias. | CONTEXTO: El 2026-10-03 la cuenta `bbed4915-a816-4c74-ac2a-b7efa7e381b0` quedó `connected` a las 03:24 UTC, con 733 chats, y a las 04:22 UTC el proceso `m68zv` la pasó a `interrupted`. La tabla de credenciales seguía en cero.

[2026-10-03] DECISIÓN: El resumen diario no guarda el hilo. A las 6:00 de Ciudad de México, `gpt-6-luna` (LangChain, Responses API) lee los chats sin leer y no archivados, y solo si el último texto no alcanza pide cinco mensajes a WhatsApp. En `daily_digests` queda el párrafo y la acción. | RAZONAMIENTO: El inicio tiene que decir qué hacer ese día sin convertir `chats` en un historial. LangChain deja el modelo en un solo módulo para cambiarlo con `DIGEST_MODEL`. | CONTEXTO: Un día `ready` o `empty` no se regenera. `POST /digests/run` sí. Tope de 200 chats, en lotes de 40. La clave `OPENAI_API_KEY` vive en Render.

[2026-10-05] DECISIÓN: `/` es la página pública de la marca. Quien llega al index la ve, tenga sesión o no. El botón va a `/dashboard` si hay sesión y a `/login` si no. La PWA abre en `/dashboard`. | RAZONAMIENTO: soygerman.com tiene que poder promocionarse. El panel sigue protegido y el icono instalado no abre la promo. | CONTEXTO: Primario `#7A0505`, acento `#1C1C1C`, titulares en Montserrat. El apex sigue redirigiendo a `www`.

[2026-10-06] DECISIÓN: Quitar una conversación del inicio guarda `inbox_dismissed_at` y no cambia el no leído de WhatsApp. `inbox_visible` la oculta hasta que llegue un mensaje entrante posterior. Ver la conversación pide los últimos textos al worker y no los guarda. El pie del móvil incluye Inicio. | RAZONAMIENTO: Limpiar el panel no es marcar como leído ni borrar el chat. El hilo sigue sin persistirse. | CONTEXTO: Sin leer en `/dashboard`.
