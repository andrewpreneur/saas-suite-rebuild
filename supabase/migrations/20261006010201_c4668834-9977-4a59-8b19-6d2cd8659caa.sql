CREATE OR REPLACE FUNCTION public.ensure_agency_id()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE base text; cand text; old_id text; pbase text; i int; is_placeholder boolean; in_use boolean;
BEGIN
  base := trim(both '-' from regexp_replace(regexp_replace(lower(coalesce(NEW.agency_name,'')), '&', ' and ', 'g'), '[^a-z0-9]+', '-', 'g'));
  pbase := nullif(base,'');
  IF pbase IS NULL THEN pbase := nullif(trim(both '-' from regexp_replace(lower(coalesce(NEW.full_name,'')), '[^a-z0-9]+', '-', 'g')),''); END IF;
  IF pbase IS NULL THEN pbase := nullif(trim(both '-' from regexp_replace(lower(split_part(coalesce(NEW.email,''),'@',1)), '[^a-z0-9]+', '-', 'g')),''); END IF;

  IF NEW.agency_id IS NULL OR btrim(NEW.agency_id) = '' OR NEW.agency_id ~ '[\[\]{}<>\s]' THEN
    NEW.agency_id := replace(gen_random_uuid()::text, '-', '');
  END IF;

  -- Placeholder (random hex) IDs are swapped for a readable one while nothing depends on them yet.
  is_placeholder := NEW.agency_id ~ '^[0-9a-f]{24,}$';
  IF is_placeholder AND pbase IS NOT NULL AND NEW.install_confirmed_at IS NULL THEN
    in_use := EXISTS (SELECT 1 FROM hub_ip_sessions h WHERE h.agency_id = NEW.agency_id)
           OR EXISTS (SELECT 1 FROM user_progress p WHERE p.agency_id = NEW.agency_id);
    IF NOT in_use THEN
      cand := NULL;
      FOR i IN 1..40 LOOP
        cand := CASE WHEN i = 1 THEN pbase ELSE pbase || '-' || (i+2) END;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM saas_suite_users
          WHERE lower(email) <> lower(coalesce(NEW.email,''))
            AND (cand IN (agency_id, agency_id_basic, agency_id_advanced, agency_id_elite)
              OR cand || '-2' IN (agency_id, agency_id_basic, agency_id_advanced, agency_id_elite)
              OR cand || '-3' IN (agency_id, agency_id_basic, agency_id_advanced, agency_id_elite)));
        cand := NULL;
      END LOOP;
      IF cand IS NOT NULL THEN
        old_id := NEW.agency_id;
        IF TG_OP = 'UPDATE' THEN NEW.original_agency_id := coalesce(NEW.original_agency_id, old_id); END IF;
        NEW.agency_id := cand;
        IF NEW.agency_id_basic IS NULL OR btrim(NEW.agency_id_basic) = '' OR NEW.agency_id_basic = old_id OR NEW.agency_id_basic ~ '^[0-9a-f]{24,}$' THEN
          NEW.agency_id_basic := cand;
        END IF;
        IF NEW.agency_id_advanced ~ '^[0-9a-f]{24,}$' THEN NEW.agency_id_advanced := cand || '-2'; END IF;
        IF NEW.agency_id_elite ~ '^[0-9a-f]{24,}$' THEN NEW.agency_id_elite := cand || '-3'; END IF;
      END IF;
    END IF;
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

  IF NEW.agency_id_basic IS NULL OR btrim(NEW.agency_id_basic) = '' THEN
    NEW.agency_id_basic := NEW.agency_id;
  END IF;
  RETURN NEW;
END $function$;