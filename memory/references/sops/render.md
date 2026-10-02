# Worker en Render

Servicio en línea desde el 2026-09-29. Workspace `tea-csp9avbgbbvc73ceiu30`. URL pública `https://webservice.soygerman.com` (CNAME a `soygerman.onrender.com`). `GET /health` responde `{"ok":true}`.

- Web Service, Dockerfile `apps/worker/Dockerfile`, contexto `apps/worker`.
- Disco persistente en `/data`. `WWEBJS_DATA_PATH=/data/wwebjs`.
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`.
- Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_API_SECRET`, `WEB_ORIGIN` (la URL de Vercel), `PORT`.
- Health check: `GET /health`.
- Al arrancar, restaura carpetas `session-<uuid>` bajo el disco.
- Un Chromium de WhatsApp Web, sin ajuste, pide cerca de 1 GB. Si el contenedor tiene menos de 900 MB, el worker lo arranca en un solo proceso. Si la memoria libre baja de 72 MB, cierra el navegador y deja el servicio en pie.

`apps/worker/.npmrc` evita que Puppeteer baje Chromium en la instalación. La imagen del sistema lo trae.
