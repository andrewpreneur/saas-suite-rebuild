-- /founders-plan leads reuse funnel_apply_leads.
-- Ships in the PR only. Do not apply this against the live project from an agent.
-- Until it runs, funnel = 'founders_plan' fails the existing funnel check.

DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  WHERE con.conrelid = 'public.funnel_apply_leads'::regclass
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%highlevelers_upgrade%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.funnel_apply_leads DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.funnel_apply_leads
  DROP CONSTRAINT IF EXISTS funnel_apply_leads_funnel_check;

ALTER TABLE public.funnel_apply_leads
  ADD CONSTRAINT funnel_apply_leads_funnel_check
  CHECK (funnel IN ('agents', 'work_with_us', 'highlevelers', 'highlevelers_upgrade', 'founders_plan'));

-- One Founders Plan row per email. A second opt-in updates that row.
CREATE UNIQUE INDEX IF NOT EXISTS funnel_apply_leads_founders_plan_email_idx
  ON public.funnel_apply_leads (funnel, lower(email))
  WHERE funnel = 'founders_plan' AND email IS NOT NULL;

COMMENT ON TABLE public.funnel_apply_leads IS
  'Partial and final applications for /agents, /work-with-us, /highlevelers, /highlevelers-upgrade, and /founders-plan. Service role writes. No public read.';
