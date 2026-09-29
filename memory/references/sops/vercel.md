# Vercel

Proyecto `weprograpp/soygerman`. Cuenta de la CLI: `yamileliassoto-2044`. Equipo `weprograpp`.

- Directorio raíz: `apps/web`
- Framework: Next.js
- Node: 24.x
- Instalación: `cd ../.. && npm install --workspace=web --include-workspace-root` (`apps/web/vercel.json`)
- Build: `npm run build`, que es `next build --webpack`
- Git: `yamilelias/soygerman`, rama `main`
- Producción: `https://soygerman-rose.vercel.app`

Variables ya cargadas en Production y Preview, marcadas como secretas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `WORKER_API_SECRET`, `WORKER_URL`. El 2026-09-29 se actualizaron para apuntar al worker de Render. Un cambio de variables entra en la web con el siguiente despliegue.

El primer build falló por el binario de Linux de `lightningcss`. El segundo, con las dependencias opcionales, quedó Ready.
