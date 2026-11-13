-- lovable-cron-fallback-reviewed: 96 runs/day; practice requests must be released at randomised minute-level times across the day so trainees cannot predict them; hourly would make every request arrive on the hour.
select cron.schedule(
  'support-rep-dispatch-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/support-rep-dispatch',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);