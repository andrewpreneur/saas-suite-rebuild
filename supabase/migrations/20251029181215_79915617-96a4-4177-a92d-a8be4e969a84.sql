-- Drop and recreate save_marketing_data with improved NULL handling
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
  
  -- Upsert marketing data with proper NULL handling
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
    targeting_input,
    situation_input,
    solution_input,
    offer_data,
    email_data
  )
  ON CONFLICT (user_email)
  DO UPDATE SET
    targeting = CASE 
      WHEN EXCLUDED.targeting IS NOT NULL THEN EXCLUDED.targeting 
      ELSE marketing_tool_data.targeting 
    END,
    situation = CASE 
      WHEN EXCLUDED.situation IS NOT NULL THEN EXCLUDED.situation 
      ELSE marketing_tool_data.situation 
    END,
    solution = CASE 
      WHEN EXCLUDED.solution IS NOT NULL THEN EXCLUDED.solution 
      ELSE marketing_tool_data.solution 
    END,
    ai_offer_data = CASE 
      WHEN EXCLUDED.ai_offer_data IS NOT NULL AND EXCLUDED.ai_offer_data != '{}'::jsonb 
      THEN EXCLUDED.ai_offer_data 
      ELSE marketing_tool_data.ai_offer_data 
    END,
    ai_email_data = CASE 
      WHEN EXCLUDED.ai_email_data IS NOT NULL AND EXCLUDED.ai_email_data != '{}'::jsonb 
      THEN EXCLUDED.ai_email_data 
      ELSE marketing_tool_data.ai_email_data 
    END,
    updated_at = now();
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$function$;