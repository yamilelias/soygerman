# Secretos

Un solo tema: qué no se escribe en el repositorio.

No van a git ni a `memory/`:

- API key de Resend
- `SUPABASE_SERVICE_ROLE_KEY`
- `WORKER_API_SECRET`
- `OPENAI_API_KEY`
- Llaves de anon o publishable, salvo los `.env.example` con placeholders

Sitios válidos: `apps/web/.env.local`, `apps/worker/.env`, variables de Vercel y de Render, y el SMTP del panel de Supabase.

La caché de la CLI (`supabase/.temp/`, `supabase/.branches/`) tampoco entra: guarda el proyecto enlazado y la URL del pooler de esta máquina.

La CLI de Supabase de esta máquina ve el proyecto «Dossier generation» (`uwfdiunlhexwgztflcuf`), no SoyGerman. Para este producto usa el MCP o el panel del proyecto `nbwxmkcwzqqxvxxfqqpn`.
