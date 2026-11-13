CREATE OR REPLACE FUNCTION public.notify_agency_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
  request_id bigint;
BEGIN
  IF (TG_OP = 'UPDATE') AND (NEW.agency_id IS DISTINCT FROM OLD.agency_id) THEN
    payload := jsonb_build_object(
      'owner_email', NEW.email,
      'old_agency_id', OLD.agency_id,
      'new_agency_id', NEW.agency_id
    );

    BEGIN
      SELECT net.http_post(
        url := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/notify-agency-id-change',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := payload
      ) INTO request_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_agency_id_change webhook failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_agency_id_change ON public.saas_suite_users;

CREATE TRIGGER trg_notify_agency_id_change
AFTER UPDATE OF agency_id ON public.saas_suite_users
FOR EACH ROW
EXECUTE FUNCTION public.notify_agency_id_change();