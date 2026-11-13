-- 1. Profile: handle + verified
ALTER TABLE public.community_profiles
  ADD COLUMN IF NOT EXISTS handle text,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS community_profiles_handle_lower_key
  ON public.community_profiles (lower(handle));

-- allow non-auth system accounts (SaaSSuite bot)
ALTER TABLE public.community_profiles DROP CONSTRAINT IF EXISTS community_profiles_id_fkey;

-- 2. Handle helpers
CREATE OR REPLACE FUNCTION public.community_normalize_handle(_raw text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NULLIF(substring(regexp_replace(lower(coalesce(_raw,'')), '[^a-z0-9_]', '', 'g') from 1 for 24), '')
$$;

CREATE OR REPLACE FUNCTION public.community_handle_available(_handle text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.community_normalize_handle(_handle) IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.community_profiles p
       WHERE lower(p.handle) = public.community_normalize_handle(_handle)
         AND p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
     )
$$;

CREATE OR REPLACE FUNCTION public.community_generate_handle(_base text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _root text := public.community_normalize_handle(split_part(coalesce(_base,'member'), ' ', 1));
  _try text;
  _n int := 0;
BEGIN
  IF _root IS NULL THEN _root := 'member'; END IF;
  LOOP
    _try := CASE WHEN _n = 0 THEN _root ELSE _root || _n::text END;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.community_profiles WHERE lower(handle) = _try);
    _n := _n + 1;
  END LOOP;
  RETURN _try;
END $$;

-- 3. System SaaSSuite account + announcements space
INSERT INTO public.community_profiles (id, email, display_name, handle, tier, role, is_verified, joined_at, bio)
VALUES ('00000000-0000-0000-0000-000000005a55'::uuid, 'team@saassuite.ai', 'SaaSSuite', 'saassuite', 'paid', 'admin', true, now(), 'Official SaaSSuite product updates')
ON CONFLICT (id) DO UPDATE SET display_name = 'SaaSSuite', handle = 'saassuite', is_verified = true, role = 'admin';

INSERT INTO public.community_spaces (slug, name, description, min_tier, sort_order)
VALUES ('announcements', 'Announcements', 'Product updates from the SaaSSuite team', 'free', 0)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.community_profiles
   SET role = 'admin', is_verified = true
 WHERE lower(email) = 'andrew@dna-media.net';

-- 4. Join RPC now stores handle + avatar
CREATE OR REPLACE FUNCTION public.community_join(
  _display_name text DEFAULT NULL,
  _active_subaccounts text DEFAULT NULL,
  _highlevel_experience text DEFAULT NULL,
  _show_account_count boolean DEFAULT true,
  _bio text DEFAULT NULL,
  _handle text DEFAULT NULL,
  _avatar_url text DEFAULT NULL
)
RETURNS community_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _row public.community_profiles;
  _h text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  PERFORM public.community_ensure_profile(_display_name, _avatar_url);

  _h := public.community_normalize_handle(_handle);
  IF _h IS NULL THEN
    SELECT handle INTO _h FROM public.community_profiles WHERE id = auth.uid();
  END IF;
  IF _h IS NULL THEN
    _h := public.community_generate_handle(coalesce(_display_name, ''));
  END IF;
  IF EXISTS (SELECT 1 FROM public.community_profiles WHERE lower(handle) = _h AND id <> auth.uid()) THEN
    RAISE EXCEPTION 'That @handle is already taken';
  END IF;

  UPDATE public.community_profiles p
     SET display_name = COALESCE(NULLIF(trim(_display_name), ''), p.display_name),
         bio = COALESCE(NULLIF(trim(_bio), ''), p.bio),
         handle = _h,
         avatar_url = COALESCE(NULLIF(trim(_avatar_url), ''), p.avatar_url),
         active_subaccounts = COALESCE(_active_subaccounts, p.active_subaccounts),
         highlevel_experience = COALESCE(_highlevel_experience, p.highlevel_experience),
         show_account_count = COALESCE(_show_account_count, p.show_account_count),
         joined_at = COALESCE(p.joined_at, now()),
         updated_at = now()
   WHERE p.id = auth.uid()
   RETURNING * INTO _row;

  RETURN _row;
END $$;

-- 5. Ask the Team becomes a private DM line
ALTER TABLE public.community_threads ALTER COLUMN is_private SET DEFAULT true;
UPDATE public.community_threads SET is_private = true WHERE is_private = false;

CREATE OR REPLACE FUNCTION public.community_can_view_thread(_thread_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_threads t
    WHERE t.id = _thread_id
      AND (t.user_id = auth.uid() OR public.community_is_staff())
  )
$$;

DROP POLICY IF EXISTS thread_read ON public.community_threads;
CREATE POLICY thread_read ON public.community_threads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.community_is_staff());

-- 6. Staff-only announcement publisher (posts as the SaaSSuite account)
CREATE OR REPLACE FUNCTION public.community_post_announcement(_body text, _title text DEFAULT NULL, _pin boolean DEFAULT false)
RETURNS community_posts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _space uuid;
  _row public.community_posts;
  _bot uuid := '00000000-0000-0000-0000-000000005a55'::uuid;
BEGIN
  IF NOT public.community_is_staff() THEN RAISE EXCEPTION 'Staff only'; END IF;
  IF coalesce(trim(_body), '') = '' THEN RAISE EXCEPTION 'Body required'; END IF;

  SELECT id INTO _space FROM public.community_spaces WHERE slug = 'announcements';
  IF _space IS NULL THEN RAISE EXCEPTION 'Announcements space missing'; END IF;

  INSERT INTO public.community_posts (space_id, author_id, title, body, is_pinned)
  VALUES (_space, _bot, NULLIF(trim(coalesce(_title,'')), ''), trim(_body), coalesce(_pin, false))
  RETURNING * INTO _row;

  RETURN _row;
END $$;