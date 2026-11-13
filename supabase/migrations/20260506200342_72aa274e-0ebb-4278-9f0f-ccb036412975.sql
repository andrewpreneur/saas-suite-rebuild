CREATE OR REPLACE FUNCTION public.handle_new_auth_user_starter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.register_starter_user(lower(NEW.email), NULL);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block auth user creation
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_register_starter ON auth.users;

CREATE TRIGGER on_auth_user_created_register_starter
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user_starter();