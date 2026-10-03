-- Una conversación archivada sigue en WhatsApp, pero no entra en Sin leer.
ALTER TABLE public.chats
  ADD COLUMN archived boolean NOT NULL DEFAULT false;

DROP INDEX IF EXISTS public.chats_open_unread_idx;

CREATE INDEX chats_open_unread_idx
  ON public.chats (user_id, unread_since)
  WHERE hidden = false
    AND archived = false
    AND (unread_count > 0 OR marked_unread);
