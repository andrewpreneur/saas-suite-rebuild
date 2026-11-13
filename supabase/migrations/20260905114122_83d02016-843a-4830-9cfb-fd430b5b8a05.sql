CREATE OR REPLACE FUNCTION public.agency_ids_for_email(user_email text)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT DISTINCT x FROM (
      SELECT unnest(ARRAY[u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite]) AS x
      FROM public.saas_suite_users u
      WHERE lower(u.email) = lower(trim(user_email))
      LIMIT 4
    ) s WHERE x IS NOT NULL AND trim(x) <> ''
  );
$$;

CREATE OR REPLACE FUNCTION public.is_hub_installed(user_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ids text[];
  confirmed timestamptz;
BEGIN
  SELECT install_confirmed_at INTO confirmed
  FROM public.saas_suite_users
  WHERE lower(email) = lower(trim(user_email))
  LIMIT 1;

  IF confirmed IS NOT NULL THEN
    RETURN true;
  END IF;

  ids := public.agency_ids_for_email(user_email);
  IF ids IS NULL OR array_length(ids, 1) IS NULL THEN
    RETURN false;
  END IF;

  -- Saved menu link ID (classic proof)
  IF EXISTS (
    SELECT 1 FROM public.agency_menu_config c
    WHERE c.agency_id = ANY(ids)
      AND (coalesce(trim(c.menu_link_id), '') <> '' OR coalesce(trim(c.menu_link_id_2), '') <> '')
  ) THEN RETURN true; END IF;

  -- Saved menu configuration at all (they got through the guide)
  IF EXISTS (SELECT 1 FROM public.agency_menu_config c WHERE c.agency_id = ANY(ids)) THEN
    RETURN true;
  END IF;

  -- Real clients using the hub = it is live inside HighLevel
  IF EXISTS (SELECT 1 FROM public.user_progress p WHERE p.agency_id = ANY(ids)) THEN
    RETURN true;
  END IF;

  IF EXISTS (SELECT 1 FROM public.ai_chat_messages m WHERE m.agency_id = ANY(ids)) THEN
    RETURN true;
  END IF;

  IF EXISTS (SELECT 1 FROM public.hub_ip_sessions h WHERE h.agency_id = ANY(ids)) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.agency_ids_for_email(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_hub_installed(text) TO authenticated, anon, service_role;

-- Backfill confirmation for every account that clearly has a live hub
UPDATE public.saas_suite_users u
SET install_confirmed_at = now()
WHERE u.install_confirmed_at IS NULL
  AND public.is_hub_installed(u.email);