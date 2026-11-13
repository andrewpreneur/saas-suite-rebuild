CREATE OR REPLACE FUNCTION public.ensure_agency_id()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE base text; cand text; old_id text;
BEGIN
  base := trim(both '-' from regexp_replace(regexp_replace(lower(coalesce(NEW.agency_name,'')), '&', ' and ', 'g'), '[^a-z0-9]+', '-', 'g'));

  IF NEW.agency_id IS NULL OR btrim(NEW.agency_id) = '' OR NEW.agency_id ~ '[\[\]{}<>\s]' THEN
    cand := NULL;
    IF base <> '' AND NOT EXISTS (SELECT 1 FROM saas_suite_users WHERE base IN (agency_id, agency_id_basic, agency_id_advanced, agency_id_elite) AND lower(email) <> lower(NEW.email)) THEN
      cand := base;
    END IF;
    NEW.agency_id := coalesce(cand, replace(gen_random_uuid()::text, '-', ''));
  END IF;

  -- Rename: when the agency name changes, the IDs follow it (data moves via carry trigger).
  IF TG_OP = 'UPDATE'
     AND base <> ''
     AND lower(btrim(coalesce(NEW.agency_name,''))) IS DISTINCT FROM lower(btrim(coalesce(OLD.agency_name,'')))
     AND NEW.agency_id IS NOT DISTINCT FROM OLD.agency_id
     AND NEW.agency_id <> base
     AND NOT EXISTS (
       SELECT 1 FROM saas_suite_users
       WHERE lower(email) <> lower(NEW.email)
         AND (base IN (agency_id, agency_id_basic, agency_id_advanced, agency_id_elite)
           OR base || '-2' IN (agency_id, agency_id_basic, agency_id_advanced, agency_id_elite)
           OR base || '-3' IN (agency_id, agency_id_basic, agency_id_advanced, agency_id_elite))
     ) THEN
    old_id := NEW.agency_id;
    NEW.original_agency_id := coalesce(NEW.original_agency_id, old_id);
    NEW.agency_id := base;
    IF NEW.agency_id_basic IS NULL OR NEW.agency_id_basic = old_id THEN
      NEW.agency_id_basic := base;
    ELSE
      NEW.original_agency_id_basic := coalesce(NEW.original_agency_id_basic, NEW.agency_id_basic);
      NEW.agency_id_basic := base;
    END IF;
    IF NEW.agency_id_advanced IS NOT NULL AND btrim(NEW.agency_id_advanced) <> '' THEN
      NEW.original_agency_id_advanced := coalesce(NEW.original_agency_id_advanced, NEW.agency_id_advanced);
      NEW.agency_id_advanced := base || '-2';
    END IF;
    IF NEW.agency_id_elite IS NOT NULL AND btrim(NEW.agency_id_elite) <> '' THEN
      NEW.original_agency_id_elite := coalesce(NEW.original_agency_id_elite, NEW.agency_id_elite);
      NEW.agency_id_elite := base || '-3';
    END IF;
  END IF;

  -- Plan 1 always exists and is the main agency ID.
  IF NEW.agency_id_basic IS NULL OR btrim(NEW.agency_id_basic) = '' THEN
    NEW.agency_id_basic := NEW.agency_id;
  END IF;
  RETURN NEW;
END $function$;

UPDATE public.saas_suite_users SET agency_id_basic = agency_id
WHERE (agency_id_basic IS NULL OR btrim(agency_id_basic) = '') AND agency_id IS NOT NULL;