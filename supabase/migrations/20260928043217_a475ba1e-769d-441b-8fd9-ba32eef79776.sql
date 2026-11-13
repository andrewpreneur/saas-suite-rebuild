GRANT SELECT ON public.agency_ui_versions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.agency_ui_versions TO authenticated;
GRANT ALL ON public.agency_ui_versions TO service_role;

CREATE POLICY "Agency owners can add their link theme"
ON public.agency_ui_versions FOR INSERT TO authenticated
WITH CHECK (public.can_access_agency(agency_id));

CREATE POLICY "Agency owners can change their link theme"
ON public.agency_ui_versions FOR UPDATE TO authenticated
USING (public.can_access_agency(agency_id))
WITH CHECK (public.can_access_agency(agency_id));