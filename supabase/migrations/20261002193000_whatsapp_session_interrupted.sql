-- La sesión puede quedar a medias si Chromium se cae después de
-- marcarse conectada. Este estado avisa en el dashboard y deja vincular otra vez.
ALTER TABLE public.whatsapp_sessions
  DROP CONSTRAINT whatsapp_sessions_status_check;

ALTER TABLE public.whatsapp_sessions
  ADD CONSTRAINT whatsapp_sessions_status_check
  CHECK (
    status IN (
      'disconnected',
      'connecting',
      'qr_ready',
      'authenticating',
      'connected',
      'interrupted'
    )
  );
