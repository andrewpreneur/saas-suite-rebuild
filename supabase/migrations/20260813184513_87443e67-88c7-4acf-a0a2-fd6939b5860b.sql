-- 1) agency_menu_config: scope writes to agency owner/admins
DROP POLICY IF EXISTS "Authenticated users can insert agency_menu_config" ON public.agency_menu_config;
DROP POLICY IF EXISTS "Authenticated users can update agency_menu_config" ON public.agency_menu_config;

CREATE POLICY "Agency owners can insert agency_menu_config"
ON public.agency_menu_config FOR INSERT TO authenticated
WITH CHECK (public.can_access_agency(agency_id));

CREATE POLICY "Agency owners can update agency_menu_config"
ON public.agency_menu_config FOR UPDATE TO authenticated
USING (public.can_access_agency(agency_id))
WITH CHECK (public.can_access_agency(agency_id));

CREATE POLICY "Agency owners can delete agency_menu_config"
ON public.agency_menu_config FOR DELETE TO authenticated
USING (public.can_access_agency(agency_id));

-- 2) menu_link_rules: scope writes to agency owner/admins
DROP POLICY IF EXISTS "Authenticated users can insert menu_link_rules" ON public.menu_link_rules;
DROP POLICY IF EXISTS "Authenticated users can update menu_link_rules" ON public.menu_link_rules;
DROP POLICY IF EXISTS "Authenticated users can delete menu_link_rules" ON public.menu_link_rules;

CREATE POLICY "Agency owners can insert menu_link_rules"
ON public.menu_link_rules FOR INSERT TO authenticated
WITH CHECK (public.can_access_agency(agency_id));

CREATE POLICY "Agency owners can update menu_link_rules"
ON public.menu_link_rules FOR UPDATE TO authenticated
USING (public.can_access_agency(agency_id))
WITH CHECK (public.can_access_agency(agency_id));

CREATE POLICY "Agency owners can delete menu_link_rules"
ON public.menu_link_rules FOR DELETE TO authenticated
USING (public.can_access_agency(agency_id));

-- 3) affiliate_commissions: scope to affiliate owner / platform admin
DROP POLICY IF EXISTS "Authenticated users can manage affiliate commissions" ON public.affiliate_commissions;
DROP POLICY IF EXISTS "Authenticated users can read affiliate commissions" ON public.affiliate_commissions;

CREATE POLICY "Affiliates can read their own commissions"
ON public.affiliate_commissions FOR SELECT TO authenticated
USING (public.can_access_affiliate(affiliate_id));

CREATE POLICY "Platform admin can manage affiliate commissions"
ON public.affiliate_commissions FOR ALL TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- 4) agency_daily_checklist: remove blanket public policy, scope writes
DROP POLICY IF EXISTS "Allow all access to agency_daily_checklist" ON public.agency_daily_checklist;

CREATE POLICY "Anyone can view agency_daily_checklist"
ON public.agency_daily_checklist FOR SELECT
USING (true);

CREATE POLICY "Agency owners can insert agency_daily_checklist"
ON public.agency_daily_checklist FOR INSERT TO authenticated
WITH CHECK (public.can_access_agency(agency_id));

CREATE POLICY "Agency owners can update agency_daily_checklist"
ON public.agency_daily_checklist FOR UPDATE TO authenticated
USING (public.can_access_agency(agency_id))
WITH CHECK (public.can_access_agency(agency_id));

CREATE POLICY "Agency owners can delete agency_daily_checklist"
ON public.agency_daily_checklist FOR DELETE TO authenticated
USING (public.can_access_agency(agency_id));

-- 5) chat_threads: scope reads and writes to agency owner/admins/platform admin
DROP POLICY IF EXISTS "Authenticated users can manage chat threads" ON public.chat_threads;
DROP POLICY IF EXISTS "Authenticated users can read chat threads" ON public.chat_threads;

CREATE POLICY "Agency owners can read chat threads"
ON public.chat_threads FOR SELECT TO authenticated
USING (public.can_access_agency(agency_id));

CREATE POLICY "Agency owners can insert chat threads"
ON public.chat_threads FOR INSERT TO authenticated
WITH CHECK (public.can_access_agency(agency_id));

CREATE POLICY "Agency owners can update chat threads"
ON public.chat_threads FOR UPDATE TO authenticated
USING (public.can_access_agency(agency_id))
WITH CHECK (public.can_access_agency(agency_id));

CREATE POLICY "Agency owners can delete chat threads"
ON public.chat_threads FOR DELETE TO authenticated
USING (public.can_access_agency(agency_id));