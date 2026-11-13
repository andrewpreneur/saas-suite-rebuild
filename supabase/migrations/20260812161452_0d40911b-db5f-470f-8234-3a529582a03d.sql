CREATE TABLE IF NOT EXISTS public.copilot_ai_paused (
  owner_email TEXT PRIMARY KEY,
  reason TEXT,
  paused_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.copilot_ai_paused TO service_role;
ALTER TABLE public.copilot_ai_paused ENABLE ROW LEVEL SECURITY;
INSERT INTO public.copilot_ai_paused (owner_email, reason, paused_by)
VALUES ('joramir23@yahoo.com', 'AI gave incorrect plan/pricing info — handed to human', 'andrew@dna-media.net')
ON CONFLICT (owner_email) DO NOTHING;