
ALTER TABLE public.slack_channel_agency_map
  ADD COLUMN IF NOT EXISTS bot_token TEXT,
  ADD COLUMN IF NOT EXISTS bot_user_id TEXT,
  ADD COLUMN IF NOT EXISTS team_domain TEXT,
  ADD COLUMN IF NOT EXISTS installed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS slack_channel_agency_map_agency_team_uniq
  ON public.slack_channel_agency_map (agency_id, slack_team_id)
  WHERE slack_team_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.slack_oauth_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state TEXT NOT NULL UNIQUE,
  agency_id TEXT NOT NULL,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
  used_at TIMESTAMPTZ
);

GRANT ALL ON public.slack_oauth_states TO service_role;
ALTER TABLE public.slack_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role manages slack_oauth_states"
  ON public.slack_oauth_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
