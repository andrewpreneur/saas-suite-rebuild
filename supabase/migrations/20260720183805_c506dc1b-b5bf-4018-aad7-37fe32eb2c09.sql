
ALTER TABLE public.v2_home_settings ADD COLUMN IF NOT EXISTS welcome_video_thumbnail_url text;

-- Storage policies for welcome-video-thumbnails bucket (bucket assumed to exist, private with public read)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='welcome_video_thumbnails_public_read') THEN
    CREATE POLICY "welcome_video_thumbnails_public_read" ON storage.objects
      FOR SELECT TO public
      USING (bucket_id = 'welcome-video-thumbnails');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='welcome_video_thumbnails_auth_insert') THEN
    CREATE POLICY "welcome_video_thumbnails_auth_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'welcome-video-thumbnails');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='welcome_video_thumbnails_auth_update') THEN
    CREATE POLICY "welcome_video_thumbnails_auth_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'welcome-video-thumbnails')
      WITH CHECK (bucket_id = 'welcome-video-thumbnails');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='welcome_video_thumbnails_auth_delete') THEN
    CREATE POLICY "welcome_video_thumbnails_auth_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'welcome-video-thumbnails');
  END IF;
END $$;
