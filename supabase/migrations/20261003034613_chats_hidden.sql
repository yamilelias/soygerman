-- Un chat oculto sigue en la tabla para que el sync, que hace upsert por
-- (user_id, wa_id) sin esta columna, no lo vuelva a mostrar.
ALTER TABLE public.chats
  ADD COLUMN hidden boolean NOT NULL DEFAULT false;
