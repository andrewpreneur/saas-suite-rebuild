
-- Helper function (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1) Fix Alex's referral attribution
UPDATE public.affiliate_referrals
SET plan = 'ADVANCED', status = 'converted', updated_at = now()
WHERE referred_email = 'alex@cyber-sells.com';

-- 2) Affiliate commissions
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referral_id UUID NOT NULL REFERENCES public.affiliate_referrals(id) ON DELETE CASCADE,
  referred_email TEXT NOT NULL,
  plan TEXT NOT NULL,
  plan_amount NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL DEFAULT 30,
  amount NUMERIC NOT NULL DEFAULT 0,
  period_index INTEGER NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (referral_id, period_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_commissions TO authenticated;
GRANT ALL ON public.affiliate_commissions TO service_role;

ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read affiliate commissions" ON public.affiliate_commissions;
DROP POLICY IF EXISTS "Authenticated users can manage affiliate commissions" ON public.affiliate_commissions;
CREATE POLICY "Authenticated users can read affiliate commissions"
  ON public.affiliate_commissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage affiliate commissions"
  ON public.affiliate_commissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate ON public.affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_status ON public.affiliate_commissions(status);

DROP TRIGGER IF EXISTS trg_affiliate_commissions_updated ON public.affiliate_commissions;
CREATE TRIGGER trg_affiliate_commissions_updated
  BEFORE UPDATE ON public.affiliate_commissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Chat thread state
CREATE TABLE IF NOT EXISTS public.chat_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id TEXT NOT NULL,
  user_identifier TEXT NOT NULL,
  handover_requested_at TIMESTAMPTZ,
  handover_resolved_at TIMESTAMPTZ,
  last_user_message_at TIMESTAMPTZ,
  last_owner_message_at TIMESTAMPTZ,
  last_assistant_message_at TIMESTAMPTZ,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agency_id, user_identifier)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read chat threads" ON public.chat_threads;
DROP POLICY IF EXISTS "Authenticated users can manage chat threads" ON public.chat_threads;
CREATE POLICY "Authenticated users can read chat threads"
  ON public.chat_threads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage chat threads"
  ON public.chat_threads FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_chat_threads_handover ON public.chat_threads(handover_requested_at) WHERE handover_resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_threads_agency ON public.chat_threads(agency_id);

DROP TRIGGER IF EXISTS trg_chat_threads_updated ON public.chat_threads;
CREATE TRIGGER trg_chat_threads_updated
  BEFORE UPDATE ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Sync triggers
CREATE OR REPLACE FUNCTION public.sync_thread_on_ai_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.chat_threads (agency_id, user_identifier, last_user_message_at, last_assistant_message_at, message_count)
  VALUES (
    NEW.agency_id,
    lower(NEW.user_identifier),
    CASE WHEN NEW.role = 'user' THEN NEW.created_at ELSE NULL END,
    CASE WHEN NEW.role = 'assistant' THEN NEW.created_at ELSE NULL END,
    1
  )
  ON CONFLICT (agency_id, user_identifier) DO UPDATE
  SET
    last_user_message_at = CASE WHEN NEW.role = 'user' THEN NEW.created_at ELSE chat_threads.last_user_message_at END,
    last_assistant_message_at = CASE WHEN NEW.role = 'assistant' THEN NEW.created_at ELSE chat_threads.last_assistant_message_at END,
    message_count = chat_threads.message_count + 1,
    updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_thread_on_ai_message ON public.ai_chat_messages;
CREATE TRIGGER trg_sync_thread_on_ai_message
  AFTER INSERT ON public.ai_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.sync_thread_on_ai_message();

CREATE OR REPLACE FUNCTION public.sync_thread_on_owner_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.chat_threads (agency_id, user_identifier, last_owner_message_at, handover_resolved_at, message_count)
  VALUES (NEW.agency_id, lower(NEW.user_identifier), NEW.created_at, NEW.created_at, 1)
  ON CONFLICT (agency_id, user_identifier) DO UPDATE
  SET
    last_owner_message_at = NEW.created_at,
    handover_resolved_at = NEW.created_at,
    message_count = chat_threads.message_count + 1,
    updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_thread_on_owner_message ON public.agency_owner_messages;
CREATE TRIGGER trg_sync_thread_on_owner_message
  AFTER INSERT ON public.agency_owner_messages
  FOR EACH ROW EXECUTE FUNCTION public.sync_thread_on_owner_message();

-- 5) Mark handover requested RPC
CREATE OR REPLACE FUNCTION public.mark_handover_requested(_agency_id TEXT, _user_identifier TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.chat_threads (agency_id, user_identifier, handover_requested_at)
  VALUES (_agency_id, lower(_user_identifier), now())
  ON CONFLICT (agency_id, user_identifier) DO UPDATE
  SET handover_requested_at = now(),
      handover_resolved_at = NULL,
      updated_at = now();
END; $$;

GRANT EXECUTE ON FUNCTION public.mark_handover_requested(TEXT, TEXT) TO authenticated, anon, service_role;

-- 6) Backfill chat_threads
INSERT INTO public.chat_threads (agency_id, user_identifier, last_user_message_at, last_assistant_message_at, message_count)
SELECT
  agency_id,
  lower(user_identifier),
  MAX(CASE WHEN role = 'user' THEN created_at END),
  MAX(CASE WHEN role = 'assistant' THEN created_at END),
  COUNT(*)
FROM public.ai_chat_messages
GROUP BY agency_id, lower(user_identifier)
ON CONFLICT (agency_id, user_identifier) DO NOTHING;

UPDATE public.chat_threads ct
SET last_owner_message_at = sub.last_owner_at,
    handover_resolved_at = sub.last_owner_at
FROM (
  SELECT agency_id, lower(user_identifier) AS uid, MAX(created_at) AS last_owner_at
  FROM public.agency_owner_messages
  GROUP BY agency_id, lower(user_identifier)
) sub
WHERE ct.agency_id = sub.agency_id AND ct.user_identifier = sub.uid;

-- 7) Seed Alex's initial commission ($97 * 30% = $29.10)
INSERT INTO public.affiliate_commissions (
  affiliate_id, referral_id, referred_email, plan, plan_amount, commission_rate, amount, period_index, period_start, status
)
SELECT
  ar.affiliate_id, ar.id, ar.referred_email, 'ADVANCED', 97, 30, 29.10, 0, ar.created_at, 'pending'
FROM public.affiliate_referrals ar
WHERE ar.referred_email = 'alex@cyber-sells.com'
ON CONFLICT (referral_id, period_index) DO NOTHING;
