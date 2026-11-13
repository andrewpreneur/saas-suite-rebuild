-- An owner message was stamping handover_resolved_at even when the customer
-- had never asked for a person. Only resolve a handover that was actually requested.
CREATE OR REPLACE FUNCTION public.sync_thread_on_owner_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.chat_threads (agency_id, user_identifier, last_owner_message_at, message_count)
  VALUES (NEW.agency_id, lower(NEW.user_identifier), NEW.created_at, 1)
  ON CONFLICT (agency_id, user_identifier) DO UPDATE
  SET
    last_owner_message_at = NEW.created_at,
    handover_resolved_at = CASE
      WHEN chat_threads.handover_requested_at IS NOT NULL THEN NEW.created_at
      ELSE chat_threads.handover_resolved_at
    END,
    message_count = chat_threads.message_count + 1,
    updated_at = now();
  RETURN NEW;
END;
$$;
