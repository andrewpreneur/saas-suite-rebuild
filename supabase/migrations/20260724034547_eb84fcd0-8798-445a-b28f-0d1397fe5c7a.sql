
-- blog-covers bucket policies
CREATE POLICY "Blog covers are readable by anyone"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'blog-covers');

CREATE POLICY "Admins can upload blog covers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'blog-covers' AND public.is_platform_admin());

CREATE POLICY "Admins can update blog covers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'blog-covers' AND public.is_platform_admin());

CREATE POLICY "Admins can delete blog covers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'blog-covers' AND public.is_platform_admin());
