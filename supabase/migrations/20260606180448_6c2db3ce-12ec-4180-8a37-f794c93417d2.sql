
ALTER TABLE public.onboarding_calls
  ADD COLUMN IF NOT EXISTS agency_id TEXT,
  ADD COLUMN IF NOT EXISTS owner_email TEXT;

CREATE INDEX IF NOT EXISTS idx_onboarding_calls_agency_id ON public.onboarding_calls (agency_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_calls_owner_email ON public.onboarding_calls (lower(owner_email));

-- Replace the per-email RLS policy with one that also matches via agency owner email
DROP POLICY IF EXISTS "Users can view their own onboarding calls" ON public.onboarding_calls;

CREATE POLICY "Owners can view their agency onboarding calls"
ON public.onboarding_calls
FOR SELECT
TO authenticated
USING (
  lower(COALESCE(owner_email, email)) = lower(COALESCE((auth.jwt() ->> 'email')::text, ''))
);

-- New RPC: consume by agency_id. Returns owner email + wallet/access state.
CREATE OR REPLACE FUNCTION public.consume_onboarding_call_by_agency(_agency_id text, _amount int DEFAULT 1)
RETURNS TABLE(owner_email text, new_wallet int, access_enabled bool)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_email text;
  v_new_wallet int;
  v_access bool;
BEGIN
  IF _agency_id IS NULL OR length(trim(_agency_id)) = 0 THEN
    RAISE EXCEPTION 'agency_id required';
  END IF;

  UPDATE public.saas_suite_users
  SET onboarding_call_wallet = GREATEST(COALESCE(onboarding_call_wallet, 0) - GREATEST(_amount, 1), 0),
      onboarding_call_access = CASE
        WHEN plan = 'ADVANCED' THEN true
        WHEN GREATEST(COALESCE(onboarding_call_wallet, 0) - GREATEST(_amount, 1), 0) = 0 THEN false
        ELSE onboarding_call_access
      END
  WHERE agency_id = _agency_id
     OR agency_id_basic = _agency_id
     OR agency_id_advanced = _agency_id
     OR agency_id_elite = _agency_id
     OR original_agency_id = _agency_id
     OR original_agency_id_basic = _agency_id
     OR original_agency_id_advanced = _agency_id
     OR original_agency_id_elite = _agency_id
  RETURNING email, onboarding_call_wallet, onboarding_call_access
  INTO v_owner_email, v_new_wallet, v_access;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No agency found for agency_id %', _agency_id;
  END IF;

  RETURN QUERY SELECT v_owner_email, v_new_wallet, v_access;
END;
$$;
