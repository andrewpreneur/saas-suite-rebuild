CREATE TABLE public.support_chat_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id text NOT NULL,
  user_identifier text NOT NULL,
  assigned_to_email text,
  assigned_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX support_chat_assignments_thread_uidx ON public.support_chat_assignments (agency_id, lower(user_identifier));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_chat_assignments TO authenticated;
GRANT ALL ON public.support_chat_assignments TO service_role;
ALTER TABLE public.support_chat_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency members manage chat assignments" ON public.support_chat_assignments
  FOR ALL TO authenticated USING (public.can_access_agency(agency_id)) WITH CHECK (public.can_access_agency(agency_id));
CREATE TRIGGER support_chat_assignments_touch BEFORE UPDATE ON public.support_chat_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS source_chat_identifier text,
  ADD COLUMN IF NOT EXISTS attachment_urls text[] NOT NULL DEFAULT '{}';