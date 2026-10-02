# Resumen de la sesión

**Fecha:** 2026-09-29, cierre anotado el 2026-10-02

**Enfoque:** Por qué «Vincular WhatsApp» en producción decía «No se pudo contactar al worker» y en local no.

## Qué se hizo

- El fallo no era Render caído. `GET https://webservice.soygerman.com/health` respondía `{"ok":true}`.
- Los logs de `www.soygerman.com` decían `Failed to parse URL from webservice.soygerman.com/sessions/connect`. `WORKER_URL` en Vercel era el host sin `https://`.
- En local la misma variable es `http://localhost:3001`, con esquema.
- Se guardó `https://webservice.soygerman.com` en Production y Preview y se redesplegó. El alias de ese despliegue quedó en `https://www.soygerman.com`.
- `WEB_ORIGIN` del worker, leído en `access-control-allow-origin`, seguía en `http://localhost:3000`. No explica este error: la llamada sale de la server action, no del navegador.

## Decisiones tomadas

- `WORKER_URL` de producción es `https://webservice.soygerman.com`. Quedó en `memory/decisions/log.md`.

## Temas pendientes / Próximos pasos

- Volver a pulsar vincular en producción después de ese redespliegue. Esta sesión no tenía la sesión del usuario para probar el botón.
- En Render, pasar `WEB_ORIGIN` a `https://www.soygerman.com` antes de que el navegador llame al worker directo.

## Actualizaciones de memoria

- Preferencias aprendidas: para este equipo, la CLI de Vercel (`yamileliassoto-2044`, scope `weprograpp`). El MCP del editor responde 403.
- Decisiones a registrar: ya estaban. Esta nota guarda el diagnóstico y los comandos en `memory/references/sops/vercel.md` y `memory/references/sops/render.md`.
