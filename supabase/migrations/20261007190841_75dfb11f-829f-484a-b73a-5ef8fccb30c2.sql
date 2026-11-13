CREATE TABLE public.one_feature_training_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 255),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 7 AND 30),
  has_highlevel boolean NOT NULL,
  page text NOT NULL CHECK (char_length(page) <= 60),
  form text NOT NULL CHECK (char_length(form) <= 40),
  utm jsonb CHECK (pg_column_size(utm) < 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.one_feature_training_leads TO anon, authenticated;
GRANT ALL ON public.one_feature_training_leads TO service_role;
ALTER TABLE public.one_feature_training_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visitors can submit the training form" ON public.one_feature_training_leads
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Platform admin can read leads" ON public.one_feature_training_leads
  FOR SELECT TO authenticated USING (lower(auth.jwt()->>'email') = 'andrew@dna-media.net');
GRANT SELECT ON public.one_feature_training_leads TO authenticated;