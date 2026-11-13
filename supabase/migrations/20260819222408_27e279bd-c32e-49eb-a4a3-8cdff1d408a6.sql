CREATE TABLE IF NOT EXISTS public.bump_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  plan text NOT NULL,
  promo_code text NOT NULL,
  percent_off integer NOT NULL DEFAULT 25,
  expires_at timestamptz NOT NULL,
  redeemed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS bump_offers_email_plan_idx ON public.bump_offers (lower(email), plan);

GRANT SELECT ON public.bump_offers TO authenticated;
GRANT ALL ON public.bump_offers TO service_role;

ALTER TABLE public.bump_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bump offers"
ON public.bump_offers FOR SELECT TO authenticated
USING (lower(email) = lower(coalesce(public.current_auth_email(), '')));