CREATE TABLE public.client_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_email text,
  page_path text,
  source text,
  title text,
  message text,
  user_agent text
);
GRANT INSERT ON public.client_error_logs TO anon, authenticated;
GRANT SELECT ON public.client_error_logs TO authenticated;
GRANT ALL ON public.client_error_logs TO service_role;
ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can log errors" ON public.client_error_logs FOR INSERT TO anon, authenticated WITH CHECK (length(coalesce(message,'')) <= 4000 AND length(coalesce(title,'')) <= 500);
CREATE POLICY "Admin reads error logs" ON public.client_error_logs FOR SELECT TO authenticated USING (lower(auth.jwt()->>'email') = 'andrew@dna-media.net');