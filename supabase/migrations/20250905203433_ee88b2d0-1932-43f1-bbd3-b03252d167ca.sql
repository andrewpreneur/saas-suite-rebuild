-- Create functions to manage agency video settings
CREATE OR REPLACE FUNCTION public.get_agency_video_settings(lookup_agency_id text, lookup_tier text)
RETURNS TABLE(category_id text, module_id text, is_visible boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate inputs
  IF lookup_agency_id IS NULL OR lookup_agency_id = '' THEN
    RETURN;
  END IF;
  
  -- Return video settings for the specific agency and tier
  -- If no custom settings exist, the default behavior is all videos visible (handled in frontend)
  RETURN QUERY
  SELECT 
    avs.category_id,
    avs.module_id,
    avs.is_visible
  FROM agency_video_settings avs
  WHERE avs.agency_id = lookup_agency_id 
    AND avs.tier = COALESCE(lookup_tier, 'basic');
END;
$function$;

-- Create function to save/update video settings
CREATE OR REPLACE FUNCTION public.save_agency_video_setting(
  agency_id_param text,
  tier_param text,
  category_id_param text,
  module_id_param text,
  is_visible_param boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate inputs
  IF agency_id_param IS NULL OR agency_id_param = '' OR
     tier_param IS NULL OR tier_param = '' OR
     category_id_param IS NULL OR category_id_param = '' OR
     module_id_param IS NULL OR module_id_param = '' THEN
    RETURN false;
  END IF;
  
  -- Upsert the video setting
  INSERT INTO agency_video_settings (agency_id, tier, category_id, module_id, is_visible)
  VALUES (agency_id_param, tier_param, category_id_param, module_id_param, is_visible_param)
  ON CONFLICT (agency_id, tier, category_id, module_id)
  DO UPDATE SET 
    is_visible = EXCLUDED.is_visible,
    updated_at = now();
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$function$;

-- Create function to delete video settings (for reverting to default visible state)
CREATE OR REPLACE FUNCTION public.delete_agency_video_setting(
  agency_id_param text,
  tier_param text,
  category_id_param text,
  module_id_param text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate inputs
  IF agency_id_param IS NULL OR agency_id_param = '' OR
     tier_param IS NULL OR tier_param = '' OR
     category_id_param IS NULL OR category_id_param = '' OR
     module_id_param IS NULL OR module_id_param = '' THEN
    RETURN false;
  END IF;
  
  -- Delete the specific setting
  DELETE FROM agency_video_settings
  WHERE agency_id = agency_id_param
    AND tier = tier_param
    AND category_id = category_id_param
    AND module_id = module_id_param;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$function$;