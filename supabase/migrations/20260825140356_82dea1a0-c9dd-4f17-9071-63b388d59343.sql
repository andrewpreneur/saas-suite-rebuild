SELECT cron.unschedule('send-pending-hub-welcome') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-pending-hub-welcome');

SELECT cron.schedule(
  'send-pending-hub-welcome',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://cjqeebyeqtzzqmmwvfga.supabase.co/functions/v1/send-pending-hub-welcome',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);