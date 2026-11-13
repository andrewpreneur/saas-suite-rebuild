CREATE OR REPLACE FUNCTION public.get_user_approval_by_email(user_email text)
 RETURNS TABLE(approval text, has_auth_account boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE e text := lower(btrim(user_email));
BEGIN
  IF e IS NULL OR e = '' THEN RETURN; END IF;

  RETURN QUERY
  SELECT COALESCE(ssu.approval, 'YES'), (au.id IS NOT NULL)
  FROM saas_suite_users ssu
  LEFT JOIN auth.users au ON lower(ssu.email) = lower(au.email)
  WHERE lower(ssu.email) = e;
  IF FOUND THEN RETURN; END IF;

  -- Team admins have no account of their own; they sign in to the account they were added to.
  IF EXISTS (SELECT 1 FROM account_admins aa WHERE lower(aa.admin_email) = e AND aa.status IN ('accepted','pending')) THEN
    RETURN QUERY SELECT 'YES'::text, EXISTS (SELECT 1 FROM auth.users au WHERE lower(au.email) = e);
  END IF;
END;
$function$;