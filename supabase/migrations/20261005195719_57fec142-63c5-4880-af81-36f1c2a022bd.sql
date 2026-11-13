CREATE OR REPLACE FUNCTION public.create_agency_version_safe(user_email text, version_type text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  new_agency_id text; col text; existing text;
  v_legacy text; v_basic text; v_name text;
  base text; suffix text; norm_email text;
BEGIN
  IF user_email IS NULL OR btrim(user_email) = '' THEN RAISE EXCEPTION 'Email cannot be empty'; END IF;
  IF version_type NOT IN ('basic','advanced','elite') THEN RAISE EXCEPTION 'Version type must be basic, advanced, or elite'; END IF;
  norm_email := lower(btrim(user_email));
  col := 'agency_id_' || version_type;

  SELECT agency_id, agency_id_basic, agency_name INTO v_legacy, v_basic, v_name
  FROM public.saas_suite_users WHERE lower(email) = norm_email LIMIT 1;

  IF version_type = 'basic' THEN
    IF coalesce(v_basic,'') <> '' THEN RETURN v_basic; END IF;
    IF coalesce(v_legacy,'') <> '' THEN
      UPDATE public.saas_suite_users SET agency_id_basic = v_legacy WHERE lower(email) = norm_email;
      RETURN v_legacy;
    END IF;
  END IF;

  EXECUTE format('SELECT %I FROM public.saas_suite_users WHERE lower(email) = $1 LIMIT 1', col) INTO existing USING norm_email;
  IF coalesce(existing,'') <> '' THEN RETURN existing; END IF;

  -- Base = plan-1 agency ID when it is name-based, else a slug of the agency name.
  base := nullif(coalesce(nullif(v_basic,''), v_legacy), '');
  IF base IS NULL OR base ~ '^[0-9a-f]{32}$' THEN
    base := nullif(lower(regexp_replace(coalesce(v_name,''), '[^a-zA-Z0-9]', '', 'g')), '');
  END IF;

  suffix := CASE version_type WHEN 'advanced' THEN '-2' WHEN 'elite' THEN '-3' ELSE '' END;

  IF base IS NOT NULL THEN
    new_agency_id := base || suffix;
    IF EXISTS (SELECT 1 FROM public.saas_suite_users u WHERE lower(u.email) <> norm_email
               AND new_agency_id IN (u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite)) THEN
      new_agency_id := NULL;
    END IF;
  END IF;
  IF new_agency_id IS NULL THEN new_agency_id := replace(gen_random_uuid()::text, '-', ''); END IF;

  IF version_type = 'basic' THEN
    UPDATE public.saas_suite_users SET agency_id = new_agency_id, agency_id_basic = new_agency_id WHERE lower(email) = norm_email;
  ELSE
    EXECUTE format('UPDATE public.saas_suite_users SET %I = $1 WHERE lower(email) = $2', col) USING new_agency_id, norm_email;
  END IF;
  RETURN new_agency_id;
END;
$function$;