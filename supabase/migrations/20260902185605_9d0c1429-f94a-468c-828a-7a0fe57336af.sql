CREATE OR REPLACE FUNCTION public.can_manage_agency_message(_agency_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin()
     OR EXISTS (
       SELECT 1 FROM public.saas_suite_users u
       WHERE lower(trim(u.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
         AND lower(trim(_agency_id)) IN (
           lower(trim(coalesce(u.agency_id, ''))),
           lower(trim(coalesce(u.agency_id_basic, ''))),
           lower(trim(coalesce(u.agency_id_advanced, ''))),
           lower(trim(coalesce(u.agency_id_elite, '')))
         )
     );
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_agency_message(text) TO authenticated, service_role;

GRANT DELETE ON public.agency_owner_messages TO authenticated;
GRANT ALL ON public.agency_owner_messages TO service_role;

DROP POLICY IF EXISTS "Admins and owners can delete agency_owner_messages" ON public.agency_owner_messages;
CREATE POLICY "Admins and owners can delete agency_owner_messages"
  ON public.agency_owner_messages
  FOR DELETE
  TO authenticated
  USING (public.can_manage_agency_message(agency_id));