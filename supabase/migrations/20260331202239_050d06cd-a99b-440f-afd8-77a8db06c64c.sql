
CREATE TABLE public.platform_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan TEXT NOT NULL,
  email_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  week_label TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage platform_emails"
  ON public.platform_emails
  FOR ALL
  TO public
  USING (lower((auth.jwt() ->> 'email'::text)) = 'andrew@dna-media.net'::text)
  WITH CHECK (lower((auth.jwt() ->> 'email'::text)) = 'andrew@dna-media.net'::text);
