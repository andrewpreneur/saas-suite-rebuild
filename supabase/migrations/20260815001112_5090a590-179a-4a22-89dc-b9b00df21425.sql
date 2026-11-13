-- Safety net: also create the app row when a Google/OAuth user's email lands on
-- auth.users after the initial insert (email can be NULL at insert time for some
-- OAuth flows, which silently skipped account creation).
DROP TRIGGER IF EXISTS on_auth_user_email_set_register_starter ON auth.users;
CREATE TRIGGER on_auth_user_email_set_register_starter
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
WHEN (NEW.email IS NOT NULL AND (OLD.email IS NULL OR OLD.email <> NEW.email))
EXECUTE FUNCTION public.handle_new_auth_user_starter();

-- Log failures instead of swallowing them silently so future gaps are visible.
CREATE TABLE IF NOT EXISTS public.auth_signup_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.auth_signup_failures TO service_role;
ALTER TABLE public.auth_signup_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admin views signup failures"
ON public.auth_signup_failures FOR SELECT TO authenticated
USING (lower(coalesce(public.current_auth_email(), '')) = 'andrew@dna-media.net');

CREATE OR REPLACE FUNCTION public.handle_new_auth_user_starter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.register_starter_user(lower(NEW.email), NULL);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block auth user creation, but record why it failed.
  BEGIN
    INSERT INTO public.auth_signup_failures (email, error_message)
    VALUES (lower(NEW.email), SQLERRM);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END;
$function$;