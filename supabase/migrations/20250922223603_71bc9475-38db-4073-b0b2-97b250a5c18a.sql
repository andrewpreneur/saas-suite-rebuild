-- Fix the security warning by setting search_path for the function
CREATE OR REPLACE FUNCTION notify_onboarding_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
begin
  -- Only fire if onboarding_completed changes from false to true
  if (TG_OP = 'UPDATE'
      and NEW.onboarding_completed = true
      and OLD.onboarding_completed = false) then

    perform
      net.http_post(
        url := 'https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/c80002d8-3a02-4e62-8f41-19256fdc1414',
        headers := '{"Content-Type": "application/json"}'::json,
        body := json_build_object(
          'user_id', NEW.id,
          'email', NEW.email,
          'onboarding_completed', NEW.onboarding_completed
        )
      );
  end if;

  return NEW;
end;
$$;