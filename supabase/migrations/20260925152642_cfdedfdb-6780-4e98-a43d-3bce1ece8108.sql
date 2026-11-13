CREATE OR REPLACE FUNCTION public.get_copilot_nudge_pref(user_email text)
RETURNS TABLE(enabled boolean, frequency text, last_sent_at timestamptz, next_due_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.enabled, s.frequency, s.last_sent_at, s.next_due_at
  FROM public.copilot_nudge_settings s
  WHERE lower(s.owner_email) = lower(trim(user_email));
$$;

CREATE OR REPLACE FUNCTION public.set_copilot_nudge_pref(user_email text, p_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e text := lower(trim(user_email));
BEGIN
  IF e IS NULL OR e = '' THEN RETURN false; END IF;
  INSERT INTO public.copilot_nudge_settings (owner_email, enabled)
  VALUES (e, p_enabled)
  ON CONFLICT (owner_email) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_copilot_nudge_pref(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_copilot_nudge_pref(text, boolean) TO authenticated;