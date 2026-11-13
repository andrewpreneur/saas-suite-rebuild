CREATE TABLE IF NOT EXISTS public.webinar_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webinar_id text,
  first_name text,
  last_name text,
  email text NOT NULL,
  phone text,
  session_date_text text,
  fbclid text,
  fbc text,
  fbp text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  landing_page text,
  page_url text,
  user_agent text,
  forwarded_at timestamptz,
  forward_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.webinar_registrations TO service_role;

ALTER TABLE public.webinar_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages webinar registrations"
ON public.webinar_registrations FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS webinar_registrations_email_idx ON public.webinar_registrations (lower(email));
CREATE INDEX IF NOT EXISTS webinar_registrations_created_idx ON public.webinar_registrations (created_at DESC);

CREATE TRIGGER update_webinar_registrations_updated_at
BEFORE UPDATE ON public.webinar_registrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();