-- Update account_admins policies to be case-insensitive
DROP POLICY IF EXISTS "Admins can accept their invitations" ON public.account_admins;
DROP POLICY IF EXISTS "Admins can view their invitations" ON public.account_admins;
DROP POLICY IF EXISTS "Owners can delete their admins" ON public.account_admins;
DROP POLICY IF EXISTS "Owners can insert admins" ON public.account_admins;
DROP POLICY IF EXISTS "Owners can update their admins" ON public.account_admins;
DROP POLICY IF EXISTS "Owners can view their admins" ON public.account_admins;

CREATE POLICY "Admins can accept their invitations"
ON public.account_admins FOR UPDATE
USING (lower(admin_email) = lower(auth.jwt() ->> 'email'));

CREATE POLICY "Admins can view their invitations"
ON public.account_admins FOR SELECT
USING (lower(admin_email) = lower(auth.jwt() ->> 'email'));

CREATE POLICY "Owners can delete their admins"
ON public.account_admins FOR DELETE
USING (lower(owner_email) = lower(auth.jwt() ->> 'email'));

CREATE POLICY "Owners can insert admins"
ON public.account_admins FOR INSERT
WITH CHECK (lower(owner_email) = lower(auth.jwt() ->> 'email'));

CREATE POLICY "Owners can update their admins"
ON public.account_admins FOR UPDATE
USING (lower(owner_email) = lower(auth.jwt() ->> 'email'));

CREATE POLICY "Owners can view their admins"
ON public.account_admins FOR SELECT
USING (lower(owner_email) = lower(auth.jwt() ->> 'email'));

-- Update email_warmup_requests policies to be case-insensitive
DROP POLICY IF EXISTS "Users can insert their own warmup requests" ON public.email_warmup_requests;
DROP POLICY IF EXISTS "Users can view their own warmup requests" ON public.email_warmup_requests;

CREATE POLICY "Users can insert their own warmup requests"
ON public.email_warmup_requests FOR INSERT
WITH CHECK (lower(user_email) = lower(auth.jwt() ->> 'email'));

CREATE POLICY "Users can view their own warmup requests"
ON public.email_warmup_requests FOR SELECT
USING (lower(user_email) = lower(auth.jwt() ->> 'email'));

-- Update free_leads policies to be case-insensitive
DROP POLICY IF EXISTS "Users can insert their own free leads request" ON public.free_leads;
DROP POLICY IF EXISTS "Users can view their own free leads request" ON public.free_leads;

CREATE POLICY "Users can insert their own free leads request"
ON public.free_leads FOR INSERT
WITH CHECK (lower(user_email) = lower(auth.jwt() ->> 'email'));

CREATE POLICY "Users can view their own free leads request"
ON public.free_leads FOR SELECT
USING (lower(user_email) = lower(auth.jwt() ->> 'email'));

-- Update marketing_tool_data policies to be case-insensitive
DROP POLICY IF EXISTS "Users can delete their own marketing data" ON public.marketing_tool_data;
DROP POLICY IF EXISTS "Users can insert their own marketing data" ON public.marketing_tool_data;
DROP POLICY IF EXISTS "Users can update their own marketing data" ON public.marketing_tool_data;
DROP POLICY IF EXISTS "Users can view their own marketing data" ON public.marketing_tool_data;

CREATE POLICY "Users can delete their own marketing data"
ON public.marketing_tool_data FOR DELETE
USING (lower(user_email) = lower(auth.jwt() ->> 'email'));

CREATE POLICY "Users can insert their own marketing data"
ON public.marketing_tool_data FOR INSERT
WITH CHECK (lower(user_email) = lower(auth.jwt() ->> 'email'));

CREATE POLICY "Users can update their own marketing data"
ON public.marketing_tool_data FOR UPDATE
USING (lower(user_email) = lower(auth.jwt() ->> 'email'));

CREATE POLICY "Users can view their own marketing data"
ON public.marketing_tool_data FOR SELECT
USING (lower(user_email) = lower(auth.jwt() ->> 'email'));

-- Update saas_suite_users policies to be case-insensitive
DROP POLICY IF EXISTS "Users can insert their own saas_suite_users record" ON public.saas_suite_users;
DROP POLICY IF EXISTS "Users can update their own saas_suite_users record" ON public.saas_suite_users;
DROP POLICY IF EXISTS "Users can view their own saas_suite_users record" ON public.saas_suite_users;

CREATE POLICY "Users can insert their own saas_suite_users record"
ON public.saas_suite_users FOR INSERT
WITH CHECK (lower(email) = lower(auth.jwt() ->> 'email'));

CREATE POLICY "Users can update their own saas_suite_users record"
ON public.saas_suite_users FOR UPDATE
USING (lower(email) = lower(auth.jwt() ->> 'email'));

CREATE POLICY "Users can view their own saas_suite_users record"
ON public.saas_suite_users FOR SELECT
USING (lower(email) = lower(auth.jwt() ->> 'email'));

-- Update admin policy for saas_suite_users (case-insensitive)
DROP POLICY IF EXISTS "Admin can view all saas_suite_users" ON public.saas_suite_users;

CREATE POLICY "Admin can view all saas_suite_users"
ON public.saas_suite_users FOR SELECT
USING (lower(auth.jwt() ->> 'email') = 'andrew@dna-media.net');