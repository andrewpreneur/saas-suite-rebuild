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
  IF NEW.agency_id IS NULL OR NEW.agency_id = '' THEN
    RETURN NEW;
  END IF;

  fn_url := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/notify-agency-user-count';
  payload := jsonb_build_object(
    'agency_id', NEW.agency_id,
    'new_user_email', NEW.email,
    'new_user_name', NEW.name
  );

  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_agency_user_count_change failed: %', SQLERRM;
  RETURN NEW;
END;
$$;