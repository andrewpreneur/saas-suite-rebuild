
ALTER TABLE public.email_warmup_requests ADD COLUMN IF NOT EXISTS warmed_domain text;
ALTER TABLE public.free_leads ADD COLUMN IF NOT EXISTS leads_url text;
ALTER TABLE public.free_leads ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

DO $$ BEGIN
  CREATE POLICY "Admin can update email warmup requests"
  ON public.email_warmup_requests FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'andrew@dna-media.net')
  WITH CHECK ((auth.jwt() ->> 'email') = 'andrew@dna-media.net');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin can select all email warmup requests"
  ON public.email_warmup_requests FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = 'andrew@dna-media.net');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin can update free leads"
  ON public.free_leads FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'andrew@dna-media.net')
  WITH CHECK ((auth.jwt() ->> 'email') = 'andrew@dna-media.net');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin can select all free leads"
  ON public.free_leads FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = 'andrew@dna-media.net');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
