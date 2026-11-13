
CREATE TABLE public.copilot_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  actions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_chat_messages_owner ON public.copilot_chat_messages (owner_email, created_at);

ALTER TABLE public.copilot_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own copilot messages"
  ON public.copilot_chat_messages FOR SELECT
  USING (lower(owner_email) = lower((auth.jwt() ->> 'email')));

CREATE POLICY "Users can insert their own copilot messages"
  ON public.copilot_chat_messages FOR INSERT
  WITH CHECK (lower(owner_email) = lower((auth.jwt() ->> 'email')));

CREATE POLICY "Admin can manage all copilot messages"
  ON public.copilot_chat_messages FOR ALL
  USING (lower((auth.jwt() ->> 'email')) = 'andrew@dna-media.net')
  WITH CHECK (lower((auth.jwt() ->> 'email')) = 'andrew@dna-media.net');
