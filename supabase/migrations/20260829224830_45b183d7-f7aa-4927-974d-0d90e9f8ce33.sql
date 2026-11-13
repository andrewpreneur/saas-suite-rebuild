CREATE TABLE public.academy_notify_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  item_id text NOT NULL,
  item_title text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.academy_notify_requests TO authenticated;
GRANT ALL ON public.academy_notify_requests TO service_role;

ALTER TABLE public.academy_notify_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notify requests"
ON public.academy_notify_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users create own notify requests"
ON public.academy_notify_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX academy_notify_unique ON public.academy_notify_requests (email, item_id);