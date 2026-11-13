-- Platform-admin lists on /admin/support read chat_threads and support_tickets
-- through PostgREST as `authenticated` (statement_timeout 8s).
--
-- The previous SELECT policies called support_can_see_chat / support_can_see_ticket
-- on every row. For the platform admin those functions call
-- is_platform_support_excluded, which joins platform_support_excluded_agencies to
-- saas_suite_users. On 2026-11-01 that was ~16s for ~290 threads (code 57014),
-- so loadTickets and loadAiSupport returned 500 and the page toasted
-- "Failed to load tickets" / "Failed to load AI conversations".
-- Narrower filters in the same minute still returned 200.
--
-- The platform-admin arm below resolves the excluded agency ids once per query
-- (uncorrelated ARRAY subquery — do not reference the outer row inside it)
-- and compares each row's normalized id. Same visibility as
-- is_platform_support_excluded: blank ids stay visible, a trailing NO is
-- ignored, and a ticket whose customer_email is the signed-in user stays
-- visible. Non-admins stay on can_access_agency AND support_can_see_*.
-- UPDATE policies are unchanged.

DROP POLICY IF EXISTS "Agency owners can read chat threads" ON public.chat_threads;
CREATE POLICY "Agency owners can read chat threads"
  ON public.chat_threads
  FOR SELECT
  USING (
    (
      public.is_platform_admin()
      AND COALESCE(
        public.platform_support_agency_key(agency_id) <> ALL (ARRAY(
          SELECT DISTINCT keys.agency_id
          FROM public.platform_support_excluded_agencies ex
          JOIN public.saas_suite_users ssu
            ON lower(ssu.email) = ex.owner_email
          CROSS JOIN LATERAL (
            VALUES
              (public.platform_support_agency_key(ssu.agency_id)),
              (public.platform_support_agency_key(ssu.agency_id_basic)),
              (public.platform_support_agency_key(ssu.agency_id_advanced)),
              (public.platform_support_agency_key(ssu.agency_id_elite))
          ) AS keys(agency_id)
          WHERE keys.agency_id IS NOT NULL
        )),
        true
      )
    )
    OR (
      NOT public.is_platform_admin()
      AND public.can_access_agency(agency_id)
      AND public.support_can_see_chat(agency_id, user_identifier)
    )
  );

DROP POLICY IF EXISTS "Agency owners can view support tickets" ON public.support_tickets;
CREATE POLICY "Agency owners can view support tickets"
  ON public.support_tickets
  FOR SELECT
  USING (
    (
      public.is_platform_admin()
      AND (
        COALESCE(
          public.platform_support_agency_key(agency_id) <> ALL (ARRAY(
            SELECT DISTINCT keys.agency_id
            FROM public.platform_support_excluded_agencies ex
            JOIN public.saas_suite_users ssu
              ON lower(ssu.email) = ex.owner_email
            CROSS JOIN LATERAL (
              VALUES
                (public.platform_support_agency_key(ssu.agency_id)),
                (public.platform_support_agency_key(ssu.agency_id_basic)),
                (public.platform_support_agency_key(ssu.agency_id_advanced)),
                (public.platform_support_agency_key(ssu.agency_id_elite))
            ) AS keys(agency_id)
            WHERE keys.agency_id IS NOT NULL
          )),
          true
        )
        OR lower(customer_email) = public.current_auth_email()
      )
    )
    OR (
      NOT public.is_platform_admin()
      AND (
        (
          public.can_access_agency(agency_id)
          AND public.support_can_see_ticket(agency_id, assigned_to)
        )
        OR lower(customer_email) = public.current_auth_email()
      )
    )
  );
