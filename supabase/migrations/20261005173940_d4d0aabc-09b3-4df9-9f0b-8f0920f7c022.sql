CREATE POLICY "Service role manages public support submissions"
ON public.public_support_submissions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);