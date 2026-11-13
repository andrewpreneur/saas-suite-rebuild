-- Admin Support message timeout correction
-- The thread/ticket inbox was optimized earlier, but its message SELECT still
-- called support_can_see_chat's expensive platform exclusion lookup per row.
DROP POLICY IF EXISTS "Agency owners can view ai chat messages" ON public.ai_chat_messages;
CREATE POLICY "Agency owners can view ai chat messages"
ON public.ai_chat_messages FOR SELECT
USING (
  CASE WHEN (SELECT public.is_platform_admin()) THEN
    COALESCE(
      public.platform_support_agency_key(agency_id) <> ALL (ARRAY(
        SELECT DISTINCT keys.agency_id
        FROM public.platform_support_excluded_agencies ex
        JOIN public.saas_suite_users ssu ON lower(ssu.email) = ex.owner_email
        CROSS JOIN LATERAL (VALUES
          (public.platform_support_agency_key(ssu.agency_id)),
          (public.platform_support_agency_key(ssu.agency_id_basic)),
          (public.platform_support_agency_key(ssu.agency_id_advanced)),
          (public.platform_support_agency_key(ssu.agency_id_elite))
        ) keys(agency_id)
        WHERE keys.agency_id IS NOT NULL
      )), true
    )
  ELSE
    public.can_access_agency(agency_id)
    AND public.support_can_see_chat(agency_id, user_identifier)
  END
  OR lower(user_identifier) = (SELECT public.current_auth_email())
);
CREATE INDEX IF NOT EXISTS ai_chat_messages_agency_created_idx
ON public.ai_chat_messages (agency_id, created_at DESC);
