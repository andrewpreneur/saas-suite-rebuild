-- Lease for GoHighLevel customer emails other than kit_purchased.
-- kit_purchased stays on one_feature_kit_actions (lynkific:<checkout>).
-- Not applied from an agent. Service role only.

CREATE TABLE public.ghl_email_claims (
  claim_key text PRIMARY KEY,
  completed boolean NOT NULL DEFAULT false,
  lease_until timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ghl_email_claims_key_len CHECK (char_length(claim_key) BETWEEN 3 AND 200)
);

COMMENT ON TABLE public.ghl_email_claims IS
  'One in-flight or completed GoHighLevel email. claim_ghl_email holds the row for 5 minutes. A 2xx sets completed. A definite non-2xx or a missing template URL clears lease_until so a retry can send. A timeout leaves the lease.';

ALTER TABLE public.ghl_email_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ghl_email_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ghl_email_claims TO service_role;

CREATE POLICY ghl_email_claims_server
  ON public.ghl_email_claims
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE FUNCTION public.claim_ghl_email(p_key text) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_key IS NULL OR char_length(p_key) < 3 OR char_length(p_key) > 200 THEN
    RETURN false;
  END IF;
  INSERT INTO public.ghl_email_claims (claim_key, lease_until)
  VALUES (p_key, now() + interval '5 minutes')
  ON CONFLICT DO NOTHING;
  IF FOUND THEN
    RETURN true;
  END IF;
  UPDATE public.ghl_email_claims
  SET lease_until = now() + interval '5 minutes',
      updated_at = now()
  WHERE claim_key = p_key
    AND NOT completed
    AND lease_until <= now();
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ghl_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ghl_email(text) TO service_role;

CREATE FUNCTION public.ghl_email_claim_touch() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ghl_email_claim_touch
  BEFORE UPDATE ON public.ghl_email_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.ghl_email_claim_touch();

REVOKE ALL ON FUNCTION public.ghl_email_claim_touch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ghl_email_claim_touch() TO service_role;
