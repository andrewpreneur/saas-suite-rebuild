CREATE OR REPLACE FUNCTION public.get_agency_chat_config(p_agency_id text)
 RETURNS TABLE(ai_chat_enabled boolean, human_chat_enabled boolean, human_chat_mode text, support_ticketing_enabled boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    coalesce((SELECT h.ai_chat_enabled FROM public.v2_home_settings h
              WHERE h.agency_id = regexp_replace(p_agency_id, 'NO$', '', 'i') LIMIT 1), true),
    coalesce(u.human_chat_enabled, true),
    coalesce(u.human_chat_mode, 'self'),
    coalesce(u.support_ticketing_enabled, false)
  FROM public.saas_suite_users u
  WHERE regexp_replace(p_agency_id, 'NO$', '', 'i') IN (u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite)
  LIMIT 1
$function$;