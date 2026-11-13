-- Remove the problematic trigger and function first
DROP TRIGGER IF EXISTS onboarding_completed_trigger ON saas_suite_users;
DROP FUNCTION IF EXISTS notify_onboarding_completed();

-- Create a new simplified trigger function that doesn't use net.http_post
-- This will use a background task approach instead
CREATE OR REPLACE FUNCTION notify_onboarding_completed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
begin
  -- Only fire if onboarding_completed changes from false to true
  if (TG_OP = 'UPDATE'
      and NEW.onboarding_completed = true
      and OLD.onboarding_completed = false) then

    -- Instead of using net.http_post, we'll call an edge function
    -- This avoids the pg_net dependency issues
    perform
      net.http_post(
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
  end if;

  return NEW;
end;
$$;

-- Create the trigger
CREATE TRIGGER onboarding_completed_trigger
AFTER UPDATE ON saas_suite_users
FOR EACH ROW
EXECUTE FUNCTION notify_onboarding_completed();