-- El inicio muestra lo que sigue sin leer. No se guarda el historial:
-- solo el conteo, si se marcó a mano, desde cuándo y el último texto.
ALTER TABLE public.chats
  ADD COLUMN unread_count integer NOT NULL DEFAULT 0,
  ADD COLUMN marked_unread boolean NOT NULL DEFAULT false,
  ADD COLUMN unread_since timestamptz,
  ADD COLUMN last_message_at timestamptz,
  ADD COLUMN last_message_preview text,
  ADD COLUMN last_message_from_me boolean;

ALTER TABLE public.chats
  ADD CONSTRAINT chats_unread_count_nonnegative CHECK (unread_count >= 0);

CREATE INDEX chats_open_unread_idx
  ON public.chats (user_id, unread_since)
  WHERE hidden = false AND (unread_count > 0 OR marked_unread);
