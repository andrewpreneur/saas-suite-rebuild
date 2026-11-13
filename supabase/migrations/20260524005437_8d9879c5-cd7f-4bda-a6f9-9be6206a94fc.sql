CREATE POLICY "Anyone can view custom videos"
ON public.custom_onboarding_videos
FOR SELECT
TO public
USING (true);