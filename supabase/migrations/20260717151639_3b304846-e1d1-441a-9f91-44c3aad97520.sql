
ALTER TABLE public.v2_home_settings
  ADD COLUMN IF NOT EXISTS custom_link_1_open_as_popup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_link_2_open_as_popup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_link_3_open_as_popup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS support_button_1_open_as_popup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS support_button_2_open_as_popup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS support_button_3_open_as_popup boolean NOT NULL DEFAULT false;
