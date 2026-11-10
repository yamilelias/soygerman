# Prioridades

Fecha: 2026-11-09

1. Terminar la validación de dos teléfonos. El código está en `main` y ambas migraciones se aplicaron al proyecto remoto el 2026-10-22. El 2026-11-09 los datos conservaban dos líneas 1, ninguna línea 2 y ninguna referencia `session_id` nula; falta comprobar las versiones activas de Render y Vercel, el estado del flag, el flujo real con dos teléfonos y la RAM. Mantener `MULTI_PHONE_ENABLED=false` hasta completar `memory/references/sops/multi-phone-rollout.md`.
2. Cerrar el recorrido real después del QR: sync de chats, agendar, cancelar y envío del cron. El worker ya no abre Chromium; hay que volver a vincular. El diagnóstico viejo está en `memory/references/sops/whatsapp-linking.md`.
3. En Render, `WEB_ORIGIN` seguía en `http://localhost:3000` en la última verificación. Las server actions no pasan por CORS; un futuro navegador directo sí. Verificar y apuntar a `https://www.soygerman.com`.
4. Verificar la Site URL `https://www.soygerman.com` y esa ruta, más el apex, en las redirect URLs de Supabase para el magic link.

La web de producción responde en `https://www.soygerman.com` (el apex redirige ahí) y en `https://soygerman-rose.vercel.app`. El worker público es `https://webservice.soygerman.com`. El correo de acceso ya se entrega; falta alinear las redirect URLs.
