UPDATE public.copilot_message_ratings SET rated_by = '' WHERE rated_by IS NULL;
DELETE FROM public.copilot_message_ratings a USING public.copilot_message_ratings b
  WHERE a.message_id = b.message_id AND a.rated_by = b.rated_by AND a.updated_at < b.updated_at;
ALTER TABLE public.copilot_message_ratings ALTER COLUMN rated_by SET DEFAULT '', ALTER COLUMN rated_by SET NOT NULL;
DROP INDEX IF EXISTS public.copilot_message_ratings_message_rater_idx;
ALTER TABLE public.copilot_message_ratings ADD CONSTRAINT copilot_message_ratings_message_rater_key UNIQUE (message_id, rated_by);

CREATE TABLE public.copilot_prompt_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instruction TEXT NOT NULL,
  trigger_question TEXT,
  ideal_answer TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_prompt_edits TO authenticated;
GRANT ALL ON public.copilot_prompt_edits TO service_role;
ALTER TABLE public.copilot_prompt_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admin manages copilot prompt edits" ON public.copilot_prompt_edits
FOR ALL TO authenticated
USING (lower(public.current_auth_email()) = 'andrew@dna-media.net')
WITH CHECK (lower(public.current_auth_email()) = 'andrew@dna-media.net');
CREATE TRIGGER copilot_prompt_edits_updated_at BEFORE UPDATE ON public.copilot_prompt_edits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();