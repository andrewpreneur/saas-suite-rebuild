REVOKE ALL ON FUNCTION public.giveaway_rescore_for_agency(text, interval) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.giveaway_event_rescore() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.giveaway_rescore_for_agency(text, interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.giveaway_event_rescore() TO service_role;