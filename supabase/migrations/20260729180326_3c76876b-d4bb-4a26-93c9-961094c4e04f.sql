
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS last_handover_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handover_notification_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_chat_threads_pending_handover
  ON public.chat_threads(handover_requested_at)
  WHERE handover_requested_at IS NOT NULL AND handover_resolved_at IS NULL;

CREATE OR REPLACE FUNCTION public.mark_handover_requested(_agency_id TEXT, _user_identifier TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.chat_threads (
    agency_id, user_identifier, handover_requested_at,
    last_handover_notified_at, handover_notification_count
  )
  VALUES (_agency_id, lower(_user_identifier), now(), now(), 1)
  ON CONFLICT (agency_id, user_identifier) DO UPDATE
  SET handover_requested_at = CASE
        WHEN chat_threads.handover_resolved_at IS NULL AND chat_threads.handover_requested_at IS NOT NULL
          THEN chat_threads.handover_requested_at
        ELSE now()
      END,
      handover_resolved_at = NULL,
      last_handover_notified_at = now(),
      handover_notification_count = CASE
        WHEN chat_threads.handover_resolved_at IS NULL AND chat_threads.handover_requested_at IS NOT NULL
          THEN COALESCE(chat_threads.handover_notification_count, 0) + 1
        ELSE 1
      END,
      updated_at = now();
END; $$;
