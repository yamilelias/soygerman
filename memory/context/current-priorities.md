# Prioridades

Fecha: 2026-10-22

1. Validar y desplegar por etapas los dos teléfonos. El código está en `main`, pero las migraciones no se han aplicado al proyecto remoto ni se ha probado con dos teléfonos reales. Mantener `MULTI_PHONE_ENABLED=false` hasta completar `memory/references/sops/multi-phone-rollout.md`.
2. Cerrar el recorrido real después del QR: sync de chats, agendar, cancelar y envío del cron. El worker ya no abre Chromium; hay que volver a vincular. El diagnóstico viejo está en `memory/references/sops/whatsapp-linking.md`.
3. En Render, `WEB_ORIGIN` seguía en `http://localhost:3000` en la última verificación. Las server actions no pasan por CORS; un futuro navegador directo sí. Verificar y apuntar a `https://www.soygerman.com`.
4. Verificar la Site URL `https://www.soygerman.com` y esa ruta, más el apex, en las redirect URLs de Supabase para el magic link.

La web de producción responde en `https://www.soygerman.com` (el apex redirige ahí) y en `https://soygerman-rose.vercel.app`. El worker público es `https://webservice.soygerman.com`. El correo de acceso ya se entrega; falta alinear las redirect URLs.
