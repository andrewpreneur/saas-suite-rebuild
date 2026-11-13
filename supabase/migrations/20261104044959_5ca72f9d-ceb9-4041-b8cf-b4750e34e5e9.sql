ALTER TABLE public.saas_suite_users ADD COLUMN IF NOT EXISTS customer_language text NOT NULL DEFAULT 'en';

CREATE OR REPLACE FUNCTION public.guard_customer_language() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.customer_language IS NULL OR NEW.customer_language NOT IN ('en','es','fr','de','nl','no','pt','it','sv','da','fi') THEN
    RAISE EXCEPTION 'Unsupported customer language';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.customer_language IS DISTINCT FROM OLD.customer_language AND auth.uid() IS NOT NULL THEN
    IF NOT public.can_access_owner_email(OLD.email) THEN RAISE EXCEPTION 'Account access required'; END IF;
    IF lower(coalesce(auth.jwt()->>'email','')) <> lower(OLD.email) AND NOT public.is_platform_admin() THEN
      IF NOT EXISTS (SELECT 1 FROM public.account_admins a WHERE lower(a.owner_email)=lower(OLD.email) AND lower(a.admin_email)=lower(auth.jwt()->>'email') AND a.status='accepted' AND coalesce(a.permissions->>'settings','edit')='edit') THEN
        RAISE EXCEPTION 'Settings edit access required';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_customer_language BEFORE INSERT OR UPDATE OF customer_language ON public.saas_suite_users FOR EACH ROW EXECUTE FUNCTION public.guard_customer_language();

CREATE OR REPLACE FUNCTION public.set_customer_language(p_owner_email text,p_language text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_language text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_access_owner_email(lower(trim(p_owner_email))) THEN RAISE EXCEPTION 'Account access required'; END IF;
  UPDATE public.saas_suite_users SET customer_language=p_language WHERE lower(email)=lower(trim(p_owner_email)) RETURNING customer_language INTO v_language;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
  RETURN v_language;
END; $$;
REVOKE ALL ON FUNCTION public.set_customer_language(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_customer_language(text,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_customer_language(p_agency_id text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT s.customer_language FROM public.saas_suite_users s WHERE p_agency_id IN (s.agency_id,s.agency_id_basic,s.agency_id_advanced,s.agency_id_elite) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_customer_language(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_language(text) TO anon,authenticated,service_role;