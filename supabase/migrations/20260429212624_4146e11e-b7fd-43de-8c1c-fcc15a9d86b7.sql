
ALTER TABLE public.custom_onboarding_videos
  ADD COLUMN IF NOT EXISTS transcription text,
  ADD COLUMN IF NOT EXISTS transcription_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS transcription_language text,
  ADD COLUMN IF NOT EXISTS transcription_attempted_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_custom_videos_transcription_status
  ON public.custom_onboarding_videos(agency_id, transcription_status);
