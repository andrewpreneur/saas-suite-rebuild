-- The policy "Owners manage their agency_category_settings" (20260716193523)
-- compared saas_suite_users.agency_id to itself. Inside that subquery the
-- unqualified agency_id binds to u.agency_id, so the check is
-- u.agency_id IN (u.agency_id, ...) and any signed-in user with an account
-- row can insert, update, or delete every agency's rows.
-- Bind the check to this table's agency_id. can_access_agency already allows
-- the owner, an accepted team admin, and the platform admin; is_platform_admin
-- stays explicit so platform-admin access does not depend on that detail.
-- Public reads are unchanged ("Public can read agency_category_settings").

DROP POLICY IF EXISTS "Owners manage their agency_category_settings"
  ON public.agency_category_settings;

CREATE POLICY "Owners manage their agency_category_settings"
  ON public.agency_category_settings
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_admin()
    OR public.can_access_agency(agency_category_settings.agency_id)
  )
  WITH CHECK (
    public.is_platform_admin()
    OR public.can_access_agency(agency_category_settings.agency_id)
  );
