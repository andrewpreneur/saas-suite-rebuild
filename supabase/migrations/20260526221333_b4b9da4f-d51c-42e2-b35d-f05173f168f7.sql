
-- Fix RLS gaps introduced by May 16 hardening, plus a leftover open policy.

-- A. user_progress: end-users (anonymous SaaS clients) need full access again
CREATE POLICY "Public can view user progress"
ON public.user_progress FOR SELECT TO public USING (true);
CREATE POLICY "Public can insert user progress"
ON public.user_progress FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public can update user progress"
ON public.user_progress FOR UPDATE TO public USING (true) WITH CHECK (true);

-- B. user_onboarding_checklist_completion: same — anonymous SaaS clients
CREATE POLICY "Public can view checklist completion"
ON public.user_onboarding_checklist_completion FOR SELECT TO public USING (true);
CREATE POLICY "Public can insert checklist completion"
ON public.user_onboarding_checklist_completion FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public can delete checklist completion"
ON public.user_onboarding_checklist_completion FOR DELETE TO public USING (true);

-- D. saas_suite_users: account admins must be able to update the owner's row
CREATE POLICY "Account admins can update owner record"
ON public.saas_suite_users FOR UPDATE TO authenticated
USING (public.can_access_owner_email(email))
WITH CHECK (public.can_access_owner_email(email));

-- E. agency_video_settings: replace the wide-open ALL/true policy with proper scoping
DROP POLICY IF EXISTS "Allow all access to agency_video_settings" ON public.agency_video_settings;

CREATE POLICY "Anyone can view agency video settings"
ON public.agency_video_settings FOR SELECT TO public USING (true);

CREATE POLICY "Agency owners can insert agency video settings"
ON public.agency_video_settings FOR INSERT TO authenticated
WITH CHECK (public.can_access_agency(agency_id));

CREATE POLICY "Agency owners can update agency video settings"
ON public.agency_video_settings FOR UPDATE TO authenticated
USING (public.can_access_agency(agency_id))
WITH CHECK (public.can_access_agency(agency_id));

CREATE POLICY "Agency owners can delete agency video settings"
ON public.agency_video_settings FOR DELETE TO authenticated
USING (public.can_access_agency(agency_id));
