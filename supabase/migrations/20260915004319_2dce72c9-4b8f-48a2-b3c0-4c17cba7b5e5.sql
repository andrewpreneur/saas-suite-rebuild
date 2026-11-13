CREATE TABLE public.support_rep_applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text NOT NULL UNIQUE,
  phone text,
  slack_notify boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  works_weekends boolean NOT NULL DEFAULT false,
  agreed_at timestamptz NOT NULL DEFAULT now(),
  training_starts_at timestamptz NOT NULL DEFAULT now(),
  training_ends_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  status text NOT NULL DEFAULT 'training',
  final_score numeric,
  final_report jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.support_rep_login_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_rep_login_codes_email_idx ON public.support_rep_login_codes (email, created_at DESC);

CREATE TABLE public.support_rep_sessions (
  token text PRIMARY KEY,
  applicant_id uuid NOT NULL REFERENCES public.support_rep_applicants(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.support_rep_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  category text,
  source text,
  fingerprint text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.support_rep_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.support_rep_applicants(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.support_rep_questions(id) ON DELETE SET NULL,
  question text NOT NULL,
  mode text NOT NULL DEFAULT 'single',
  scheduled_at timestamptz NOT NULL,
  delivered_at timestamptz,
  first_response_at timestamptz,
  closed_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  response_minutes numeric,
  score numeric,
  grade jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_rep_cases_applicant_idx ON public.support_rep_cases (applicant_id, scheduled_at);
CREATE INDEX support_rep_cases_due_idx ON public.support_rep_cases (status, scheduled_at);

CREATE TABLE public.support_rep_case_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.support_rep_cases(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  grade jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_rep_case_messages_case_idx ON public.support_rep_case_messages (case_id, created_at);

GRANT ALL ON public.support_rep_applicants TO service_role;
GRANT ALL ON public.support_rep_login_codes TO service_role;
GRANT ALL ON public.support_rep_sessions TO service_role;
GRANT ALL ON public.support_rep_questions TO service_role;
GRANT ALL ON public.support_rep_cases TO service_role;
GRANT ALL ON public.support_rep_case_messages TO service_role;

ALTER TABLE public.support_rep_applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_rep_login_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_rep_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_rep_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_rep_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_rep_case_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages applicants" ON public.support_rep_applicants FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages codes" ON public.support_rep_login_codes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages sessions" ON public.support_rep_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages questions" ON public.support_rep_questions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages cases" ON public.support_rep_cases FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages case messages" ON public.support_rep_case_messages FOR ALL TO service_role USING (true) WITH CHECK (true);