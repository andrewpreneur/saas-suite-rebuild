DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT email FROM public.giveaway_entries LOOP
    PERFORM public.giveaway_recalculate(r.email);
  END LOOP;
END $$;

UPDATE public.giveaway_entries SET tickets = 0 WHERE tickets <> 0;