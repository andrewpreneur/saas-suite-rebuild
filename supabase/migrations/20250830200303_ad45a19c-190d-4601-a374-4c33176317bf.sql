-- Fix security warnings by setting search_path on functions
CREATE OR REPLACE FUNCTION public.sync_user_auth_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a user is created in saas_suite_users, create corresponding auth status
  IF TG_OP = 'INSERT' THEN
    -- Get the user_id from auth.users based on email
    INSERT INTO public.user_auth_status (user_id, approval, has_password)
    SELECT 
      au.id,
      NEW.approval,
      CASE WHEN au.encrypted_password IS NOT NULL THEN true ELSE false END
    FROM auth.users au 
    WHERE au.email = NEW.email
    ON CONFLICT (user_id) DO UPDATE SET 
      approval = EXCLUDED.approval,
      updated_at = now();
    
    RETURN NEW;
  END IF;
  
  -- When approval is updated in saas_suite_users, sync to auth_status
  IF TG_OP = 'UPDATE' AND OLD.approval != NEW.approval THEN
    UPDATE public.user_auth_status 
    SET approval = NEW.approval, updated_at = now()
    WHERE user_id IN (
      SELECT au.id FROM auth.users au WHERE au.email = NEW.email
    );
    
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix search_path for password status function
CREATE OR REPLACE FUNCTION public.update_password_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a user's password is set/updated in auth.users, update our status
  IF NEW.encrypted_password IS NOT NULL AND (OLD.encrypted_password IS NULL OR OLD.encrypted_password != NEW.encrypted_password) THEN
    UPDATE public.user_auth_status 
    SET has_password = true, updated_at = now()
    WHERE user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;