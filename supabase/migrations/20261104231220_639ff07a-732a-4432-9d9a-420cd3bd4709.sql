DROP TRIGGER IF EXISTS trg_notify_agency_user_count_update ON public.user_progress;

CREATE OR REPLACE FUNCTION public.notify_agency_user_count_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  ids text[];
BEGIN
  IF NEW.agency_id IS NULL OR NEW.agency_id = '' THEN RETURN NEW; END IF;

  IF COALESCE(trim(NEW.email), '') <> '' THEN
    SELECT array_remove(ARRAY[s.agency_id, s.agency_id_basic, s.agency_id_advanced, s.agency_id_elite,
           s.original_agency_id, s.original_agency_id_basic, s.original_agency_id_advanced, s.original_agency_id_elite], NULL)
      INTO ids
      FROM public.saas_suite_users s
     WHERE NEW.agency_id IN (s.agency_id, s.agency_id_basic, s.agency_id_advanced, s.agency_id_elite)
     LIMIT 1;
    IF ids IS NULL THEN ids := ARRAY[NEW.agency_id]; END IF;

    IF EXISTS (
      SELECT 1 FROM public.user_progress up
       WHERE up.id <> NEW.id
         AND lower(trim(up.email)) = lower(trim(NEW.email))
         AND up.agency_id = ANY(ids)
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  PERFORM net.http_post(
    url := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/notify-agency-user-count',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('agency_id', NEW.agency_id,
      'new_user_email', COALESCE(NEW.email, ''), 'new_user_name', COALESCE(NEW.name, ''))
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_agency_user_count_change failed: %', SQLERRM;
  RETURN NEW;
END;
$$;