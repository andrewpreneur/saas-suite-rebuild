CREATE OR REPLACE FUNCTION public.update_account_profile(p_email text, p_full_name text, p_phone text, p_agency_name text)
RETURNS TABLE(owner_email text, agency_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text := lower(btrim(coalesce(p_email,''))); v_owner text;
BEGIN
  IF v_email = '' THEN RAISE EXCEPTION 'No account selected'; END IF;
  SELECT u.email INTO v_owner FROM saas_suite_users u WHERE lower(u.email) = v_email LIMIT 1;
  IF v_owner IS NULL THEN
    -- Merged/alias logins open the owner account they were attached to.
    SELECT aa.owner_email INTO v_owner FROM account_admins aa
     WHERE lower(aa.admin_email) = v_email AND aa.status = 'accepted'
     ORDER BY aa.created_at DESC NULLS LAST LIMIT 1;
  END IF;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Account not found for %', v_email; END IF;
  IF NOT public.can_access_owner_email(v_owner) THEN RAISE EXCEPTION 'You do not have permission to edit this account'; END IF;
  RETURN QUERY
  UPDATE saas_suite_users u SET full_name = nullif(btrim(p_full_name),''), bonuses_phone = nullif(btrim(p_phone),''), agency_name = nullif(btrim(p_agency_name),'')
   WHERE lower(u.email) = lower(v_owner)
  RETURNING u.email, u.agency_id;
END $$;
REVOKE ALL ON FUNCTION public.update_account_profile(text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_account_profile(text,text,text,text) TO authenticated;