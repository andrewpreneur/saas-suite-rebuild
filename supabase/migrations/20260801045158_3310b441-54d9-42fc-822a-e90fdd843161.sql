CREATE TABLE public.community_academy_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_id text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_academy_progress TO authenticated;
GRANT ALL ON public.community_academy_progress TO service_role;

ALTER TABLE public.community_academy_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own academy progress"
ON public.community_academy_progress FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_community_academy_progress_updated_at
BEFORE UPDATE ON public.community_academy_progress
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();