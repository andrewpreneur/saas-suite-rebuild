-- Resolve an agency for a user_progress row from every available signal
CREATE OR REPLACE FUNCTION public.trace_agency_id_for_user(p_email text, p_name text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := NULLIF(lower(btrim(p_email)), '');
  v_name  text := NULLIF(btrim(p_name), '');
  v_agency text;
BEGIN
  IF v_email IS NULL AND v_name IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1) another user_progress row for the same person already has an agency
  IF v_email IS NOT NULL THEN
    SELECT up.agency_id INTO v_agency
    FROM public.user_progress up
    WHERE lower(up.email) = v_email AND up.agency_id IS NOT NULL
    LIMIT 1;
    IF v_agency IS NOT NULL THEN RETURN v_agency; END IF;
  END IF;

  IF v_name IS NOT NULL THEN
    SELECT up.agency_id INTO v_agency
    FROM public.user_progress up
    WHERE lower(up.name) = lower(v_name) AND up.agency_id IS NOT NULL
    LIMIT 1;
    IF v_agency IS NOT NULL THEN RETURN v_agency; END IF;
  END IF;

  -- 2) this email is itself a SaaS Suite account owner -> use their own agency
  IF v_email IS NOT NULL THEN
    SELECT COALESCE(s.agency_id, s.agency_id_advanced, s.agency_id_basic, s.agency_id_elite)
    INTO v_agency
    FROM public.saas_suite_users s
    WHERE lower(s.email) = v_email
    LIMIT 1;
    IF v_agency IS NOT NULL THEN RETURN v_agency; END IF;
  END IF;

  -- 3) support tickets they submitted
  IF v_email IS NOT NULL THEN
    SELECT t.agency_id INTO v_agency
    FROM public.support_tickets t
    WHERE lower(t.customer_email) = v_email AND t.agency_id IS NOT NULL
    ORDER BY t.created_at DESC
    LIMIT 1;
    IF v_agency IS NOT NULL THEN RETURN v_agency; END IF;
  END IF;

  -- 4) AI chat threads keyed by their identifier
  SELECT ct.agency_id INTO v_agency
  FROM public.chat_threads ct
  WHERE ct.agency_id IS NOT NULL
    AND lower(ct.user_identifier) IN (COALESCE(v_email, '~'), lower(COALESCE(v_name, '~')))
  ORDER BY ct.created_at DESC
  LIMIT 1;
  IF v_agency IS NOT NULL THEN RETURN v_agency; END IF;

  -- 5) onboarding checklist completions keyed by their identifier
  SELECT c.agency_id INTO v_agency
  FROM public.user_onboarding_checklist_completion c
  WHERE c.agency_id IS NOT NULL
    AND lower(c.user_identifier) IN (COALESCE(v_email, '~'), lower(COALESCE(v_name, '~')))
  LIMIT 1;

  RETURN v_agency;
END;
$$;

-- Trigger: never store a user_progress row with a blank agency when we can trace one
CREATE OR REPLACE FUNCTION public.user_progress_fill_agency_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.agency_id IS NULL OR btrim(NEW.agency_id) = '' THEN
    NEW.agency_id := public.trace_agency_id_for_user(NEW.email, NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_progress_fill_agency_id ON public.user_progress;
CREATE TRIGGER trg_user_progress_fill_agency_id
BEFORE INSERT OR UPDATE OF email, name, agency_id ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.user_progress_fill_agency_id();

-- Backfill existing rows with a missing agency
UPDATE public.user_progress up
SET agency_id = public.trace_agency_id_for_user(up.email, up.name)
WHERE up.agency_id IS NULL
  AND public.trace_agency_id_for_user(up.email, up.name) IS NOT NULL;
