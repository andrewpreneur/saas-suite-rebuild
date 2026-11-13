CREATE OR REPLACE FUNCTION public.skip_account_row_for_team_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM account_admins aa
             WHERE lower(aa.admin_email) = lower(NEW.email)
               AND aa.status IN ('accepted','pending')
               AND lower(aa.owner_email) <> lower(NEW.email)) THEN
    RETURN NULL; -- team admins only use the account they were added to
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.skip_account_row_for_team_admin() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_skip_account_row_for_team_admin ON public.saas_suite_users;
CREATE TRIGGER trg_skip_account_row_for_team_admin
BEFORE INSERT ON public.saas_suite_users
FOR EACH ROW EXECUTE FUNCTION public.skip_account_row_for_team_admin();