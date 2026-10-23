-- El resumen diario guarda la acción, no el hilo. La clave del último
-- mensaje solo sirve para pedir más contexto a WhatsApp en el momento.

ALTER TABLE public.chats
  ADD COLUMN last_message_key jsonb;

CREATE TABLE public.daily_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  digest_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'ready', 'empty', 'failed')),
  overview text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, digest_date)
);

ALTER TABLE public.daily_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own daily digests"
  ON public.daily_digests
  FOR SELECT
  USING (auth.uid() = user_id);
