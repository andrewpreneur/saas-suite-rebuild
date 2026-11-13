CREATE OR REPLACE FUNCTION public.notify_ticket_customer_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.sender_role = 'customer' THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/ticket-reply-handover',
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object('reply_id', NEW.id)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'ticket reply notify failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_ticket_customer_reply() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_ticket_customer_reply ON public.support_ticket_replies;
CREATE TRIGGER trg_notify_ticket_customer_reply
AFTER INSERT ON public.support_ticket_replies
FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_customer_reply();