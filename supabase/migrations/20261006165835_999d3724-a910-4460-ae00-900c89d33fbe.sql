-- Item 5: feature ideas, comments, upvotes
DROP POLICY IF EXISTS "Anyone can delete comments" ON public.feature_comments;
DROP POLICY IF EXISTS "Anyone can update their own comments" ON public.feature_comments;
CREATE POLICY "Authors or staff can update comments" ON public.feature_comments FOR UPDATE TO authenticated
  USING (public.community_is_staff() OR public.is_platform_admin() OR user_name = (SELECT cp.display_name FROM public.community_profiles cp WHERE cp.id = auth.uid()))
  WITH CHECK (public.community_is_staff() OR public.is_platform_admin() OR user_name = (SELECT cp.display_name FROM public.community_profiles cp WHERE cp.id = auth.uid()));
CREATE POLICY "Authors or staff can delete comments" ON public.feature_comments FOR DELETE TO authenticated
  USING (public.community_is_staff() OR public.is_platform_admin() OR user_name = (SELECT cp.display_name FROM public.community_profiles cp WHERE cp.id = auth.uid()));

DROP POLICY IF EXISTS "Anyone can delete feature_requests" ON public.feature_requests;
DROP POLICY IF EXISTS "Anyone can update feature_requests" ON public.feature_requests;
CREATE POLICY "Staff can update feature_requests" ON public.feature_requests FOR UPDATE TO authenticated
  USING (public.community_is_staff() OR public.is_platform_admin())
  WITH CHECK (public.community_is_staff() OR public.is_platform_admin());
CREATE POLICY "Staff can delete feature_requests" ON public.feature_requests FOR DELETE TO authenticated
  USING (public.community_is_staff() OR public.is_platform_admin());

DROP POLICY IF EXISTS "Anyone can delete their own upvotes" ON public.feature_upvotes;
CREATE POLICY "Voters can remove their own upvotes" ON public.feature_upvotes FOR DELETE TO authenticated
  USING (user_identifier = auth.uid()::text OR public.is_platform_admin());

-- Keep the upvote count in sync on the server instead of from the browser.
CREATE OR REPLACE FUNCTION public.sync_feature_upvote_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fid uuid := COALESCE(NEW.feature_id, OLD.feature_id);
BEGIN
  UPDATE public.feature_requests SET upvotes = (SELECT count(*) FROM public.feature_upvotes WHERE feature_id = fid) WHERE id = fid;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_feature_upvote_count() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS feature_upvotes_sync_count ON public.feature_upvotes;
CREATE TRIGGER feature_upvotes_sync_count AFTER INSERT OR DELETE ON public.feature_upvotes
  FOR EACH ROW EXECUTE FUNCTION public.sync_feature_upvote_count();

-- Item 6: hide member emails from other members
REVOKE SELECT ON public.community_profiles FROM anon, authenticated;
GRANT SELECT (id, display_name, avatar_url, bio, tier, role, post_count, created_at, updated_at, joined_at,
  active_subaccounts, highlevel_experience, show_account_count, handle, is_verified)
  ON public.community_profiles TO anon, authenticated;