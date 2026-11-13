-- ============ ENUMS ============
DO $$ BEGIN CREATE TYPE public.community_tier AS ENUM ('free','paid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.community_role AS ENUM ('member','team','admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.community_thread_status AS ENUM ('open','answered','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ PROFILES ============
CREATE TABLE public.community_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text NOT NULL DEFAULT 'Member',
  avatar_url text,
  bio text,
  tier public.community_tier NOT NULL DEFAULT 'free',
  role public.community_role NOT NULL DEFAULT 'member',
  post_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.community_profiles TO authenticated;
GRANT ALL ON public.community_profiles TO service_role;
ALTER TABLE public.community_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp_read_all" ON public.community_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "cp_insert_own" ON public.community_profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "cp_update_own" ON public.community_profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- helper functions (security definer, avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.community_my_tier()
RETURNS public.community_tier LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT tier FROM public.community_profiles WHERE id = auth.uid()), 'free'::public.community_tier)
$$;

CREATE OR REPLACE FUNCTION public.community_is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.community_profiles WHERE id = auth.uid() AND role IN ('team','admin'))
$$;

CREATE OR REPLACE FUNCTION public.community_tier_ok(_min public.community_tier)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _min = 'free' OR public.community_my_tier() = 'paid' OR public.community_is_staff()
$$;

-- ============ SPACES ============
CREATE TABLE public.community_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text,
  min_tier public.community_tier NOT NULL DEFAULT 'free',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_spaces TO authenticated;
GRANT ALL ON public.community_spaces TO service_role;
ALTER TABLE public.community_spaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_read_by_tier" ON public.community_spaces FOR SELECT TO authenticated USING (public.community_tier_ok(min_tier));

-- ============ POSTS ============
CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.community_spaces(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  body text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  is_answered boolean NOT NULL DEFAULT false,
  comment_count integer NOT NULL DEFAULT 0,
  reaction_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_posts_space_idx ON public.community_posts(space_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_read" ON public.community_posts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.community_spaces s WHERE s.id = space_id AND public.community_tier_ok(s.min_tier)));
CREATE POLICY "post_insert_own" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "post_update_own" ON public.community_posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.community_is_staff()) WITH CHECK (author_id = auth.uid() OR public.community_is_staff());
CREATE POLICY "post_delete_own" ON public.community_posts FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.community_is_staff());

-- ============ COMMENTS ============
CREATE TABLE public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES public.community_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_answer boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_comments_post_idx ON public.community_comments(post_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_comments TO authenticated;
GRANT ALL ON public.community_comments TO service_role;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comment_read" ON public.community_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.community_posts p JOIN public.community_spaces s ON s.id = p.space_id
                 WHERE p.id = post_id AND public.community_tier_ok(s.min_tier)));
CREATE POLICY "comment_insert_own" ON public.community_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "comment_update_own" ON public.community_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.community_is_staff()) WITH CHECK (author_id = auth.uid() OR public.community_is_staff());
CREATE POLICY "comment_delete_own" ON public.community_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.community_is_staff());

