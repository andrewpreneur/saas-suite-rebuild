CREATE OR REPLACE FUNCTION public.remove_empty_starter_for_new_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('accepted','pending') OR lower(NEW.admin_email) = lower(NEW.owner_email) THEN
    RETURN NEW;
  END IF;
  DELETE FROM saas_suite_users u
  WHERE lower(u.email) = lower(NEW.admin_email)
    AND coalesce(u.plan::text,'STARTER') = 'STARTER'
    AND u.install_confirmed_at IS NULL
    AND coalesce(u.is_affiliate,false) = false
    AND u.onboarding_stripe_customer_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM user_progress p WHERE p.agency_id IN (u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite))
    AND NOT EXISTS (SELECT 1 FROM account_admins a WHERE lower(a.owner_email) = lower(u.email));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_remove_empty_starter_for_new_admin ON public.account_admins;
CREATE TRIGGER trg_remove_empty_starter_for_new_admin
AFTER INSERT OR UPDATE OF status ON public.account_admins
FOR EACH ROW EXECUTE FUNCTION public.remove_empty_starter_for_new_admin();