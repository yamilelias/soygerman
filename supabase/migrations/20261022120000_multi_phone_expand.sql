-- Ampliación compatible con el worker anterior. La segunda línea permanece
-- deshabilitada hasta aplicar la migración de activación.
ALTER TABLE public.whatsapp_sessions
  ADD COLUMN slot smallint NOT NULL DEFAULT 1 CHECK (slot IN (1, 2)),
  ADD COLUMN label text NOT NULL DEFAULT 'Principal',
  ADD COLUMN phone_number text,
  ADD COLUMN error_message text;
INSERT INTO public.whatsapp_sessions (user_id)
SELECT user_id FROM (
  SELECT user_id FROM public.chats
  UNION SELECT user_id FROM public.scheduled_messages
  UNION SELECT user_id FROM public.whatsapp_auth_files
  UNION SELECT user_id FROM public.daily_digests
) owners
ON CONFLICT (user_id) DO NOTHING;
ALTER TABLE public.whatsapp_sessions
  ADD CONSTRAINT whatsapp_sessions_user_slot_key UNIQUE (user_id, slot),
  ADD CONSTRAINT whatsapp_sessions_id_user_key UNIQUE (id, user_id);
UPDATE public.whatsapp_sessions s
SET phone_number = '+' || substring(
  f.body::jsonb -> 'me' ->> 'id'
  FROM '^([0-9]{8,15})(:[0-9]+)?@s\.whatsapp\.net$'
)
FROM public.whatsapp_auth_files f
WHERE f.user_id = s.user_id AND f.name = 'creds.json'
  AND substring(
    f.body::jsonb -> 'me' ->> 'id'
    FROM '^([0-9]{8,15})(:[0-9]+)?@s\.whatsapp\.net$'
  ) IS NOT NULL;
CREATE UNIQUE INDEX whatsapp_sessions_user_phone_key
  ON public.whatsapp_sessions (user_id, phone_number)
  WHERE phone_number IS NOT NULL;

ALTER TABLE public.chats ADD COLUMN session_id uuid;
UPDATE public.chats c SET session_id = s.id
  FROM public.whatsapp_sessions s WHERE s.user_id = c.user_id AND s.slot = 1;
ALTER TABLE public.chats ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE public.chats ADD CONSTRAINT chats_session_user_fkey
  FOREIGN KEY (session_id, user_id)
  REFERENCES public.whatsapp_sessions (id, user_id) ON DELETE CASCADE;
CREATE UNIQUE INDEX chats_session_wa_key ON public.chats (session_id, wa_id);
CREATE INDEX chats_session_name_idx ON public.chats (session_id, name, id);
CREATE INDEX chats_session_unread_idx ON public.chats (session_id, unread_since)
  WHERE inbox_visible;

CREATE FUNCTION public.set_legacy_chat_session() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.session_id IS NULL THEN
    SELECT id INTO NEW.session_id FROM public.whatsapp_sessions
      WHERE user_id = NEW.user_id AND slot = 1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER set_legacy_chat_session BEFORE INSERT ON public.chats
  FOR EACH ROW EXECUTE FUNCTION public.set_legacy_chat_session();
CREATE FUNCTION public.keep_chat_owner() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.session_id IS DISTINCT FROM OLD.session_id THEN
    RAISE EXCEPTION 'No se puede mover un chat a otra línea';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER keep_chat_owner BEFORE UPDATE OF user_id, session_id
  ON public.chats FOR EACH ROW EXECUTE FUNCTION public.keep_chat_owner();

ALTER TABLE public.whatsapp_auth_files ADD COLUMN session_id uuid;
UPDATE public.whatsapp_auth_files f SET session_id = s.id
  FROM public.whatsapp_sessions s WHERE s.user_id = f.user_id AND s.slot = 1;
ALTER TABLE public.whatsapp_auth_files ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE public.whatsapp_auth_files ADD CONSTRAINT whatsapp_auth_files_session_user_fkey
  FOREIGN KEY (session_id, user_id)
  REFERENCES public.whatsapp_sessions (id, user_id) ON DELETE CASCADE;
CREATE UNIQUE INDEX whatsapp_auth_files_session_name_key
  ON public.whatsapp_auth_files (session_id, name);
CREATE FUNCTION public.set_legacy_auth_session() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.session_id IS NULL THEN
    SELECT id INTO NEW.session_id FROM public.whatsapp_sessions
      WHERE user_id = NEW.user_id AND slot = 1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER set_legacy_auth_session BEFORE INSERT ON public.whatsapp_auth_files
  FOR EACH ROW EXECUTE FUNCTION public.set_legacy_auth_session();

