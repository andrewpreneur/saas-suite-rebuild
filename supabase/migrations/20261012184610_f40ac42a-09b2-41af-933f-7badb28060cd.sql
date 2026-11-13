CREATE OR REPLACE FUNCTION public._support_updates_webhook_dispatch(_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions' AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/notify-support-webhook',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := _payload);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '_support_updates_webhook_dispatch failed: %', SQLERRM;
END $$;

CREATE OR REPLACE FUNCTION public.trg_ticket_status_updates_webhook()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public._support_updates_webhook_dispatch(jsonb_build_object(
      'event_type','ticket_status_updated',
      'ticket', to_jsonb(NEW) - 'customer_autopay' ,
      'previous_status', OLD.status));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ticket_status_updates_webhook ON public.support_tickets;
CREATE TRIGGER trg_ticket_status_updates_webhook AFTER UPDATE OF status ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.trg_ticket_status_updates_webhook();

CREATE OR REPLACE FUNCTION public.trg_ticket_reply_updates_webhook()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t public.support_tickets;
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id = NEW.ticket_id;
  IF t.id IS NOT NULL THEN
    PERFORM public._support_updates_webhook_dispatch(jsonb_build_object(
      'event_type','ticket_message_added',
      'ticket', to_jsonb(t),
      'message', jsonb_build_object('body', NEW.body, 'sender_role', NEW.sender_role,
        'sender_name', NEW.sender_name, 'sender_email', NEW.sender_email, 'created_at', NEW.created_at)));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ticket_reply_updates_webhook ON public.support_ticket_replies;
CREATE TRIGGER trg_ticket_reply_updates_webhook AFTER INSERT ON public.support_ticket_replies
FOR EACH ROW EXECUTE FUNCTION public.trg_ticket_reply_updates_webhook();