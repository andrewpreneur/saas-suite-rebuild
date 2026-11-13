ALTER TABLE public.saas_suite_users 
ADD COLUMN branding_tool_access boolean NOT NULL DEFAULT false,
ADD COLUMN branding_tool_purchased_at timestamptz DEFAULT NULL;