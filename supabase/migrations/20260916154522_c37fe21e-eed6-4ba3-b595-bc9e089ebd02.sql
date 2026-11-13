-- Admin read access to account-rep (agency support) messages
CREATE OR REPLACE FUNCTION public.admin_list_agency_support_messages(p_limit integer DEFAULT 500)
RETURNS TABLE(
  id uuid,
  client_email text,
  agency_id text,
  sender_role text,
  sender_name text,
  body text,
  attachment_url text,
  created_at timestamptz,
  owner_email text,
  agency_name text,
  full_name text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT m.id, m.client_email, m.agency_id, m.sender_role, m.sender_name, m.body,
         m.attachment_url, m.created_at,
         c.owner_email,
         u.agency_name,
         u.full_name
  FROM public.agency_support_messages m
  LEFT JOIN public.agency_support_clients c
    ON lower(c.client_email) = lower(m.client_email)
  LEFT JOIN public.saas_suite_users u
    ON lower(u.email) = lower(COALESCE(c.owner_email, m.client_email))
  ORDER BY m.created_at DESC
  LIMIT LEAST(COALESCE(p_limit, 500), 2000);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_agency_support_messages(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_agency_support_messages(integer) TO authenticated, service_role;

-- Admin reply into an account-rep conversation
CREATE OR REPLACE FUNCTION public.admin_send_agency_support_message(
  p_client_email text,
  p_body text,
  p_sender_name text DEFAULT 'SaaSSuite Support',
  p_attachment_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_agency text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN
    RAISE EXCEPTION 'Message body is required';
  END IF;

  SELECT m.agency_id INTO v_agency
  FROM public.agency_support_messages m
  WHERE lower(m.client_email) = lower(trim(p_client_email))
  ORDER BY m.created_at DESC
  LIMIT 1;

  INSERT INTO public.agency_support_messages
    (agency_id, client_email, sender_role, sender_name, body, attachment_url)
  VALUES
    (v_agency, lower(trim(p_client_email)), 'rep', COALESCE(NULLIF(trim(p_sender_name), ''), 'SaaSSuite Support'),
     left(trim(p_body), 5000), p_attachment_url)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_send_agency_support_message(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_send_agency_support_message(text, text, text, text) TO authenticated, service_role;

-- Alert on every inbound account-rep message
CREATE OR REPLACE FUNCTION public.notify_agency_support_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  request_id bigint;
BEGIN
  IF NEW.sender_role = 'client' THEN
    BEGIN
      SELECT net.http_post(
        url := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/notify-agency-support-message',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object('message_id', NEW.id)
      ) INTO request_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_agency_support_message webhook failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_agency_support_message ON public.agency_support_messages;
CREATE TRIGGER trg_notify_agency_support_message
AFTER INSERT ON public.agency_support_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_agency_support_message();