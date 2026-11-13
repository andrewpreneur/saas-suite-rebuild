CREATE TABLE public.agency_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_email text NOT NULL,
  owner_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_email, owner_email)
);
GRANT SELECT ON public.agency_join_requests TO authenticated;
GRANT ALL ON public.agency_join_requests TO service_role;
ALTER TABLE public.agency_join_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties can view their join requests" ON public.agency_join_requests
FOR SELECT TO authenticated
USING (lower(requester_email) = lower(auth.jwt()->>'email') OR lower(owner_email) = lower(auth.jwt()->>'email'));

CREATE OR REPLACE FUNCTION public.find_agency_by_domain()
RETURNS TABLE(owner_email text, agency_name text, domain text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me text := lower(auth.jwt()->>'email');
  d text := split_part(lower(auth.jwt()->>'email'), '@', 2);
BEGIN
  IF me IS NULL OR d = '' OR d = ANY (ARRAY['gmail.com','googlemail.com','yahoo.com','hotmail.com','outlook.com','live.com','icloud.com','me.com','aol.com','proton.me','protonmail.com','msn.com','ymail.com','gmx.com','mail.com','yandex.com','zoho.com']) THEN
    RETURN;
  END IF;
  -- Already an admin somewhere on this domain: nothing to prompt
  IF EXISTS (SELECT 1 FROM account_admins a WHERE lower(a.admin_email) = me AND split_part(lower(a.owner_email),'@',2) = d) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT u.email::text, u.agency_name::text, d
  FROM saas_suite_users u
  WHERE split_part(lower(u.email),'@',2) = d
    AND lower(u.email) <> me
    AND coalesce(u.agency_name,'') <> ''
    AND coalesce(u.approval,'YES') <> 'NO'
    AND lower(u.email) NOT IN (SELECT lower(a.admin_email) FROM account_admins a)
  ORDER BY (u.plan = 'ADVANCED') DESC, u.created_at ASC
  LIMIT 1;
END $$;

CREATE OR REPLACE FUNCTION public.request_join_agency(p_owner_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := lower(auth.jwt()->>'email');
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF split_part(me,'@',2) <> split_part(lower(p_owner_email),'@',2) THEN RAISE EXCEPTION 'Domain mismatch'; END IF;
  INSERT INTO agency_join_requests (requester_email, owner_email)
  VALUES (me, lower(p_owner_email))
  ON CONFLICT (requester_email, owner_email) DO UPDATE SET status = 'pending', updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.respond_join_request(p_request_id uuid, p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text := lower(auth.jwt()->>'email'); r agency_join_requests;
BEGIN
  SELECT * INTO r FROM agency_join_requests WHERE id = p_request_id;
  IF r.id IS NULL OR lower(r.owner_email) <> me THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE agency_join_requests SET status = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END, updated_at = now() WHERE id = r.id;
  IF p_approve THEN
    INSERT INTO account_admins (owner_email, admin_email, status, accepted_at)
    SELECT r.owner_email, r.requester_email, 'accepted', now()
    WHERE NOT EXISTS (SELECT 1 FROM account_admins WHERE lower(owner_email)=lower(r.owner_email) AND lower(admin_email)=lower(r.requester_email));
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.find_agency_by_domain() FROM anon, public;
REVOKE ALL ON FUNCTION public.request_join_agency(text) FROM anon, public;
REVOKE ALL ON FUNCTION public.respond_join_request(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.find_agency_by_domain() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_join_agency(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_join_request(uuid, boolean) TO authenticated;