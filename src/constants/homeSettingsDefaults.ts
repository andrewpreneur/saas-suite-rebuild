// Centralized default values for home settings
// Used across ClientHub.tsx and related components to ensure consistency

export interface HomeSettings {
  welcome_enabled: boolean;
  welcome_headline: string;
  welcome_subheadline: string;
  welcome_video_enabled: boolean;
  welcome_video_url: string | null;
  welcome_video_is_embed: boolean;
  welcome_video_thumbnail_url: string | null;
  welcome_video_source: 'url' | 'library' | 'custom';
  welcome_video_library_category_id: string | null;
  welcome_video_library_module_id: string | null;
  welcome_video_custom_video_id: string | null;
  announcements_enabled: boolean;
  announcements_headline: string | null;
  announcements_paragraph: string | null;
  announcements_image_url: string | null;
  custom_links_enabled: boolean;
  custom_link_1_text: string | null;
  custom_link_1_url: string | null;
  custom_link_1_color: string | null;
  custom_link_1_open_as_popup: boolean;
  custom_link_2_text: string | null;
  custom_link_2_url: string | null;
  custom_link_2_color: string | null;
  custom_link_2_open_as_popup: boolean;
  custom_link_3_text: string | null;
  custom_link_3_url: string | null;
  custom_link_3_color: string | null;
  custom_link_3_open_as_popup: boolean;
  next_steps_enabled: boolean;
  next_steps_priority: 'onboarding_videos' | 'checklist' | 'custom_text' | 'custom_url';
  next_steps_custom_text: string | null;
  next_steps_custom_url: string | null;
  next_steps_custom_url_label: string | null;
}

export const DEFAULT_HOME_SETTINGS: HomeSettings = {
  welcome_enabled: true,
  welcome_headline: "Welcome to your custom software solution",
  welcome_subheadline: "Get started with the tools and resources below.",
  welcome_video_enabled: false,
  welcome_video_url: null,
  welcome_video_is_embed: false,
  welcome_video_thumbnail_url: null,
  welcome_video_source: 'url',
  welcome_video_library_category_id: null,
  welcome_video_library_module_id: null,
  welcome_video_custom_video_id: null,
  announcements_enabled: false,
  announcements_headline: null,
  announcements_paragraph: null,
  announcements_image_url: null,
  custom_links_enabled: false,
  custom_link_1_text: null,
  custom_link_1_url: null,
  custom_link_1_color: "#3b82f6",
  custom_link_1_open_as_popup: false,
  custom_link_2_text: null,
  custom_link_2_url: null,
  custom_link_2_color: "#3b82f6",
  custom_link_2_open_as_popup: false,
  custom_link_3_text: null,
  custom_link_3_url: null,
  custom_link_3_color: "#3b82f6",
  custom_link_3_open_as_popup: false,
  next_steps_enabled: true,
  next_steps_priority: 'onboarding_videos',
  next_steps_custom_text: null,
  next_steps_custom_url: null,
  next_steps_custom_url_label: null,
};

export const DEFAULT_TAB_NAMES = {
  education: 'Education',
  home: 'Home',
  support: 'Support'
};

export const DEFAULT_CHECKLIST_TITLE = 'Daily Checklist';

export const DEFAULT_CHECKLIST_ITEMS = {
  item_1: "Complete your daily outreach",
  item_2: "Follow up with pending leads",
  item_3: "Review your pipeline progress"
};

export const DEFAULT_AI_SETTINGS = {
  ai_chat_type: 'NATIVE' as const,
  prompt_personality: '',
  prompt_goals: '',
  prompt_additional_instructions: '',
  prompt_training_doc: ''
};

// Full database row defaults for v2_home_settings table
// Used when creating new rows to ensure all columns have proper defaults
export const getV2HomeSettingsDefaults = (agencyId: string) => ({
  agency_id: agencyId,
  home_page_enabled: true,
  education_page_enabled: true,
  support_page_enabled: true,
  default_landing_page: 'home',
  welcome_enabled: DEFAULT_HOME_SETTINGS.welcome_enabled,
  welcome_headline: DEFAULT_HOME_SETTINGS.welcome_headline,
  welcome_subheadline: DEFAULT_HOME_SETTINGS.welcome_subheadline,
  welcome_video_enabled: DEFAULT_HOME_SETTINGS.welcome_video_enabled,
  welcome_video_url: DEFAULT_HOME_SETTINGS.welcome_video_url,
  welcome_video_is_embed: DEFAULT_HOME_SETTINGS.welcome_video_is_embed,
  welcome_video_thumbnail_url: DEFAULT_HOME_SETTINGS.welcome_video_thumbnail_url,
  announcements_enabled: DEFAULT_HOME_SETTINGS.announcements_enabled,
  announcements_headline: DEFAULT_HOME_SETTINGS.announcements_headline,
  announcements_paragraph: DEFAULT_HOME_SETTINGS.announcements_paragraph,
  announcements_image_url: DEFAULT_HOME_SETTINGS.announcements_image_url,
  custom_links_enabled: DEFAULT_HOME_SETTINGS.custom_links_enabled,
  custom_link_1_text: DEFAULT_HOME_SETTINGS.custom_link_1_text,
  custom_link_1_url: DEFAULT_HOME_SETTINGS.custom_link_1_url,
  custom_link_1_color: DEFAULT_HOME_SETTINGS.custom_link_1_color,
  custom_link_1_open_as_popup: DEFAULT_HOME_SETTINGS.custom_link_1_open_as_popup,
  custom_link_2_text: DEFAULT_HOME_SETTINGS.custom_link_2_text,
  custom_link_2_url: DEFAULT_HOME_SETTINGS.custom_link_2_url,
  custom_link_2_color: DEFAULT_HOME_SETTINGS.custom_link_2_color,
  custom_link_2_open_as_popup: DEFAULT_HOME_SETTINGS.custom_link_2_open_as_popup,
  custom_link_3_text: DEFAULT_HOME_SETTINGS.custom_link_3_text,
  custom_link_3_url: DEFAULT_HOME_SETTINGS.custom_link_3_url,
  custom_link_3_color: DEFAULT_HOME_SETTINGS.custom_link_3_color,
  custom_link_3_open_as_popup: DEFAULT_HOME_SETTINGS.custom_link_3_open_as_popup,
  next_steps_enabled: DEFAULT_HOME_SETTINGS.next_steps_enabled,
  next_steps_priority: DEFAULT_HOME_SETTINGS.next_steps_priority,
  next_steps_custom_text: DEFAULT_HOME_SETTINGS.next_steps_custom_text,
  next_steps_custom_url: DEFAULT_HOME_SETTINGS.next_steps_custom_url,
  next_steps_custom_url_label: DEFAULT_HOME_SETTINGS.next_steps_custom_url_label,
  ai_chat_enabled: false,
  ai_chat_type: DEFAULT_AI_SETTINGS.ai_chat_type,
  daily_checklist_enabled: false,
  checklist_title: DEFAULT_CHECKLIST_TITLE,
  tab_name_education: DEFAULT_TAB_NAMES.education,
  tab_name_home: DEFAULT_TAB_NAMES.home,
  tab_name_support: DEFAULT_TAB_NAMES.support,
  prompt_personality: DEFAULT_AI_SETTINGS.prompt_personality,
  prompt_goals: DEFAULT_AI_SETTINGS.prompt_goals,
  prompt_additional_instructions: DEFAULT_AI_SETTINGS.prompt_additional_instructions,
  prompt_training_doc: DEFAULT_AI_SETTINGS.prompt_training_doc
});
