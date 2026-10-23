-- Una conversación archivada sigue en WhatsApp, pero no entra en Sin leer.
ALTER TABLE public.chats
  ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- Esta versión remota precede a chats_unread. El índice se crea allí,
-- cuando unread_since, unread_count y marked_unread ya existen.
