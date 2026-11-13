CREATE OR REPLACE FUNCTION public.giveaway_rescore_me()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
BEGIN
  IF v_email = '' THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.giveaway_entries WHERE email = v_email) THEN
    RETURN NULL;
  END IF;
  PERFORM public.giveaway_recalculate(v_email);
  RETURN public.giveaway_stats();
END;
$$;

REVOKE ALL ON FUNCTION public.giveaway_rescore_me() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.giveaway_rescore_me() TO authenticated, service_role;