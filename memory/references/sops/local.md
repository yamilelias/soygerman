# Arranque local

1. `npm install` en la raíz.
2. `apps/web/.env.local` y `apps/worker/.env` a partir de los `.env.example`. El mismo `WORKER_API_SECRET` en los dos.
3. `npm run dev:web` en el puerto 3000 y `npm run dev:worker` en el 3001.
4. Redirect de Supabase para local: `http://localhost:3000/**`.

`npm run build:web` usa Webpack. En `next dev` la PWA queda apagada.

El 2026-09-28 el servidor local del puerto 3000 y el worker de prueba se detuvieron a mano. Producción no depende de esos procesos.
