
-- Add affiliate tracking columns to saas_suite_users
ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS is_affiliate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS affiliate_slug text UNIQUE;

-- Create affiliate_events table for tracking views, clicks, purchases
CREATE TABLE public.affiliate_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL, -- 'view', 'click', 'purchase'
  page text NOT NULL, -- 'home', 'branding-tool', 'email-warmup', 'ai-support', 'webinar'
  referrer_url text,
  user_agent text,
  ip_hash text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create affiliate_payouts table
CREATE TABLE public.affiliate_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE NOT NULL,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'cancelled'
  notes text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create affiliate_referrals table to track which users signed up via affiliate
CREATE TABLE public.affiliate_referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE NOT NULL,
  referred_email text NOT NULL,
  referred_name text,
  plan text,
  commission_rate numeric(5,2) NOT NULL DEFAULT 30.00,
  status text NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'churned'
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add affiliate_slug to affiliates table for URL tracking
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS affiliate_slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS user_email_linked text;

-- RLS for affiliate_events
ALTER TABLE public.affiliate_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert affiliate events" ON public.affiliate_events FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Authenticated users can view affiliate events" ON public.affiliate_events FOR SELECT TO authenticated USING (true);

-- RLS for affiliate_payouts
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage payouts" ON public.affiliate_payouts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS for affiliate_referrals
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage referrals" ON public.affiliate_referrals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can insert referrals" ON public.affiliate_referrals FOR INSERT TO public WITH CHECK (true);
