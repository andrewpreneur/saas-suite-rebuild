CREATE TABLE public.public_copilot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  ip_hash text,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  claimed_by text,
  claimed_thread_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.public_copilot_messages TO service_role;
ALTER TABLE public.public_copilot_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX public_copilot_messages_visitor_idx ON public.public_copilot_messages (visitor_id, created_at);
CREATE INDEX public_copilot_messages_ip_idx ON public.public_copilot_messages (ip_hash, created_at);