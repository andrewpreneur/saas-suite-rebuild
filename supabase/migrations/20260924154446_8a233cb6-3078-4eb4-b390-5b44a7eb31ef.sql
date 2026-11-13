REVOKE EXECUTE ON FUNCTION public.expired_cancel_access_users() FROM PUBLIC, anon, authenticated;
UPDATE public.saas_suite_users SET approval = 'YES' WHERE lower(email) = 'cate@sanesocialmedia.com';