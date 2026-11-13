-- Public ?ref= visits need a slug -> affiliate id without a table read.
-- anon cannot select affiliates (RLS). Authenticated visitors can only select
-- their own row. The tracking hook only needs the id, so the lookup lives in
-- an unexposed security-definer function. The public wrapper is what the
-- client calls, and it returns that id or null.
--
-- Does not change commission rates, referral inserts, or signup attribution.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.resolve_affiliate_slug(p_slug text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id
  FROM public.affiliates a
  WHERE p_slug IS NOT NULL
    AND char_length(btrim(p_slug)) BETWEEN 1 AND 120
    AND lower(a.affiliate_slug) = lower(btrim(p_slug))
  ORDER BY a.id
  LIMIT 1;
$$;

COMMENT ON FUNCTION private.resolve_affiliate_slug(text) IS
  'Slug to affiliate id for ?ref= tracking. Returns no other affiliate columns.';

REVOKE ALL ON FUNCTION private.resolve_affiliate_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.resolve_affiliate_slug(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_affiliate_slug(slug text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.resolve_affiliate_slug(slug);
$$;

COMMENT ON FUNCTION public.resolve_affiliate_slug(text) IS
  'Client entry for ?ref= tracking. Returns the affiliate id, or null when the slug is missing.';

REVOKE ALL ON FUNCTION public.resolve_affiliate_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_affiliate_slug(text) TO anon, authenticated, service_role;
