-- Quitar del inicio no marca el chat como leído. Vuelve si llega
-- un mensaje entrante posterior a inbox_dismissed_at.
ALTER TABLE public.chats
  ADD COLUMN inbox_dismissed_at timestamptz;

ALTER TABLE public.chats
  ADD COLUMN inbox_visible boolean
  GENERATED ALWAYS AS (
    NOT hidden
    AND NOT archived
    AND (unread_count > 0 OR marked_unread)
    AND (
      inbox_dismissed_at IS NULL
      OR (
        last_message_from_me IS FALSE
        AND last_message_at IS NOT NULL
        AND last_message_at > inbox_dismissed_at
      )
    )
  ) STORED;

DROP INDEX IF EXISTS public.chats_open_unread_idx;

CREATE INDEX chats_open_unread_idx
  ON public.chats (user_id, unread_since)
  WHERE inbox_visible;
