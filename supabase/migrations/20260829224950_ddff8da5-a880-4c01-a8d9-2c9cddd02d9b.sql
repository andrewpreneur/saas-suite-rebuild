CREATE POLICY "Users see notify requests by email"
ON public.academy_notify_requests FOR SELECT TO authenticated
USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));