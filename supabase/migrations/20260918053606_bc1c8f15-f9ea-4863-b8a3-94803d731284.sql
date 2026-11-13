ALTER TABLE public.webinar_registrations
  ADD COLUMN IF NOT EXISTS capi_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS pixel_claimed_at timestamptz;