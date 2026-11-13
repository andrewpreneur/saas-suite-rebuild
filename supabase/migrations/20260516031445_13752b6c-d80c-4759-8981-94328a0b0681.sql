-- Helpers used by RLS policies
CREATE OR REPLACE FUNCTION public.current_auth_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_auth_email() = 'andrew@dna-media.net';
$$;

CREATE OR REPLACE FUNCTION public.can_access_owner_email(p_owner_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin()
    OR lower(coalesce(p_owner_email, '')) = public.current_auth_email()
    OR EXISTS (
      SELECT 1
      FROM public.account_admins aa
      WHERE lower(aa.owner_email) = lower(coalesce(p_owner_email, ''))
        AND lower(aa.admin_email) = public.current_auth_email()
        AND aa.status = 'accepted'
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_agency(p_agency_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.saas_suite_users ssu
      WHERE public.can_access_owner_email(ssu.email)
        AND p_agency_id IS NOT NULL
        AND p_agency_id IN (
          ssu.agency_id,
          ssu.agency_id_basic,
          ssu.agency_id_advanced,
          ssu.agency_id_elite,
          ssu.original_agency_id,
          ssu.original_agency_id_basic,
          ssu.original_agency_id_advanced,
          ssu.original_agency_id_elite,
          ssu.agency_name
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_affiliate(p_affiliate_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.affiliates a
      WHERE a.id = p_affiliate_id
        AND (
          lower(a.email) = public.current_auth_email()
          OR lower(coalesce(a.user_email_linked, '')) = public.current_auth_email()
        )
    );
$$;

-- ai_chat_messages
DROP POLICY IF EXISTS "Anyone can view their own messages" ON public.ai_chat_messages;
DROP POLICY IF EXISTS "Anyone can insert messages" ON public.ai_chat_messages;
CREATE POLICY "Agency owners can view ai chat messages"
ON public.ai_chat_messages FOR SELECT TO authenticated
USING (public.can_access_agency(agency_id) OR lower(user_identifier) = public.current_auth_email());
CREATE POLICY "Public can insert ai chat messages"
ON public.ai_chat_messages FOR INSERT TO public
WITH CHECK (true);

-- banned_users
DROP POLICY IF EXISTS "Allow authenticated read access to banned_users" ON public.banned_users;
DROP POLICY IF EXISTS "Allow authenticated insert to banned_users" ON public.banned_users;
DROP POLICY IF EXISTS "Allow authenticated delete from banned_users" ON public.banned_users;
CREATE POLICY "Agency owners can view banned users"
ON public.banned_users FOR SELECT TO authenticated
USING (public.can_access_agency(agency_id));
CREATE POLICY "Agency owners can insert banned users"
ON public.banned_users FOR INSERT TO authenticated
WITH CHECK (public.can_access_agency(agency_id));
CREATE POLICY "Agency owners can delete banned users"
ON public.banned_users FOR DELETE TO authenticated
USING (public.can_access_agency(agency_id));

-- user_progress
DROP POLICY IF EXISTS "Allow all access to user_progress" ON public.user_progress;
CREATE POLICY "Users and agency owners can view user progress"
ON public.user_progress FOR SELECT TO authenticated
USING (lower(coalesce(email, '')) = public.current_auth_email() OR public.can_access_agency(agency_id));
CREATE POLICY "Users can insert own progress"
ON public.user_progress FOR INSERT TO authenticated
WITH CHECK (lower(coalesce(email, '')) = public.current_auth_email() OR public.can_access_agency(agency_id));
CREATE POLICY "Users and agency owners can update progress"
ON public.user_progress FOR UPDATE TO authenticated
USING (lower(coalesce(email, '')) = public.current_auth_email() OR public.can_access_agency(agency_id))
WITH CHECK (lower(coalesce(email, '')) = public.current_auth_email() OR public.can_access_agency(agency_id));
CREATE POLICY "Agency owners can delete progress"
ON public.user_progress FOR DELETE TO authenticated
USING (public.can_access_agency(agency_id));

-- support_tickets
DROP POLICY IF EXISTS "Users can view their agency tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can update their agency tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can delete their agency tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Anyone can insert tickets" ON public.support_tickets;
CREATE POLICY "Agency owners can view support tickets"
ON public.support_tickets FOR SELECT TO authenticated
USING (public.can_access_agency(agency_id) OR lower(customer_email) = public.current_auth_email());
CREATE POLICY "Public can submit support tickets"
ON public.support_tickets FOR INSERT TO public
WITH CHECK (true);
CREATE POLICY "Agency owners can update support tickets"
ON public.support_tickets FOR UPDATE TO authenticated
USING (public.can_access_agency(agency_id))
WITH CHECK (public.can_access_agency(agency_id));
CREATE POLICY "Agency owners can delete support tickets"
ON public.support_tickets FOR DELETE TO authenticated
USING (public.can_access_agency(agency_id));

-- user_onboarding_checklist_completion
DROP POLICY IF EXISTS "Anyone can view checklist completion" ON public.user_onboarding_checklist_completion;
DROP POLICY IF EXISTS "Anyone can insert checklist completion" ON public.user_onboarding_checklist_completion;
DROP POLICY IF EXISTS "Anyone can delete their own checklist completion" ON public.user_onboarding_checklist_completion;
CREATE POLICY "Users and agency owners can view checklist completion"
ON public.user_onboarding_checklist_completion FOR SELECT TO authenticated
USING (lower(user_identifier) = public.current_auth_email() OR public.can_access_agency(agency_id));
CREATE POLICY "Users can insert checklist completion"
ON public.user_onboarding_checklist_completion FOR INSERT TO authenticated
WITH CHECK (lower(user_identifier) = public.current_auth_email() OR public.can_access_agency(agency_id));
CREATE POLICY "Users and agency owners can delete checklist completion"
ON public.user_onboarding_checklist_completion FOR DELETE TO authenticated
USING (lower(user_identifier) = public.current_auth_email() OR public.can_access_agency(agency_id));

-- training_doc_chunks
DROP POLICY IF EXISTS "Service role can manage training chunks" ON public.training_doc_chunks;
CREATE POLICY "Agency owners can view training chunks"
ON public.training_doc_chunks FOR SELECT TO authenticated
USING (public.can_access_agency(agency_id));
CREATE POLICY "Platform admin can manage training chunks"
ON public.training_doc_chunks FOR ALL TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- custom_onboarding_videos
DROP POLICY IF EXISTS "Users can view their agency's custom videos" ON public.custom_onboarding_videos;
DROP POLICY IF EXISTS "Users can insert custom videos for their agency" ON public.custom_onboarding_videos;
DROP POLICY IF EXISTS "Users can update their agency's custom videos" ON public.custom_onboarding_videos;
DROP POLICY IF EXISTS "Users can delete their agency's custom videos" ON public.custom_onboarding_videos;
CREATE POLICY "Agency owners can view custom videos"
ON public.custom_onboarding_videos FOR SELECT TO authenticated
USING (public.can_access_agency(agency_id));
CREATE POLICY "Agency owners can insert custom videos"
ON public.custom_onboarding_videos FOR INSERT TO authenticated
WITH CHECK (public.can_access_agency(agency_id));
CREATE POLICY "Agency owners can update custom videos"
ON public.custom_onboarding_videos FOR UPDATE TO authenticated
USING (public.can_access_agency(agency_id))
WITH CHECK (public.can_access_agency(agency_id));
CREATE POLICY "Agency owners can delete custom videos"
ON public.custom_onboarding_videos FOR DELETE TO authenticated
USING (public.can_access_agency(agency_id));

-- agency_onboarding_checklist
DROP POLICY IF EXISTS "Authenticated users can manage agency onboarding checklist" ON public.agency_onboarding_checklist;
CREATE POLICY "Agency owners can manage agency onboarding checklist"
ON public.agency_onboarding_checklist FOR ALL TO authenticated
USING (public.can_access_agency(agency_id))
WITH CHECK (public.can_access_agency(agency_id));

-- affiliates and affiliate children
DROP POLICY IF EXISTS "Authenticated users can view affiliate applications" ON public.affiliates;
DROP POLICY IF EXISTS "Authenticated users can update affiliate applications" ON public.affiliates;
CREATE POLICY "Affiliates can view own application"
ON public.affiliates FOR SELECT TO authenticated
USING (public.is_platform_admin() OR lower(email) = public.current_auth_email() OR lower(coalesce(user_email_linked, '')) = public.current_auth_email());
CREATE POLICY "Affiliates can update own application"
ON public.affiliates FOR UPDATE TO authenticated
USING (public.is_platform_admin() OR lower(email) = public.current_auth_email() OR lower(coalesce(user_email_linked, '')) = public.current_auth_email())
WITH CHECK (public.is_platform_admin() OR lower(email) = public.current_auth_email() OR lower(coalesce(user_email_linked, '')) = public.current_auth_email());

DROP POLICY IF EXISTS "Authenticated users can manage referrals" ON public.affiliate_referrals;
CREATE POLICY "Affiliates can view own referrals"
ON public.affiliate_referrals FOR SELECT TO authenticated
USING (public.can_access_affiliate(affiliate_id));
CREATE POLICY "Platform admin can manage referrals"
ON public.affiliate_referrals FOR ALL TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Authenticated users can manage payouts" ON public.affiliate_payouts;
CREATE POLICY "Affiliates can view own payouts"
ON public.affiliate_payouts FOR SELECT TO authenticated
USING (public.can_access_affiliate(affiliate_id));
CREATE POLICY "Platform admin can manage payouts"
ON public.affiliate_payouts FOR ALL TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Authenticated users can view affiliate events" ON public.affiliate_events;
CREATE POLICY "Affiliates can view own events"
ON public.affiliate_events FOR SELECT TO authenticated
USING (public.can_access_affiliate(affiliate_id));

-- admin-only tables
DROP POLICY IF EXISTS "Authenticated users can view audit logs" ON public.approval_changes_audit;
CREATE POLICY "Platform admin can view audit logs"
ON public.approval_changes_audit FOR SELECT TO authenticated
USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Authenticated users can view connections" ON public.levelup_connections;
CREATE POLICY "Platform admin can view connections"
ON public.levelup_connections FOR SELECT TO authenticated
USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Authenticated users can view text requests" ON public.text_requests;
CREATE POLICY "Platform admin can view text requests"
ON public.text_requests FOR SELECT TO authenticated
USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Authenticated users can view registrations" ON public.ai_webinar_registrations;
CREATE POLICY "Platform admin can view ai webinar registrations"
ON public.ai_webinar_registrations FOR SELECT TO authenticated
USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Authenticated users can manage admin_lists" ON public.admin_lists;
CREATE POLICY "Platform admin can manage admin lists"
ON public.admin_lists FOR ALL TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Authenticated users can manage admin_list_members" ON public.admin_list_members;
CREATE POLICY "Platform admin can manage admin list members"
ON public.admin_list_members FOR ALL TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- v2_home_settings
DROP POLICY IF EXISTS "Authenticated users can insert v2_home_settings" ON public.v2_home_settings;
DROP POLICY IF EXISTS "Authenticated users can update v2_home_settings" ON public.v2_home_settings;
CREATE POLICY "Agency owners can insert v2 home settings"
ON public.v2_home_settings FOR INSERT TO authenticated
WITH CHECK (public.can_access_agency(agency_id));
CREATE POLICY "Agency owners can update v2 home settings"
ON public.v2_home_settings FOR UPDATE TO authenticated
USING (public.can_access_agency(agency_id))
WITH CHECK (public.can_access_agency(agency_id));

-- user_auth_status
DROP POLICY IF EXISTS "Allow public read access to user_auth_status" ON public.user_auth_status;
CREATE POLICY "Users can view own auth status"
ON public.user_auth_status FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_platform_admin());

-- workflows
DROP POLICY IF EXISTS "Anyone can view workflows" ON public.workflows;
DROP POLICY IF EXISTS "Authenticated can insert workflows" ON public.workflows;
DROP POLICY IF EXISTS "Authenticated can update workflows" ON public.workflows;
DROP POLICY IF EXISTS "Authenticated can delete workflows" ON public.workflows;
CREATE POLICY "Agency owners can view workflows"
ON public.workflows FOR SELECT TO authenticated
USING (public.can_access_agency(agency_id));
CREATE POLICY "Agency owners can insert workflows"
ON public.workflows FOR INSERT TO authenticated
WITH CHECK (public.can_access_agency(agency_id));
CREATE POLICY "Agency owners can update workflows"
ON public.workflows FOR UPDATE TO authenticated
USING (public.can_access_agency(agency_id))
WITH CHECK (public.can_access_agency(agency_id));
CREATE POLICY "Agency owners can delete workflows"
ON public.workflows FOR DELETE TO authenticated
USING (public.can_access_agency(agency_id));

-- ai_chat_rate_limits
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.ai_chat_rate_limits;
CREATE POLICY "Users can view own rate limits"
ON public.ai_chat_rate_limits FOR SELECT TO authenticated
USING (lower(user_identifier) = public.current_auth_email() OR public.is_platform_admin());
CREATE POLICY "Authenticated users can manage own rate limits"
ON public.ai_chat_rate_limits FOR ALL TO authenticated
USING (lower(user_identifier) = public.current_auth_email() OR public.is_platform_admin())
WITH CHECK (lower(user_identifier) = public.current_auth_email() OR public.is_platform_admin());

-- ai_support_feedback
DROP POLICY IF EXISTS "Anyone can view feedback" ON public.ai_support_feedback;
DROP POLICY IF EXISTS "Service role can update feedback" ON public.ai_support_feedback;
CREATE POLICY "Agency owners can view support feedback"
ON public.ai_support_feedback FOR SELECT TO authenticated
USING (public.can_access_agency(agency_id) OR lower(coalesce(user_email, user_identifier, '')) = public.current_auth_email());
CREATE POLICY "Platform admin can update support feedback"
ON public.ai_support_feedback FOR UPDATE TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());