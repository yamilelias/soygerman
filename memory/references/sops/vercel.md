# Vercel

Proyecto `weprograpp/soygerman`. Cuenta de la CLI: `yamileliassoto-2044`. Equipo `weprograpp`.

- Directorio raíz: `apps/web`
- Framework: Next.js
- Node: 24.x
- Instalación: `cd ../.. && npm install --workspace=web --include-workspace-root` (`apps/web/vercel.json`)
- Build: `npm run build`, que es `next build --webpack`
- Git: `yamilelias/soygerman`, rama `main`
- Producción: `https://soygerman-rose.vercel.app`

Variables ya cargadas en Production y Preview, marcadas como secretas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `WORKER_API_SECRET`, `WORKER_URL`. `WORKER_URL` tiene que llevar esquema (`https://webservice.soygerman.com`). Sin `https://`, la server action no arma la petición y la pantalla dice «No se pudo contactar al worker». Un cambio de variables entra en la web con el siguiente despliegue.

El dominio que sirve producción es `https://www.soygerman.com`. El apex redirige ahí. `https://soygerman-rose.vercel.app` sigue existiendo.

El primer build falló por el binario de Linux de `lightningcss`. El segundo, con las dependencias opcionales, quedó Ready.

## Si vincular dice que no llega al worker

La pantalla sale de `callWorker` en `apps/web/app/actions/worker.ts`. Tres textos, tres causas:

- «El worker no está configurado»: en ese despliegue falta `WORKER_URL` o `WORKER_API_SECRET`. El log dice `sin WORKER_URL o WORKER_API_SECRET`.
- «No se pudo contactar al worker»: `fetch` lanzó. No hubo respuesta HTTP. El log es `[worker] POST <url> no respondió: <mensaje>`.
- «Error del worker», o el texto que devolvió el worker: Render respondió con un estado distinto de 2xx. El log trae el código.

El 2026-09-29 el clic en producción cayó en el segundo caso. El log fue `Failed to parse URL from webservice.soygerman.com/sessions/connect`. `WORKER_URL` era el host pelado. En local era `http://localhost:3001`, con esquema, y por eso ahí sí funcionaba. `GET https://webservice.soygerman.com/health` ya respondía `{"ok":true}`. El 2026-09-30 se guardó `https://webservice.soygerman.com` en Production y Preview y se redesplegó el despliegue de entonces. El alias quedó en `https://www.soygerman.com`.

`POST /sessions/connect` responde en cuanto deja el socket arrancando. No espera a que WhatsApp quede vinculado. Un fallo instantáneo de «no se pudo contactar» es la URL o la red, no el QR.

`WORKER_URL` y `WORKER_API_SECRET` son Secret. `vercel env pull --environment production` escribe `[SENSITIVE]` y no muestra el valor. El log de la función sí imprime la URL armada, sin el secreto.

El MCP de Vercel del editor no entra al equipo `weprograpp` (403, y `list_teams` vuelve vacío). La CLI sí, con la cuenta `yamileliassoto-2044` y el equipo `weprograpp` (el otro equipo de esa cuenta es `anecdote-travel`):

```bash
vercel logs --project soygerman --scope weprograpp --environment production --query "worker" --since 24h
vercel env update WORKER_URL production --value "https://webservice.soygerman.com" --sensitive --yes --scope weprograpp --project soygerman
vercel redeploy <url-del-despliegue> --target production --scope weprograpp
```

Ese `env update` con `production` también tocó Preview. El redespliegue hace falta: la variable nueva no entra en el despliegue que ya está sirviendo.
