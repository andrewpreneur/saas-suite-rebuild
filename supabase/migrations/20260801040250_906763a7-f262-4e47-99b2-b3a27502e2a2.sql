ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_author_id_fkey;
ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.community_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.community_comments DROP CONSTRAINT IF EXISTS community_comments_author_id_fkey;
ALTER TABLE public.community_comments
  ADD CONSTRAINT community_comments_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.community_profiles(id) ON DELETE CASCADE;