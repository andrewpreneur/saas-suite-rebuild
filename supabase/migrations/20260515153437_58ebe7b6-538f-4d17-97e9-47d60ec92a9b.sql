
-- Voice AI Support: per-agency API keys for external Voice AI agents
CREATE TABLE public.agency_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Voice AI Support',
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agency_api_keys_agency ON public.agency_api_keys(agency_id);
CREATE INDEX idx_agency_api_keys_owner ON public.agency_api_keys(lower(owner_email));

ALTER TABLE public.agency_api_keys ENABLE ROW LEVEL SECURITY;

-- Owners (matched by email) can manage their own keys
CREATE POLICY "Owners can view their api keys"
ON public.agency_api_keys FOR SELECT
TO authenticated
USING (lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE POLICY "Owners can insert their api keys"
ON public.agency_api_keys FOR INSERT
TO authenticated
WITH CHECK (lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE POLICY "Owners can update their api keys"
ON public.agency_api_keys FOR UPDATE
TO authenticated
USING (lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE POLICY "Owners can delete their api keys"
ON public.agency_api_keys FOR DELETE
TO authenticated
USING (lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')));
