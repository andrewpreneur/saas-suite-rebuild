
-- Function to get all clients for an agency
CREATE OR REPLACE FUNCTION public.get_agency_clients(p_agency_id text)
RETURNS TABLE(
  user_id uuid,
  user_name text,
  user_email text,
  last_accessed timestamptz,
  login_count bigint
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.id AS user_id,
    up.name AS user_name,
    up.email AS user_email,
    up.last_accessed,
    COALESCE(
      (SELECT COUNT(*) FROM module_completion mc WHERE mc.user_id = up.id),
      0
    ) AS login_count
  FROM user_progress up
  WHERE up.agency_id = p_agency_id
    AND (
      (up.email IS NOT NULL AND up.email != '')
      OR (up.name IS NOT NULL AND up.name != '' AND up.name NOT LIKE 'Guest User #%')
    )
  ORDER BY up.last_accessed DESC NULLS LAST;
END;
$$;

-- Function to delete a client from an agency
CREATE OR REPLACE FUNCTION public.delete_agency_client(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Delete module completions first
  DELETE FROM module_completion WHERE user_id = p_user_id;
  -- Delete checklist completions
  DELETE FROM user_onboarding_checklist_completion WHERE user_identifier = (
    SELECT COALESCE(NULLIF(email, ''), name) FROM user_progress WHERE id = p_user_id
  );
  -- Delete the user progress record
  DELETE FROM user_progress WHERE id = p_user_id;
  RETURN true;
END;
$$;

-- Function to update a client's name and email
CREATE OR REPLACE FUNCTION public.update_agency_client(p_user_id uuid, p_name text DEFAULT NULL, p_email text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE user_progress
  SET 
    name = COALESCE(p_name, name),
    email = COALESCE(p_email, email)
  WHERE id = p_user_id;
  RETURN true;
END;
$$;
