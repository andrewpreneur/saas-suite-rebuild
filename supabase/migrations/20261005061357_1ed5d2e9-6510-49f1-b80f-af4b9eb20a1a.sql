CREATE OR REPLACE FUNCTION public.ensure_agency_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base text; cand text;
BEGIN
  IF NEW.agency_id IS NULL OR btrim(NEW.agency_id) = '' OR NEW.agency_id ~ '[\[\]{}<>\s]' THEN
    base := trim(both '-' from regexp_replace(regexp_replace(lower(coalesce(NEW.agency_name,'')), '&', ' and ', 'g'), '[^a-z0-9]+', '-', 'g'));
    cand := NULL;
    IF base <> '' AND NOT EXISTS (SELECT 1 FROM saas_suite_users WHERE agency_id = base AND lower(email) <> lower(NEW.email)) THEN
      cand := base;
    END IF;
    NEW.agency_id := coalesce(cand, replace(gen_random_uuid()::text, '-', ''));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ensure_agency_id ON public.saas_suite_users;
CREATE TRIGGER trg_ensure_agency_id BEFORE INSERT OR UPDATE ON public.saas_suite_users
FOR EACH ROW EXECUTE FUNCTION public.ensure_agency_id();

REVOKE EXECUTE ON FUNCTION public.ensure_agency_id() FROM PUBLIC, anon, authenticated;