
CREATE OR REPLACE FUNCTION public.set_updated_at_workflows()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE TABLE public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id text NOT NULL,
  trigger_type text NOT NULL,
  webhook_url text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, trigger_type)
);

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view workflows" ON public.workflows FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert workflows" ON public.workflows FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can update workflows" ON public.workflows FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can delete workflows" ON public.workflows FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin can manage workflows" ON public.workflows FOR ALL
  USING (lower((auth.jwt() ->> 'email'::text)) = 'andrew@dna-media.net')
  WITH CHECK (lower((auth.jwt() ->> 'email'::text)) = 'andrew@dna-media.net');

CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_workflows();

CREATE INDEX idx_workflows_agency ON public.workflows(agency_id);
