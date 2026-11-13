-- Create user_auth_status table for public onboarding flow
CREATE TABLE public.user_auth_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approval TEXT NOT NULL DEFAULT 'PENDING',
  has_password BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS but allow public read access
ALTER TABLE public.user_auth_status ENABLE ROW LEVEL SECURITY;

-- Allow public read access for onboarding flow
CREATE POLICY "Allow public read access to user_auth_status" 
ON public.user_auth_status 
FOR SELECT 
USING (true);

-- Only authenticated users can update their own record
CREATE POLICY "Users can update their own auth status" 
ON public.user_auth_status 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Function to sync user_auth_status with saas_suite_users
CREATE OR REPLACE FUNCTION public.sync_user_auth_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create trigger to sync saas_suite_users changes to user_auth_status
CREATE TRIGGER sync_auth_status_on_user_change
  AFTER INSERT OR UPDATE ON public.saas_suite_users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_auth_status();

-- Function to update has_password status when user sets password
CREATE OR REPLACE FUNCTION public.update_password_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create trigger on auth.users to update password status
CREATE TRIGGER update_auth_password_status
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_password_status();

-- Function to get user auth status by email (public function)
CREATE OR REPLACE FUNCTION public.get_user_auth_status_by_email(user_email text)
RETURNS TABLE(user_id uuid, approval text, has_password boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate email
  IF user_email IS NULL OR user_email = '' THEN
    RETURN;
  END IF;
  
  -- Return auth status for the user without exposing email
  RETURN QUERY
  SELECT uas.user_id, uas.approval, uas.has_password
  FROM user_auth_status uas
  INNER JOIN auth.users au ON uas.user_id = au.id
  WHERE au.email = user_email;
END;
$$;