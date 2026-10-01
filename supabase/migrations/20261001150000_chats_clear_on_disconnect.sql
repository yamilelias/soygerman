-- Al desconectar, el worker borra los chats. El historial conserva el
-- mensaje y muestra «Chat eliminado» cuando ya no hay fila de chat.
ALTER TABLE public.scheduled_messages
  ALTER COLUMN chat_id DROP NOT NULL;

ALTER TABLE public.scheduled_messages
  DROP CONSTRAINT scheduled_messages_chat_id_fkey;

ALTER TABLE public.scheduled_messages
  ADD CONSTRAINT scheduled_messages_chat_id_fkey
  FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE SET NULL;
