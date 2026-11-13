CREATE TABLE public.ai_webinar_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text,
  email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_webinar_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can register for ai webinar"
  ON public.ai_webinar_registrations
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view registrations"
  ON public.ai_webinar_registrations
  FOR SELECT
  TO authenticated
  USING (true);
