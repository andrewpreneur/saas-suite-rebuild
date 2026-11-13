
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_blog_posts_scheduled ON public.blog_posts (scheduled_publish_at) WHERE published = false AND scheduled_publish_at IS NOT NULL;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function that publishes due scheduled drafts
CREATE OR REPLACE FUNCTION public.publish_scheduled_blog_posts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.blog_posts
       SET published = true,
           published_at = COALESCE(published_at, now()),
           scheduled_publish_at = NULL,
           updated_at = now()
     WHERE published = false
       AND scheduled_publish_at IS NOT NULL
       AND scheduled_publish_at <= now()
    RETURNING 1
  )
  SELECT count(*) INTO updated_count FROM upd;
  RETURN updated_count;
END;
$$;

-- Schedule hourly cron (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'publish-scheduled-blog-posts') THEN
    PERFORM cron.schedule(
      'publish-scheduled-blog-posts',
      '0 * * * *',
      $cron$ SELECT public.publish_scheduled_blog_posts(); $cron$
    );
  END IF;
END $$;
