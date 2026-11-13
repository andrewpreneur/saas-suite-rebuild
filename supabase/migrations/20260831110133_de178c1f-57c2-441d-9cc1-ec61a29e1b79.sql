-- Audit log of agency id migrations
CREATE TABLE IF NOT EXISTS public.agency_id_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  old_agency_id text NOT NULL,
  new_agency_id text NOT NULL,
  user_email text,
  source text,
  moved jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.agency_id_migrations TO service_role;
ALTER TABLE public.agency_id_migrations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agency_id_migrations'
      AND policyname = 'Admins can view agency id migrations'
  ) THEN
    CREATE POLICY "Admins can view agency id migrations"
      ON public.agency_id_migrations
      FOR SELECT
      TO authenticated
      USING (lower(coalesce(public.current_auth_email(), '')) = 'andrew@dna-media.net');
  END IF;
END $$;

-- Core routine: repoint every agency-scoped row from old id to new id.
CREATE OR REPLACE FUNCTION public.migrate_agency_id(
  p_old_id text,
  p_new_id text,
  p_email text DEFAULT NULL,
  p_source text DEFAULT 'manual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec record;
  moved jsonb := '{}'::jsonb;
  n integer;
BEGIN
  IF p_old_id IS NULL OR p_new_id IS NULL THEN RETURN moved; END IF;
  IF btrim(p_old_id) = '' OR btrim(p_new_id) = '' THEN RETURN moved; END IF;
  IF p_old_id = p_new_id THEN RETURN moved; END IF;

  -- Don't clobber anything if the old id is still actively used by another account
  IF EXISTS (
    SELECT 1 FROM public.saas_suite_users u
    WHERE (p_email IS NULL OR lower(u.email) <> lower(p_email))
      AND p_old_id IN (u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite)
  ) THEN
    RETURN moved;
  END IF;

  FOR rec IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'agency_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('saas_suite_users', 'agency_id_migrations')
    ORDER BY c.table_name
  LOOP
    BEGIN
      EXECUTE format(
        'UPDATE public.%I SET agency_id = $1 WHERE agency_id = $2',
        rec.table_name
      ) USING p_new_id, p_old_id;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n > 0 THEN
        moved := moved || jsonb_build_object(rec.table_name, n);
      END IF;
    EXCEPTION WHEN unique_violation OR foreign_key_violation OR check_violation THEN
      -- New id already has its own record here; leave the old row in place.
      moved := moved || jsonb_build_object(rec.table_name, 'skipped_conflict');
    END;
  END LOOP;

  IF moved <> '{}'::jsonb THEN
    INSERT INTO public.agency_id_migrations (old_agency_id, new_agency_id, user_email, source, moved)
    VALUES (p_old_id, p_new_id, p_email, p_source, moved);
  END IF;

  RETURN moved;
END;
$$;

REVOKE ALL ON FUNCTION public.migrate_agency_id(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.migrate_agency_id(text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.migrate_agency_id(text, text, text, text) TO service_role;

-- Trigger: whenever any agency id column changes, carry the data over.
CREATE OR REPLACE FUNCTION public.carry_agency_data_on_id_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
    PERFORM public.migrate_agency_id(OLD.agency_id, NEW.agency_id, NEW.email, 'trigger:agency_id');
  END IF;

  IF NEW.agency_id_basic IS DISTINCT FROM OLD.agency_id_basic
     AND OLD.agency_id_basic IS DISTINCT FROM OLD.agency_id
     AND NEW.agency_id_basic IS DISTINCT FROM NEW.agency_id THEN
    PERFORM public.migrate_agency_id(OLD.agency_id_basic, NEW.agency_id_basic, NEW.email, 'trigger:agency_id_basic');
  END IF;

  IF NEW.agency_id_advanced IS DISTINCT FROM OLD.agency_id_advanced THEN
    PERFORM public.migrate_agency_id(OLD.agency_id_advanced, NEW.agency_id_advanced, NEW.email, 'trigger:agency_id_advanced');
  END IF;

  IF NEW.agency_id_elite IS DISTINCT FROM OLD.agency_id_elite THEN
    PERFORM public.migrate_agency_id(OLD.agency_id_elite, NEW.agency_id_elite, NEW.email, 'trigger:agency_id_elite');
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_carry_agency_data_on_id_change ON public.saas_suite_users;
CREATE TRIGGER trg_carry_agency_data_on_id_change
AFTER UPDATE OF agency_id, agency_id_basic, agency_id_advanced, agency_id_elite
ON public.saas_suite_users
FOR EACH ROW
EXECUTE FUNCTION public.carry_agency_data_on_id_change();