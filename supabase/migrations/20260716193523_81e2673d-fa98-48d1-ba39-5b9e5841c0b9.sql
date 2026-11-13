
CREATE TABLE public.agency_category_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  tier text NOT NULL CHECK (tier IN ('basic','advanced','elite')),
  category_key text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, tier, category_key)
);
GRANT SELECT ON public.agency_category_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_category_settings TO authenticated;
GRANT ALL ON public.agency_category_settings TO service_role;
ALTER TABLE public.agency_category_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read agency_category_settings"
  ON public.agency_category_settings FOR SELECT
  USING (true);

CREATE POLICY "Owners manage their agency_category_settings"
  ON public.agency_category_settings FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.saas_suite_users u
    WHERE lower(u.email) = lower(coalesce(auth.jwt() ->> 'email',''))
      AND agency_id IN (u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.saas_suite_users u
    WHERE lower(u.email) = lower(coalesce(auth.jwt() ->> 'email',''))
      AND agency_id IN (u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite)
  ));

CREATE TRIGGER agency_category_settings_updated_at
  BEFORE UPDATE ON public.agency_category_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.agency_module_name_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  tier text NOT NULL CHECK (tier IN ('basic','advanced','elite')),
  category_id text NOT NULL,
  module_id text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, tier, category_id, module_id)
);
GRANT SELECT ON public.agency_module_name_overrides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_module_name_overrides TO authenticated;
GRANT ALL ON public.agency_module_name_overrides TO service_role;
ALTER TABLE public.agency_module_name_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read agency_module_name_overrides"
  ON public.agency_module_name_overrides FOR SELECT
  USING (true);

CREATE POLICY "Owners manage their agency_module_name_overrides"
  ON public.agency_module_name_overrides FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.saas_suite_users u
    WHERE lower(u.email) = lower(coalesce(auth.jwt() ->> 'email',''))
      AND agency_id IN (u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.saas_suite_users u
    WHERE lower(u.email) = lower(coalesce(auth.jwt() ->> 'email',''))
      AND agency_id IN (u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite)
  ));

CREATE TRIGGER agency_module_name_overrides_updated_at
  BEFORE UPDATE ON public.agency_module_name_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
