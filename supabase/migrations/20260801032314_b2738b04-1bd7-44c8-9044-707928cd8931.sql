DROP FUNCTION IF EXISTS public.community_post_announcement(text, text, boolean);

CREATE OR REPLACE FUNCTION public.community_post_announcement(_body text, _title text DEFAULT NULL::text, _pin boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _space uuid;
  _id uuid;
  _bot uuid := '00000000-0000-0000-0000-000000005a55'::uuid;
  _clean_title text := NULLIF(trim(coalesce(_title,'')), '');
BEGIN
  IF NOT public.community_is_staff() THEN RAISE EXCEPTION 'Staff only'; END IF;
  IF coalesce(trim(_body), '') = '' THEN RAISE EXCEPTION 'Body required'; END IF;

  SELECT id INTO _space FROM public.community_spaces WHERE slug = 'announcements';
  IF _space IS NULL THEN RAISE EXCEPTION 'Announcements space missing'; END IF;

  IF _clean_title IS NOT NULL THEN
    SELECT id INTO _id FROM public.community_posts
    WHERE author_id = _bot AND title = _clean_title
    LIMIT 1;
    IF _id IS NOT NULL THEN RETURN _id; END IF;
  END IF;

  INSERT INTO public.community_posts (space_id, author_id, title, body, is_pinned)
  VALUES (_space, _bot, _clean_title, trim(_body), coalesce(_pin, false))
  RETURNING id INTO _id;

  RETURN _id;
END $function$;

GRANT EXECUTE ON FUNCTION public.community_post_announcement(text, text, boolean) TO authenticated, service_role;