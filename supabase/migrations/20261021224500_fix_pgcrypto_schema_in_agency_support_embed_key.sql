-- gen_random_bytes lives in the extensions schema; with search_path=public the unqualified call failed (42883), rolling back every Agency Support activation for users without an embed key. Applied live Oct 21 2026.
CREATE OR REPLACE FUNCTION public.ensure_agency_support_embed_key()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.agency_support_access, false) = true AND NEW.agency_support_embed_key IS NULL THEN
    NEW.agency_support_embed_key := encode(extensions.gen_random_bytes(12), 'hex');
    NEW.agency_support_embed_enabled := true;
  END IF;
  RETURN NEW;
END;
$function$;
