# Prioridades

Fecha: 2026-09-29

1. Probar el recorrido real: correo, QR, sync de chats, agendar, cancelar y envío del cron. El worker ya está en Render y las variables de Vercel y Render quedaron cargadas.
2. Anotar aquí la URL pública del worker y comprobar `GET /health`.
3. Dejar el magic link usable: Site URL `https://www.soygerman.com` y esa ruta, más el apex, en las redirect URLs de Supabase. El correo ya sale; el enlace no vuelve a `/auth/callback`.
4. Mantener esta memoria al día cuando cambie una decisión o una prioridad.

La web de producción responde en `https://www.soygerman.com` (el apex redirige ahí) y en `https://soygerman-rose.vercel.app`. El worker está en el workspace de Render `tea-csp9avbgbbvc73ceiu30`. El correo de acceso ya se entrega; falta alinear las redirect URLs.
