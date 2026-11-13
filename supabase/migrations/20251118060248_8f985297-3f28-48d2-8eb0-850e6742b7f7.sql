-- Add tiers column to custom_onboarding_videos to track which versions (basic, advanced, elite) each video appears in
ALTER TABLE custom_onboarding_videos 
ADD COLUMN tiers text[] DEFAULT ARRAY['basic', 'advanced', 'elite']::text[];

-- Add index for better query performance
CREATE INDEX idx_custom_onboarding_videos_agency_tiers ON custom_onboarding_videos(agency_id, tiers);