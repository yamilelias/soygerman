# Mensajes programados de WhatsApp

La iniciativa activa de este repositorio.

Estado: activo. La web está en producción. Auth, WhatsApp y el worker de producción siguen sin una prueba de punta a punta.

## Hecho

- Monorepo, esquema de Supabase, worker, pantallas y PWA.
- Historial en `main`: andamiaje, worker, magic link, vistas, PWA, endurecimiento del trigger, preparación de Vercel y binarios de CSS para Linux.
- Producción: `https://soygerman-rose.vercel.app`.

## Fechas

- 2026-09-28: primer despliegue de producción, después de corregir `lightningcss` en Linux.

## Siguiente

Aplicar Resend, abrir las redirect URLs y desplegar el worker. El detalle operativo está en `memory/references/sops/`.
