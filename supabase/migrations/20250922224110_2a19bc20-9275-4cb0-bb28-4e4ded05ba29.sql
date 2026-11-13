-- Create new trigger function that calls the edge function
CREATE OR REPLACE FUNCTION public.notify_onboarding_completed_edge()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when onboarding_completed changes from false to true
  IF OLD.onboarding_completed = false AND NEW.onboarding_completed = true THEN
    -- Call the edge function asynchronously
    PERFORM net.http_post(
      url := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/notify-onboarding-webhook',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
      ),
      body := jsonb_build_object(
        'user_id', NEW.id,
        'email', NEW.email,
        'onboarding_completed', NEW.onboarding_completed
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
CREATE TRIGGER onboarding_completed_edge_trigger
  AFTER UPDATE ON saas_suite_users
  FOR EACH ROW
  EXECUTE FUNCTION notify_onboarding_completed_edge();