ALTER TABLE public.account_admins ALTER COLUMN status SET DEFAULT 'accepted';

ALTER TABLE public.saas_suite_users ADD COLUMN IF NOT EXISTS hub_welcome_email_queued_at timestamptz;

CREATE OR REPLACE FUNCTION public.account_admins_auto_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS NULL OR NEW.status = 'pending' THEN
    NEW.status := 'accepted';
  END IF;
  IF NEW.status = 'accepted' AND NEW.accepted_at IS NULL THEN
    NEW.accepted_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS account_admins_auto_accept_trigger ON public.account_admins;
CREATE TRIGGER account_admins_auto_accept_trigger
BEFORE INSERT ON public.account_admins
FOR EACH ROW EXECUTE FUNCTION public.account_admins_auto_accept();