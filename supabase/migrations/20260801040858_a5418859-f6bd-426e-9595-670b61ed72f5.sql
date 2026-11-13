ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Other';
CREATE INDEX IF NOT EXISTS community_posts_category_idx ON public.community_posts (category);