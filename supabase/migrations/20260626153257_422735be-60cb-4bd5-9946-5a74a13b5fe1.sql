ALTER TABLE public.saas_suite_users ALTER COLUMN show_v2_ui SET DEFAULT false;
UPDATE public.saas_suite_users SET show_v2_ui = false WHERE show_v2_ui IS DISTINCT FROM false;