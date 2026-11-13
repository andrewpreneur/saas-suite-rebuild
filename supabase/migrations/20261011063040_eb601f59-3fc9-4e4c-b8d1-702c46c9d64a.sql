ALTER TABLE public.one_feature_training_leads
  ADD COLUMN IF NOT EXISTS selected_plan text,
  ADD COLUMN IF NOT EXISTS plan_selected_at timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_sent_at timestamptz;