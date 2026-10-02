# Prioridades

Fecha: 2026-10-02

1. Cerrar el recorrido real después del QR: sync de chats, agendar, cancelar y envío del cron. El worker ya no abre Chromium; hay que volver a vincular. El intento con Chrome se quedó en `qr_ready` por memoria. Cómo leerlo: `memory/references/sops/whatsapp-linking.md`. El worker ya está en Render (`https://webservice.soygerman.com`, `GET /health` en 200) y `WORKER_URL` en Vercel ya lleva `https://`.
2. En Render, `WEB_ORIGIN` sigue en `http://localhost:3000`. Las server actions no pasan por CORS; el navegador sí. Conviene apuntarlo a `https://www.soygerman.com` antes de que algo llame al worker desde el cliente.
3. Dejar el magic link usable: Site URL `https://www.soygerman.com` y esa ruta, más el apex, en las redirect URLs de Supabase. El correo ya sale; el enlace no vuelve a `/auth/callback`.
4. Mantener esta memoria al día cuando cambie una decisión o una prioridad.

La web de producción responde en `https://www.soygerman.com` (el apex redirige ahí) y en `https://soygerman-rose.vercel.app`. El worker público es `https://webservice.soygerman.com`. El correo de acceso ya se entrega; falta alinear las redirect URLs.
