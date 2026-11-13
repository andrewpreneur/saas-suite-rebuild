ALTER TABLE public.v2_home_settings
  ADD COLUMN IF NOT EXISTS next_steps_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS next_steps_priority text NOT NULL DEFAULT 'onboarding_videos',
  ADD COLUMN IF NOT EXISTS next_steps_custom_text text,
  ADD COLUMN IF NOT EXISTS next_steps_custom_url text,
  ADD COLUMN IF NOT EXISTS next_steps_custom_url_label text;