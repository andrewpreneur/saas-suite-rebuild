-- Service-role lookup for one email. Returns a single state, never a user list.
-- Does not write saas_suite_users and does not change plan, approval, or access.
-- Not applied to the live database from this change.

CREATE OR REPLACE FUNCTION public.lookup_auth_account_for_service(user_email text)
RETURNS TABLE(user_id uuid, state text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.id,
    CASE
      WHEN au.id IS NULL THEN 'new'
      WHEN coalesce(au.encrypted_password, '') <> '' THEN 'password'
      ELSE 'needs_password'
    END
  FROM (SELECT NULLIF(btrim(user_email), '') AS email) input
  LEFT JOIN auth.users au
    ON input.email IS NOT NULL
   AND lower(au.email) = lower(input.email)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_auth_account_for_service(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lookup_auth_account_for_service(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_auth_account_for_service(text) TO service_role;

CREATE TABLE IF NOT EXISTS public.auth_account_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket text NOT NULL CHECK (bucket IN ('lookup', 'send_code', 'set_password')),
  email_hash text NOT NULL,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_account_attempts_email_idx
  ON public.auth_account_attempts (bucket, email_hash, created_at);

CREATE INDEX IF NOT EXISTS auth_account_attempts_ip_idx
  ON public.auth_account_attempts (bucket, ip_hash, created_at);

CREATE TABLE IF NOT EXISTS public.auth_password_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  salt text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_password_codes_email_idx
  ON public.auth_password_codes (email, created_at DESC);

ALTER TABLE public.auth_account_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_password_codes ENABLE ROW LEVEL SECURITY;

-- Deny client roles. Created only when missing so a second apply does not fail.
-- Service role bypasses RLS and is the only writer.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_account_attempts' AND policyname = 'auth_account_attempts_no_client'
  ) THEN
    CREATE POLICY auth_account_attempts_no_client ON public.auth_account_attempts
      FOR ALL TO anon, authenticated
      USING (false) WITH CHECK (false);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_password_codes' AND policyname = 'auth_password_codes_no_client'
  ) THEN
    CREATE POLICY auth_password_codes_no_client ON public.auth_password_codes
      FOR ALL TO anon, authenticated
      USING (false) WITH CHECK (false);
  END IF;
END $$;

REVOKE ALL ON TABLE public.auth_account_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.auth_password_codes FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.auth_account_attempts TO service_role;
GRANT ALL ON TABLE public.auth_password_codes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.auth_account_attempts_id_seq TO service_role;
