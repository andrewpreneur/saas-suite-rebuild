CREATE TABLE public.ai_support_kb (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  tags text[] DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  source_agency_id text,
  source_user_identifier text,
  source_message_id uuid,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_support_kb TO authenticated;
GRANT ALL ON public.ai_support_kb TO service_role;
ALTER TABLE public.ai_support_kb ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages ai support kb" ON public.ai_support_kb FOR ALL TO authenticated
  USING (public.current_auth_email() = 'andrew@dna-media.net')
  WITH CHECK (public.current_auth_email() = 'andrew@dna-media.net');

CREATE TABLE public.ai_support_message_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  agency_id text NOT NULL,
  user_identifier text,
  rating text NOT NULL,
  question_text text,
  answer_text text,
  kb_entry_id uuid REFERENCES public.ai_support_kb(id) ON DELETE SET NULL,
  rated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, rated_by)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_support_message_ratings TO authenticated;
GRANT ALL ON public.ai_support_message_ratings TO service_role;
ALTER TABLE public.ai_support_message_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages ai message ratings" ON public.ai_support_message_ratings FOR ALL TO authenticated
  USING (public.current_auth_email() = 'andrew@dna-media.net')
  WITH CHECK (public.current_auth_email() = 'andrew@dna-media.net');

CREATE TRIGGER ai_support_kb_touch BEFORE UPDATE ON public.ai_support_kb
  FOR EACH ROW EXECUTE FUNCTION public.community_touch_updated_at();