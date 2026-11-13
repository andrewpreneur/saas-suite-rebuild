ALTER TABLE public.webinar_registrations
  ADD COLUMN IF NOT EXISTS attendance_status text,
  ADD COLUMN IF NOT EXISTS max_retention_pct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS watch_seconds integer,
  ADD COLUMN IF NOT EXISTS retention_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.webinar_retention_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid REFERENCES public.webinar_registrations(id) ON DELETE SET NULL,
  email text NOT NULL,
  webinar_id text,
  session_date_text text,
  milestone integer NOT NULL,
  watch_seconds integer,
  source text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.webinar_retention_events TO service_role;

ALTER TABLE public.webinar_retention_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role manages webinar retention" ON public.webinar_retention_events;
CREATE POLICY "service role manages webinar retention"
ON public.webinar_retention_events FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS webinar_retention_unique_idx
  ON public.webinar_retention_events (lower(email), milestone, coalesce(session_date_text, ''));
CREATE INDEX IF NOT EXISTS webinar_retention_created_idx
  ON public.webinar_retention_events (created_at DESC);