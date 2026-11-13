CREATE POLICY "community_avatars_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'community-avatars');

CREATE POLICY "community_avatars_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "community_avatars_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'community-avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'community-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "community_avatars_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'community-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);