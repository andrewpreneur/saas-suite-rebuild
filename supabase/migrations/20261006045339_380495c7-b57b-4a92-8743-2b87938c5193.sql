CREATE TABLE public.webinar_confirmation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  first_name text,
  step text NOT NULL CHECK (step IN ('free_trial','text_us','free_bonus')),
  page text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.webinar_confirmation_steps TO anon, authenticated;
GRANT ALL ON public.webinar_confirmation_steps TO service_role;
ALTER TABLE public.webinar_confirmation_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can record a step click" ON public.webinar_confirmation_steps
  FOR INSERT TO anon, authenticated
  WITH CHECK (length(coalesce(email,'')) <= 320 AND length(coalesce(first_name,'')) <= 200 AND length(coalesce(page,'')) <= 200);
CREATE INDEX webinar_confirmation_steps_email_idx ON public.webinar_confirmation_steps (lower(email));