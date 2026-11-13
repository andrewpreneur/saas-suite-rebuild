CREATE TABLE IF NOT EXISTS public.billing_delinquency_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.billing_delinquency_log TO service_role;
GRANT SELECT ON public.billing_delinquency_log TO authenticated;
ALTER TABLE public.billing_delinquency_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins can view delinquency log"
  ON public.billing_delinquency_log FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

INSERT INTO public.billing_delinquency_log (email, action, details)
SELECT s.email, 'backfill_past_due', public.mark_payment_delinquent(s.email, 'stripe_canceled_backfill')
FROM public.saas_suite_users s
WHERE s.approval = 'NO'
  AND (s.agency_id LIKE '%NO' OR s.agency_id_basic LIKE '%NO' OR s.agency_id_advanced LIKE '%NO' OR s.agency_id_elite LIKE '%NO');