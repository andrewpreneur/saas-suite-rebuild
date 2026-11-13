-- Create a public function to get user approval status by email
-- This allows checking if an email is approved before they create an auth account
CREATE OR REPLACE FUNCTION public.get_user_approval_by_email(user_email text)
RETURNS TABLE(approval text, has_auth_account boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate email
  IF user_email IS NULL OR user_email = '' THEN
    RETURN;
  END IF;
  
  -- Check if user exists in saas_suite_users and if they have an auth account
  RETURN QUERY
  SELECT 
    COALESCE(ssu.approval, 'PENDING') as approval,
    (au.id IS NOT NULL) as has_auth_account
  FROM saas_suite_users ssu
  LEFT JOIN auth.users au ON ssu.email = au.email
  WHERE ssu.email = user_email;
END;
$$;