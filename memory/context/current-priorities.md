# Prioridades

Fecha: 2026-09-28

1. Dejar el magic link usable: Site URL `https://www.soygerman.com` y esa ruta, más el apex, en las redirect URLs de Supabase. El correo ya sale; el enlace no vuelve a `/auth/callback`.
2. Probar el recorrido real: correo, QR, sync de chats, agendar, cancelar y envío del cron.
3. Desplegar el worker en Render con disco persistente, para que la web de Vercel tenga un `WORKER_URL` de verdad.
4. Mantener esta memoria al día cuando cambie una decisión o una prioridad.

La web de producción responde en `https://www.soygerman.com` (el apex redirige ahí) y en `https://soygerman-rose.vercel.app`. El worker de producción no existe todavía. El correo de acceso ya se entrega; falta alinear las redirect URLs.
