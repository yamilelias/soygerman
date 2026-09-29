# Prioridades

Fecha: 2026-09-28

1. Dejar el magic link usable: SMTP de Resend en Supabase y la URL de producción en las redirect URLs.
2. Probar el recorrido real: correo, QR, sync de chats, agendar, cancelar y envío del cron.
3. Desplegar el worker en Render con disco persistente, para que la web de Vercel tenga un `WORKER_URL` de verdad.
4. Mantener esta memoria al día cuando cambie una decisión o una prioridad.

La web de producción ya responde en `https://soygerman-rose.vercel.app`. El worker de producción no existe todavía. El SMTP de Resend tampoco quedó aplicado.
