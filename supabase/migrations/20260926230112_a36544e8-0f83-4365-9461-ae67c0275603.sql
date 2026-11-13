CREATE OR REPLACE FUNCTION public.notify_ticket_customer_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.sender_role = 'customer' THEN
    UPDATE public.support_tickets SET status = 'open', updated_at = now()
     WHERE id = NEW.ticket_id AND status IS DISTINCT FROM 'open';
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