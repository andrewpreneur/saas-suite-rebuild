ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS top_nav_widget_icon_color_mode text DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS top_nav_widget_icon_custom_color text,
  ADD COLUMN IF NOT EXISTS top_nav_widget_tile_color_mode text DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS top_nav_widget_tile_custom_color text;