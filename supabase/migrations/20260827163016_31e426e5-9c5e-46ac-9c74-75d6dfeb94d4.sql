CREATE TABLE public.copilot_message_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL,
  owner_email TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('up','down')),
  question_text TEXT,
  answer_text TEXT,
  corrected_answer TEXT,
  notes TEXT,
  rated_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX copilot_message_ratings_message_rater_idx
  ON public.copilot_message_ratings (message_id, COALESCE(rated_by, ''));

CREATE INDEX copilot_message_ratings_rating_idx ON public.copilot_message_ratings (rating, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_message_ratings TO authenticated;
GRANT ALL ON public.copilot_message_ratings TO service_role;

ALTER TABLE public.copilot_message_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admin can manage copilot message ratings"
ON public.copilot_message_ratings
FOR ALL
TO authenticated
USING (lower(public.current_auth_email()) = 'andrew@dna-media.net')
WITH CHECK (lower(public.current_auth_email()) = 'andrew@dna-media.net');

CREATE TRIGGER copilot_message_ratings_updated_at
BEFORE UPDATE ON public.copilot_message_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();