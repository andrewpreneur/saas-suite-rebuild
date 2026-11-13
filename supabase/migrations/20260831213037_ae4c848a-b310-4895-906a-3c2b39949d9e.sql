CREATE OR REPLACE FUNCTION public.giveaway_recalculate_all()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT email FROM public.giveaway_entries LOOP
    BEGIN
      PERFORM public.giveaway_recalculate(r.email);
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'giveaway rescore failed for %: %', r.email, SQLERRM;
    END;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.giveaway_recalculate_all() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.giveaway_recalculate_all() TO service_role;

SELECT cron.unschedule('giveaway-rescore-10min') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'giveaway-rescore-10min');
SELECT cron.schedule('giveaway-rescore-10min', '*/10 * * * *', $$SELECT public.giveaway_recalculate_all();$$);