-- Aplicar solo cuando el worker y la web compatibles ya estén sirviendo.
ALTER TABLE public.whatsapp_sessions DROP CONSTRAINT whatsapp_sessions_user_id_key;
ALTER TABLE public.chats DROP CONSTRAINT chats_user_id_wa_id_key;
ALTER TABLE public.whatsapp_auth_files DROP CONSTRAINT whatsapp_auth_files_pkey;
ALTER TABLE public.whatsapp_auth_files
  ADD CONSTRAINT whatsapp_auth_files_pkey PRIMARY KEY (session_id, name);
ALTER TABLE public.daily_digests
  DROP CONSTRAINT daily_digests_user_id_digest_date_key;

-- La sesión se escribe solo desde el worker; el navegador puede leer su QR.
DROP POLICY "Users can manage their own whatsapp sessions"
  ON public.whatsapp_sessions;
CREATE POLICY "Users can read own whatsapp sessions"
  ON public.whatsapp_sessions FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP TRIGGER set_legacy_chat_session ON public.chats;
DROP FUNCTION public.set_legacy_chat_session();
DROP TRIGGER set_legacy_auth_session ON public.whatsapp_auth_files;
DROP FUNCTION public.set_legacy_auth_session();
DROP TRIGGER set_legacy_digest_session ON public.daily_digests;
DROP FUNCTION public.set_legacy_digest_session();
