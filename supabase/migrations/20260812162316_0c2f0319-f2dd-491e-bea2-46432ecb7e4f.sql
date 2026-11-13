ALTER TABLE public.copilot_ai_paused
  ADD COLUMN IF NOT EXISTS paused_until timestamptz,
  ADD COLUMN IF NOT EXISTS source text;

COMMENT ON COLUMN public.copilot_ai_paused.paused_until IS 'When the AI pause expires. NULL = paused indefinitely (manual kill switch).';