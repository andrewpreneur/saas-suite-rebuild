ALTER TABLE public.webinar_registrations
  ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES public.webinar_registrations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS watched_replay boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offer_clicked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offer_click_context text,
  ADD COLUMN IF NOT EXISTS offer_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS needs_followup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS followup_note text;

CREATE INDEX IF NOT EXISTS webinar_registrations_duplicate_of_idx ON public.webinar_registrations (duplicate_of);
CREATE INDEX IF NOT EXISTS webinar_registrations_followup_idx ON public.webinar_registrations (needs_followup) WHERE needs_followup;