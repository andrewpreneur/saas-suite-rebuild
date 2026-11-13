-- Add email warmup request table
CREATE TABLE IF NOT EXISTS public.email_warmup_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email text NOT NULL,
  agency_name text NOT NULL,
  sender_name text NOT NULL,
  sender_email text NOT NULL,
  profile_image_link text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_warmup_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own warmup requests"
  ON public.email_warmup_requests
  FOR SELECT
  USING (user_email = (auth.jwt() ->> 'email'::text));

CREATE POLICY "Users can insert their own warmup requests"
  ON public.email_warmup_requests
  FOR INSERT
  WITH CHECK (user_email = (auth.jwt() ->> 'email'::text));

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_email_warmup_requests_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER update_email_warmup_requests_updated_at
  BEFORE UPDATE ON public.email_warmup_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_warmup_requests_updated_at();