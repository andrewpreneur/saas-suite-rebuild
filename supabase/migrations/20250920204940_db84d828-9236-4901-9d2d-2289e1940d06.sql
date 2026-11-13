-- Create table to store user onboarding responses
CREATE TABLE public.user_onboarding_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  highlevel_experience TEXT NOT NULL CHECK (highlevel_experience IN ('< 6 months', '< 12 months', '1-2 years', '2-5 years', '5 years+', 'I don''t use HighLevel')),
  active_subaccounts TEXT NOT NULL CHECK (active_subaccounts IN ('0', '1-10', '10-50', '50-100', '100-500', '500+')),
  most_used_feature TEXT NOT NULL CHECK (most_used_feature IN ('Sites & Funnels', 'Documents & Payments', 'Automations/Workflows', 'Forms, Surveys, & Quizzes', 'Memberships', 'Calendars', 'Opportunities & Pipelines', 'AI Agents')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_onboarding_responses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own onboarding responses"
ON public.user_onboarding_responses
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own onboarding responses"
ON public.user_onboarding_responses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding responses"
ON public.user_onboarding_responses
FOR UPDATE
USING (auth.uid() = user_id);

-- Add column to track if user has completed initial onboarding questions
ALTER TABLE public.saas_suite_users 
ADD COLUMN initial_questions_completed BOOLEAN DEFAULT FALSE;

-- Create function to check if user has completed initial questions
CREATE OR REPLACE FUNCTION public.get_user_initial_questions_status(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Validate email
  IF user_email IS NULL OR user_email = '' THEN
    RETURN false;
  END IF;
  
  -- Return whether user has completed initial questions
  RETURN COALESCE((
    SELECT initial_questions_completed 
    FROM saas_suite_users 
    WHERE email = user_email
  ), false);
END;
$$;

-- Create function to mark initial questions as completed
CREATE OR REPLACE FUNCTION public.mark_initial_questions_completed(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Validate email
  IF user_email IS NULL OR user_email = '' THEN
    RETURN false;
  END IF;
  
  -- Update the flag
  UPDATE saas_suite_users 
  SET initial_questions_completed = true
  WHERE email = user_email;
  
  RETURN FOUND;
END;
$$;