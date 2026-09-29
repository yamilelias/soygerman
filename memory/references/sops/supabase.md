# Supabase

Proyecto `nbwxmkcwzqqxvxxfqqpn`.

La migración `supabase/migrations/20260928120000_init.sql` ya está aplicada. Incluye el revoke de `handle_new_user()` para que anon y authenticated no la llamen por RPC.

Auth por correo está activo y el alta automática también. El correo integrado solo entrega a miembros del equipo.

El dominio canónico de la app es `https://www.soygerman.com`. Vercel manda `https://soygerman.com` ahí con un 308.

Site URL: `https://www.soygerman.com`.

Redirect URLs:

- `https://www.soygerman.com/**`
- `https://soygerman.com/**`
- `https://soygerman-rose.vercel.app/**`
- `http://localhost:3000/**`

Para previews de Vercel, el patrón del equipo es `https://soygerman-*-weprograpp.vercel.app/**`.

Si `emailRedirectTo` no está en esa lista, el enlace del correo usa la Site URL sola, sin `/auth/callback`, y la app vuelve a `/login` sin crear sesión.
