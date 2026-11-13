
CREATE OR REPLACE FUNCTION public.get_agency_clients(p_agency_id text)
RETURNS TABLE(
  user_id uuid,
  user_name text,
  user_email text,
  last_accessed timestamp with time zone,
  login_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  ORDER BY up.last_accessed DESC NULLS LAST;
END;
$$;
