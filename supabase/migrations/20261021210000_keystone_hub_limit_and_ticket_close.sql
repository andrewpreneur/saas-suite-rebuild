-- Keystone, 21 Oct 2026.
-- Hub seats no longer include the agency owner's emails, accepted-or-not admin
-- emails on that account, owner aliases, guest rows, or preview/test identities.
-- max_onboarding_users and plan entitlements are unchanged.
-- Closing a support chat (handover_resolved_at) closes the linked auto-opened
-- "Need help." ticket. An assistant line that promises an email update is
-- rewritten when the visitor just asked to stay in the chat.
--
-- APPLY THIS FILE to the database. It is not applied by opening the pull request.
-- Do not run it against a production project from an automated agent.

CREATE OR REPLACE FUNCTION public.hub_is_preview_identity(p_email text, p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    COALESCE(p_name, '') ~* '^(preview|test|demo)( user)?$'
    OR COALESCE(p_name, '') ~* '(^|[^[:alnum:]])(preview|test|demo) user([^[:alnum:]]|$)'
    OR split_part(lower(btrim(COALESCE(p_email, ''))), '@', 1) ~ '^(preview|test|demo)(\+.*)?$';
$$;

CREATE OR REPLACE FUNCTION public.hub_seat_exempt(p_agency_id text, p_email text, p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      COALESCE(NULLIF(btrim(p_email), ''), '') = ''
      AND (p_name IS NULL OR btrim(p_name) = '' OR p_name LIKE 'Guest User #%')
    )
    OR lower(btrim(COALESCE(p_email, ''))) IN (
      SELECT lower(btrim(e))
      FROM (
        SELECT ssu.email AS e
        FROM public.saas_suite_users ssu
        WHERE ssu.agency_id = p_agency_id
           OR ssu.agency_id_basic = p_agency_id
           OR ssu.agency_id_advanced = p_agency_id
           OR ssu.agency_id_elite = p_agency_id
        UNION
        SELECT aa.admin_email
        FROM public.account_admins aa
        JOIN public.saas_suite_users ssu ON lower(aa.owner_email) = lower(ssu.email)
        WHERE ssu.agency_id = p_agency_id
           OR ssu.agency_id_basic = p_agency_id
           OR ssu.agency_id_advanced = p_agency_id
           OR ssu.agency_id_elite = p_agency_id
        UNION
        SELECT oa.alias_email
        FROM public.onboarding_owner_aliases oa
        JOIN public.saas_suite_users ssu ON lower(oa.owner_email) = lower(ssu.email)
        WHERE ssu.agency_id = p_agency_id
           OR ssu.agency_id_basic = p_agency_id
           OR ssu.agency_id_advanced = p_agency_id
           OR ssu.agency_id_elite = p_agency_id
      ) emails
      WHERE e IS NOT NULL AND btrim(e) <> ''
    )
    OR public.hub_is_preview_identity(p_email, p_name);
$$;

CREATE OR REPLACE FUNCTION public.hub_seated_users(p_agency_id text)
RETURNS TABLE(user_key text, first_seen timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN NULLIF(btrim(up.email), '') IS NOT NULL THEN lower(btrim(up.email))
      ELSE up.name
    END AS user_key,
    MIN(up.created_at) AS first_seen
  FROM public.user_progress up
  WHERE up.agency_id = p_agency_id
    AND NOT public.hub_seat_exempt(p_agency_id, up.email, up.name)
    AND (
      NULLIF(btrim(up.email), '') IS NOT NULL
      OR (up.name IS NOT NULL AND btrim(up.name) <> '' AND up.name NOT LIKE 'Guest User #%')
    )
  GROUP BY 1;
$$;

CREATE OR REPLACE FUNCTION public.get_agency_user_limit(p_agency_id text)
RETURNS TABLE(max_users integer, current_users bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ssu.max_onboarding_users AS max_users,
    (SELECT COUNT(*) FROM public.hub_seated_users(p_agency_id)) AS current_users
  FROM public.saas_suite_users ssu
  WHERE ssu.agency_id = p_agency_id
     OR ssu.agency_id_basic = p_agency_id
     OR ssu.agency_id_advanced = p_agency_id
     OR ssu.agency_id_elite = p_agency_id
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_user_within_limit(
  p_agency_id text,
  p_user_identifier text,
  p_identifier_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_users integer;
  v_user_rank bigint;
  v_key text;
BEGIN
  SELECT ssu.max_onboarding_users INTO v_max_users
  FROM public.saas_suite_users ssu
  WHERE ssu.agency_id = p_agency_id
     OR ssu.agency_id_basic = p_agency_id
     OR ssu.agency_id_advanced = p_agency_id
     OR ssu.agency_id_elite = p_agency_id
  LIMIT 1;

  IF v_max_users IS NULL THEN
    RETURN true;
  END IF;

  IF public.hub_seat_exempt(
    p_agency_id,
    CASE WHEN p_identifier_type = 'email' THEN p_user_identifier ELSE NULL END,
    CASE WHEN p_identifier_type = 'email' THEN NULL ELSE p_user_identifier END
  ) THEN
    RETURN true;
  END IF;

  v_key := CASE
    WHEN p_identifier_type = 'email' THEN lower(btrim(COALESCE(p_user_identifier, '')))
    ELSE p_user_identifier
  END;

  SELECT ranked.rank INTO v_user_rank
  FROM (
    SELECT user_key, ROW_NUMBER() OVER (ORDER BY first_seen ASC) AS rank
    FROM public.hub_seated_users(p_agency_id)
  ) ranked
  WHERE ranked.user_key = v_key;

  IF v_user_rank IS NOT NULL THEN
    RETURN v_user_rank <= v_max_users;
  END IF;

  RETURN (SELECT COUNT(*) FROM public.hub_seated_users(p_agency_id)) < v_max_users;
END;
$$;

REVOKE ALL ON FUNCTION public.hub_is_preview_identity(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hub_seat_exempt(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hub_seated_users(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hub_is_preview_identity(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_seat_exempt(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hub_seated_users(text) TO service_role;

-- Resolving the chat closes the ticket the AI opened for that same person.
CREATE OR REPLACE FUNCTION public.close_linked_ticket_when_chat_resolved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.handover_resolved_at IS NULL OR NEW.handover_requested_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.handover_resolved_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.support_tickets
  SET
    status = 'closed',
    updated_at = now(),
    request_text = regexp_replace(
      request_text,
      'Issue:[[:space:]]*Need help\.',
      'Issue: Resolved in chat.',
      'g'
    )
  WHERE status = 'open'
    AND agency_id = NEW.agency_id
    AND request_text ~* '^[[:space:]]*Human handover request from AI support'
    AND (
      (source_chat_identifier IS NOT NULL AND lower(source_chat_identifier) = lower(NEW.user_identifier))
      OR lower(customer_email) = lower(NEW.user_identifier)
      OR lower(customer_name) = lower(NEW.user_identifier)
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_ticket_on_chat_resolve ON public.chat_threads;
CREATE TRIGGER trg_close_ticket_on_chat_resolve
AFTER INSERT OR UPDATE OF handover_resolved_at ON public.chat_threads
FOR EACH ROW
EXECUTE FUNCTION public.close_linked_ticket_when_chat_resolved();

-- Stored assistant copy must match an in-chat-only preference from the last two hours.
CREATE OR REPLACE FUNCTION public.rewrite_inchat_email_promise()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM 'assistant' OR NEW.content IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.content !~* 'you(''ll| will) (get|receive) an email update' THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.ai_chat_messages m
    WHERE m.agency_id = NEW.agency_id
      AND lower(m.user_identifier) = lower(NEW.user_identifier)
      AND m.role = 'user'
      AND m.created_at > now() - interval '2 hours'
      AND m.content ~* '(keep it in this chat|in-chat only|in this chat only|in-chat-only|chat only)'
  ) THEN
    RETURN NEW;
  END IF;

  NEW.content := regexp_replace(NEW.content, 'you''ll get an email update', 'you''ll get the update in this chat', 'gi');
  NEW.content := regexp_replace(NEW.content, 'you will get an email update', 'you''ll get the update in this chat', 'gi');
  NEW.content := regexp_replace(NEW.content, 'you''ll receive an email update', 'you''ll get the update in this chat', 'gi');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rewrite_inchat_email_promise ON public.ai_chat_messages;
CREATE TRIGGER trg_rewrite_inchat_email_promise
BEFORE INSERT ON public.ai_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.rewrite_inchat_email_promise();
