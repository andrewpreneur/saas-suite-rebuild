-- Create account_admins table to track admin users for each account
CREATE TABLE public.account_admins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_email text NOT NULL,
  admin_email text NOT NULL,
  admin_name text,
  status text NOT NULL DEFAULT 'pending',
  invited_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(owner_email, admin_email)
);

-- Enable RLS
ALTER TABLE public.account_admins ENABLE ROW LEVEL SECURITY;

-- Account owners can view and manage their admins
CREATE POLICY "Owners can view their admins"
ON public.account_admins
FOR SELECT
USING (owner_email = (auth.jwt() ->> 'email'::text));

CREATE POLICY "Owners can insert admins"
ON public.account_admins
FOR INSERT
WITH CHECK (owner_email = (auth.jwt() ->> 'email'::text));

CREATE POLICY "Owners can update their admins"
ON public.account_admins
FOR UPDATE
USING (owner_email = (auth.jwt() ->> 'email'::text));

CREATE POLICY "Owners can delete their admins"
ON public.account_admins
FOR DELETE
USING (owner_email = (auth.jwt() ->> 'email'::text));

-- Admins can view invitations sent to them
CREATE POLICY "Admins can view their invitations"
ON public.account_admins
FOR SELECT
USING (admin_email = (auth.jwt() ->> 'email'::text));

-- Admins can update their own invitations (to accept)
CREATE POLICY "Admins can accept their invitations"
ON public.account_admins
FOR UPDATE
USING (admin_email = (auth.jwt() ->> 'email'::text));