ALTER TABLE public.scheduled_messages
  ADD COLUMN session_id uuid,
  ADD COLUMN sender_phone_number text;
UPDATE public.scheduled_messages m SET session_id = s.id
  FROM public.whatsapp_sessions s WHERE s.user_id = m.user_id AND s.slot = 1;
UPDATE public.scheduled_messages m SET sender_phone_number = s.phone_number
  FROM public.whatsapp_sessions s WHERE s.id = m.session_id;
ALTER TABLE public.scheduled_messages ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE public.scheduled_messages ADD CONSTRAINT scheduled_messages_session_user_fkey
  FOREIGN KEY (session_id, user_id)
  REFERENCES public.whatsapp_sessions (id, user_id) ON DELETE CASCADE;
CREATE INDEX scheduled_messages_session_status_idx
  ON public.scheduled_messages (session_id, status, scheduled_at);

CREATE FUNCTION public.validate_message_session() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE destination record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.session_id IS DISTINCT FROM OLD.session_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.sender_phone_number IS DISTINCT FROM OLD.sender_phone_number THEN
      RAISE EXCEPTION 'No se puede cambiar la línea de un mensaje';
    END IF;
  END IF;
  IF NEW.chat_id IS NOT NULL THEN
    SELECT user_id, session_id INTO destination FROM public.chats
      WHERE id = NEW.chat_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No se encontró el chat';
    END IF;
    IF destination.user_id <> NEW.user_id THEN
      RAISE EXCEPTION 'El chat no pertenece al usuario';
    END IF;
    IF TG_OP = 'INSERT' AND NEW.session_id IS NULL THEN
      NEW.session_id := destination.session_id;
    ELSIF NEW.session_id <> destination.session_id THEN
      RAISE EXCEPTION 'El chat no pertenece a la línea';
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Se requiere un chat para agendar';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.sender_phone_number := (
      SELECT phone_number FROM public.whatsapp_sessions WHERE id = NEW.session_id
    );
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_message_session
  BEFORE INSERT OR UPDATE OF user_id, session_id, chat_id, sender_phone_number
  ON public.scheduled_messages FOR EACH ROW
  EXECUTE FUNCTION public.validate_message_session();

ALTER TABLE public.daily_digests ADD COLUMN session_id uuid;
UPDATE public.daily_digests d SET session_id = s.id
  FROM public.whatsapp_sessions s WHERE s.user_id = d.user_id AND s.slot = 1;
ALTER TABLE public.daily_digests ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE public.daily_digests ADD CONSTRAINT daily_digests_session_user_fkey
  FOREIGN KEY (session_id, user_id)
  REFERENCES public.whatsapp_sessions (id, user_id) ON DELETE CASCADE;
CREATE UNIQUE INDEX daily_digests_session_date_key
  ON public.daily_digests (session_id, digest_date);
CREATE FUNCTION public.set_legacy_digest_session() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.session_id IS NULL THEN
    SELECT id INTO NEW.session_id FROM public.whatsapp_sessions
      WHERE user_id = NEW.user_id AND slot = 1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER set_legacy_digest_session BEFORE INSERT ON public.daily_digests
  FOR EACH ROW EXECUTE FUNCTION public.set_legacy_digest_session();

-- Nueva RPC; la anterior sigue disponible durante la transición.
CREATE FUNCTION public.claim_due_messages_v2(batch_limit integer DEFAULT 20)
RETURNS TABLE (id uuid, user_id uuid, session_id uuid, chat_id uuid,
  wa_id text, message_body text, scheduled_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH due AS (
    SELECT sm.id FROM public.scheduled_messages sm
    WHERE sm.status = 'pending' AND sm.scheduled_at <= now()
    ORDER BY sm.scheduled_at LIMIT batch_limit
    FOR UPDATE OF sm SKIP LOCKED
  ), updated AS (
    UPDATE public.scheduled_messages sm SET status = 'processing'
    FROM due WHERE sm.id = due.id
    RETURNING sm.id, sm.user_id, sm.session_id, sm.chat_id,
      sm.message_body, sm.scheduled_at
  )
  SELECT u.id, u.user_id, u.session_id, u.chat_id, c.wa_id,
    u.message_body, u.scheduled_at FROM updated u
  JOIN public.chats c ON c.id = u.chat_id AND c.session_id = u.session_id;
$$;
REVOKE ALL ON FUNCTION public.claim_due_messages_v2(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_messages_v2(integer) TO service_role;
