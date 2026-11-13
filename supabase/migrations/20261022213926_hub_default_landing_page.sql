-- Per-agency Client Hub landing page.
-- NULL keeps today's behavior: a bare hub URL opens Home.
-- education | home | support are the main hub tabs. A hidden, disabled, or
-- unknown value is ignored by the client and falls back to Home.
-- Deep links (/:section, ?tab=, popup messages, editor ?hubTab=) still win.
-- get_v2_home_settings is the public read both SaaS Suite and YSO already use.
-- This replaces that function with the live return shape plus this column.
-- Not applied by the agent that added it.

ALTER TABLE public.v2_home_settings
  ADD COLUMN IF NOT EXISTS default_landing_page text;

ALTER TABLE public.v2_home_settings
  DROP CONSTRAINT IF EXISTS v2_home_settings_default_landing_page_check;

ALTER TABLE public.v2_home_settings
  ADD CONSTRAINT v2_home_settings_default_landing_page_check
  CHECK (
    default_landing_page IS NULL
    OR default_landing_page IN ('home', 'education', 'support')
  );

COMMENT ON COLUMN public.v2_home_settings.default_landing_page IS
  'Tab opened for a bare Client Hub URL. NULL means Home. Deep links still win. Hidden or unknown values fall back to Home.';

DROP FUNCTION IF EXISTS public.get_v2_home_settings(text);

CREATE FUNCTION public.get_v2_home_settings(p_agency_id text)
RETURNS TABLE (
  welcome_enabled boolean,
  welcome_headline text,
  welcome_subheadline text,
  welcome_video_enabled boolean,
  welcome_video_url text,
  welcome_video_is_embed boolean,
  welcome_video_thumbnail_url text,
  announcements_enabled boolean,
  announcements_headline text,
  announcements_paragraph text,
  announcements_image_url text,
  custom_links_enabled boolean,
  custom_link_1_text text,
  custom_link_1_url text,
  custom_link_1_color text,
  custom_link_1_open_as_popup boolean,
  custom_link_2_text text,
  custom_link_2_url text,
  custom_link_2_color text,
  custom_link_2_open_as_popup boolean,
  custom_link_3_text text,
  custom_link_3_url text,
  custom_link_3_color text,
  custom_link_3_open_as_popup boolean,
  daily_checklist_enabled boolean,
  checklist_title text,
  ai_chat_enabled boolean,
  ai_chat_type text,
  prompt_personality text,
  prompt_goals text,
  prompt_additional_instructions text,
  prompt_training_doc text,
  tab_name_home text,
  tab_name_education text,
  tab_name_support text,
  support_headline text,
  support_subheadline text,
  support_button_1_text text,
  support_button_1_url text,
  support_button_1_color text,
  support_button_1_open_as_popup boolean,
  support_button_2_text text,
  support_button_2_url text,
  support_button_2_color text,
  support_button_2_open_as_popup boolean,
  support_button_3_text text,
  support_button_3_url text,
  support_button_3_color text,
  support_button_3_open_as_popup boolean,
  ai_chat_name text,
  ai_chat_icon_url text,
  next_steps_enabled boolean,
  next_steps_priority text,
  next_steps_custom_text text,
  next_steps_custom_url text,
  next_steps_custom_url_label text,
  default_landing_page text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    hs.welcome_enabled, hs.welcome_headline, hs.welcome_subheadline,
    hs.welcome_video_enabled, hs.welcome_video_url, hs.welcome_video_is_embed, hs.welcome_video_thumbnail_url,
    hs.announcements_enabled, hs.announcements_headline, hs.announcements_paragraph, hs.announcements_image_url,
    hs.custom_links_enabled,
    hs.custom_link_1_text, hs.custom_link_1_url, hs.custom_link_1_color, COALESCE(hs.custom_link_1_open_as_popup, false),
    hs.custom_link_2_text, hs.custom_link_2_url, hs.custom_link_2_color, COALESCE(hs.custom_link_2_open_as_popup, false),
    hs.custom_link_3_text, hs.custom_link_3_url, hs.custom_link_3_color, COALESCE(hs.custom_link_3_open_as_popup, false),
    hs.daily_checklist_enabled, hs.checklist_title,
    hs.ai_chat_enabled, hs.ai_chat_type,
    hs.prompt_personality, hs.prompt_goals, hs.prompt_additional_instructions, hs.prompt_training_doc,
    hs.tab_name_home, hs.tab_name_education, hs.tab_name_support,
    hs.support_headline, hs.support_subheadline,
    hs.support_button_1_text, hs.support_button_1_url, hs.support_button_1_color, COALESCE(hs.support_button_1_open_as_popup, false),
    hs.support_button_2_text, hs.support_button_2_url, hs.support_button_2_color, COALESCE(hs.support_button_2_open_as_popup, false),
    hs.support_button_3_text, hs.support_button_3_url, hs.support_button_3_color, COALESCE(hs.support_button_3_open_as_popup, false),
    hs.ai_chat_name, hs.ai_chat_icon_url,
    hs.next_steps_enabled, hs.next_steps_priority,
    hs.next_steps_custom_text, hs.next_steps_custom_url, hs.next_steps_custom_url_label,
    hs.default_landing_page
  FROM v2_home_settings hs
  WHERE hs.agency_id = p_agency_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_v2_home_settings(text) TO PUBLIC, anon, authenticated, service_role;
