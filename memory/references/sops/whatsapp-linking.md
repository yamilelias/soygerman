# Vincular WhatsApp en producción

Lo aprendido al vincular `yamileliassoto@gmail.com` (`bbed4915-a816-4c74-ac2a-b7efa7e381b0`) el 2026-09-30 y el 2026-10-01. El código ya cambió; esto es para no repetir el diagnóstico.

La librería fijada en el lockfile es whatsapp-web.js 1.34.7 (`package.json` dice `^1.34.2`). `authenticated` y `ready` salen juntos, dentro de `onAppStateHasSyncedEvent`, y ese callback solo lo dispara `WAWebSocketModel.Socket` en `change:hasSynced`. El teléfono puede listar el Chrome y mostrar el historial «en pausa» mientras la fila sigue en `qr_ready`: el escaneo ocurrió y la sincronización no.

## Qué dice cada pantalla

- «Vinculando...»: estado local `linking`. El botón queda deshabilitado. Solo se suelta si la fila pasa a `connected`, `disconnected` o `interrupted`.
- «No se pudo vincular WhatsApp. Puedes intentarlo otra vez.»: la fila pasó por `connecting`, `qr_ready` o `authenticating` y volvió a `disconnected`. No es un fallo de red con el worker.
- «No se pudo contactar al worker» y «El worker no está configurado» son de la server action. El detalle está en `memory/references/sops/vercel.md`.

## Cómo se ve en los datos

La consola del worker no está en Supabase. Ahí solo se ven las escrituras.

En los edge logs, un `POST` a `whatsapp_sessions?on_conflict=user_id` con user-agent `node` es el worker. Varios POST separados por unos 3 segundos, sin un QR de por medio, son `initialize` fallando y el reintento (`RETRY_DELAY_MS` es 3000, tope 3). Un QR sano se reescribe cada ~20 s. Si el último POST es `qr_ready` y el teléfono ya muestra el dispositivo, el socket no llegó a `hasSynced`.

La fila de esa cuenta se consulta así, en el proyecto `nbwxmkcwzqqxvxxfqqpn`:

```sql
select status, updated_at, (qr_code_base64 is not null) as has_qr
from public.whatsapp_sessions
where user_id = 'bbed4915-a816-4c74-ac2a-b7efa7e381b0';
```

## Qué pasó, en orden

1. El 2026-09-30 16:23 UTC el QR se guardó una vez y Chromium se quedó colgado. WhatsApp mostró el dispositivo conectado. La fila no pasó de `qr_ready`. Un `connect` posterior no escribía nada: en memoria el cliente seguía `initializing` y `connect()` salía sin tocar la base. El botón seguía en «Vinculando...».
2. Desconectar cerró la sesión y no borró los chats. Desde el 2026-10-01 el worker los borra al pasar a `disconnected`. El historial conserva el mensaje con `chat_id` nulo («Chat eliminado»). Pendientes y en proceso pasan a `failed`.
3. El 2026-10-01 20:53 UTC cada intento murió en menos de un segundo, tres veces. Causa: el perfil en `/data/wwebjs/session-<uuid>` quedó con `SingletonLock` de un Chromium huérfano. Antes de abrir el navegador hay que cerrar ese proceso y quitar `SingletonLock`, `SingletonCookie` y `SingletonSocket`.
4. El 2026-10-01 22:07 UTC el teléfono listó el Chrome con el historial en pausa y la fila siguió en `qr_ready`. En Render el último log útil era el QR. Cada 8 s el worker escribe `watch` con `state`, `hasSynced`, si existe `WWebJS` y un recorte de la pantalla. Esas líneas son las que hay que buscar.
5. No hay que esperar `onAppStateHasSyncedEvent` dentro de `page.evaluate`. Es un binding de Puppeteer y, al correr, vuelve a evaluar la página: el target se cierra con «Target closed» justo al escanear y el cliente queda marcado en curso. El aviso se programa con `setTimeout` en la página, y solo tras dos lecturas seguidas en `CONNECTED` o `hasSynced`. Si `WWebJS` ya existe, no se vuelve a llamar.
6. Un QR en pantalla no caduca a los 2 minutos. El estado en memoria `qr` aguanta 5 minutos desde el último código. Caducarlo antes mata el Chrome a mitad del escaneo y el teléfono se queda con el historial en pausa.
7. El dispositivo vinculado se anuncia como SoyGerman (`deviceName` y `browserName`). Si el socket está en `CONFLICT`, se llama a `Socket.takeover()`.

## Memoria del contenedor

El plan visto en el tablero el 2026-10-01 era `0.5c-512mb`. A las 16:06 y 16:08 (hora de México) la instancia murió con «Ran out of memory (used over 512MB)». Sin tope, Chromium pide cerca de 1 GB. Con menos de 900 MB en el contenedor el worker lo arranca en un solo proceso y lo cierra si la RAM libre baja de 72 MB, para que Render no reinicie el servicio. Un perfil a medias no se restaura al arrancar: se borra. Uno que ya estaba listo, sí.

Si el navegador deja de estar listo, la fila pasa a `interrupted` antes de esperar a que Chromium termine de cerrar. La interfaz lee esa fila. Si el cierre se cuelga y la fila sigue en `connected`, sincronizar dice que no hay sesión.

## Render

Auto-deploy desde `main`. No hace falta un deploy manual si el push ya salió.

- Proyecto: `prj-datlna7lot8c7382men0`
- Servicio: `srv-datuiq8u01pc73ajerfg` (`soygerman`, Docker, Oregon)
- Tablero: `https://dashboard.render.com/web/srv-datuiq8u01pc73ajerfg`
- Eventos: el commit en vivo aparece como «Deploy live for <sha>»
- El navegador del editor entró al workspace Prograpp. El id antiguo anotado del workspace es `tea-csp9avbgbbvc73ceiu30`.

No commitear un volcado `supabase/migrations/*remote_schema.sql`. El del 2026-10-01 empezaba con `drop extension` y no es una migración de este repo.
