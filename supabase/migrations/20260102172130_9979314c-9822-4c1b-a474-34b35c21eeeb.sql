-- Add client_hub_enabled column to saas_suite_users table
ALTER TABLE public.saas_suite_users
ADD COLUMN IF NOT EXISTS client_hub_enabled boolean NOT NULL DEFAULT false;

-- Add custom_ai_general_help_enabled column 
ALTER TABLE public.saas_suite_users
ADD COLUMN IF NOT EXISTS custom_ai_general_help_enabled boolean NOT NULL DEFAULT false;

-- Create table for agency daily checklist items
CREATE TABLE IF NOT EXISTS public.agency_daily_checklist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id text NOT NULL,
  item_1 text DEFAULT 'Complete your daily outreach',
  item_2 text DEFAULT 'Follow up with pending leads',
  item_3 text DEFAULT 'Review your pipeline progress',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(agency_id)
);

-- Enable RLS on the new table
ALTER TABLE public.agency_daily_checklist ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for agency_daily_checklist
CREATE POLICY "Allow all access to agency_daily_checklist" 
ON public.agency_daily_checklist 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger for automatic timestamp updates on agency_daily_checklist
CREATE OR REPLACE FUNCTION public.update_agency_daily_checklist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_agency_daily_checklist_updated_at
BEFORE UPDATE ON public.agency_daily_checklist
FOR EACH ROW
EXECUTE FUNCTION public.update_agency_daily_checklist_updated_at();