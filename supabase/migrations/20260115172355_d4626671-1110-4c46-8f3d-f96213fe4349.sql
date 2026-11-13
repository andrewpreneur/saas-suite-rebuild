-- Add admin UPDATE policy for saas_suite_users to allow impersonation updates
CREATE POLICY "Admin can update all saas_suite_users"
ON public.saas_suite_users FOR UPDATE
USING (lower(auth.jwt() ->> 'email') = 'andrew@dna-media.net')
WITH CHECK (lower(auth.jwt() ->> 'email') = 'andrew@dna-media.net');

-- Check and add admin policies for related tables used in the app

-- v2_home_settings - admin read access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'v2_home_settings' 
    AND policyname = 'Admin can view all v2_home_settings'
  ) THEN
    CREATE POLICY "Admin can view all v2_home_settings"
    ON public.v2_home_settings FOR SELECT
    USING (lower(auth.jwt() ->> 'email') = 'andrew@dna-media.net');
  END IF;
END $$;

-- v2_home_settings - admin update access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'v2_home_settings' 
    AND policyname = 'Admin can update all v2_home_settings'
  ) THEN
    CREATE POLICY "Admin can update all v2_home_settings"
    ON public.v2_home_settings FOR UPDATE
    USING (lower(auth.jwt() ->> 'email') = 'andrew@dna-media.net')
    WITH CHECK (lower(auth.jwt() ->> 'email') = 'andrew@dna-media.net');
  END IF;
END $$;

-- agency_daily_checklist - admin access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'agency_daily_checklist' 
    AND policyname = 'Admin can view all agency_daily_checklist'
  ) THEN
    CREATE POLICY "Admin can view all agency_daily_checklist"
    ON public.agency_daily_checklist FOR SELECT
    USING (lower(auth.jwt() ->> 'email') = 'andrew@dna-media.net');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'agency_daily_checklist' 
    AND policyname = 'Admin can update all agency_daily_checklist'
  ) THEN
    CREATE POLICY "Admin can update all agency_daily_checklist"
    ON public.agency_daily_checklist FOR UPDATE
    USING (lower(auth.jwt() ->> 'email') = 'andrew@dna-media.net')
    WITH CHECK (lower(auth.jwt() ->> 'email') = 'andrew@dna-media.net');
  END IF;
END $$;

-- agency_onboarding_checklist - admin access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'agency_onboarding_checklist' 
    AND policyname = 'Admin can view all agency_onboarding_checklist'
  ) THEN
    CREATE POLICY "Admin can view all agency_onboarding_checklist"
    ON public.agency_onboarding_checklist FOR SELECT
    USING (lower(auth.jwt() ->> 'email') = 'andrew@dna-media.net');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'agency_onboarding_checklist' 
    AND policyname = 'Admin can update all agency_onboarding_checklist'
  ) THEN
    CREATE POLICY "Admin can update all agency_onboarding_checklist"
    ON public.agency_onboarding_checklist FOR UPDATE
    USING (lower(auth.jwt() ->> 'email') = 'andrew@dna-media.net')
    WITH CHECK (lower(auth.jwt() ->> 'email') = 'andrew@dna-media.net');
  END IF;
END $$;

-- custom_onboarding_videos - admin access  
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'custom_onboarding_videos' 
    AND policyname = 'Admin can view all custom_onboarding_videos'
  ) THEN
    CREATE POLICY "Admin can view all custom_onboarding_videos"
    ON public.custom_onboarding_videos FOR SELECT
    USING (lower(auth.jwt() ->> 'email') = 'andrew@dna-media.net');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'custom_onboarding_videos' 
    AND policyname = 'Admin can manage all custom_onboarding_videos'
  ) THEN
    CREATE POLICY "Admin can manage all custom_onboarding_videos"
    ON public.custom_onboarding_videos FOR ALL
    USING (lower(auth.jwt() ->> 'email') = 'andrew@dna-media.net')
    WITH CHECK (lower(auth.jwt() ->> 'email') = 'andrew@dna-media.net');
  END IF;
END $$;

-- agency_video_settings - admin access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'agency_video_settings' 
    AND policyname = 'Admin can view all agency_video_settings'
  ) THEN
    CREATE POLICY "Admin can view all agency_video_settings"
    ON public.agency_video_settings FOR SELECT
    USING (lower(auth.jwt() ->> 'email') = 'andrew@dna-media.net');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'agency_video_settings' 
    AND policyname = 'Admin can manage all agency_video_settings'
  ) THEN
    CREATE POLICY "Admin can manage all agency_video_settings"
    ON public.agency_video_settings FOR ALL
    USING (lower(auth.jwt() ->> 'email') = 'andrew@dna-media.net')
    WITH CHECK (lower(auth.jwt() ->> 'email') = 'andrew@dna-media.net');
  END IF;
END $$;