-- ============ REACTIONS ============
CREATE TABLE public.community_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.community_comments(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_reactions_target_chk CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR (post_id IS NULL AND comment_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX community_reactions_post_uniq ON public.community_reactions(user_id, post_id, type) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX community_reactions_comment_uniq ON public.community_reactions(user_id, comment_id, type) WHERE comment_id IS NOT NULL;
GRANT SELECT, INSERT, DELETE ON public.community_reactions TO authenticated;
GRANT ALL ON public.community_reactions TO service_role;
ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reaction_read" ON public.community_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "reaction_insert_own" ON public.community_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reaction_delete_own" ON public.community_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ SNAPSHOTS ============
CREATE TABLE public.community_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'General',
  thumbnail_url text,
  share_link text,
  min_tier public.community_tier NOT NULL DEFAULT 'free',
  install_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_snapshots TO authenticated;
GRANT ALL ON public.community_snapshots TO service_role;
ALTER TABLE public.community_snapshots ENABLE ROW LEVEL SECURITY;
-- everyone signed in can see the listing (locked cards are blurred in the UI)
CREATE POLICY "snap_read" ON public.community_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "snap_staff_write" ON public.community_snapshots FOR ALL TO authenticated
  USING (public.community_is_staff()) WITH CHECK (public.community_is_staff());

CREATE OR REPLACE FUNCTION public.community_increment_install(_snapshot_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.community_snapshots SET install_count = install_count + 1, updated_at = now()
  WHERE id = _snapshot_id RETURNING install_count INTO v;
  RETURN v;
END $$;

-- ============ COURSES / LESSONS ============
CREATE TABLE public.community_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  thumbnail_url text,
  min_tier public.community_tier NOT NULL DEFAULT 'free',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_courses TO authenticated;
GRANT ALL ON public.community_courses TO service_role;
ALTER TABLE public.community_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "course_read" ON public.community_courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "course_staff_write" ON public.community_courses FOR ALL TO authenticated
  USING (public.community_is_staff()) WITH CHECK (public.community_is_staff());

CREATE TABLE public.community_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.community_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  video_url text,
  body text,
  duration_minutes integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_lessons_course_idx ON public.community_lessons(course_id, sort_order);
GRANT SELECT ON public.community_lessons TO authenticated;
GRANT ALL ON public.community_lessons TO service_role;
ALTER TABLE public.community_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lesson_read" ON public.community_lessons FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.community_courses c WHERE c.id = course_id AND public.community_tier_ok(c.min_tier)));
CREATE POLICY "lesson_staff_write" ON public.community_lessons FOR ALL TO authenticated
  USING (public.community_is_staff()) WITH CHECK (public.community_is_staff());

CREATE TABLE public.community_lesson_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.community_lessons(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_lesson_progress TO authenticated;
GRANT ALL ON public.community_lesson_progress TO service_role;
ALTER TABLE public.community_lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress_own" ON public.community_lesson_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ THREADS ============
CREATE TABLE public.community_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject text NOT NULL,
  status public.community_thread_status NOT NULL DEFAULT 'open',
  is_private boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.community_threads TO authenticated;
GRANT ALL ON public.community_threads TO service_role;
ALTER TABLE public.community_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "thread_read" ON public.community_threads FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.community_is_staff() OR is_private = false);
CREATE POLICY "thread_insert_own" ON public.community_threads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "thread_update" ON public.community_threads FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.community_is_staff()) WITH CHECK (user_id = auth.uid() OR public.community_is_staff());

CREATE OR REPLACE FUNCTION public.community_can_view_thread(_thread_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_threads t
    WHERE t.id = _thread_id
      AND (t.user_id = auth.uid() OR public.community_is_staff() OR t.is_private = false)
  )
$$;

CREATE TABLE public.community_thread_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.community_threads(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_thread_messages_idx ON public.community_thread_messages(thread_id, created_at);
GRANT SELECT, INSERT ON public.community_thread_messages TO authenticated;
GRANT ALL ON public.community_thread_messages TO service_role;
ALTER TABLE public.community_thread_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tmsg_read" ON public.community_thread_messages FOR SELECT TO authenticated
  USING (public.community_can_view_thread(thread_id));
CREATE POLICY "tmsg_insert" ON public.community_thread_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.community_can_view_thread(thread_id));

-- ============ COUNTERS / TRIGGERS ============
CREATE OR REPLACE FUNCTION public.community_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER community_profiles_touch BEFORE UPDATE ON public.community_profiles
FOR EACH ROW EXECUTE FUNCTION public.community_touch_updated_at();
CREATE TRIGGER community_posts_touch BEFORE UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.community_touch_updated_at();
CREATE TRIGGER community_threads_touch BEFORE UPDATE ON public.community_threads
FOR EACH ROW EXECUTE FUNCTION public.community_touch_updated_at();

CREATE OR REPLACE FUNCTION public.community_sync_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER community_comment_count AFTER INSERT OR DELETE ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION public.community_sync_comment_count();

CREATE OR REPLACE FUNCTION public.community_sync_reaction_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.post_id IS NOT NULL THEN
    UPDATE public.community_posts SET reaction_count = reaction_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.post_id IS NOT NULL THEN
    UPDATE public.community_posts SET reaction_count = GREATEST(reaction_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER community_reaction_count AFTER INSERT OR DELETE ON public.community_reactions
FOR EACH ROW EXECUTE FUNCTION public.community_sync_reaction_count();

CREATE OR REPLACE FUNCTION public.community_sync_post_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_profiles SET post_count = post_count + 1 WHERE id = NEW.author_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_profiles SET post_count = GREATEST(post_count - 1, 0) WHERE id = OLD.author_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER community_post_count AFTER INSERT OR DELETE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.community_sync_post_count();

-- ============ PROFILE BOOTSTRAP ============
-- Creates/refreshes the caller's community profile, deriving tier from their SaaSSuite plan.
CREATE OR REPLACE FUNCTION public.community_ensure_profile(_display_name text DEFAULT NULL, _avatar_url text DEFAULT NULL)
RETURNS public.community_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _plan text;
  _tier public.community_tier;
  _row public.community_profiles;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT lower(u.email) INTO _email FROM auth.users u WHERE u.id = _uid;
  SELECT s.plan::text INTO _plan FROM public.saas_suite_users s WHERE lower(s.email) = _email LIMIT 1;
  _tier := CASE WHEN _plan IN ('BASIC','ADVANCED') THEN 'paid'::public.community_tier ELSE 'free'::public.community_tier END;

  INSERT INTO public.community_profiles (id, email, display_name, avatar_url, tier)
  VALUES (_uid, _email, COALESCE(NULLIF(_display_name, ''), split_part(COALESCE(_email,'member'), '@', 1)), _avatar_url, _tier)
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.community_profiles.email),
    display_name = COALESCE(NULLIF(_display_name, ''), public.community_profiles.display_name),
    avatar_url = COALESCE(_avatar_url, public.community_profiles.avatar_url),
    tier = _tier,
    updated_at = now()
  RETURNING * INTO _row;
  RETURN _row;
END $$;
GRANT EXECUTE ON FUNCTION public.community_ensure_profile(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_increment_install(uuid) TO authenticated;

-- ============ SEED ============
INSERT INTO public.community_spaces (slug, name, description, icon, min_tier, sort_order) VALUES
  ('general', 'General', 'Talk shop with other SaaSSuite agencies.', 'MessageSquare', 'free', 1),
  ('snapshot-vault', 'Snapshot Vault', 'Done-for-you HighLevel snapshots you can load in one click.', 'LayoutGrid', 'free', 2),
  ('academy', 'Academy', 'Courses and trainings to grow your SaaS.', 'GraduationCap', 'free', 3),
  ('ask-the-team', 'Ask the Team', 'Get answers straight from the SaaSSuite team.', 'LifeBuoy', 'free', 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.community_snapshots (title, description, category, share_link, min_tier) VALUES
  ('Email Marketing Snapshot', 'Pre-built email marketing workflows, templates, and campaigns ready to load into your sub-account.', 'Marketing', 'https://affiliates.gohighlevel.com/?fp_ref=howtousehighlevel&share=juJUavNjhX6gE38EfYYp', 'free'),
  ('SaaS Mode Webinar API Snapshot', 'API-driven webinar registration and follow-up automations configured for SaaS Mode.', 'Automation', 'https://affiliates.gohighlevel.com/?fp_ref=howtousehighlevel&share=yCGTHNFjc6DWxcAvjw4T', 'free'),
  ('Voice AI Onboarding Snapshot', 'Voice AI agent onboarding flows wired up and ready to deploy.', 'Voice AI', 'https://affiliates.gohighlevel.com/?fp_ref=howtousehighlevel&share=MgoLjgaUntXFNYQJxJPR', 'free');