
CREATE TABLE public.menu_link_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id TEXT NOT NULL,
  sub_account_id TEXT,
  hidden_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_link_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own menu_link_rules"
  ON public.menu_link_rules FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert menu_link_rules"
  ON public.menu_link_rules FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update menu_link_rules"
  ON public.menu_link_rules FOR UPDATE
  TO public
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete menu_link_rules"
  ON public.menu_link_rules FOR DELETE
  TO public
  USING (auth.role() = 'authenticated');
