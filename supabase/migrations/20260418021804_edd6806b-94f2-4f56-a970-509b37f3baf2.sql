-- Enable pg_net for async HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: on new user_progress row, fire edge function with the agency_id
CREATE OR REPLACE FUNCTION public.notify_agency_user_count_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn_url text;
  payload jsonb;
BEGIN
  -- Only fire when there's an agency_id to look up
  IF NEW.agency_id IS NULL OR NEW.agency_id = '' THEN
    RETURN NEW;
  END IF;

  fn_url := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/notify-agency-user-count';
  payload := jsonb_build_object('agency_id', NEW.agency_id);

  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the insert if webhook plumbing fails
  RAISE WARNING 'notify_agency_user_count_change failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_agency_user_count_insert ON public.user_progress;
CREATE TRIGGER trg_notify_agency_user_count_insert
AFTER INSERT ON public.user_progress
FOR EACH ROW
EXECUTE FUNCTION public.notify_agency_user_count_change();

-- Also fire if a user_progress row is reassigned to a different agency_id
DROP TRIGGER IF EXISTS trg_notify_agency_user_count_update ON public.user_progress;
CREATE TRIGGER trg_notify_agency_user_count_update
AFTER UPDATE OF agency_id ON public.user_progress
FOR EACH ROW
WHEN (NEW.agency_id IS DISTINCT FROM OLD.agency_id)
EXECUTE FUNCTION public.notify_agency_user_count_change();