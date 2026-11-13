-- Per-agency Help & Support menu.
-- Null keeps Help Library, Live Support, and Open a Ticket, card title
-- "How can we help?", and subtitle "We're here to help", shown on both views.
-- An object may also store title, subtitle, and showOn (both | sub-accounts | agency).
-- Do not apply from the agent. dynamic-styles still serves the built-in menu
-- when this column is missing.

ALTER TABLE public.saas_suite_users
  ADD COLUMN IF NOT EXISTS top_nav_widget_options jsonb;

COMMENT ON COLUMN public.saas_suite_users.top_nav_widget_options IS
  'Ordered Help & Support options. Null uses Help Library, Live Support, and Open a Ticket.';
