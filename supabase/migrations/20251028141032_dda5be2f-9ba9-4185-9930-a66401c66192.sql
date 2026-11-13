-- ============================================
-- Fix payment/trial consistency bug
-- ============================================

-- 1. Replace the legacy 1-arg start_user_trial to delegate to the safe 2-arg version
-- This prevents any external or legacy callers from accidentally downgrading paid users
CREATE OR REPLACE FUNCTION public.start_user_trial(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Delegate to the 2-arg version with null affiliate_id
  -- This ensures we never overwrite YES approval status
  RETURN start_user_trial(user_email, NULL);
END;
$function$;

-- 2. Add protective trigger to prevent accidental YES → TRIALING downgrades
CREATE OR REPLACE FUNCTION public.prevent_approval_downgrade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Block any attempt to change approval from YES to TRIALING
  IF OLD.approval = 'YES' AND NEW.approval = 'TRIALING' THEN
    RAISE EXCEPTION 'Cannot downgrade approval from YES to TRIALING. User has paid access.';
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_prevent_approval_downgrade ON public.saas_suite_users;

CREATE TRIGGER trigger_prevent_approval_downgrade
BEFORE UPDATE ON public.saas_suite_users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_approval_downgrade();

-- 3. Create audit table for tracking approval changes
CREATE TABLE IF NOT EXISTS public.approval_changes_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  old_approval text,
  new_approval text,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  changed_by text,
  source text
);

-- Enable RLS on audit table
ALTER TABLE public.approval_changes_audit ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can view audit logs (admin use case)
CREATE POLICY "Authenticated users can view audit logs"
ON public.approval_changes_audit
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

-- 4. Create trigger to log all approval changes
CREATE OR REPLACE FUNCTION public.log_approval_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only log if approval actually changed
  IF OLD.approval IS DISTINCT FROM NEW.approval THEN
    INSERT INTO public.approval_changes_audit (
      user_email, 
      old_approval, 
      new_approval,
      changed_by,
      source
    ) VALUES (
      NEW.email,
      OLD.approval,
      NEW.approval,
      COALESCE(current_setting('request.jwt.claims', true)::json->>'email', 'system'),
      current_setting('application_name', true)
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_log_approval_change ON public.saas_suite_users;

CREATE TRIGGER trigger_log_approval_change
AFTER UPDATE ON public.saas_suite_users
FOR EACH ROW
EXECUTE FUNCTION public.log_approval_change();