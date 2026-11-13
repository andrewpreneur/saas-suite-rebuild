CREATE TABLE public.public_support_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  email text NOT NULL CHECK (char_length(email) BETWEEN 5 AND 320),
  agency_name text NULL CHECK (agency_name IS NULL OR char_length(agency_name) <= 160),
  topic text NOT NULL CHECK (topic IN ('Account access', 'Installation', 'Client Hub', 'Support and ticketing', 'Billing', 'Other')),
  question text NOT NULL CHECK (char_length(question) BETWEEN 10 AND 5000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'spam')),
  source text NOT NULL DEFAULT 'public_support_page',
  ip_hash text NULL,
  user_agent text NULL CHECK (user_agent IS NULL OR char_length(user_agent) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.public_support_submissions TO service_role;
ALTER TABLE public.public_support_submissions ENABLE ROW LEVEL SECURITY;
CREATE INDEX public_support_submissions_created_at_idx ON public.public_support_submissions (created_at DESC);
CREATE INDEX public_support_submissions_email_idx ON public.public_support_submissions (lower(email), created_at DESC);
CREATE OR REPLACE FUNCTION public.set_public_support_submission_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER set_public_support_submission_updated_at
BEFORE UPDATE ON public.public_support_submissions
FOR EACH ROW EXECUTE FUNCTION public.set_public_support_submission_updated_at();