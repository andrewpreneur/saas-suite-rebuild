ALTER TABLE public.slack_channel_agency_map
  ADD COLUMN IF NOT EXISTS inbound_webhook_token text;

UPDATE public.slack_channel_agency_map
  SET inbound_webhook_token = encode(gen_random_bytes(24), 'hex')
  WHERE inbound_webhook_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS slack_channel_agency_map_inbound_token_key
  ON public.slack_channel_agency_map (inbound_webhook_token)
  WHERE inbound_webhook_token IS NOT NULL;