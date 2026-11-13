
-- Allow invited admins to read the owner's saas_suite_users row
CREATE POLICY "Invited admins can view owner account"
ON public.saas_suite_users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.account_admins
    WHERE lower(account_admins.admin_email) = lower((auth.jwt() ->> 'email'::text))
      AND lower(account_admins.owner_email) = lower(saas_suite_users.email)
      AND account_admins.status = 'accepted'
  )
);
