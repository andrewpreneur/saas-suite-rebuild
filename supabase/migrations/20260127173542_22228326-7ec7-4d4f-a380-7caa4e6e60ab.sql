-- Add support tab customization columns to v2_home_settings
ALTER TABLE v2_home_settings
ADD COLUMN IF NOT EXISTS support_headline text DEFAULT 'How can we help?',
ADD COLUMN IF NOT EXISTS support_subheadline text DEFAULT 'Get instant answers or connect with our team',
ADD COLUMN IF NOT EXISTS support_button_1_text text,
ADD COLUMN IF NOT EXISTS support_button_1_url text,
ADD COLUMN IF NOT EXISTS support_button_1_color text DEFAULT '#3b82f6',
ADD COLUMN IF NOT EXISTS support_button_2_text text,
ADD COLUMN IF NOT EXISTS support_button_2_url text,
ADD COLUMN IF NOT EXISTS support_button_2_color text DEFAULT '#3b82f6',
ADD COLUMN IF NOT EXISTS support_button_3_text text,
ADD COLUMN IF NOT EXISTS support_button_3_url text,
ADD COLUMN IF NOT EXISTS support_button_3_color text DEFAULT '#3b82f6',
ADD COLUMN IF NOT EXISTS ai_chat_name text DEFAULT 'AI Support Assistant',
ADD COLUMN IF NOT EXISTS ai_chat_icon_url text;