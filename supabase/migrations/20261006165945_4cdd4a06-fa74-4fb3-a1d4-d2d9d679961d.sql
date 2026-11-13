-- Item 7: ticket reply attachments limited to people who can see the ticket
DROP POLICY IF EXISTS "Authenticated can read ticket response attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload ticket response attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update ticket response attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete ticket response attachments" ON storage.objects;
CREATE POLICY "Ticket team or customer can read ticket attachments" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ticket-response-attachments' AND (public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM public.support_tickets t WHERE t.id::text = (storage.foldername(name))[1]
      AND (public.can_access_agency(t.agency_id) OR lower(coalesce(t.customer_email,'')) = public.current_auth_email()))));
CREATE POLICY "Ticket team or customer can upload ticket attachments" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ticket-response-attachments' AND (public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM public.support_tickets t WHERE t.id::text = (storage.foldername(name))[1]
      AND (public.can_access_agency(t.agency_id) OR lower(coalesce(t.customer_email,'')) = public.current_auth_email()))));
CREATE POLICY "Platform admin manages ticket attachments" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ticket-response-attachments' AND public.is_platform_admin());

-- Item 8: nobody can overwrite or delete another account's logo or thumbnail
DROP POLICY IF EXISTS "Authenticated users can update their logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their logos" ON storage.objects;
CREATE POLICY "Uploader or admin can replace logos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'logos' AND (owner = auth.uid() OR public.is_platform_admin()))
  WITH CHECK (bucket_id = 'logos');
CREATE POLICY "Uploader or admin can delete logos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'logos' AND (owner = auth.uid() OR public.is_platform_admin()));

DROP POLICY IF EXISTS "Authenticated delete welcome video thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update welcome video thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload welcome video thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "welcome_video_thumbnails_auth_delete" ON storage.objects;
DROP POLICY IF EXISTS "welcome_video_thumbnails_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "welcome_video_thumbnails_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "Public read welcome video thumbnails" ON storage.objects;
CREATE POLICY "Agency can upload its welcome thumbnails" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'welcome-video-thumbnails' AND public.can_access_agency((storage.foldername(name))[1]));
CREATE POLICY "Agency can replace its welcome thumbnails" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'welcome-video-thumbnails' AND public.can_access_agency((storage.foldername(name))[1]))
  WITH CHECK (bucket_id = 'welcome-video-thumbnails' AND public.can_access_agency((storage.foldername(name))[1]));
CREATE POLICY "Agency can delete its welcome thumbnails" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'welcome-video-thumbnails' AND public.can_access_agency((storage.foldername(name))[1]));