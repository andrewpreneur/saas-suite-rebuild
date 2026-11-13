ALTER TABLE public.community_profiles
  ADD COLUMN IF NOT EXISTS joined_at timestamptz,
  ADD COLUMN IF NOT EXISTS active_subaccounts text,
  ADD COLUMN IF NOT EXISTS highlevel_experience text,
  ADD COLUMN IF NOT EXISTS show_account_count boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.community_join(
  _display_name text DEFAULT NULL,
  _active_subaccounts text DEFAULT NULL,
  _highlevel_experience text DEFAULT NULL,
  _show_account_count boolean DEFAULT true,
  _bio text DEFAULT NULL
)
RETURNS public.community_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.community_profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.community_ensure_profile(_display_name, NULL);

  UPDATE public.community_profiles p
     SET display_name = COALESCE(NULLIF(trim(_display_name), ''), p.display_name),
         bio = COALESCE(NULLIF(trim(_bio), ''), p.bio),
         active_subaccounts = COALESCE(_active_subaccounts, p.active_subaccounts),
         highlevel_experience = COALESCE(_highlevel_experience, p.highlevel_experience),
         show_account_count = COALESCE(_show_account_count, p.show_account_count),
         joined_at = COALESCE(p.joined_at, now()),
         updated_at = now()
   WHERE p.id = auth.uid()
   RETURNING * INTO _row;

  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_onboarding_prefill()
RETURNS TABLE(display_name text, active_subaccounts text, highlevel_experience text, most_used_feature text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(
      (SELECT up.name FROM public.user_progress up
        WHERE lower(up.email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))
          AND up.name IS NOT NULL AND up.name <> ''
        ORDER BY up.created_at DESC LIMIT 1),
      NULL
    )::text,
    r.active_subaccounts::text,
    r.highlevel_experience::text,
    r.most_used_feature::text
  FROM (SELECT * FROM public.user_onboarding_responses o
         WHERE o.user_id = auth.uid()
         ORDER BY o.updated_at DESC LIMIT 1) r
  RIGHT JOIN (SELECT 1) dummy ON true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.community_join(text, text, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_onboarding_prefill() TO authenticated;