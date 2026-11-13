-- Add tips_bot_enabled column to saas_suite_users (default false for gradual rollout)
ALTER TABLE public.saas_suite_users 
ADD COLUMN tips_bot_enabled boolean NOT NULL DEFAULT false;

-- Create table to track dismissed tips per user
CREATE TABLE public.user_dismissed_tips (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email text NOT NULL,
  tip_id text NOT NULL,
  dismissed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_email, tip_id)
);

-- Enable RLS
ALTER TABLE public.user_dismissed_tips ENABLE ROW LEVEL SECURITY;

-- Users can view their own dismissed tips
CREATE POLICY "Users can view their own dismissed tips"
ON public.user_dismissed_tips
FOR SELECT
USING (lower(user_email) = lower((auth.jwt() ->> 'email'::text)));

-- Users can insert their own dismissed tips
CREATE POLICY "Users can insert their own dismissed tips"
ON public.user_dismissed_tips
FOR INSERT
WITH CHECK (lower(user_email) = lower((auth.jwt() ->> 'email'::text)));

-- Users can delete their own dismissed tips
CREATE POLICY "Users can delete their own dismissed tips"
ON public.user_dismissed_tips
FOR DELETE
USING (lower(user_email) = lower((auth.jwt() ->> 'email'::text)));

-- Admin can view all dismissed tips
CREATE POLICY "Admin can view all dismissed tips"
ON public.user_dismissed_tips
FOR SELECT
USING (lower((auth.jwt() ->> 'email'::text)) = 'andrew@dna-media.net');

-- Enable the bot for andrew@dna-media.net for testing
UPDATE public.saas_suite_users 
SET tips_bot_enabled = true 
WHERE lower(email) = 'andrew@dna-media.net';