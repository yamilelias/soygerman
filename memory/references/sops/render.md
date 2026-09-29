# Worker en Render

Servicio en línea desde el 2026-09-29. Workspace `tea-csp9avbgbbvc73ceiu30`. Ese día quedaron cargadas las variables del worker y, en Vercel, las de la web. La URL pública no está en esta nota: el navegador de Cursor no tiene la sesión del panel.

- Web Service, Dockerfile `apps/worker/Dockerfile`, contexto `apps/worker`.
- Disco persistente en `/data`. `WWEBJS_DATA_PATH=/data/wwebjs`.
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`.
- Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_API_SECRET`, `WEB_ORIGIN` (la URL de Vercel), `PORT`.
- Health check: `GET /health`.
- Al arrancar, restaura carpetas `session-<uuid>` bajo el disco.
- Presupuesta cerca de 1 GB de RAM por sesión de Chromium activa.

`apps/worker/.npmrc` evita que Puppeteer baje Chromium en la instalación. La imagen del sistema lo trae.
