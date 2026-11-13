-- Replace partial unique index with a real unique constraint so ON CONFLICT (agency_id, slack_team_id) can infer it.
-- Table is empty so this is safe. Enforce NOT NULL on slack_team_id for new installs.
DROP INDEX IF EXISTS public.slack_channel_agency_map_agency_team_uniq;

-- Also drop the older (agency_id, slack_channel_id) unique which conflicts with re-installs where channel changes.
ALTER TABLE public.slack_channel_agency_map
  DROP CONSTRAINT IF EXISTS slack_channel_agency_map_agency_id_slack_channel_id_key;

ALTER TABLE public.slack_channel_agency_map
  ALTER COLUMN slack_team_id SET NOT NULL;

ALTER TABLE public.slack_channel_agency_map
  ADD CONSTRAINT slack_channel_agency_map_agency_team_key UNIQUE (agency_id, slack_team_id);