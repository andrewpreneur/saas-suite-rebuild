
CREATE TABLE public.agency_menu_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id text NOT NULL UNIQUE,
  menu_link_id text,
  remove_launchpad boolean NOT NULL DEFAULT true,
  auto_navigate_on_login boolean NOT NULL DEFAULT false,
  hidden_menu_items jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.agency_menu_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view agency_menu_config" ON public.agency_menu_config FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert agency_menu_config" ON public.agency_menu_config FOR INSERT WITH CHECK (auth.role() = 'authenticated'::text);
CREATE POLICY "Authenticated users can update agency_menu_config" ON public.agency_menu_config FOR UPDATE USING (auth.role() = 'authenticated'::text);
