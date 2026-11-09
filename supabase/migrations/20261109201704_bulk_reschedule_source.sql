ALTER TABLE public.scheduled_messages
  ADD COLUMN destination_wa_id text,
  ADD COLUMN destination_name text,
  ADD COLUMN rescheduled_from_id uuid;

UPDATE public.scheduled_messages AS message
SET destination_wa_id = chat.wa_id, destination_name = chat.name
FROM public.chats AS chat
WHERE message.chat_id = chat.id;

ALTER TABLE public.scheduled_messages
  ADD CONSTRAINT scheduled_messages_rescheduled_from_user_unique
  UNIQUE (user_id, rescheduled_from_id);
