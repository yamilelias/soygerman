# Alcance de un cambio

Un solo tema: qué no mezclar.

- La web no habla con WhatsApp. Pasa por el worker.
- El worker no usa la anon key. Usa el service role.
- Un cambio de UI se verifica en el navegador, o se dice qué no se pudo probar.
- No rehagas el esquema en la app. `supabase/migrations` es la fuente.
- `apps/web/AGENTS.md` pertenece a Next.js. La memoria del producto está en la raíz y en `memory/`.
