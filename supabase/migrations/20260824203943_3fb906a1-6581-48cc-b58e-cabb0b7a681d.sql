DO $$
DECLARE r record; old_id text := 'william-penn'; new_id text := 'customout-media';
BEGIN
  FOR r IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema='public' AND column_name='agency_id' AND table_name <> 'saas_suite_users'
  LOOP
    EXECUTE format('UPDATE public.%I SET agency_id = %L WHERE agency_id = %L', r.table_name, new_id, old_id);
  END LOOP;
  UPDATE public.saas_suite_users SET agency_id_basic = new_id WHERE agency_id_basic = old_id;
  UPDATE public.saas_suite_users SET original_agency_id_basic = new_id WHERE original_agency_id_basic = old_id;
END $$;