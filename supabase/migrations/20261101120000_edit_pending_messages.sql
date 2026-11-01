-- Permite editar los datos de un mensaje mientras todavía no lo reclama el cron.
-- La política de cancelación existente sigue siendo la única transición a cancelled.
CREATE POLICY "Users can edit own pending messages"
  ON public.scheduled_messages
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id AND status = 'pending')
  WITH CHECK ((select auth.uid()) = user_id AND status = 'pending');
