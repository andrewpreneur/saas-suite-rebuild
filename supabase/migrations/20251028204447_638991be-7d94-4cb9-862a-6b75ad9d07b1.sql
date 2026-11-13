-- Create marketing_tool_data table to store user inputs and AI responses
CREATE TABLE IF NOT EXISTS public.marketing_tool_data (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email text NOT NULL,
  targeting text,
  situation text,
  solution text,
  ai_offer_data jsonb DEFAULT '{}'::jsonb,
  ai_email_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT marketing_tool_data_user_email_unique UNIQUE (user_email)
);

-- Enable RLS
ALTER TABLE public.marketing_tool_data ENABLE ROW LEVEL SECURITY;

-- Create policies for users to access only their own data
CREATE POLICY "Users can view their own marketing data"
ON public.marketing_tool_data
FOR SELECT
USING (user_email = (auth.jwt() ->> 'email'::text));

CREATE POLICY "Users can insert their own marketing data"
ON public.marketing_tool_data
FOR INSERT
WITH CHECK (user_email = (auth.jwt() ->> 'email'::text));

CREATE POLICY "Users can update their own marketing data"
ON public.marketing_tool_data
FOR UPDATE
USING (user_email = (auth.jwt() ->> 'email'::text));

CREATE POLICY "Users can delete their own marketing data"
ON public.marketing_tool_data
FOR DELETE
USING (user_email = (auth.jwt() ->> 'email'::text));

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_marketing_tool_data_updated_at()
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

CREATE TRIGGER update_marketing_tool_data_updated_at
BEFORE UPDATE ON public.marketing_tool_data
FOR EACH ROW
EXECUTE FUNCTION public.update_marketing_tool_data_updated_at();

-- Create helper functions for saving and loading marketing data
CREATE OR REPLACE FUNCTION public.save_marketing_data(
  user_email text,
  targeting_input text DEFAULT NULL,
  situation_input text DEFAULT NULL,
  solution_input text DEFAULT NULL,
  offer_data jsonb DEFAULT NULL,
  email_data jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate email
  IF user_email IS NULL OR user_email = '' THEN
    RETURN false;
  END IF;
  
  -- Upsert marketing data
  INSERT INTO marketing_tool_data (
    user_email, 
    targeting, 
    situation, 
    solution, 
    ai_offer_data, 
    ai_email_data
  )
  VALUES (
    user_email,
    COALESCE(targeting_input, ''),
    COALESCE(situation_input, ''),
    COALESCE(solution_input, ''),
    COALESCE(offer_data, '{}'::jsonb),
    COALESCE(email_data, '{}'::jsonb)
  )
  ON CONFLICT (user_email)
  DO UPDATE SET
    targeting = COALESCE(EXCLUDED.targeting, marketing_tool_data.targeting),
    situation = COALESCE(EXCLUDED.situation, marketing_tool_data.situation),
    solution = COALESCE(EXCLUDED.solution, marketing_tool_data.solution),
    ai_offer_data = COALESCE(EXCLUDED.ai_offer_data, marketing_tool_data.ai_offer_data),
    ai_email_data = COALESCE(EXCLUDED.ai_email_data, marketing_tool_data.ai_email_data),
    updated_at = now();
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_marketing_data(user_email text)
RETURNS TABLE(
  targeting text,
  situation text,
  solution text,
  ai_offer_data jsonb,
  ai_email_data jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate email
  IF user_email IS NULL OR user_email = '' THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    mtd.targeting,
    mtd.situation,
    mtd.solution,
    mtd.ai_offer_data,
    mtd.ai_email_data
  FROM marketing_tool_data mtd
  WHERE mtd.user_email = get_marketing_data.user_email;
END;
$function$;