CREATE POLICY "Admin can view all account_admins"
ON public.account_admins
FOR SELECT
TO public
USING (lower((auth.jwt() ->> 'email'::text)) = 'andrew@dna-media.net'::text);