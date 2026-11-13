UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE id = '630ac745-122f-49a9-a90a-e9d315f80676';
CREATE POLICY "Email admin can manage platform_emails" ON public.platform_emails FOR ALL TO authenticated
USING (lower(auth.jwt() ->> 'email') = 'rendersgallery0@gmail.com')
WITH CHECK (lower(auth.jwt() ->> 'email') = 'rendersgallery0@gmail.com');