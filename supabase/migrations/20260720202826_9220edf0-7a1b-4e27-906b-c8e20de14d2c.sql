
CREATE TABLE IF NOT EXISTS public.slack_channel_agency_map (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id TEXT NOT NULL,
  slack_channel_id TEXT NOT NULL,
  slack_team_id TEXT,
  label TEXT,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agency_id, slack_channel_id)
);

CREATE INDEX IF NOT EXISTS slack_channel_agency_map_agency_idx ON public.slack_channel_agency_map(agency_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slack_channel_agency_map TO authenticated;
GRANT ALL ON public.slack_channel_agency_map TO service_role;

ALTER TABLE public.slack_channel_agency_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their agency channel mappings"
ON public.slack_channel_agency_map
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.saas_suite_users u
    WHERE lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND (
        u.agency_id = slack_channel_agency_map.agency_id
        OR u.agency_id_basic = slack_channel_agency_map.agency_id
        OR u.agency_id_advanced = slack_channel_agency_map.agency_id
        OR u.agency_id_elite = slack_channel_agency_map.agency_id
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.saas_suite_users u
    WHERE lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND (
        u.agency_id = slack_channel_agency_map.agency_id
        OR u.agency_id_basic = slack_channel_agency_map.agency_id
        OR u.agency_id_advanced = slack_channel_agency_map.agency_id
        OR u.agency_id_elite = slack_channel_agency_map.agency_id
      )
  )
);

CREATE TRIGGER update_slack_channel_agency_map_updated_at
BEFORE UPDATE ON public.slack_channel_agency_map
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
