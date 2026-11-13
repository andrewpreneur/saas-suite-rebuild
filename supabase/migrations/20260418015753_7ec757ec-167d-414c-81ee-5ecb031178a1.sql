
CREATE TABLE public.user_activity_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  session_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_ended_at TIMESTAMPTZ,
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_analysis JSONB,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_activity_sessions_email ON public.user_activity_sessions(user_email);
CREATE INDEX idx_user_activity_sessions_status ON public.user_activity_sessions(status);

ALTER TABLE public.user_activity_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own sessions"
ON public.user_activity_sessions FOR INSERT
WITH CHECK (lower(user_email) = lower((auth.jwt() ->> 'email'::text)));

CREATE POLICY "Users can update their own sessions"
ON public.user_activity_sessions FOR UPDATE
USING (lower(user_email) = lower((auth.jwt() ->> 'email'::text)));

CREATE POLICY "Users can view their own sessions"
ON public.user_activity_sessions FOR SELECT
USING (lower(user_email) = lower((auth.jwt() ->> 'email'::text)));

CREATE POLICY "Admin can view all sessions"
ON public.user_activity_sessions FOR SELECT
USING (lower((auth.jwt() ->> 'email'::text)) = 'andrew@dna-media.net');

CREATE POLICY "Admin can update all sessions"
ON public.user_activity_sessions FOR UPDATE
USING (lower((auth.jwt() ->> 'email'::text)) = 'andrew@dna-media.net');
