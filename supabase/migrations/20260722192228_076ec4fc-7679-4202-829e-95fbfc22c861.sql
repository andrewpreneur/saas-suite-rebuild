
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS admin_response_attachment_url TEXT;

CREATE POLICY "Authenticated can upload ticket response attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ticket-response-attachments');

CREATE POLICY "Authenticated can read ticket response attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ticket-response-attachments');

CREATE POLICY "Authenticated can update ticket response attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'ticket-response-attachments');

CREATE POLICY "Authenticated can delete ticket response attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ticket-response-attachments');
