ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS top_nav_widget_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS top_nav_widget_label text NOT NULL DEFAULT 'Help & Support',
  ADD COLUMN IF NOT EXISTS top_nav_widget_color_mode text NOT NULL DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS top_nav_widget_custom_color text;