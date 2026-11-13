DROP POLICY IF EXISTS "Owners can manage their agency channel mappings" ON public.slack_channel_agency_map;

CREATE POLICY "Owners and platform admin can manage agency channel mappings"
ON public.slack_channel_agency_map
FOR ALL
TO public
USING (
  public.is_platform_admin()
  OR EXISTS (
    SELECT 1
    FROM public.saas_suite_users u
    WHERE lower(u.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
      AND (
        u.agency_id = slack_channel_agency_map.agency_id
        OR u.agency_id_basic = slack_channel_agency_map.agency_id
        OR u.agency_id_advanced = slack_channel_agency_map.agency_id
        OR u.agency_id_elite = slack_channel_agency_map.agency_id
      )
  )
)
WITH CHECK (
  public.is_platform_admin()
  OR EXISTS (
    SELECT 1
    FROM public.saas_suite_users u
    WHERE lower(u.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
      AND (
        u.agency_id = slack_channel_agency_map.agency_id
        OR u.agency_id_basic = slack_channel_agency_map.agency_id
        OR u.agency_id_advanced = slack_channel_agency_map.agency_id
        OR u.agency_id_elite = slack_channel_agency_map.agency_id
      )
  )
);

DROP POLICY IF EXISTS "Owners view their own workspace links" ON public.slack_workspace_links;

CREATE POLICY "Owners and platform admin view workspace links"
ON public.slack_workspace_links
FOR SELECT
TO authenticated
USING (
  public.is_platform_admin()
  OR lower(linked_by_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
);