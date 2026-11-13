CREATE TABLE public.followup_email_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email text NOT NULL,
  email_type text NOT NULL,
  session_id uuid,
  subject text,
  body text,
  sent boolean NOT NULL DEFAULT false,
  suppressed_reason text,
  user_health text,
  event_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.followup_email_log TO service_role;
GRANT SELECT ON public.followup_email_log TO authenticated;

ALTER TABLE public.followup_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view followup email log"
ON public.followup_email_log
FOR SELECT
TO authenticated
USING (public.is_platform_admin());

CREATE INDEX idx_followup_email_log_email_created ON public.followup_email_log (lower(user_email), created_at DESC);

ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS last_followup_email_sent_at timestamp with time zone;