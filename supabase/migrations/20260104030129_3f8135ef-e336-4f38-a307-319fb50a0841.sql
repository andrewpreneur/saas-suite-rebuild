-- Allow the admin user to view all SaaS Suite users (fixes admin dashboard only showing their own row)
-- RLS is enabled on public.saas_suite_users, and the existing SELECT policy limits users to their own email.
-- This policy grants read access to the specific admin email.

CREATE POLICY "Admin can view all saas_suite_users"
ON public.saas_suite_users
FOR SELECT
TO authenticated
USING ((auth.jwt() ->> 'email') = 'andrew@dna-media.net');