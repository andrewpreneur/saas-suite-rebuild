-- Slack default event fan-out: new account, first AI support message
-- (8h dedupe), and ticket status/response changes.

CREATE OR REPLACE FUNCTION public.notify_agency_user_count_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn_url text;
  payload jsonb;
BEGIN
  IF NEW.agency_id IS NULL OR NEW.agency_id = '' THEN
    RETURN NEW;
  END IF;

  fn_url := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/notify-agency-user-count';
  payload := jsonb_build_object(
    'agency_id', NEW.agency_id,
    'new_user_email', COALESCE(NEW.email, ''),
    'new_user_name',  COALESCE(NEW.name, '')
  );

  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_agency_user_count_change failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._slack_auto_dispatch(
  _agency_id text,
  _event_type text,
  _data jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn_url text := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/slack-auto-notify';
BEGIN
  IF _agency_id IS NULL OR _agency_id = '' THEN RETURN; END IF;
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'agency_id', _agency_id,
      'event_type', _event_type,
      'data', _data
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '_slack_auto_dispatch failed: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_slack_ai_chat_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  prior_count int;
BEGIN
  IF NEW.role <> 'user' THEN RETURN NEW; END IF;
  IF NEW.agency_id IS NULL OR NEW.user_identifier IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO prior_count
  FROM public.ai_chat_messages
  WHERE agency_id = NEW.agency_id
    AND user_identifier = NEW.user_identifier
    AND role = 'user'
    AND id <> NEW.id
    AND created_at >= (NEW.created_at - interval '8 hours');

  IF prior_count > 0 THEN RETURN NEW; END IF;

  PERFORM public._slack_auto_dispatch(
    NEW.agency_id,
    'support_started',
    jsonb_build_object(
      'user_email',    NEW.user_identifier,
      'user_name',     NEW.user_identifier,
      'first_message', LEFT(COALESCE(NEW.content, ''), 500)
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_slack_ai_chat_session failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_slack_ai_chat_session ON public.ai_chat_messages;
CREATE TRIGGER trg_slack_ai_chat_session
AFTER INSERT ON public.ai_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_slack_ai_chat_session();

CREATE OR REPLACE FUNCTION public.notify_slack_ticket_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  status_changed boolean;
  response_changed boolean;
BEGIN
  status_changed   := (NEW.status IS DISTINCT FROM OLD.status);
  response_changed := (COALESCE(NEW.admin_response,'') IS DISTINCT FROM COALESCE(OLD.admin_response,''));

  IF NOT status_changed AND NOT response_changed THEN RETURN NEW; END IF;

  PERFORM public._slack_auto_dispatch(
    NEW.agency_id,
    'ticket_updated',
    jsonb_build_object(
      'ticket_id',       NEW.ticket_number,
      'subject',         COALESCE(NEW.issue_category, ''),
      'user_email',      NEW.customer_email,
      'user_name',       NEW.customer_name,
      'previous_status', OLD.status,
      'status',          NEW.status,
      'updated_by',      COALESCE(NEW.responded_by, ''),
      'note',            CASE WHEN response_changed THEN LEFT(COALESCE(NEW.admin_response, ''), 800) ELSE '' END
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_slack_ticket_updated failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_slack_ticket_updated ON public.support_tickets;
CREATE TRIGGER trg_slack_ticket_updated
AFTER UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.notify_slack_ticket_updated();