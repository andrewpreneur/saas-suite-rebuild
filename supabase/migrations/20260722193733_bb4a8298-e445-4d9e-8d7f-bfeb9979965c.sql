DROP FUNCTION IF EXISTS public.get_agency_tickets(text);

CREATE OR REPLACE FUNCTION public.get_agency_tickets(user_email text)
 RETURNS TABLE(id uuid, ticket_number integer, agency_id text, customer_name text, customer_email text, issue_category text, request_text text, status text, created_at timestamp with time zone, admin_response text, responded_at timestamp with time zone, admin_response_attachment_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_agency_ids text[];
BEGIN
  SELECT ARRAY_REMOVE(ARRAY[
    ssu.agency_id,
    ssu.agency_id_basic,
    ssu.agency_id_advanced,
    ssu.agency_id_elite,
    ssu.original_agency_id,
    ssu.original_agency_id_basic,
    ssu.original_agency_id_advanced,
    ssu.original_agency_id_elite,
    ssu.agency_name
  ], NULL) INTO user_agency_ids
  FROM saas_suite_users ssu
  WHERE ssu.email = user_email;

  RETURN QUERY
  SELECT
    st.id,
    st.ticket_number,
    st.agency_id,
    st.customer_name,
    st.customer_email,
    st.issue_category,
    st.request_text,
    st.status,
    st.created_at,
    st.admin_response,
    st.responded_at,
    st.admin_response_attachment_url
  FROM support_tickets st
  WHERE st.agency_id = ANY(user_agency_ids)
  ORDER BY st.created_at DESC;
END;
$function$;