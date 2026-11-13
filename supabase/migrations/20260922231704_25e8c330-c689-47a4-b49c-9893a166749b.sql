CREATE OR REPLACE FUNCTION public.sync_login_title_from_welcome()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_titles text[] := ARRAY['Welcome to Your Client Hub', 'Welcome to Your Dashboard', 'Welcome'];
BEGIN
  IF NEW.welcome_headline IS NULL OR btrim(NEW.welcome_headline) = '' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.welcome_headline IS NOT DISTINCT FROM NEW.welcome_headline THEN
    RETURN NEW;
  END IF;

  UPDATE public.saas_suite_users u
     SET login_welcome_headline = NEW.welcome_headline
   WHERE (
           u.agency_id = NEW.agency_id
           OR u.agency_id_basic = NEW.agency_id
           OR u.agency_id_advanced = NEW.agency_id
           OR u.agency_id_elite = NEW.agency_id
         )
     AND (
           u.login_welcome_headline IS NULL
           OR btrim(u.login_welcome_headline) = ''
           OR btrim(u.login_welcome_headline) = ANY (default_titles)
         );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_login_title_from_welcome_trg ON public.v2_home_settings;

CREATE TRIGGER sync_login_title_from_welcome_trg
AFTER INSERT OR UPDATE OF welcome_headline ON public.v2_home_settings
FOR EACH ROW
EXECUTE FUNCTION public.sync_login_title_from_welcome();