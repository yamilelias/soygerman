# Worker en Render

Servicio en línea desde el 2026-09-29. Workspace `tea-csp9avbgbbvc73ceiu30`. En el tablero, el 2026-10-01, el workspace visible era Prograpp, el proyecto `prj-datlna7lot8c7382men0` y el servicio `srv-datuiq8u01pc73ajerfg` (`https://dashboard.render.com/web/srv-datuiq8u01pc73ajerfg`). URL pública `https://webservice.soygerman.com` (CNAME a `soygerman.onrender.com`). `GET /health` responde `{"ok":true}`.

`main` despliega solo. El evento «Deploy live for <sha>» confirma el commit que está sirviendo. El síntoma de la vinculación y las líneas `watch` están en `memory/references/sops/whatsapp-linking.md`.

- Web Service, Dockerfile `apps/worker/Dockerfile`, contexto `apps/worker`.
- Disco persistente en `/data`. `BAILEYS_DATA_PATH=/data/baileys`. Un perfil viejo en `/data/wwebjs` no se restaura.
- Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_API_SECRET`, `WEB_ORIGIN`, `PORT`, `OPENAI_API_KEY`. `DIGEST_MODEL` es opcional.
- El 2026-09-30 `GET /health` por HTTPS devolvió `access-control-allow-origin: http://localhost:3000`. `WEB_ORIGIN` seguía en local. Las server actions no miran CORS; un `fetch` del navegador sí. El valor que corresponde a producción es `https://www.soygerman.com`.
- Health check: `GET /health`.
- Al arrancar, restaura `session-<uuid>` si `creds.json` tiene `me.id` o `registered`. Sin eso, la carpeta es un QR a medias y se borra. Si el disco no la trae, se copia desde `whatsapp_auth_files`.
- La imagen no trae Chromium. La sesión es un WebSocket y cabe en el plan de 512 MB. Cada 8 s, mientras vincula, el log anota la RAM del proceso.

`http://webservice.soygerman.com` responde 301 hacia HTTPS. `WORKER_URL` tiene que nacer en `https://`: un POST que siguiera ese 301 puede cambiar de método. El CNAME es `webservice.soygerman.com` → `soygerman.onrender.com`, origen Render `gcp-us-west1-1`, delante Cloudflare.
