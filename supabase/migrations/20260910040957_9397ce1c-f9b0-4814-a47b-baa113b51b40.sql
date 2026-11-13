INSERT INTO public.copilot_nudge_settings (owner_email, enabled, channels, frequency, tz_offset_minutes, work_hour_start, work_hour_end, preferred_dow)
VALUES ('andrew@dna-media.net', true, '["slack"]'::jsonb, 'weekly', -300, 9, 17, 1)
ON CONFLICT (owner_email) DO UPDATE SET enabled = true, updated_at = now();