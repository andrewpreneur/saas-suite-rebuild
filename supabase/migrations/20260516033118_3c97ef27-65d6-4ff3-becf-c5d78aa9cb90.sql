
ALTER TABLE public.agency_video_settings
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.custom_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id text NOT NULL,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (agency_id, title)
);

ALTER TABLE public.custom_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view custom modules"
  ON public.custom_modules FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Agency owners can insert custom modules"
  ON public.custom_modules FOR INSERT
  TO authenticated
  WITH CHECK (can_access_agency(agency_id));

CREATE POLICY "Agency owners can update custom modules"
  ON public.custom_modules FOR UPDATE
  TO authenticated
  USING (can_access_agency(agency_id))
  WITH CHECK (can_access_agency(agency_id));

CREATE POLICY "Agency owners can delete custom modules"
  ON public.custom_modules FOR DELETE
  TO authenticated
  USING (can_access_agency(agency_id));

CREATE INDEX IF NOT EXISTS custom_modules_agency_idx ON public.custom_modules(agency_id);

CREATE OR REPLACE FUNCTION public.update_custom_modules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_custom_modules_updated_at ON public.custom_modules;
CREATE TRIGGER trg_custom_modules_updated_at
  BEFORE UPDATE ON public.custom_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_custom_modules_updated_at();
