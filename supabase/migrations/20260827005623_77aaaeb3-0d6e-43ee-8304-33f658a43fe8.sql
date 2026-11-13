CREATE OR REPLACE FUNCTION public.is_academy_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT lower(coalesce((auth.jwt() ->> 'email'), '')) = 'andrew@dna-media.net'
$$;