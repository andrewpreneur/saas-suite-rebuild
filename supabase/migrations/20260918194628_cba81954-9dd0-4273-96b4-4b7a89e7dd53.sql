
ALTER TABLE public.saas_suite_users ADD COLUMN IF NOT EXISTS support_updates_webhook_url text;

CREATE TABLE IF NOT EXISTS public.agency_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  agency_id text,
  title text NOT NULL,
  details text,
  stage text NOT NULL DEFAULT 'Draft',
  priority text NOT NULL DEFAULT 'normal',
  position integer NOT NULL DEFAULT 0,
  client_email text,
  client_name text,
  client_company text,
  location_id text,
  due_date date,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_projects_stage_chk CHECK (stage IN ('Draft','Requested','In Progress','In Revision','Closed')),
  CONSTRAINT agency_projects_priority_chk CHECK (priority IN ('low','normal','high','urgent'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_projects TO authenticated;
GRANT ALL ON public.agency_projects TO service_role;
ALTER TABLE public.agency_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins read projects" ON public.agency_projects
  FOR SELECT TO authenticated USING (public.can_access_owner_email(owner_email));
CREATE POLICY "Owners and admins insert projects" ON public.agency_projects
  FOR INSERT TO authenticated WITH CHECK (public.can_access_owner_email(owner_email));
CREATE POLICY "Owners and admins update projects" ON public.agency_projects
  FOR UPDATE TO authenticated USING (public.can_access_owner_email(owner_email))
  WITH CHECK (public.can_access_owner_email(owner_email));
CREATE POLICY "Owners and admins delete projects" ON public.agency_projects
  FOR DELETE TO authenticated USING (public.can_access_owner_email(owner_email));

CREATE INDEX IF NOT EXISTS agency_projects_owner_idx ON public.agency_projects (lower(owner_email), stage, position);

CREATE TABLE IF NOT EXISTS public.agency_project_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.agency_projects(id) ON DELETE CASCADE,
  sender_role text NOT NULL DEFAULT 'owner',
  sender_email text,
  sender_name text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_project_messages_role_chk CHECK (sender_role IN ('owner','admin'))
);

GRANT SELECT, INSERT, DELETE ON public.agency_project_messages TO authenticated;
GRANT ALL ON public.agency_project_messages TO service_role;
ALTER TABLE public.agency_project_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members read messages" ON public.agency_project_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.agency_projects p WHERE p.id = project_id AND public.can_access_owner_email(p.owner_email))
  );
CREATE POLICY "Project members write messages" ON public.agency_project_messages
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.agency_projects p WHERE p.id = project_id AND public.can_access_owner_email(p.owner_email))
  );
CREATE POLICY "Project members delete messages" ON public.agency_project_messages
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.agency_projects p WHERE p.id = project_id AND public.can_access_owner_email(p.owner_email))
  );

CREATE INDEX IF NOT EXISTS agency_project_messages_project_idx ON public.agency_project_messages (project_id, created_at);

CREATE OR REPLACE FUNCTION public.agency_projects_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS agency_projects_touch ON public.agency_projects;
CREATE TRIGGER agency_projects_touch BEFORE UPDATE ON public.agency_projects
  FOR EACH ROW EXECUTE FUNCTION public.agency_projects_touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.agency_projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agency_project_messages;

CREATE TABLE IF NOT EXISTS public.webinar_funnel_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_label text,
  customer_email text,
  amount numeric NOT NULL DEFAULT 0,
  interval text NOT NULL DEFAULT 'monthly',
  purchased_at date NOT NULL DEFAULT current_date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webinar_funnel_purchases_interval_chk CHECK (interval IN ('monthly','yearly','one_time'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webinar_funnel_purchases TO authenticated;
GRANT ALL ON public.webinar_funnel_purchases TO service_role;
ALTER TABLE public.webinar_funnel_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage webinar purchases" ON public.webinar_funnel_purchases
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP TRIGGER IF EXISTS webinar_funnel_purchases_touch ON public.webinar_funnel_purchases;
CREATE TRIGGER webinar_funnel_purchases_touch BEFORE UPDATE ON public.webinar_funnel_purchases
  FOR EACH ROW EXECUTE FUNCTION public.agency_projects_touch_updated_at();
