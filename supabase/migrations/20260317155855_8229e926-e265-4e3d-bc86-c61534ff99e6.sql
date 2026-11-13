CREATE OR REPLACE FUNCTION public.create_agency_version_safe(user_email text, version_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_agency_id text;
  column_name text;
  current_legacy_id text;
  current_basic_id text;
  current_agency_name text;
  current_use_name_url boolean;
  name_slug text;
  suffix text;
BEGIN
  IF user_email IS NULL OR user_email = '' THEN
    RAISE EXCEPTION 'Email cannot be empty';
  END IF;
  
  IF version_type NOT IN ('basic', 'advanced', 'elite') THEN
    RAISE EXCEPTION 'Version type must be basic, advanced, or elite';
  END IF;
  
  column_name := 'agency_id_' || version_type;
  
  -- Fetch agency name info for slug-based IDs
  SELECT agency_name, use_agency_name_url
  INTO current_agency_name, current_use_name_url
  FROM public.saas_suite_users
  WHERE email = user_email;

  -- Build a slug from agency_name if available
  IF current_agency_name IS NOT NULL AND current_agency_name <> '' THEN
    name_slug := lower(regexp_replace(current_agency_name, '[^a-zA-Z0-9]', '', 'g'));
  END IF;

  -- Determine suffix for plan tiers
  IF version_type = 'advanced' THEN suffix := '-2';
  ELSIF version_type = 'elite' THEN suffix := '-3';
  ELSE suffix := '';
  END IF;

  -- Special handling for BASIC
  IF version_type = 'basic' THEN
    SELECT agency_id, agency_id_basic INTO current_legacy_id, current_basic_id
    FROM public.saas_suite_users
    WHERE email = user_email;

    IF current_basic_id IS NOT NULL AND current_basic_id <> '' THEN
      RETURN current_basic_id;
    END IF;

    IF current_legacy_id IS NOT NULL AND current_legacy_id <> '' THEN
      UPDATE public.saas_suite_users
      SET agency_id_basic = current_legacy_id
      WHERE email = user_email;
      RETURN current_legacy_id;
    END IF;

    -- Use name slug if available, otherwise random
    IF name_slug IS NOT NULL AND name_slug <> '' THEN
      new_agency_id := name_slug;
    ELSE
      new_agency_id := REPLACE(gen_random_uuid()::text, '-', '');
    END IF;
    
    UPDATE public.saas_suite_users
    SET agency_id = new_agency_id,
        agency_id_basic = new_agency_id
    WHERE email = user_email;
    RETURN new_agency_id;
  END IF;

  -- For advanced/elite: use name slug + suffix if available, otherwise random UUID
  IF name_slug IS NOT NULL AND name_slug <> '' THEN
    new_agency_id := name_slug || suffix;
  ELSE
    new_agency_id := REPLACE(gen_random_uuid()::text, '-', '');
  END IF;

  EXECUTE format('UPDATE public.saas_suite_users SET %I = $1 WHERE email = $2', column_name)
  USING new_agency_id, user_email;
  
  RETURN new_agency_id;
END;
$$;