# Worker en Render

Servicio en línea desde el 2026-09-29. Workspace `tea-csp9avbgbbvc73ceiu30`. URL pública `https://webservice.soygerman.com` (CNAME a `soygerman.onrender.com`). `GET /health` responde `{"ok":true}`.

- Web Service, Dockerfile `apps/worker/Dockerfile`, contexto `apps/worker`.
- Disco persistente en `/data`. `WWEBJS_DATA_PATH=/data/wwebjs`.
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`.
- Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_API_SECRET`, `WEB_ORIGIN`, `PORT`.
- El 2026-09-30 `GET /health` por HTTPS devolvió `access-control-allow-origin: http://localhost:3000`. `WEB_ORIGIN` seguía en local. Las server actions no miran CORS; un `fetch` del navegador sí. El valor que corresponde a producción es `https://www.soygerman.com`.
- Health check: `GET /health`.
- Al arrancar, restaura carpetas `session-<uuid>` bajo el disco.
- Un Chromium de WhatsApp Web, sin ajuste, pide cerca de 1 GB. Si el contenedor tiene menos de 900 MB, el worker lo arranca en un solo proceso. Si la memoria libre baja de 72 MB, cierra el navegador y deja el servicio en pie.

`apps/worker/.npmrc` evita que Puppeteer baje Chromium en la instalación. La imagen del sistema lo trae.

`http://webservice.soygerman.com` responde 301 hacia HTTPS. `WORKER_URL` tiene que nacer en `https://`: un POST que siguiera ese 301 puede cambiar de método. El CNAME es `webservice.soygerman.com` → `soygerman.onrender.com`, origen Render `gcp-us-west1-1`, delante Cloudflare.
