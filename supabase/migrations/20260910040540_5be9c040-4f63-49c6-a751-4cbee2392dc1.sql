CREATE TABLE public.copilot_nudge_settings (
  owner_email text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  channels jsonb NOT NULL DEFAULT '["slack"]'::jsonb,
  frequency text NOT NULL DEFAULT 'weekly',
  tz_offset_minutes integer NOT NULL DEFAULT -300,
  work_hour_start integer NOT NULL DEFAULT 9,
  work_hour_end integer NOT NULL DEFAULT 17,
  preferred_hour_local integer,
  preferred_dow integer DEFAULT 1,
  sms_outbound_webhook_url text,
  email_outbound_webhook_url text,
  paused_until timestamptz,
  last_sent_at timestamptz,
  next_due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT copilot_nudge_settings_frequency_chk CHECK (frequency IN ('daily','weekly','biweekly')),
  CONSTRAINT copilot_nudge_settings_hours_chk CHECK (work_hour_start >= 0 AND work_hour_start < 24 AND work_hour_end > work_hour_start AND work_hour_end <= 24)
);

CREATE TABLE public.copilot_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  kind text NOT NULL DEFAULT 'account_digest',
  channel text NOT NULL DEFAULT 'slack',
  headline text,
  body text NOT NULL DEFAULT '',
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  error text,
  slack_channel_id text,
  slack_ts text,
  response_text text,
  response_channel text,
  responded_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX copilot_nudges_owner_created_idx ON public.copilot_nudges (owner_email, created_at DESC);
CREATE INDEX copilot_nudges_slack_ts_idx ON public.copilot_nudges (slack_ts);

CREATE TABLE public.copilot_nudge_topics (
  owner_email text NOT NULL,
  topic text NOT NULL,
  stance text NOT NULL DEFAULT 'declined',
  note text,
  snooze_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_email, topic),
  CONSTRAINT copilot_nudge_topics_stance_chk CHECK (stance IN ('accepted','declined','snoozed'))
);

CREATE TABLE public.copilot_nudge_locks (
  job text PRIMARY KEY,
  locked_until timestamptz NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.copilot_nudge_settings TO service_role;
GRANT ALL ON public.copilot_nudges TO service_role;
GRANT ALL ON public.copilot_nudge_topics TO service_role;
GRANT ALL ON public.copilot_nudge_locks TO service_role;
GRANT SELECT, UPDATE ON public.copilot_nudge_settings TO authenticated;
GRANT SELECT ON public.copilot_nudges TO authenticated;
GRANT SELECT ON public.copilot_nudge_topics TO authenticated;

ALTER TABLE public.copilot_nudge_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_nudge_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_nudge_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their nudge settings"
  ON public.copilot_nudge_settings FOR SELECT TO authenticated
  USING (lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE POLICY "Owners update their nudge settings"
  ON public.copilot_nudge_settings FOR UPDATE TO authenticated
  USING (lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  WITH CHECK (lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE POLICY "Owners view their nudges"
  ON public.copilot_nudges FOR SELECT TO authenticated
  USING (lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE POLICY "Owners view their nudge topics"
  ON public.copilot_nudge_topics FOR SELECT TO authenticated
  USING (lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE TRIGGER copilot_nudge_settings_updated_at
  BEFORE UPDATE ON public.copilot_nudge_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();