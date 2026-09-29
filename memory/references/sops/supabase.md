# Supabase

Proyecto `nbwxmkcwzqqxvxxfqqpn`.

La migración `supabase/migrations/20260928120000_init.sql` ya está aplicada. Incluye el revoke de `handle_new_user()` para que anon y authenticated no la llamen por RPC.

Auth por correo está activo y el alta automática también. El correo integrado solo entrega a miembros del equipo.

Redirect URLs que hacen falta:

- `http://localhost:3000/**`
- `https://soygerman-rose.vercel.app/**`

Site URL de producción: `https://soygerman-rose.vercel.app`.

Para previews de Vercel, el patrón del equipo es `https://soygerman-*-weprograpp.vercel.app/**`.
