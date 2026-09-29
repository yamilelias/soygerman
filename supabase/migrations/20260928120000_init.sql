-- Esquema de mensajes programados de WhatsApp.
-- Ejecutar en el SQL Editor de Supabase antes de probar la app.

-- 1. Perfiles
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Sesión de WhatsApp (una por usuario)
CREATE TABLE public.whatsapp_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('disconnected', 'qr_ready', 'connected')) DEFAULT 'disconnected',
  qr_code_base64 TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Chats y grupos.
-- wa_id es el JID de WhatsApp. No es la clave primaria: dos usuarios pueden
-- compartir el mismo grupo.
CREATE TABLE public.chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  wa_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_group BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, wa_id)
);

-- 4. Mensajes agendados.
-- processing lo toma el worker antes de enviar, para que dos ciclos del cron
-- no manden el mismo mensaje.
CREATE TABLE public.scheduled_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
  message_body TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'processing', 'sent', 'cancelled', 'failed')) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX scheduled_messages_due_idx
  ON public.scheduled_messages (scheduled_at)
  WHERE status = 'pending';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own profile"
  ON public.profiles
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can manage their own whatsapp sessions"
  ON public.whatsapp_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own chats"
  ON public.chats
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own scheduled messages"
  ON public.scheduled_messages
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert pending messages"
  ON public.scheduled_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Users can cancel own pending messages"
  ON public.scheduled_messages
  FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, COALESCE(NEW.email, ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.whatsapp_sessions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'whatsapp_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_sessions;
  END IF;
END $$;

-- El worker (service role) reclama los mensajes vencidos de forma atómica.
CREATE OR REPLACE FUNCTION public.claim_due_messages(batch_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  chat_id uuid,
  wa_id text,
  message_body text,
  scheduled_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH due AS (
    SELECT sm.id
    FROM public.scheduled_messages AS sm
    WHERE sm.status = 'pending'
      AND sm.scheduled_at <= NOW()
    ORDER BY sm.scheduled_at
    LIMIT batch_limit
    FOR UPDATE OF sm SKIP LOCKED
  ),
  updated AS (
    UPDATE public.scheduled_messages AS sm
    SET status = 'processing'
    FROM due
    WHERE sm.id = due.id
    RETURNING sm.id, sm.user_id, sm.chat_id, sm.message_body, sm.scheduled_at
  )
  SELECT
    updated.id,
    updated.user_id,
    updated.chat_id,
    c.wa_id,
    updated.message_body,
    updated.scheduled_at
  FROM updated
  JOIN public.chats AS c ON c.id = updated.chat_id;
$$;

REVOKE ALL ON FUNCTION public.claim_due_messages(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_due_messages(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_messages(integer) TO service_role;
