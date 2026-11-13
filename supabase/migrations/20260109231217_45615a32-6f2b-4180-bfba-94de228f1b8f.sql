-- Add custom tab names to v2_home_settings table
ALTER TABLE public.v2_home_settings 
ADD COLUMN IF NOT EXISTS tab_name_education TEXT DEFAULT 'Education',
ADD COLUMN IF NOT EXISTS tab_name_home TEXT DEFAULT 'Home',
ADD COLUMN IF NOT EXISTS tab_name_support TEXT DEFAULT 'Support';

-- Drop existing function first
DROP FUNCTION IF EXISTS public.get_v2_home_settings(TEXT);

-- Recreate the function with new columns
CREATE FUNCTION public.get_v2_home_settings(lookup_agency_id TEXT)
RETURNS TABLE (
  welcome_enabled BOOLEAN,
  welcome_headline TEXT,
  welcome_subheadline TEXT,
  welcome_video_enabled BOOLEAN,
  welcome_video_url TEXT,
  welcome_video_is_embed BOOLEAN,
  announcements_enabled BOOLEAN,
  announcements_headline TEXT,
  announcements_paragraph TEXT,
  announcements_image_url TEXT,
  custom_links_enabled BOOLEAN,
  custom_link_1_text TEXT,
  custom_link_1_url TEXT,
  custom_link_1_color TEXT,
  custom_link_2_text TEXT,
  custom_link_2_url TEXT,
  custom_link_2_color TEXT,
  custom_link_3_text TEXT,
  custom_link_3_url TEXT,
  custom_link_3_color TEXT,
  tab_name_education TEXT,
  tab_name_home TEXT,
  tab_name_support TEXT
) SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.welcome_enabled,
    v.welcome_headline,
    v.welcome_subheadline,
    v.welcome_video_enabled,
    v.welcome_video_url,
    v.welcome_video_is_embed,
    v.announcements_enabled,
    v.announcements_headline,
    v.announcements_paragraph,
    v.announcements_image_url,
    v.custom_links_enabled,
    v.custom_link_1_text,
    v.custom_link_1_url,
    v.custom_link_1_color,
    v.custom_link_2_text,
    v.custom_link_2_url,
    v.custom_link_2_color,
    v.custom_link_3_text,
    v.custom_link_3_url,
    v.custom_link_3_color,
    COALESCE(v.tab_name_education, 'Education'),
    COALESCE(v.tab_name_home, 'Home'),
    COALESCE(v.tab_name_support, 'Support')
  FROM v2_home_settings v
  WHERE v.agency_id = lookup_agency_id;
END;
$$ LANGUAGE plpgsql;