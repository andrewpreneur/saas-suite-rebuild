CREATE TABLE public.copilot_pending_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_email TEXT NOT NULL,
  message TEXT NOT NULL,
  target_field TEXT,
  operation TEXT NOT NULL DEFAULT 'append',
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  applied_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT copilot_pending_suggestions_operation_check CHECK (operation IN ('append','replace')),
  CONSTRAINT copilot_pending_suggestions_status_check CHECK (status IN ('pending','applied','dismissed')),
  CONSTRAINT copilot_pending_suggestions_target_check CHECK (
    target_field IS NULL OR target_field IN (
      'prompt_personality',
      'prompt_goals',
      'prompt_additional_instructions',
      'prompt_training_doc',
      'general'
    )
  )
);

CREATE INDEX idx_copilot_pending_suggestions_owner_status
  ON public.copilot_pending_suggestions (lower(owner_email), status, created_at DESC);

ALTER TABLE public.copilot_pending_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their copilot suggestions"
ON public.copilot_pending_suggestions
FOR SELECT
USING (lower(owner_email) = lower((auth.jwt() ->> 'email'::text)));

CREATE POLICY "Owners can update their copilot suggestions"
ON public.copilot_pending_suggestions
FOR UPDATE
USING (lower(owner_email) = lower((auth.jwt() ->> 'email'::text)));

CREATE POLICY "Admin can manage all copilot suggestions"
ON public.copilot_pending_suggestions
FOR ALL
USING (lower((auth.jwt() ->> 'email'::text)) = 'andrew@dna-media.net'::text)
WITH CHECK (lower((auth.jwt() ->> 'email'::text)) = 'andrew@dna-media.net'::text);

CREATE OR REPLACE FUNCTION public.touch_copilot_pending_suggestions()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_copilot_pending_suggestions
BEFORE UPDATE ON public.copilot_pending_suggestions
FOR EACH ROW
EXECUTE FUNCTION public.touch_copilot_pending_suggestions();