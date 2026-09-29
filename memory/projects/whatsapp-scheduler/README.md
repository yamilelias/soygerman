# Mensajes programados de WhatsApp

La iniciativa activa de este repositorio.

Estado: activo. La web y el worker están en producción. Auth, WhatsApp y el envío del cron siguen sin una prueba de punta a punta.

## Hecho

- Monorepo, esquema de Supabase, worker, pantallas y PWA.
- Historial en `main`: andamiaje, worker, magic link, vistas, PWA, endurecimiento del trigger, preparación de Vercel y binarios de CSS para Linux.
- Producción: `https://soygerman-rose.vercel.app`.

## Fechas

- 2026-09-28: primer despliegue de producción, después de corregir `lightningcss` en Linux.
- 2026-09-29: el worker quedó en línea en Render y se actualizaron las variables de Vercel y Render.

## Siguiente

Anotar la URL del worker, abrir las redirect URLs y probar el recorrido real. El detalle operativo está en `memory/references/sops/`.
