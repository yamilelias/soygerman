-- Copia de la credencial de Baileys. Sirve para reabrir el socket
-- después de un corte (428, 408, reinicio del proceso) sin pedir otro QR.
-- El navegador no puede leerla: solo el worker, con service role.

CREATE TABLE public.whatsapp_auth_files (
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, name)
);

ALTER TABLE public.whatsapp_auth_files ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.whatsapp_auth_files FROM anon, authenticated;
