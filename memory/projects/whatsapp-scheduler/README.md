# Mensajes programados de WhatsApp

La iniciativa activa de este repositorio.

Estado: activo. La web y el worker están en producción. La vinculación de `yamileliassoto@gmail.com` se probó el 2026-10-01: el teléfono llegó a listar el Chrome y la fila se quedó en `qr_ready` con el historial en pausa. El recorrido completo (sync, agenda, cancelar y cron) sigue sin cerrarse. El diagnóstico está en `memory/references/sops/whatsapp-linking.md`.

## Hecho

- Monorepo, esquema de Supabase, worker, pantallas y PWA.
- Historial en `main`: andamiaje, worker, magic link, vistas, PWA, endurecimiento del trigger, preparación de Vercel y binarios de CSS para Linux.
- Producción: `https://soygerman-rose.vercel.app`.

## Fechas

- 2026-09-28: primer despliegue de producción, después de corregir `lightningcss` en Linux.
- 2026-09-29: el worker quedó en línea en Render y se actualizaron las variables de Vercel y Render.
- 2026-10-01: desconectar borra los chats; el perfil de Chromium se limpia antes de reabrir; el worker registra el socket cada 8 s. Render auto-desplegó `fe421ed`.

## Siguiente

El worker público es `https://webservice.soygerman.com`. Falta alinear las redirect URLs y probar el recorrido real. El detalle operativo está en `memory/references/sops/`.
