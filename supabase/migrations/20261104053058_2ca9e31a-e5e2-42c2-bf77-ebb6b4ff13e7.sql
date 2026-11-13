INSERT INTO public.v2_home_settings (agency_id, home_page_enabled, education_page_enabled, support_page_enabled, default_landing_page)
SELECT DISTINCT ids.agency_id, false, false, true, 'support'
FROM public.saas_suite_users u
CROSS JOIN LATERAL unnest(ARRAY[u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite]) AS ids(agency_id)
WHERE lower(u.email) = 'rob@medspamarketing.ai' AND u.agency_id = 'med-spa-marketing-ai' AND ids.agency_id IS NOT NULL AND ids.agency_id <> ''
ON CONFLICT (agency_id) DO UPDATE SET home_page_enabled = false, education_page_enabled = false, support_page_enabled = true, default_landing_page = 'support';