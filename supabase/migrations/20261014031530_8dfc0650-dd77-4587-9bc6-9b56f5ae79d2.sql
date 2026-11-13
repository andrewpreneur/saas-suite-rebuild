CREATE TABLE public.copilot_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  title text NOT NULL DEFAULT 'New chat',
  kind text NOT NULL DEFAULT 'chat',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX copilot_threads_owner_idx ON public.copilot_threads (lower(owner_email), updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_threads TO authenticated;
GRANT ALL ON public.copilot_threads TO service_role;
ALTER TABLE public.copilot_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their copilot threads" ON public.copilot_threads FOR ALL TO authenticated
  USING (lower(owner_email) = lower(public.current_auth_email()))
  WITH CHECK (lower(owner_email) = lower(public.current_auth_email()));

CREATE TABLE public.copilot_thread_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.copilot_threads(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX copilot_thread_messages_thread_idx ON public.copilot_thread_messages (thread_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.copilot_thread_messages TO authenticated;
GRANT ALL ON public.copilot_thread_messages TO service_role;
ALTER TABLE public.copilot_thread_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their copilot messages" ON public.copilot_thread_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.copilot_threads t WHERE t.id = thread_id AND lower(t.owner_email) = lower(public.current_auth_email())));
CREATE POLICY "Owners add their copilot messages" ON public.copilot_thread_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.copilot_threads t WHERE t.id = thread_id AND lower(t.owner_email) = lower(public.current_auth_email())));
CREATE POLICY "Owners delete their copilot messages" ON public.copilot_thread_messages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.copilot_threads t WHERE t.id = thread_id AND lower(t.owner_email) = lower(public.current_auth_email())));

CREATE TABLE public.copilot_preferences (
  owner_email text PRIMARY KEY,
  assistant_name text NOT NULL DEFAULT 'Copilot',
  business_website text,
  first_time_completed_at timestamptz,
  ghl_skipped boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.copilot_preferences TO authenticated;
GRANT ALL ON public.copilot_preferences TO service_role;
ALTER TABLE public.copilot_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their copilot preferences" ON public.copilot_preferences FOR ALL TO authenticated
  USING (lower(owner_email) = lower(public.current_auth_email()))
  WITH CHECK (lower(owner_email) = lower(public.current_auth_email()));