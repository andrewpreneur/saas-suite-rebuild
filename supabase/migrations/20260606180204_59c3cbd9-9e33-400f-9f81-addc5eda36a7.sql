
CREATE TABLE public.onboarding_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  scheduled_at TIMESTAMPTZ,
  meeting_link TEXT,
  recording_link TEXT,
  notes TEXT,
  external_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_onboarding_calls_email ON public.onboarding_calls (lower(email));
CREATE INDEX idx_onboarding_calls_scheduled_at ON public.onboarding_calls (scheduled_at DESC);

GRANT SELECT ON public.onboarding_calls TO authenticated;
GRANT ALL ON public.onboarding_calls TO service_role;

ALTER TABLE public.onboarding_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own onboarding calls"
ON public.onboarding_calls
FOR SELECT
TO authenticated
USING (lower(email) = lower(COALESCE((auth.jwt() ->> 'email')::text, '')));

CREATE OR REPLACE FUNCTION public.update_onboarding_calls_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_onboarding_calls_updated_at
BEFORE UPDATE ON public.onboarding_calls
FOR EACH ROW
EXECUTE FUNCTION public.update_onboarding_calls_updated_at();
