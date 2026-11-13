
UPDATE public.affiliate_referrals r
SET plan = UPPER(u.plan::text),
    status = CASE WHEN UPPER(COALESCE(u.plan::text,'')) IN ('BASIC','ADVANCED') THEN 'converted' ELSE r.status END,
    updated_at = now()
FROM public.saas_suite_users u
WHERE lower(u.email) = lower(r.referred_email)
  AND u.plan IS NOT NULL
  AND (COALESCE(r.plan,'') <> UPPER(u.plan::text));

CREATE OR REPLACE FUNCTION public.sync_affiliate_referral_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan IS NULL THEN RETURN NEW; END IF;
  UPDATE public.affiliate_referrals
  SET plan = UPPER(NEW.plan::text),
      status = CASE WHEN UPPER(NEW.plan::text) IN ('BASIC','ADVANCED') THEN 'converted' ELSE status END,
      updated_at = now()
  WHERE lower(referred_email) = lower(NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_affiliate_referral_plan ON public.saas_suite_users;
CREATE TRIGGER trg_sync_affiliate_referral_plan
AFTER INSERT OR UPDATE OF plan ON public.saas_suite_users
FOR EACH ROW EXECUTE FUNCTION public.sync_affiliate_referral_plan();
