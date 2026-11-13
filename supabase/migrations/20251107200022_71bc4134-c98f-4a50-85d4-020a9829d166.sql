-- Add free_leads_access column to saas_suite_users
ALTER TABLE public.saas_suite_users 
ADD COLUMN free_leads_access boolean NOT NULL DEFAULT false;

-- Create free_leads table
CREATE TABLE public.free_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email text NOT NULL,
  business_keywords text NOT NULL,
  city text NOT NULL,
  country text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_email UNIQUE (user_email)
);

-- Enable RLS on free_leads table
ALTER TABLE public.free_leads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for free_leads
CREATE POLICY "Users can view their own free leads request"
ON public.free_leads
FOR SELECT
USING (user_email = (auth.jwt() ->> 'email'));

CREATE POLICY "Users can insert their own free leads request"
ON public.free_leads
FOR INSERT
WITH CHECK (user_email = (auth.jwt() ->> 'email'));

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_free_leads_updated_at
BEFORE UPDATE ON public.free_leads
FOR EACH ROW
EXECUTE FUNCTION public.update_user_tool_data_updated_at();