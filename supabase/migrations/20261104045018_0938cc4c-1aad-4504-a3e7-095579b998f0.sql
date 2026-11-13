ALTER FUNCTION public.set_customer_language(text,text) SECURITY INVOKER;
ALTER FUNCTION public.guard_customer_language() SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.guard_customer_language() FROM PUBLIC,anon,authenticated;
COMMENT ON FUNCTION public.get_customer_language(text) IS 'Intentionally public read-only Hub setting. Returns only a validated language code for a public agency ID; never returns account identity or customer data.';