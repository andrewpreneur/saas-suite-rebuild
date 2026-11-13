-- =============================================
-- USER BEHAVIOR TRACKING EXTENSION
-- Extends saas_suite_users with behavioral metrics
-- =============================================

-- 1️⃣ LOGIN FREQUENCY TRACKING
-- Add columns to track login behavior
ALTER TABLE public.saas_suite_users 
ADD COLUMN IF NOT EXISTS last_login_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS login_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_login_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_login_reset_at timestamp with time zone DEFAULT now();

-- 2️⃣ CHECKLIST/ONBOARDING COMPLETION TRACKING
-- Extend existing onboarding columns with time tracking
ALTER TABLE public.saas_suite_users 
ADD COLUMN IF NOT EXISTS onboarding_started_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_incomplete_step_id text;

-- 3️⃣ EDUCATION ENGAGEMENT TRACKING
ALTER TABLE public.saas_suite_users 
ADD COLUMN IF NOT EXISTS videos_watched_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS videos_skipped_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_watch_time_seconds integer DEFAULT 0;

-- 4️⃣ SUPPORT USAGE TRACKING
ALTER TABLE public.saas_suite_users 
ADD COLUMN IF NOT EXISTS ai_questions_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS tickets_opened_count integer DEFAULT 0;

-- =============================================
-- TRACKING FUNCTIONS
-- =============================================

