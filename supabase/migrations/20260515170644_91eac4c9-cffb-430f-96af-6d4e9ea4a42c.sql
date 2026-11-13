CREATE OR REPLACE FUNCTION public.get_training_doc_for_agency(p_agency_id TEXT)
RETURNS TABLE (
  training_doc_url TEXT,
  detected_plan TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Get the training doc URL from v2_home_settings
  RETURN QUERY
  SELECT 
    COALESCE(h.prompt_training_doc, '')::TEXT as training_doc_url,
    CASE 
      WHEN u.agency_id = p_agency_id THEN 'starter'
      WHEN u.agency_id_basic = p_agency_id THEN 'basic'
      WHEN u.agency_id_advanced = p_agency_id THEN 'advanced'
      WHEN u.agency_id_elite = p_agency_id THEN 'elite'
      ELSE 'unknown'
    END::TEXT as detected_plan
  FROM saas_suite_users u
  LEFT JOIN v2_home_settings h ON h.agency_id = p_agency_id
  WHERE u.agency_id = p_agency_id
     OR u.agency_id_basic = p_agency_id
     OR u.agency_id_advanced = p_agency_id
     OR u.agency_id_elite = p_agency_id
  LIMIT 1;
END;
$$;