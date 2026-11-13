-- Add is_embed column to custom_onboarding_videos table
ALTER TABLE public.custom_onboarding_videos 
ADD COLUMN IF NOT EXISTS is_embed boolean NOT NULL DEFAULT false;

-- Add is_embed column for welcome video in v2_home_settings table
ALTER TABLE public.v2_home_settings 
ADD COLUMN IF NOT EXISTS welcome_video_is_embed boolean NOT NULL DEFAULT false;

-- Add comment to clarify the columns
COMMENT ON COLUMN public.custom_onboarding_videos.is_embed IS 'When true, video_url contains embed code instead of a URL';
COMMENT ON COLUMN public.v2_home_settings.welcome_video_is_embed IS 'When true, welcome_video_url contains embed code instead of a URL';