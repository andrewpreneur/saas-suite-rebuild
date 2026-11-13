UPDATE public.saas_suite_users u
   SET install_confirmed_at = now()
 WHERE u.install_confirmed_at IS NULL
   AND EXISTS (
     SELECT 1 FROM public.agency_menu_config m
      WHERE m.agency_id IN (u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite)
        AND (NULLIF(btrim(m.menu_link_id), '') IS NOT NULL OR NULLIF(btrim(m.menu_link_id_2), '') IS NOT NULL)
   );