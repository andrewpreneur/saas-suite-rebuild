
ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS email_warmup_credits integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.consume_email_warmup_credit(p_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE public.saas_suite_users
     SET email_warmup_credits = email_warmup_credits - 1
   WHERE lower(email) = lower(p_email)
     AND email_warmup_credits > 0
   RETURNING email_warmup_credits INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'NO_CREDITS';
  END IF;

  RETURN new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_email_warmup_credit(text) TO service_role;

UPDATE public.saas_suite_users
   SET email_warmup_access = true,
       email_warmup_credits = 999
 WHERE lower(email) = 'rob@medspamarketing.ai';
