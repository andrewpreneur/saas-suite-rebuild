CREATE OR REPLACE FUNCTION public.migrate_agency_id(
  p_old_id text,
  p_new_id text,
  p_email text DEFAULT NULL,
  p_source text DEFAULT 'manual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec record;
  moved jsonb := '{}'::jsonb;
  n integer;
  merged integer;
BEGIN
  IF p_old_id IS NULL OR p_new_id IS NULL THEN RETURN moved; END IF;
  IF btrim(p_old_id) = '' OR btrim(p_new_id) = '' THEN RETURN moved; END IF;
  IF p_old_id = p_new_id THEN RETURN moved; END IF;

  IF EXISTS (
    SELECT 1 FROM public.saas_suite_users u
    WHERE (p_email IS NULL OR lower(u.email) <> lower(p_email))
      AND p_old_id IN (u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite)
  ) THEN
    RETURN moved;
  END IF;

  FOR rec IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'agency_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('saas_suite_users', 'agency_id_migrations')
    ORDER BY c.table_name
  LOOP
    BEGIN
      EXECUTE format(
        'UPDATE public.%I SET agency_id = $1 WHERE agency_id = $2',
        rec.table_name
      ) USING p_new_id, p_old_id;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n > 0 THEN
        moved := moved || jsonb_build_object(rec.table_name, n);
      END IF;
    EXCEPTION WHEN unique_violation OR foreign_key_violation OR check_violation THEN
      moved := moved || jsonb_build_object(rec.table_name, 'skipped_conflict');
    END;
  END LOOP;

  -- The new hub may already have a settings row created with defaults (AI chat off).
  -- Never let a rename silently disable AI support: carry the AI config forward.
  UPDATE public.v2_home_settings nw
  SET ai_chat_enabled = true,
      ai_chat_name = COALESCE(od.ai_chat_name, nw.ai_chat_name),
      ai_chat_type = COALESCE(od.ai_chat_type, nw.ai_chat_type),
      ai_chat_icon_url = COALESCE(nw.ai_chat_icon_url, od.ai_chat_icon_url)
  FROM public.v2_home_settings od
  WHERE nw.agency_id = p_new_id
    AND od.agency_id = p_old_id
    AND od.ai_chat_enabled IS TRUE
    AND COALESCE(nw.ai_chat_enabled, false) IS FALSE;
  GET DIAGNOSTICS merged = ROW_COUNT;
  IF merged > 0 THEN
    moved := moved || jsonb_build_object('v2_home_settings_ai_merged', merged);
  END IF;

  IF moved <> '{}'::jsonb THEN
    INSERT INTO public.agency_id_migrations (old_agency_id, new_agency_id, user_email, source, moved)
    VALUES (p_old_id, p_new_id, p_email, p_source, moved);
  END IF;

  RETURN moved;
END;
$$;

REVOKE ALL ON FUNCTION public.migrate_agency_id(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.migrate_agency_id(text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.migrate_agency_id(text, text, text, text) TO service_role;