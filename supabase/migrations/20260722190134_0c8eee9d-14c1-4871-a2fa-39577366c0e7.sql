
ALTER TABLE public.v2_home_settings ALTER COLUMN checklist_title SET DEFAULT 'Daily Checklist';
ALTER TABLE public.v2_home_settings ALTER COLUMN daily_checklist_enabled SET DEFAULT false;
UPDATE public.v2_home_settings SET checklist_title = 'Daily Checklist' WHERE checklist_title = 'Getting Started Checklist';