-- Function to record user login and update frequency metrics
CREATE OR REPLACE FUNCTION public.record_user_login(user_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  user_record record;
  days_since_last_login integer;
  is_weekly_active boolean;
BEGIN
  -- Validate email
  IF user_email IS NULL OR user_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email cannot be empty');
  END IF;
  
  -- Get current user data
  SELECT last_login_at, login_count, weekly_login_count, weekly_login_reset_at
  INTO user_record
  FROM saas_suite_users
  WHERE email = user_email;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Calculate days since last login
  days_since_last_login := COALESCE(
    EXTRACT(DAY FROM (now() - user_record.last_login_at))::integer,
    0
  );
  
  -- Check if we need to reset weekly counter (every 7 days)
  IF user_record.weekly_login_reset_at IS NULL OR 
     (now() - user_record.weekly_login_reset_at) > interval '7 days' THEN
    -- Reset weekly counter
    UPDATE saas_suite_users
    SET 
      last_login_at = now(),
      last_accessed = now(),
      login_count = COALESCE(login_count, 0) + 1,
      weekly_login_count = 1,
      weekly_login_reset_at = now()
    WHERE email = user_email;
  ELSE
    -- Increment weekly counter
    UPDATE saas_suite_users
    SET 
      last_login_at = now(),
      last_accessed = now(),
      login_count = COALESCE(login_count, 0) + 1,
      weekly_login_count = COALESCE(weekly_login_count, 0) + 1
    WHERE email = user_email;
  END IF;
  
  -- Determine if weekly active (3+ logins in past 7 days)
  SELECT weekly_login_count >= 3 INTO is_weekly_active
  FROM saas_suite_users
  WHERE email = user_email;
  
  RETURN jsonb_build_object(
    'success', true,
    'days_inactive', days_since_last_login,
    'weekly_active', COALESCE(is_weekly_active, false)
  );
END;
$$;

-- Function to update onboarding step progress with timing
CREATE OR REPLACE FUNCTION public.update_onboarding_progress(
  user_email text,
  step_id text,
  is_completed boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate email
  IF user_email IS NULL OR user_email = '' THEN
    RETURN false;
  END IF;
  
  -- Set onboarding_started_at if not already set
  UPDATE saas_suite_users
  SET 
    onboarding_started_at = COALESCE(onboarding_started_at, now()),
    last_incomplete_step_id = CASE WHEN is_completed THEN NULL ELSE step_id END,
    onboarding_completed_at = CASE WHEN is_completed THEN now() ELSE onboarding_completed_at END
  WHERE email = user_email;
  
  RETURN FOUND;
END;
$$;

-- Function to track video engagement
CREATE OR REPLACE FUNCTION public.track_video_engagement(
  user_email text,
  action_type text, -- 'watched', 'skipped'
  watch_time_seconds integer DEFAULT 0
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate email
  IF user_email IS NULL OR user_email = '' THEN
    RETURN false;
  END IF;
  
  IF action_type = 'watched' THEN
    UPDATE saas_suite_users
    SET 
      videos_watched_count = COALESCE(videos_watched_count, 0) + 1,
      total_watch_time_seconds = COALESCE(total_watch_time_seconds, 0) + COALESCE(watch_time_seconds, 0)
    WHERE email = user_email;
  ELSIF action_type = 'skipped' THEN
    UPDATE saas_suite_users
    SET videos_skipped_count = COALESCE(videos_skipped_count, 0) + 1
    WHERE email = user_email;
  END IF;
  
  RETURN FOUND;
END;
$$;

-- Function to increment AI question count
CREATE OR REPLACE FUNCTION public.increment_ai_question_count(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF user_email IS NULL OR user_email = '' THEN
    RETURN false;
  END IF;
  
  UPDATE saas_suite_users
  SET ai_questions_count = COALESCE(ai_questions_count, 0) + 1
  WHERE email = user_email;
  
  RETURN FOUND;
END;
$$;

-- Function to increment tickets opened count
CREATE OR REPLACE FUNCTION public.increment_tickets_opened(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF user_email IS NULL OR user_email = '' THEN
    RETURN false;
  END IF;
  
  UPDATE saas_suite_users
  SET tickets_opened_count = COALESCE(tickets_opened_count, 0) + 1
  WHERE email = user_email;
  
  RETURN FOUND;
END;
$$;

-- Function to get all user metrics for frontend/rule-based triggers
CREATE OR REPLACE FUNCTION public.get_user_behavior_metrics(user_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  user_record record;
  days_inactive integer;
  completion_pct numeric;
  total_videos integer := 23; -- Updated total including voice-ai-agent
BEGIN
  IF user_email IS NULL OR user_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email cannot be empty');
  END IF;
  
  SELECT 
    last_login_at,
    login_count,
    weekly_login_count,
    weekly_login_reset_at,
    onboarding_step,
    onboarding_completed,
    onboarding_started_at,
    onboarding_completed_at,
    last_incomplete_step_id,
    videos_watched_count,
    videos_skipped_count,
    total_watch_time_seconds,
    ai_questions_count,
    tickets_opened_count
  INTO user_record
  FROM saas_suite_users
  WHERE email = user_email;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Calculate days inactive
  days_inactive := COALESCE(
    EXTRACT(DAY FROM (now() - user_record.last_login_at))::integer,
    0
  );
  
  -- Calculate completion percentage
  completion_pct := CASE 
    WHEN user_record.onboarding_completed THEN 100
    ELSE ROUND((COALESCE(user_record.onboarding_step, 0)::numeric / 7) * 100, 1)
  END;
  
  RETURN jsonb_build_object(
    'success', true,
    'login_frequency', jsonb_build_object(
      'last_login_at', user_record.last_login_at,
      'days_inactive', days_inactive,
      'weekly_active', COALESCE(user_record.weekly_login_count, 0) >= 3,
      'login_count', COALESCE(user_record.login_count, 0),
      'weekly_login_count', COALESCE(user_record.weekly_login_count, 0)
    ),
    'checklist_completion', jsonb_build_object(
      'completion_percentage', completion_pct,
      'last_incomplete_step_id', user_record.last_incomplete_step_id,
      'started_at', user_record.onboarding_started_at,
      'completed_at', user_record.onboarding_completed_at,
      'time_to_complete_seconds', CASE 
        WHEN user_record.onboarding_completed_at IS NOT NULL AND user_record.onboarding_started_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (user_record.onboarding_completed_at - user_record.onboarding_started_at))::integer
        ELSE NULL
      END
    ),
    'education_engagement', jsonb_build_object(
      'videos_watched', COALESCE(user_record.videos_watched_count, 0),
      'videos_skipped', COALESCE(user_record.videos_skipped_count, 0),
      'total_watch_time_seconds', COALESCE(user_record.total_watch_time_seconds, 0),
      'watch_ratio', CASE 
        WHEN COALESCE(user_record.videos_watched_count, 0) + COALESCE(user_record.videos_skipped_count, 0) > 0
        THEN ROUND(
          COALESCE(user_record.videos_watched_count, 0)::numeric / 
          (COALESCE(user_record.videos_watched_count, 0) + COALESCE(user_record.videos_skipped_count, 0)),
          2
        )
        ELSE 1
      END
    ),
    'support_usage', jsonb_build_object(
      'ai_questions_count', COALESCE(user_record.ai_questions_count, 0),
      'tickets_opened', COALESCE(user_record.tickets_opened_count, 0)
    )
  );
END;
$$;