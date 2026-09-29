-- Estados intermedios de la vinculación, para que el dashboard
-- actualice el QR por Realtime sin otro clic.
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
      'connected'
    )
  );
